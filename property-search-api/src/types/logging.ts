export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  app?: string;
  service?: string;
  version?: string;
  environment?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  metadata?: any;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    [key: string]: any;
  };
}

export interface LogTransport {
  (entry: LogEntry): void;
}