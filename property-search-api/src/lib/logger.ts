import * as winston from 'winston';
import { getEnv } from '../config/env';

const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

const level = () => {
    const isDevelopment = env.NODE_ENV === 'development';
    return isDevelopment ? 'debug' : 'warn';
};

const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.errors({ stack: true }),
    winston.format.printf((info: winston.Logform.TransformableInfo) => {
        const { timestamp, level, message, stack, ...meta } = info;
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level.toUpperCase()}]: ${message} ${stack || ''} ${metaStr}`;
    })
);

const developmentFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    format
);

const productionFormat = winston.format.combine(
    winston.format.json(),
    winston.format.timestamp()
);

const transports: winston.transport[] = [
    new winston.transports.Console({
        format: getEnv().NODE_ENV === 'development' ? developmentFormat : productionFormat,
    }),
];

// Add file transports for production
if (getEnv().NODE_ENV === 'production') {
    transports.push(
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    );
}

export const logger = winston.createLogger({
    level: level(),
    levels: logLevels,
    format,
    transports,
    exitOnError: false,
});

// Stream for Morgan HTTP logger
export const httpLogStream = {
    write: (message: string) => {
        logger.http(message.trim());
    },
};

// Custom methods for structured logging
export const logRequest = (req: any, res: any, responseTime: number): void => {
    logger.http({
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        responseTime: `${responseTime}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
    });
};

export const logError = (error: Error, context: any = {}): void => {
    logger.error({
        message: error.message,
        stack: error.stack,
        ...context,
    });
};

export const logInfo = (message: string, meta: any = {}): void => {
    logger.info(message, meta);
};

export const logWarn = (message: string, meta: any = {}): void => {
    logger.warn(message, meta);
};

export const logDebug = (message: string, meta: any = {}): void => {
    logger.debug(message, meta);
};