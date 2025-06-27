import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';
import { validateUserRegistration, validateUserLogin } from '../validation/userAuthValidation';

const router = Router();

// Register endpoint with comprehensive validation
router.post('/register', async (req, res): Promise<void> => {
    try {
        // Validate registration data using our comprehensive validation
        const validationResult = validateUserRegistration(req.body);

        if (!validationResult.success) {
            res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validationResult.error.issues.map(issue =>
                    `${issue.path.join('.')}: ${issue.message}`
                )
            });
            return;
        }

        const userData = validationResult.data;

        const db = getDatabase();

        // Check if user already exists
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [userData.email]
        );

        if (existingUser.rows.length > 0) {
            res.status(409).json({
                success: false,
                error: 'User already exists with this email'
            });
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 12);

        // Create user with all validated fields
        const result = await db.query(
            `INSERT INTO users (
                email, password_hash, first_name, last_name, phone,
                marketing_opt_in, date_of_birth, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) 
            RETURNING id, email, first_name, last_name, phone, created_at`,
            [
                userData.email,
                hashedPassword,
                userData.firstName,
                userData.lastName,
                userData.phone,
                userData.marketingOptIn,
                userData.dateOfBirth || null
            ]
        );

        const user = result.rows[0];

        // Generate JWT token
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET is not configured');
        }

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                tier: 'authenticated' // New users start as authenticated tier
            },
            jwtSecret,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
        );

        logger.info(`User registered: ${userData.email}`);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                createdAt: user.created_at
            },
            token
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

        logger.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Registration failed'
        });
    }
});

// Login endpoint with comprehensive validation
router.post('/login', async (req, res): Promise<void> => {
    try {
        // Validate login data using our comprehensive validation
        const validationResult = validateUserLogin(req.body);

        if (!validationResult.success) {
            res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validationResult.error.issues.map(issue =>
                    `${issue.path.join('.')}: ${issue.message}`
                )
            });
            return;
        }

        const loginData = validationResult.data;

        const db = getDatabase();

        // Find user
        const result = await db.query(
            `SELECT id, email, password_hash, first_name, last_name, phone, 
                    is_premium, created_at FROM users WHERE email = $1`,
            [loginData.email]
        );

        if (result.rows.length === 0) {
            res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
            return;
        }

        const user = result.rows[0];

        // Check password
        const isValidPassword = await bcrypt.compare(loginData.password, user.password_hash);

        if (!isValidPassword) {
            res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
            return;
        }

        // Generate JWT token with user tier information
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET is not configured');
        }

        const tokenPayload = {
            userId: user.id,
            email: user.email,
            tier: user.is_premium ? 'premium' : 'authenticated'
        };

        const tokenOptions: any = { expiresIn: process.env.JWT_EXPIRES_IN || '7d' };
        if (loginData.rememberMe) {
            tokenOptions.expiresIn = '30d';
        }

        const token = jwt.sign(tokenPayload, jwtSecret, tokenOptions);

        // Update last login
        await db.query(
            'UPDATE users SET last_login = NOW() WHERE id = $1',
            [user.id]
        );

        logger.info(`User logged in: ${loginData.email}`);

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
            },
            token
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

        logger.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
});

// Get current user profile
router.get('/profile', async (req, res): Promise<void> => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            res.status(401).json({
                success: false,
                error: 'No token provided'
            });
            return;
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET is not configured');
        }

        const decoded = jwt.verify(token, jwtSecret) as any;
        const db = getDatabase();

        const result = await db.query(
            'SELECT id, email, first_name, last_name, created_at FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }

        const user = result.rows[0];

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                createdAt: user.created_at
            }
        });

    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
            return;
        }

        logger.error('Profile fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch profile'
        });
    }
});

export default router;