// Type definitions for Express Request extensions
declare namespace Express {
    interface Request {
        // Validated query parameters
        validatedQuery?: any;

        // Validated body data
        validatedBody?: any;

        // User information (for authentication)
        user?: {
            id: string;
            email: string;
            tier: 'anonymous' | 'authenticated' | 'premium';
        };

        // Additional context
        correlationId?: string;
        startTime?: number;
    }
}