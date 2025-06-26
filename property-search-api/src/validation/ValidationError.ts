export class ValidationError extends Error {
    public readonly details: string[];
    public readonly statusCode: number;

    constructor(message: string, details: string[] = []) {
        super(message);
        this.name = 'ValidationError';
        this.details = details;
        this.statusCode = 400;
    }

    toJSON() {
        return {
            error: this.message,
            details: this.details,
            statusCode: this.statusCode,
            timestamp: new Date().toISOString()
        };
    }
}