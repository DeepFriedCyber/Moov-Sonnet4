import { Router } from 'express';
import { z } from 'zod';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const chatMessageSchema = z.object({
    sessionId: z.string().min(1),
    message: z.string().min(1),
    userId: z.string().optional(),
});

const chatSessionSchema = z.object({
    userId: z.string().optional(),
    sessionName: z.string().optional(),
});

// Create a new chat session
router.post('/sessions', async (req, res): Promise<void> => {
    try {
        const { userId, sessionName } = chatSessionSchema.parse(req.body);
        const db = getDatabase();

        const result = await db.query(
            `INSERT INTO chat_sessions (user_id, session_name, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING id, user_id, session_name, created_at, updated_at`,
            [userId || null, sessionName || 'New Chat']
        );

        const session = result.rows[0];

        logger.info(`Chat session created: ${session.id}`);

        res.status(201).json({
            success: true,
            message: 'Chat session created',
            session: {
                id: session.id,
                userId: session.user_id,
                sessionName: session.session_name,
                createdAt: session.created_at,
                updatedAt: session.updated_at
            }
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: error.errors
            });
            return;
        }

        logger.error('Chat session creation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create chat session'
        });
    }
});

// Get chat sessions for a user
router.get('/sessions', async (req, res) => {
    try {
        const userId = req.query.userId as string;
        const db = getDatabase();

        let query = `
      SELECT 
        s.id, s.user_id, s.session_name, s.created_at, s.updated_at,
        COUNT(m.id) as message_count,
        MAX(m.created_at) as last_message_at
      FROM chat_sessions s
      LEFT JOIN chat_messages m ON s.id = m.session_id
    `;

        const params: any[] = [];

        if (userId) {
            query += ' WHERE s.user_id = $1';
            params.push(userId);
        } else {
            query += ' WHERE s.user_id IS NULL';
        }

        query += `
      GROUP BY s.id, s.user_id, s.session_name, s.created_at, s.updated_at
      ORDER BY COALESCE(MAX(m.created_at), s.created_at) DESC
    `;

        const result = await db.query(query, params);

        const sessions = result.rows.map(session => ({
            id: session.id,
            userId: session.user_id,
            sessionName: session.session_name,
            messageCount: parseInt(session.message_count),
            createdAt: session.created_at,
            updatedAt: session.updated_at,
            lastMessageAt: session.last_message_at
        }));

        res.json({
            success: true,
            data: sessions
        });

    } catch (error) {
        logger.error('Chat sessions fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch chat sessions'
        });
    }
});

// Send a message in a chat session
router.post('/messages', async (req, res): Promise<void> => {
    try {
        const { sessionId, message } = chatMessageSchema.parse(req.body);
        const db = getDatabase();

        // Verify session exists
        const sessionResult = await db.query(
            'SELECT id FROM chat_sessions WHERE id = $1',
            [sessionId]
        );

        if (sessionResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                error: 'Chat session not found'
            });
            return;
        }

        // Save user message
        const userMessageResult = await db.query(
            `INSERT INTO chat_messages (session_id, sender_type, message, created_at)
       VALUES ($1, 'user', $2, NOW())
       RETURNING id, session_id, sender_type, message, created_at`,
            [sessionId, message]
        );

        const userMessage = userMessageResult.rows[0];

        // Generate AI response (simplified for now)
        const aiResponse = await generateAIResponse(message);

        // Save AI response
        const aiMessageResult = await db.query(
            `INSERT INTO chat_messages (session_id, sender_type, message, created_at)
       VALUES ($1, 'assistant', $2, NOW())
       RETURNING id, session_id, sender_type, message, created_at`,
            [sessionId, aiResponse]
        );

        const aiMessage = aiMessageResult.rows[0];

        // Update session timestamp
        await db.query(
            'UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1',
            [sessionId]
        );

        logger.info(`Chat message processed for session: ${sessionId}`);

        res.json({
            success: true,
            messages: [
                {
                    id: userMessage.id,
                    sessionId: userMessage.session_id,
                    senderType: userMessage.sender_type,
                    message: userMessage.message,
                    createdAt: userMessage.created_at
                },
                {
                    id: aiMessage.id,
                    sessionId: aiMessage.session_id,
                    senderType: aiMessage.sender_type,
                    message: aiMessage.message,
                    createdAt: aiMessage.created_at
                }
            ]
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: error.errors
            });
            return;
        }

        logger.error('Chat message error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process chat message'
        });
    }
});

// Get messages for a chat session
router.get('/sessions/:sessionId/messages', async (req, res): Promise<void> => {
    try {
        const sessionId = req.params.sessionId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;

        const db = getDatabase();

        // Verify session exists
        const sessionResult = await db.query(
            'SELECT id FROM chat_sessions WHERE id = $1',
            [sessionId]
        );

        if (sessionResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                error: 'Chat session not found'
            });
            return;
        }

        // Get total message count
        const countResult = await db.query(
            'SELECT COUNT(*) as total FROM chat_messages WHERE session_id = $1',
            [sessionId]
        );

        const total = parseInt(countResult.rows[0].total);

        // Get paginated messages
        const offset = (page - 1) * limit;
        const messagesResult = await db.query(
            `SELECT id, session_id, sender_type, message, created_at
       FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
            [sessionId, limit, offset]
        );

        const messages = messagesResult.rows.map(message => ({
            id: message.id,
            sessionId: message.session_id,
            senderType: message.sender_type,
            message: message.message,
            createdAt: message.created_at
        }));

        res.json({
            success: true,
            data: messages,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        logger.error('Chat messages fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch chat messages'
        });
    }
});

// Delete a chat session
router.delete('/sessions/:sessionId', async (req, res): Promise<void> => {
    try {
        const sessionId = req.params.sessionId;
        const db = getDatabase();

        // Delete messages first (foreign key constraint)
        await db.query(
            'DELETE FROM chat_messages WHERE session_id = $1',
            [sessionId]
        );

        // Delete session
        const result = await db.query(
            'DELETE FROM chat_sessions WHERE id = $1 RETURNING id',
            [sessionId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                error: 'Chat session not found'
            });
            return;
        }

        logger.info(`Chat session deleted: ${sessionId}`);

        res.json({
            success: true,
            message: 'Chat session deleted successfully'
        });

    } catch (error) {
        logger.error('Chat session deletion error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete chat session'
        });
    }
});

// Helper function to generate AI responses (simplified)
async function generateAIResponse(userMessage: string): Promise<string> {
    // This is a simplified AI response generator
    // In a real implementation, you would integrate with an LLM API

    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
        return "Hello! I'm here to help you find the perfect property. What kind of home are you looking for?";
    }

    if (lowerMessage.includes('search') || lowerMessage.includes('find')) {
        return "I can help you search for properties! You can tell me about your preferences like location, budget, number of bedrooms, or property type. What would you like to search for?";
    }

    if (lowerMessage.includes('price') || lowerMessage.includes('budget')) {
        return "I can help you find properties within your budget. What's your price range? You can also filter by location and other features.";
    }

    if (lowerMessage.includes('bedroom') || lowerMessage.includes('bed')) {
        return "How many bedrooms are you looking for? I can search for properties with specific bedroom counts in your preferred location.";
    }

    if (lowerMessage.includes('location') || lowerMessage.includes('area') || lowerMessage.includes('city')) {
        return "Which area or city are you interested in? I can search for properties in specific locations and show you what's available.";
    }

    // Default response
    return "I'm here to help you find properties! You can ask me about searching for homes, filtering by price, location, bedrooms, or any other property features. What would you like to know?";
}

export default router;