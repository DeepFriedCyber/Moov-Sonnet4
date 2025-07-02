import { Logger } from './Logger';
import { LogLevel, LogContext } from '@/types/logging';

describe('Logger', () => {
  let logger: Logger;
  let mockTransport: jest.Mock;

  beforeEach(() => {
    mockTransport = jest.fn();
    logger = new Logger({
      level: LogLevel.DEBUG,
      transports: [mockTransport],
    });
  });

  describe('log levels', () => {
    it('should log messages at appropriate levels', () => {
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(mockTransport).toHaveBeenCalledTimes(4);
      
      const calls = mockTransport.mock.calls;
      expect(calls[0][0].level).toBe(LogLevel.DEBUG);
      expect(calls[1][0].level).toBe(LogLevel.INFO);
      expect(calls[2][0].level).toBe(LogLevel.WARN);
      expect(calls[3][0].level).toBe(LogLevel.ERROR);
    });

    it('should respect minimum log level', () => {
      logger = new Logger({
        level: LogLevel.WARN,
        transports: [mockTransport],
      });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(mockTransport).toHaveBeenCalledTimes(2);
      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({ level: LogLevel.WARN })
      );
      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({ level: LogLevel.ERROR })
      );
    });
  });

  describe('context enrichment', () => {
    it('should include context in log entries', () => {
      const context: LogContext = {
        userId: 'user-123',
        sessionId: 'session-456',
        requestId: 'req-789',
      };

      logger.withContext(context).info('User action', {
        action: 'search',
        query: 'apartment',
      });

      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User action',
          context,
          metadata: { action: 'search', query: 'apartment' },
        })
      );
    });

    it('should merge nested contexts', () => {
      const baseLogger = logger.withContext({ app: 'property-search' });
      const userLogger = baseLogger.withContext({ userId: 'user-123' });
      
      userLogger.info('Action performed');

      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          context: {
            app: 'property-search',
            userId: 'user-123',
          },
        })
      );
    });

    it('should override context values', () => {
      const baseLogger = logger.withContext({ environment: 'dev' });
      const prodLogger = baseLogger.withContext({ environment: 'prod' });
      
      prodLogger.info('Environment test');

      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          context: {
            environment: 'prod',
          },
        })
      );
    });
  });

  describe('error logging', () => {
    it('should serialize error objects', () => {
      const error = new Error('Something went wrong');
      error.stack = 'Error: Something went wrong\n    at test.js:10:5';

      logger.error('Operation failed', { error });

      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.ERROR,
          message: 'Operation failed',
          error: {
            message: 'Something went wrong',
            stack: expect.stringContaining('test.js:10:5'),
            name: 'Error',
          },
        })
      );
    });

    it('should handle custom error properties', () => {
      const error = new Error('Custom error') as any;
      error.code = 'CUSTOM_ERROR';
      error.statusCode = 500;

      logger.error('Custom error occurred', { error });

      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'Error',
            message: 'Custom error',
            code: 'CUSTOM_ERROR',
            statusCode: 500,
          }),
        })
      );
    });

    it('should handle non-Error objects', () => {
      const errorLike = {
        message: 'Not a real error',
        code: 'FAKE_ERROR',
      };

      logger.error('Fake error', { error: errorLike });

      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { error: errorLike },
        })
      );
    });

    it('should handle circular references', () => {
      const obj: any = { name: 'test' };
      obj.circular = obj;

      expect(() => {
        logger.info('Circular reference test', { data: obj });
      }).not.toThrow();

      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { error: 'Failed to serialize metadata' },
        })
      );
    });
  });

  describe('performance logging', () => {
    it('should measure operation duration', async () => {
      const timer = logger.startTimer();
      
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      timer.done('Operation completed');

      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Operation completed',
          metadata: expect.objectContaining({
            duration: expect.any(Number),
          }),
        })
      );

      const duration = mockTransport.mock.calls[0][0].metadata.duration;
      expect(duration).toBeGreaterThan(90);
      expect(duration).toBeLessThan(150);
    });

    it('should include additional metadata with timer', () => {
      const timer = logger.startTimer();
      
      timer.done('Database query completed', {
        query: 'SELECT * FROM properties',
        rowCount: 25,
      });

      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            query: 'SELECT * FROM properties',
            rowCount: 25,
            duration: expect.any(Number),
          }),
        })
      );
    });

    it('should handle multiple concurrent timers', () => {
      const timer1 = logger.startTimer();
      const timer2 = logger.startTimer();
      
      timer1.done('First operation');
      timer2.done('Second operation');

      expect(mockTransport).toHaveBeenCalledTimes(2);
      expect(mockTransport).toHaveBeenNthCalledWith(1, 
        expect.objectContaining({ message: 'First operation' })
      );
      expect(mockTransport).toHaveBeenNthCalledWith(2, 
        expect.objectContaining({ message: 'Second operation' })
      );
    });
  });

  describe('metadata handling', () => {
    it('should handle complex metadata objects', () => {
      const complexMetadata = {
        user: {
          id: 'user-123',
          preferences: {
            theme: 'dark',
            notifications: true,
          },
        },
        request: {
          method: 'POST',
          url: '/api/search',
          headers: {
            'user-agent': 'Mozilla/5.0',
          },
        },
        performance: {
          startTime: Date.now(),
          memoryUsage: process.memoryUsage(),
        },
      };

      logger.info('Complex metadata test', complexMetadata);

      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: complexMetadata,
        })
      );
    });

    it('should handle null and undefined metadata', () => {
      logger.info('Null metadata', null);
      logger.info('Undefined metadata', undefined);
      logger.info('No metadata');

      expect(mockTransport).toHaveBeenCalledTimes(3);
      expect(mockTransport).toHaveBeenNthCalledWith(1,
        expect.objectContaining({ metadata: null })
      );
      expect(mockTransport).toHaveBeenNthCalledWith(2,
        expect.objectContaining({ metadata: undefined })
      );
      expect(mockTransport).toHaveBeenNthCalledWith(3,
        expect.objectContaining({ metadata: undefined })
      );
    });

    it('should handle large metadata objects', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        data: `item-${i}`,
      }));

      logger.info('Large metadata test', { items: largeArray });

      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { items: largeArray },
        })
      );
    });
  });

  describe('log formatting', () => {
    it('should include timestamp in log entries', () => {
      logger.info('Timestamp test');

      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );

      const timestamp = mockTransport.mock.calls[0][0].timestamp;
      expect(new Date(timestamp).getTime()).toBeCloseTo(Date.now(), -2);
    });

    it('should format log entries as JSON', () => {
      logger.info('JSON format test', { key: 'value' });

      const logEntry = mockTransport.mock.calls[0][0];
      expect(() => JSON.parse(JSON.stringify(logEntry))).not.toThrow();
    });

    it('should maintain log entry structure', () => {
      const context = { userId: 'user-123' };
      const metadata = { action: 'test' };

      logger.withContext(context).warn('Structure test', metadata);

      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
          level: LogLevel.WARN,
          message: 'Structure test',
          context,
          metadata,
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty messages', () => {
      logger.info('');
      logger.info('   ');

      expect(mockTransport).toHaveBeenCalledTimes(2);
      expect(mockTransport).toHaveBeenNthCalledWith(1,
        expect.objectContaining({ message: '' })
      );
      expect(mockTransport).toHaveBeenNthCalledWith(2,
        expect.objectContaining({ message: '   ' })
      );
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(10000);
      
      logger.info(longMessage);

      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({ message: longMessage })
      );
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Test with émojis 🚀 and unicode ñ characters';
      
      logger.info(specialMessage);

      expect(mockTransport).toHaveBeenCalledWith(
        expect.objectContaining({ message: specialMessage })
      );
    });

    it('should handle concurrent logging', async () => {
      const promises = Array.from({ length: 100 }, (_, i) => 
        Promise.resolve().then(() => logger.info(`Message ${i}`))
      );

      await Promise.all(promises);

      expect(mockTransport).toHaveBeenCalledTimes(100);
    });
  });
});