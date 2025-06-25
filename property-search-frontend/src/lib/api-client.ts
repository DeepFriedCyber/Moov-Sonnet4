// Enhanced API Client with retry logic and error handling
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { z } from 'zod';
import { Property, SearchQuery, SearchResult, ApiResponse } from '@/types';

// Error class
export class ApiError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number,
        public readonly errors?: unknown[]
    ) {
        super(message);
        this.name = 'ApiError';
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}

// Schemas
const ApiClientConfigSchema = z.object({
    baseUrl: z.string().url(),
    timeout: z.number().positive(),
    authToken: z.string().optional(),
    retryAttempts: z.number().int().min(0).default(0),
    retryDelay: z.number().int().min(0).default(1000),
});

const ApiResponseSchema = z.object({
    status: z.enum(['success', 'error']),
    data: z.unknown().optional(),
    error: z.object({
        message: z.string(),
        code: z.string().optional(),
        details: z.unknown().optional(),
    }).optional(),
    meta: z.object({
        page: z.number().optional(),
        totalPages: z.number().optional(),
        totalItems: z.number().optional(),
        timestamp: z.string().optional(),
    }).optional(),
});

// Types
type ApiClientConfig = z.infer<typeof ApiClientConfigSchema>;

export interface SearchOptions extends Omit<SearchQuery, 'query'> {
    query: string;
}

export interface PropertySearchResult extends SearchResult {
    properties: (Property & { similarity_score?: number })[];
    searchTime: number;
}

// Constants
const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
};

const NETWORK_ERROR_MESSAGE = 'Network error';
const TIMEOUT_ERROR_MESSAGE = 'Request timeout';

// Main API Client
export class ApiClient {
    private readonly client: AxiosInstance;
    private readonly config: Required<ApiClientConfig>;

    constructor(config: ApiClientConfig) {
        this.config = ApiClientConfigSchema.parse(config);
        this.client = this.createAxiosInstance();
        this.setupInterceptors();
    }

    private createAxiosInstance(): AxiosInstance {
        const instance = axios.create({
            baseURL: this.config.baseUrl,
            timeout: this.config.timeout,
            headers: DEFAULT_HEADERS,
        });

        if (this.config.authToken) {
            instance.defaults.headers.common['Authorization'] = `Bearer ${this.config.authToken}`;
        }

        return instance;
    }

    private setupInterceptors(): void {
        this.client.interceptors.request.use(this.requestInterceptor);
        this.client.interceptors.response.use(
            (response) => response,
            this.errorInterceptor.bind(this)
        );
    }

    private requestInterceptor = (config: AxiosRequestConfig): AxiosRequestConfig => {
        config._retryCount = 0;
        return config;
    };

    private errorInterceptor = async (error: AxiosError): Promise<never> => {
        if (error.code === 'ECONNABORTED') {
            throw new Error(TIMEOUT_ERROR_MESSAGE);
        }

        if (!error.response) {
            throw new Error(NETWORK_ERROR_MESSAGE);
        }

        const shouldRetry = this.shouldRetryRequest(error);
        if (shouldRetry) {
            return this.retryRequest(error.config!);
        }

        throw this.createApiError(error);
    };

    private shouldRetryRequest(error: AxiosError): boolean {
        if (!error.response || !error.config) return false;

        const { status } = error.response;
        const retryCount = error.config._retryCount || 0;

        return (
            status >= 500 &&
            retryCount < this.config.retryAttempts
        );
    }

    private async retryRequest(config: AxiosRequestConfig): Promise<never> {
        config._retryCount = (config._retryCount || 0) + 1;

        await this.delay(this.config.retryDelay);

        return this.client.request(config) as any;
    }

    private createApiError(error: AxiosError<ApiResponse<unknown>>): ApiError {
        const response = error.response!;
        const data = response.data;

        return new ApiError(
            data?.error?.message || 'API Error',
            response.status,
            data?.error?.details
        );
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // API Methods
    async searchProperties(options: SearchOptions): Promise<PropertySearchResult> {
        const response = await this.client.post<ApiResponse<PropertySearchResult>>(
            '/api/properties/search',
            options
        );

        return this.extractData(response.data);
    }

    async getProperty(id: string): Promise<Property> {
        const response = await this.client.get<ApiResponse<Property>>(
            `/api/properties/${id}`
        );

        return this.extractData(response.data);
    }

    async createProperty(
        data: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<Property> {
        const response = await this.client.post<ApiResponse<Property>>(
            '/api/properties',
            data
        );

        return this.extractData(response.data);
    }

    async updateProperty(
        id: string,
        data: Partial<Omit<Property, 'id' | 'createdAt' | 'updatedAt'>>
    ): Promise<Property> {
        const response = await this.client.put<ApiResponse<Property>>(
            `/api/properties/${id}`,
            data
        );

        return this.extractData(response.data);
    }

    async deleteProperty(id: string): Promise<void> {
        await this.client.delete(`/api/properties/${id}`);
    }

    private extractData<T>(response: ApiResponse<T>): T {
        const validated = ApiResponseSchema.parse(response);

        if (validated.status === 'error' || !validated.data) {
            throw new ApiError(
                validated.error?.message || 'Request failed',
                500,
                validated.error?.details
            );
        }

        return validated.data as T;
    }

    // Utility method to update auth token
    setAuthToken(token: string | null): void {
        if (token) {
            this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            delete this.client.defaults.headers.common['Authorization'];
        }
    }

    // Health check endpoint
    async healthCheck(): Promise<{ status: string; timestamp: string }> {
        const response = await this.client.get<ApiResponse<{ status: string; timestamp: string }>>(
            '/api/health'
        );

        return this.extractData(response.data);
    }
}

// Extend Axios types
declare module 'axios' {
    export interface AxiosRequestConfig {
        _retryCount?: number;
    }
}

// Default client factory
export const createApiClient = (config: Partial<ApiClientConfig> = {}) => {
    const defaultConfig: ApiClientConfig = {
        baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
        timeout: 10000,
        retryAttempts: 3,
        retryDelay: 1000,
        ...config,
    };

    return new ApiClient(defaultConfig);
};