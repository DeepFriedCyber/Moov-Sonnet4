import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../validation/ValidationError';
// Import type declarations to ensure they're loaded
import '../types/express';

// Generic validation middleware with proper TypeScript support
export const createValidationMiddleware = <T extends z.ZodType>(
    schema: T,
    source: 'body' | 'query' | 'params' = 'body'
) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const data = req[source];
            const validatedData = schema.parse(data);

            // Store validated data in appropriate property
            if (source === 'body') {
                (req as any).validatedBody = validatedData;
            } else if (source === 'query') {
                (req as any).validatedQuery = validatedData;
            } else if (source === 'params') {
                // For params, we can safely assign since it's usually just string keys
                req.params = validatedData as any;
            }

            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                const validationError = new ValidationError(
                    'Validation failed',
                    error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
                );
                res.status(400).json(validationError.toJSON());
            } else {
                next(error);
            }
        }
    };
};

// Type-safe helper to get validated data
export const getValidatedQuery = <T>(req: Request): T => {
    const validatedQuery = (req as any).validatedQuery;
    if (!validatedQuery) {
        throw new Error('Query parameters not validated. Make sure to use validation middleware.');
    }
    return validatedQuery as T;
};

export const getValidatedBody = <T>(req: Request): T => {
    const validatedBody = (req as any).validatedBody;
    if (!validatedBody) {
        throw new Error('Body not validated. Make sure to use validation middleware.');
    }
    return validatedBody as T;
};