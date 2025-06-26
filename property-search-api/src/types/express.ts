import { Request } from 'express';
import { PropertySearchParams } from '../validation/propertySearchValidation';

// Extend Express Request to include validated query types
export interface ValidatedRequest<T = any> extends Omit<Request, 'query'> {
    query: T;
}

// Specific type for property search requests
export interface PropertySearchRequest extends ValidatedRequest<PropertySearchParams> { }