// Custom error classes for database operations

export class DatabaseError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly details?: any
    ) {
        super(message);
        this.name = 'DatabaseError';
    }
}

export class ConnectionError extends DatabaseError {
    constructor(message: string, details?: any) {
        super(message, 'CONNECTION_ERROR', details);
        this.name = 'ConnectionError';
    }
}

export class ValidationError extends DatabaseError {
    constructor(message: string, public readonly validationErrors?: any[]) {
        super(message, 'VALIDATION_ERROR', validationErrors);
        this.name = 'ValidationError';
    }
}

export class NotFoundError extends DatabaseError {
    constructor(resource: string, id: string) {
        super(`${resource} with id '${id}' not found`, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}

export class QueryError extends DatabaseError {
    constructor(message: string, public readonly query?: string, details?: any) {
        super(message, 'QUERY_ERROR', details);
        this.name = 'QueryError';
    }
}

export class TransactionError extends DatabaseError {
    constructor(message: string, details?: any) {
        super(message, 'TRANSACTION_ERROR', details);
        this.name = 'TransactionError';
    }
}