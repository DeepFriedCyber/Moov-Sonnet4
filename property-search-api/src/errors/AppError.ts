export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly type: string;

    constructor(
        message: string,
        statusCode: number = 500,
        isOperational: boolean = true
    ) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.type = this.constructor.name;

        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            message: this.message,
            type: this.type,
            statusCode: this.statusCode,
            isOperational: this.isOperational
        };
    }
}

export class ValidationError extends AppError {
    public readonly details: string[];

    constructor(message: string, details: string[] = []) {
        super(message, 400);
        this.details = details;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            details: this.details
        };
    }
}

export class DatabaseError extends AppError {
    public readonly code: string;
    public readonly retryAfter?: number;

    constructor(message: string, code: string, retryAfter?: number) {
        super(message, 503);
        this.code = code;
        this.retryAfter = retryAfter;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            code: this.code,
            ...(this.retryAfter && { retryAfter: this.retryAfter })
        };
    }
}

export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication required') {
        super(message, 401);
    }
}

export class AuthorizationError extends AppError {
    constructor(message: string = 'Insufficient permissions') {
        super(message, 403);
    }
}

export class RateLimitError extends AppError {
    public readonly retryAfter: number;
    public readonly limit: number;

    constructor(message: string, retryAfter: number, limit: number) {
        super(message, 429);
        this.retryAfter = retryAfter;
        this.limit = limit;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            retryAfter: this.retryAfter,
            limit: this.limit
        };
    }
}