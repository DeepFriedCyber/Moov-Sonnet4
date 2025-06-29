// TDD-Driven API Error Handling and Retry Logic
export class ApiError extends Error {
  public status: number;
  public code: string;
  public data?: any;

  constructor(message: string, status: number, code: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      data: this.data
    };
  }
}

export class NetworkError extends ApiError {
  public isRetryable = true;

  constructor(message: string) {
    super(message, 0, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

export class ValidationError extends ApiError {
  public fields: Record<string, string>;
  public isRetryable = false;

  constructor(message: string, fields: Record<string, string>) {
    super(message, 422, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

export class RateLimitError extends ApiError {
  public retryAfter: number;
  public isRetryable = true;

  constructor(message: string, retryAfter: number) {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

// Retry configuration interface
export interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  jitter?: boolean;
  retryCondition?: (error: Error) => boolean;
}

// Error handler configuration
export interface ErrorHandlerConfig extends RetryConfig {
  onError?: (error: Error) => void;
  errorTransformer?: (error: Error) => Error;
}

/**
 * Determines if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  // Check if error has explicit retryable flag
  if ('isRetryable' in error) {
    return (error as any).isRetryable;
  }

  // Network errors are generally retryable
  if (error instanceof NetworkError) {
    return true;
  }

  // API errors - check status codes
  if (error instanceof ApiError) {
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    return retryableStatuses.includes(error.status);
  }

  // Generic network/connection errors
  if (error.message.toLowerCase().includes('network') ||
      error.message.toLowerCase().includes('connection') ||
      error.message.toLowerCase().includes('timeout')) {
    return true;
  }

  return false;
}

/**
 * Retry an operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    jitter = false,
    retryCondition = isRetryableError
  } = config;

  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on last attempt or non-retryable errors
      if (attempt === maxRetries || !retryCondition(lastError)) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      let delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      
      // Add jitter to prevent thundering herd
      if (jitter) {
        delay += Math.random() * delay;
      }

      // Special handling for rate limit errors
      if (lastError instanceof RateLimitError) {
        delay = lastError.retryAfter * 1000; // Convert to milliseconds
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Handle API response and convert to appropriate errors
 */
export async function handleApiResponse(response: Response): Promise<any> {
  if (response.ok) {
    return await response.json();
  }

  let errorData: any = {};
  try {
    errorData = await response.json();
  } catch {
    // Response doesn't have JSON body
    errorData = { error: response.statusText };
  }

  const message = errorData.error || errorData.message || response.statusText;
  const code = errorData.code || `HTTP_${response.status}`;

  // Handle specific error types
  switch (response.status) {
    case 422:
      throw new ValidationError(message, errorData.fields || {});
    
    case 429:
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      throw new RateLimitError(message, retryAfter);
    
    default:
      throw new ApiError(message, response.status, code, errorData);
  }
}

/**
 * Create an error handler with retry logic
 */
export function createApiErrorHandler(config: ErrorHandlerConfig = {}) {
  return async function handleApiCall<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await retryWithBackoff(operation, config);
    } catch (error) {
      // Call error callback if provided
      if (config.onError) {
        config.onError(error as Error);
      }

      // Transform error if transformer provided
      if (config.errorTransformer) {
        throw config.errorTransformer(error as Error);
      }

      throw error;
    }
  };
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ValidationError) {
    const fieldErrors = Object.values(error.fields).join(', ');
    return `Validation failed: ${fieldErrors}`;
  }

  if (error instanceof RateLimitError) {
    return `Too many requests. Please try again in ${error.retryAfter} seconds.`;
  }

  if (error instanceof NetworkError) {
    return 'Connection failed. Please check your internet connection and try again.';
  }

  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return 'Invalid request. Please check your input and try again.';
      case 401:
        return 'Authentication required. Please log in and try again.';
      case 403:
        return 'Access denied. You don\'t have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 500:
        return 'Server error. Please try again later.';
      case 503:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return error.message || 'An error occurred while processing your request.';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Enhanced fetch wrapper with error handling and retries
 */
export async function fetchWithRetry(
  url: string, 
  options: RequestInit = {},
  retryConfig: RetryConfig = {}
): Promise<any> {
  const handler = createApiErrorHandler(retryConfig);
  
  return handler(async () => {
    try {
      const response = await fetch(url, options);
      return await handleApiResponse(response);
    } catch (error) {
      // Convert fetch errors to NetworkError
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('Network request failed');
      }
      throw error;
    }
  });
}

/**
 * Create a typed API client with error handling
 */
export function createApiClient(baseUrl: string, defaultConfig: ErrorHandlerConfig = {}) {
  const handler = createApiErrorHandler(defaultConfig);

  return {
    async get<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
      return handler(async () => {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          ...options
        });
        return handleApiResponse(response);
      });
    },

    async post<T>(endpoint: string, data?: any, options: RequestInit = {}): Promise<T> {
      return handler(async () => {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          },
          body: data ? JSON.stringify(data) : undefined,
          ...options
        });
        return handleApiResponse(response);
      });
    },

    async put<T>(endpoint: string, data?: any, options: RequestInit = {}): Promise<T> {
      return handler(async () => {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          },
          body: data ? JSON.stringify(data) : undefined,
          ...options
        });
        return handleApiResponse(response);
      });
    },

    async delete<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
      return handler(async () => {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'DELETE',
          ...options
        });
        return handleApiResponse(response);
      });
    }
  };
}

/**
 * Utility to check if error is a specific type
 */
export function isErrorType<T extends Error>(
  error: unknown, 
  errorClass: new (...args: any[]) => T
): error is T {
  return error instanceof errorClass;
}

/**
 * Utility to extract error details for logging
 */
export function getErrorDetails(error: unknown): Record<string, any> {
  if (error instanceof ApiError) {
    return {
      type: error.name,
      message: error.message,
      status: error.status,
      code: error.code,
      data: error.data
    };
  }

  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    type: 'Unknown',
    value: error
  };
}

/**
 * Circuit breaker pattern for API calls
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.timeout) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}