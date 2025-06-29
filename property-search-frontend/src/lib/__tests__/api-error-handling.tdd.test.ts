// TDD Tests for Advanced API Error Handling and Retry Logic
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  ApiError, 
  NetworkError, 
  ValidationError, 
  RateLimitError,
  createApiErrorHandler,
  retryWithBackoff,
  isRetryableError,
  getErrorMessage,
  handleApiResponse
} from '../api-error-handling';

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Error Handling - TDD Implementation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Error Classes', () => {
    describe('ApiError', () => {
      it('should create ApiError with correct properties', () => {
        const error = new ApiError('Test error', 500, 'INTERNAL_ERROR');
        
        expect(error.message).toBe('Test error');
        expect(error.status).toBe(500);
        expect(error.code).toBe('INTERNAL_ERROR');
        expect(error.name).toBe('ApiError');
        expect(error instanceof Error).toBe(true);
      });

      it('should include response data when provided', () => {
        const responseData = { details: 'Server overloaded' };
        const error = new ApiError('Server error', 500, 'INTERNAL_ERROR', responseData);
        
        expect(error.data).toEqual(responseData);
      });

      it('should be serializable', () => {
        const error = new ApiError('Test error', 404, 'NOT_FOUND');
        const serialized = JSON.stringify(error);
        const parsed = JSON.parse(serialized);
        
        expect(parsed.message).toBe('Test error');
        expect(parsed.status).toBe(404);
        expect(parsed.code).toBe('NOT_FOUND');
      });
    });

    describe('NetworkError', () => {
      it('should create NetworkError for connection issues', () => {
        const error = new NetworkError('Connection failed');
        
        expect(error.message).toBe('Connection failed');
        expect(error.name).toBe('NetworkError');
        expect(error.isRetryable).toBe(true);
      });

      it('should extend ApiError', () => {
        const error = new NetworkError('Network issue');
        
        expect(error instanceof ApiError).toBe(true);
        expect(error instanceof NetworkError).toBe(true);
      });
    });

    describe('ValidationError', () => {
      it('should create ValidationError with field details', () => {
        const fields = { email: 'Invalid email format', age: 'Must be a number' };
        const error = new ValidationError('Validation failed', fields);
        
        expect(error.message).toBe('Validation failed');
        expect(error.fields).toEqual(fields);
        expect(error.isRetryable).toBe(false);
      });
    });

    describe('RateLimitError', () => {
      it('should create RateLimitError with retry info', () => {
        const retryAfter = 60;
        const error = new RateLimitError('Rate limit exceeded', retryAfter);
        
        expect(error.message).toBe('Rate limit exceeded');
        expect(error.retryAfter).toBe(60);
        expect(error.isRetryable).toBe(true);
      });
    });
  });

  describe('Error Detection', () => {
    describe('isRetryableError', () => {
      it('should identify retryable network errors', () => {
        const networkError = new NetworkError('Connection timeout');
        expect(isRetryableError(networkError)).toBe(true);
      });

      it('should identify retryable HTTP status codes', () => {
        const serverError = new ApiError('Server error', 500, 'INTERNAL_ERROR');
        const serviceUnavailable = new ApiError('Service unavailable', 503, 'SERVICE_UNAVAILABLE');
        const timeout = new ApiError('Timeout', 408, 'TIMEOUT');
        
        expect(isRetryableError(serverError)).toBe(true);
        expect(isRetryableError(serviceUnavailable)).toBe(true);
        expect(isRetryableError(timeout)).toBe(true);
      });

      it('should identify non-retryable errors', () => {
        const notFound = new ApiError('Not found', 404, 'NOT_FOUND');
        const unauthorized = new ApiError('Unauthorized', 401, 'UNAUTHORIZED');
        const validationError = new ValidationError('Invalid data', {});
        
        expect(isRetryableError(notFound)).toBe(false);
        expect(isRetryableError(unauthorized)).toBe(false);
        expect(isRetryableError(validationError)).toBe(false);
      });

      it('should handle rate limit errors specially', () => {
        const rateLimitError = new RateLimitError('Too many requests', 60);
        expect(isRetryableError(rateLimitError)).toBe(true);
      });
    });
  });

  describe('Retry Logic', () => {
    describe('retryWithBackoff', () => {
      it('should succeed on first attempt when operation succeeds', async () => {
        const successfulOperation = vi.fn().mockResolvedValue('success');
        
        const result = await retryWithBackoff(successfulOperation);
        
        expect(result).toBe('success');
        expect(successfulOperation).toHaveBeenCalledTimes(1);
      });

      it('should retry on retryable errors', async () => {
        const failingOperation = vi.fn()
          .mockRejectedValueOnce(new NetworkError('Connection failed'))
          .mockRejectedValueOnce(new ApiError('Server error', 500, 'INTERNAL_ERROR'))
          .mockResolvedValue('success');
        
        const promise = retryWithBackoff(failingOperation, { maxRetries: 3 });
        
        // Fast-forward through retry delays
        await vi.runAllTimersAsync();
        
        const result = await promise;
        
        expect(result).toBe('success');
        expect(failingOperation).toHaveBeenCalledTimes(3);
      });

      it('should not retry on non-retryable errors', async () => {
        const failingOperation = vi.fn()
          .mockRejectedValue(new ApiError('Not found', 404, 'NOT_FOUND'));
        
        await expect(retryWithBackoff(failingOperation)).rejects.toThrow('Not found');
        expect(failingOperation).toHaveBeenCalledTimes(1);
      });

      it('should respect maxRetries limit', async () => {
        const failingOperation = vi.fn()
          .mockRejectedValue(new NetworkError('Connection failed'));
        
        const promise = retryWithBackoff(failingOperation, { maxRetries: 2 });
        
        // Fast-forward through all retry attempts
        await vi.runAllTimersAsync();
        
        await expect(promise).rejects.toThrow('Connection failed');
        expect(failingOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
      });

      it('should use exponential backoff', async () => {
        const failingOperation = vi.fn()
          .mockRejectedValue(new NetworkError('Connection failed'));
        
        const promise = retryWithBackoff(failingOperation, { 
          maxRetries: 3,
          baseDelay: 100
        });
        
        // Check that delays increase exponentially
        const delays: number[] = [];
        const originalSetTimeout = global.setTimeout;
        global.setTimeout = vi.fn((callback, delay) => {
          delays.push(delay as number);
          return originalSetTimeout(callback, 0); // Execute immediately for test
        });
        
        await expect(promise).rejects.toThrow();
        
        expect(delays).toEqual([100, 200, 400]); // Exponential backoff
        
        global.setTimeout = originalSetTimeout;
      });

      it('should handle rate limit errors with custom delay', async () => {
        const rateLimitError = new RateLimitError('Rate limited', 30);
        const failingOperation = vi.fn()
          .mockRejectedValueOnce(rateLimitError)
          .mockResolvedValue('success');
        
        const promise = retryWithBackoff(failingOperation);
        
        // Fast-forward through rate limit delay
        await vi.advanceTimersByTimeAsync(30000); // 30 seconds
        
        const result = await promise;
        
        expect(result).toBe('success');
        expect(failingOperation).toHaveBeenCalledTimes(2);
      });

      it('should add jitter to prevent thundering herd', async () => {
        const failingOperation = vi.fn()
          .mockRejectedValue(new NetworkError('Connection failed'));
        
        // Mock Math.random to return predictable values
        const originalRandom = Math.random;
        Math.random = vi.fn().mockReturnValue(0.5);
        
        const delays: number[] = [];
        const originalSetTimeout = global.setTimeout;
        global.setTimeout = vi.fn((callback, delay) => {
          delays.push(delay as number);
          return originalSetTimeout(callback, 0);
        });
        
        const promise = retryWithBackoff(failingOperation, { 
          maxRetries: 2,
          baseDelay: 100,
          jitter: true
        });
        
        await expect(promise).rejects.toThrow();
        
        // Delays should be modified by jitter (50% of base delay added)
        expect(delays[0]).toBe(150); // 100 + (100 * 0.5)
        expect(delays[1]).toBe(300); // 200 + (200 * 0.5)
        
        Math.random = originalRandom;
        global.setTimeout = originalSetTimeout;
      });
    });
  });

  describe('Response Handling', () => {
    describe('handleApiResponse', () => {
      it('should return data for successful responses', async () => {
        const mockResponse = {
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ data: 'success' })
        } as any;
        
        const result = await handleApiResponse(mockResponse);
        
        expect(result).toEqual({ data: 'success' });
      });

      it('should throw ApiError for 4xx client errors', async () => {
        const mockResponse = {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: vi.fn().mockResolvedValue({ 
            error: 'Invalid request',
            code: 'INVALID_REQUEST'
          })
        } as any;
        
        await expect(handleApiResponse(mockResponse)).rejects.toThrow(ApiError);
        
        try {
          await handleApiResponse(mockResponse);
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect((error as ApiError).status).toBe(400);
          expect((error as ApiError).code).toBe('INVALID_REQUEST');
        }
      });

      it('should throw ValidationError for 422 responses', async () => {
        const mockResponse = {
          ok: false,
          status: 422,
          statusText: 'Unprocessable Entity',
          json: vi.fn().mockResolvedValue({
            error: 'Validation failed',
            fields: { email: 'Invalid format' }
          })
        } as any;
        
        await expect(handleApiResponse(mockResponse)).rejects.toThrow(ValidationError);
        
        try {
          await handleApiResponse(mockResponse);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).fields).toEqual({ email: 'Invalid format' });
        }
      });

      it('should throw RateLimitError for 429 responses', async () => {
        const mockResponse = {
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: {
            get: vi.fn().mockReturnValue('60') // Retry-After header
          },
          json: vi.fn().mockResolvedValue({
            error: 'Rate limit exceeded'
          })
        } as any;
        
        await expect(handleApiResponse(mockResponse)).rejects.toThrow(RateLimitError);
        
        try {
          await handleApiResponse(mockResponse);
        } catch (error) {
          expect(error).toBeInstanceOf(RateLimitError);
          expect((error as RateLimitError).retryAfter).toBe(60);
        }
      });

      it('should handle responses without JSON body', async () => {
        const mockResponse = {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: vi.fn().mockRejectedValue(new Error('No JSON'))
        } as any;
        
        await expect(handleApiResponse(mockResponse)).rejects.toThrow(ApiError);
        
        try {
          await handleApiResponse(mockResponse);
        } catch (error) {
          expect((error as ApiError).message).toBe('Internal Server Error');
        }
      });
    });
  });

  describe('Error Handler Factory', () => {
    describe('createApiErrorHandler', () => {
      it('should create error handler with default options', () => {
        const handler = createApiErrorHandler();
        
        expect(typeof handler).toBe('function');
      });

      it('should handle errors with custom retry logic', async () => {
        const handler = createApiErrorHandler({
          maxRetries: 2,
          baseDelay: 50
        });
        
        const failingOperation = vi.fn()
          .mockRejectedValueOnce(new NetworkError('Connection failed'))
          .mockResolvedValue('success');
        
        const result = await handler(failingOperation);
        
        expect(result).toBe('success');
        expect(failingOperation).toHaveBeenCalledTimes(2);
      });

      it('should call onError callback when provided', async () => {
        const onError = vi.fn();
        const handler = createApiErrorHandler({ onError });
        
        const failingOperation = vi.fn()
          .mockRejectedValue(new ApiError('Not found', 404, 'NOT_FOUND'));
        
        await expect(handler(failingOperation)).rejects.toThrow();
        expect(onError).toHaveBeenCalledWith(expect.any(ApiError));
      });

      it('should transform errors when transformer provided', async () => {
        const errorTransformer = vi.fn((error: Error) => 
          new Error(`Transformed: ${error.message}`)
        );
        
        const handler = createApiErrorHandler({ errorTransformer });
        
        const failingOperation = vi.fn()
          .mockRejectedValue(new Error('Original error'));
        
        await expect(handler(failingOperation)).rejects.toThrow('Transformed: Original error');
        expect(errorTransformer).toHaveBeenCalled();
      });
    });
  });

  describe('Error Message Utilities', () => {
    describe('getErrorMessage', () => {
      it('should return message from ApiError', () => {
        const error = new ApiError('API failed', 500, 'INTERNAL_ERROR');
        expect(getErrorMessage(error)).toBe('API failed');
      });

      it('should return user-friendly message for common errors', () => {
        const networkError = new NetworkError('Connection failed');
        const rateLimitError = new RateLimitError('Too many requests', 60);
        
        expect(getErrorMessage(networkError)).toContain('connection');
        expect(getErrorMessage(rateLimitError)).toContain('too many requests');
      });

      it('should return generic message for unknown errors', () => {
        const unknownError = new Error('Unknown error');
        expect(getErrorMessage(unknownError)).toBe('An unexpected error occurred');
      });

      it('should handle non-Error objects', () => {
        expect(getErrorMessage('string error')).toBe('An unexpected error occurred');
        expect(getErrorMessage(null)).toBe('An unexpected error occurred');
        expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete API call workflow', async () => {
      // Mock a failing then successful API call
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ properties: [] })
        });
      
      const apiCall = async () => {
        const response = await fetch('/api/properties');
        return handleApiResponse(response);
      };
      
      const handler = createApiErrorHandler({ maxRetries: 1 });
      const result = await handler(apiCall);
      
      expect(result).toEqual({ properties: [] });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle rate limiting in real scenario', async () => {
      // First call hits rate limit, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: { get: () => '1' }, // 1 second retry
          json: () => Promise.resolve({ error: 'Rate limited' })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: 'success' })
        });
      
      const apiCall = async () => {
        const response = await fetch('/api/search');
        return handleApiResponse(response);
      };
      
      const handler = createApiErrorHandler();
      const promise = handler(apiCall);
      
      // Fast-forward through rate limit delay
      await vi.advanceTimersByTimeAsync(1000);
      
      const result = await promise;
      expect(result).toEqual({ data: 'success' });
    });
  });

  describe('Performance Tests', () => {
    it('should handle many concurrent retries efficiently', async () => {
      const operations = Array(100).fill(0).map((_, i) => 
        vi.fn()
          .mockRejectedValueOnce(new NetworkError('Connection failed'))
          .mockResolvedValue(`result-${i}`)
      );
      
      const handler = createApiErrorHandler({ maxRetries: 1 });
      
      const start = Date.now();
      const promises = operations.map(op => handler(op));
      
      // Fast-forward through all retries
      await vi.runAllTimersAsync();
      
      const results = await Promise.all(promises);
      const end = Date.now();
      
      expect(results).toHaveLength(100);
      expect(results[0]).toBe('result-0');
      expect(end - start).toBeLessThan(1000); // Should complete quickly
    });
  });
});