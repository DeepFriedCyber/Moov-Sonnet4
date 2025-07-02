import winston from 'winston';
import { performance } from 'perf_hooks';
import { LogLevel, LogContext, LogEntry, LogTransport } from '@/types/logging';

export class Logger {
  private winston: winston.Logger;
  private context: LogContext = {};

  constructor(config: {
    level: LogLevel;
    transports?: LogTransport[];
  }) {
    this.winston = winston.createLogger({
      level: config.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(this.formatLog.bind(this))
      ),
      transports: config.transports || [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });
  }

  private formatLog(info: any): string {
    const entry: LogEntry = {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      context: { ...this.context, ...info.context },
      metadata: info.metadata,
    };

    // Handle error serialization
    if (info.metadata?.error) {
      entry.error = this.serializeError(info.metadata.error);
    }

    return JSON.stringify(entry);
  }

  private serializeError(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...error,
      };
    }
    return error;
  }

  withContext(context: LogContext): Logger {
    const newLogger = Object.create(this);
    newLogger.context = { ...this.context, ...context };
    return newLogger;
  }

  debug(message: string, metadata?: any): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: any): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: any): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, metadata?: any): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  private log(level: LogLevel, message: string, metadata?: any): void {
    this.winston.log({
      level,
      message,
      context: this.context,
      metadata: this.sanitizeMetadata(metadata),
    });
  }

  private sanitizeMetadata(metadata: any): any {
    try {
      // Remove circular references
      return JSON.parse(JSON.stringify(metadata));
    } catch {
      return { error: 'Failed to serialize metadata' };
    }
  }

  startTimer(): { done: (message: string, metadata?: any) => void } {
    const start = performance.now();
    
    return {
      done: (message: string, metadata?: any) => {
        const duration = Math.round(performance.now() - start);
        this.info(message, { ...metadata, duration });
      },
    };
  }
}

// Singleton instance
export const logger = new Logger({
  level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
});