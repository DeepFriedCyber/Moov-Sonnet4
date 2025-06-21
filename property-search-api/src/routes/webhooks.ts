import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Stripe webhook signature verification middleware
const verifyStripeSignature = (req: any, res: any, next: any) => {
    const signature = req.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        logger.error('Stripe webhook secret not configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    try {
        const elements = signature.split(',');
        const signatureElements = elements.reduce((acc: any, element: string) => {
            const [key, value] = element.split('=');
            acc[key] = value;
            return acc;
        }, {});

        const payload = req.body;
        const computedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(payload, 'utf8')
            .digest('hex');

        if (computedSignature !== signatureElements.v1) {
            logger.error('Invalid Stripe webhook signature');
            return res.status(400).json({ error: 'Invalid signature' });
        }

        next();
    } catch (error) {
        logger.error('Stripe signature verification failed:', error);
        return res.status(400).json({ error: 'Signature verification failed' });
    }
};

// Stripe webhook endpoint
router.post('/stripe', verifyStripeSignature, async (req, res) => {
    try {
        const event = JSON.parse(req.body);
        const db = getDatabase();

        logger.info(`Received Stripe webhook: ${event.type}`);

        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(db, event.data.object);
                break;

            case 'customer.subscription.created':
                await handleSubscriptionCreated(db, event.data.object);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(db, event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionCanceled(db, event.data.object);
                break;

            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(db, event.data.object);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(db, event.data.object);
                break;

            default:
                logger.info(`Unhandled Stripe webhook event: ${event.type}`);
        }

        res.json({ received: true });

    } catch (error) {
        logger.error('Stripe webhook processing error:', error);
        res.status(400).json({
            success: false,
            error: 'Webhook processing failed'
        });
    }
});

// WhatsApp webhook for receiving messages
router.post('/whatsapp', async (req, res) => {
    try {
        const { entry } = req.body;

        if (!entry || !entry[0]) {
            return res.status(400).json({ error: 'Invalid webhook payload' });
        }

        const changes = entry[0].changes;
        if (!changes || !changes[0]) {
            return res.status(400).json({ error: 'No changes in webhook payload' });
        }

        const change = changes[0];
        if (change.field !== 'messages') {
            return res.json({ success: true });
        }

        const { messages, contacts } = change.value;

        if (messages && messages.length > 0) {
            for (const message of messages) {
                await processWhatsAppMessage(message, contacts);
            }
        }

        return res.json({ success: true });

    } catch (error) {
        logger.error('WhatsApp webhook error:', error);
        return res.status(500).json({
            success: false,
            error: 'WhatsApp webhook processing failed'
        });
    }
});

// WhatsApp webhook verification
router.get('/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'your_verify_token';

    if (mode === 'subscribe' && token === verifyToken) {
        logger.info('WhatsApp webhook verified successfully');
        res.status(200).send(challenge);
    } else {
        logger.error('WhatsApp webhook verification failed');
        res.status(403).json({ error: 'Verification failed' });
    }
});

// Generic webhook endpoint for other services
router.post('/generic/:service', async (req, res) => {
    try {
        const service = req.params.service;
        const payload = req.body;

        logger.info(`Received webhook from ${service}:`, payload);

        // Store webhook for processing
        const db = getDatabase();
        await db.query(
            `INSERT INTO webhook_logs (service, payload, received_at, processed)
       VALUES ($1, $2, NOW(), false)`,
            [service, JSON.stringify(payload)]
        );

        res.json({
            success: true,
            message: `Webhook from ${service} received and logged`
        });

    } catch (error) {
        logger.error('Generic webhook error:', error);
        res.status(500).json({
            success: false,
            error: 'Webhook processing failed'
        });
    }
});

// Helper functions for Stripe webhook processing
async function handleCheckoutCompleted(db: any, session: any) {
    try {
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (subscriptionId) {
            await db.query(
                `UPDATE user_subscriptions 
         SET stripe_subscription_id = $1, status = 'active', updated_at = NOW()
         WHERE stripe_customer_id = $2`,
                [subscriptionId, customerId]
            );

            logger.info(`Checkout completed for customer: ${customerId}`);
        }
    } catch (error) {
        logger.error('Error handling checkout completion:', error);
    }
}

async function handleSubscriptionCreated(db: any, subscription: any) {
    try {
        const customerId = subscription.customer;
        const subscriptionId = subscription.id;

        await db.query(
            `INSERT INTO user_subscriptions (stripe_customer_id, stripe_subscription_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (stripe_customer_id) 
       DO UPDATE SET stripe_subscription_id = $2, status = $3, updated_at = NOW()`,
            [customerId, subscriptionId, subscription.status]
        );

        logger.info(`Subscription created: ${subscriptionId}`);
    } catch (error) {
        logger.error('Error handling subscription creation:', error);
    }
}

async function handleSubscriptionUpdated(db: any, subscription: any) {
    try {
        const subscriptionId = subscription.id;

        await db.query(
            `UPDATE user_subscriptions 
       SET status = $1, updated_at = NOW()
       WHERE stripe_subscription_id = $2`,
            [subscription.status, subscriptionId]
        );

        logger.info(`Subscription updated: ${subscriptionId}`);
    } catch (error) {
        logger.error('Error handling subscription update:', error);
    }
}

async function handleSubscriptionCanceled(db: any, subscription: any) {
    try {
        const subscriptionId = subscription.id;

        await db.query(
            `UPDATE user_subscriptions 
       SET status = 'canceled', updated_at = NOW()
       WHERE stripe_subscription_id = $1`,
            [subscriptionId]
        );

        logger.info(`Subscription canceled: ${subscriptionId}`);
    } catch (error) {
        logger.error('Error handling subscription cancellation:', error);
    }
}

async function handlePaymentSucceeded(db: any, invoice: any) {
    try {
        const subscriptionId = invoice.subscription;

        if (subscriptionId) {
            await db.query(
                `UPDATE user_subscriptions 
         SET status = 'active', updated_at = NOW()
         WHERE stripe_subscription_id = $1`,
                [subscriptionId]
            );

            logger.info(`Payment succeeded for subscription: ${subscriptionId}`);
        }
    } catch (error) {
        logger.error('Error handling payment success:', error);
    }
}

async function handlePaymentFailed(db: any, invoice: any) {
    try {
        const subscriptionId = invoice.subscription;

        if (subscriptionId) {
            await db.query(
                `UPDATE user_subscriptions 
         SET status = 'past_due', updated_at = NOW()
         WHERE stripe_subscription_id = $1`,
                [subscriptionId]
            );

            logger.info(`Payment failed for subscription: ${subscriptionId}`);
        }
    } catch (error) {
        logger.error('Error handling payment failure:', error);
    }
}

async function processWhatsAppMessage(message: any, contacts: any[]) {
    try {
        const from = message.from;
        const messageType = message.type;
        let messageText = '';

        // Extract message text based on type
        switch (messageType) {
            case 'text':
                messageText = message.text.body;
                break;
            case 'interactive':
                messageText = message.interactive.button_reply?.title ||
                    message.interactive.list_reply?.title || '';
                break;
            default:
                messageText = `[${messageType} message]`;
        }

        logger.info(`WhatsApp message from ${from}: ${messageText}`);

        // Here you would typically:
        // 1. Store the message in your database
        // 2. Process the message (maybe with AI)
        // 3. Send a response back to WhatsApp

        // Simple auto-response example
        const response = generateAutoResponse(messageText);
        if (response) {
            await sendWhatsAppMessage(from, response);
        }

    } catch (error) {
        logger.error('Error processing WhatsApp message:', error);
    }
}

function generateAutoResponse(message: string): string | null {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
        return "Hello! Welcome to PropertySearch. How can I help you find your perfect home today?";
    }

    if (lowerMessage.includes('search') || lowerMessage.includes('property')) {
        return "I can help you search for properties! Please visit our website or tell me what you're looking for (location, budget, bedrooms, etc.)";
    }

    return "Thanks for your message! For property searches, please visit our website or describe what kind of home you're looking for.";
}

async function sendWhatsAppMessage(to: string, message: string) {
    // This would implement the actual WhatsApp Business API call
    // For now, just log the response
    logger.info(`Would send WhatsApp message to ${to}: ${message}`);
}

export default router;