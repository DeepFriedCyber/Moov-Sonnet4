// Database configuration factory and environment management
import { DatabaseConfig, DatabaseConfigSchema } from '../schemas/database.schemas';

export class DatabaseConfigFactory {
  static fromEnvironment(): DatabaseConfig {
    const config = {
      connectionString: 
        process.env.DATABASE_URL || 
        process.env.POSTGRES_URL ||
        'postgresql://localhost:5432/property_search',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
      enableSSL: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production',
      retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.DB_RETRY_DELAY || '1000'),
    };

    return DatabaseConfigSchema.parse(config);
  }

  static forTesting(): DatabaseConfig {
    return DatabaseConfigSchema.parse({
      connectionString: 'postgresql://test:test@localhost:5432/test_db',
      maxConnections: 5,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 1000,
      enableSSL: false,
      retryAttempts: 1,
      retryDelay: 100,
    });
  }

  static forProduction(): DatabaseConfig {
    return DatabaseConfigSchema.parse({
      connectionString: process.env.DATABASE_URL!,
      maxConnections: 50,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
      enableSSL: true,
      retryAttempts: 5,
      retryDelay: 2000,
    });
  }

  static forDevelopment(): DatabaseConfig {
    return DatabaseConfigSchema.parse({
      connectionString: 'postgresql://dev:dev@localhost:5432/property_search_dev',
      maxConnections: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      enableSSL: false,
      retryAttempts: 3,
      retryDelay: 1000,
    });
  }

  static validate(config: any): DatabaseConfig {
    return DatabaseConfigSchema.parse(config);
  }
}

// Environment-aware configuration loader
export function loadDatabaseConfig(): DatabaseConfig {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return DatabaseConfigFactory.forProduction();
    case 'test':
      return DatabaseConfigFactory.forTesting();
    case 'development':
    default:
      return DatabaseConfigFactory.fromEnvironment();
  }
}