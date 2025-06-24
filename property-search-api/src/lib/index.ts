// Main database module exports
// This file provides a clean API for consuming the database layer

// Core database classes
export { DatabaseService, PropertyRepository } from './database';

// Configuration
export { DatabaseConfigFactory, loadDatabaseConfig } from './config/database.config';

// Factory and dependency injection
export { 
  DatabaseFactory, 
  createDatabaseStack, 
  createPropertyService, 
  shutdownDatabase 
} from './factory/database.factory';

// Monitoring and health checks
export { DatabaseMonitor } from './monitoring/database.monitoring';
export type { HealthStatus, HealthCheck } from './monitoring/database.monitoring';

// Migration system
export { MigrationRunner, initialMigration, optimizationMigration } from './migrations/database.migrations';

// Schemas and validation
export * from './schemas/database.schemas';

// Interfaces
export * from './interfaces/database.interfaces';

// Error classes
export * from './errors/database.errors';

// Example usage and setup helpers
export const DatabaseSetup = {
  /**
   * Quick setup for development environment
   */
  async forDevelopment() {
    const factory = DatabaseFactory.getInstance();
    return await factory.setupDatabase();
  },

  /**
   * Production-ready setup with monitoring
   */
  async forProduction() {
    const factory = DatabaseFactory.getInstance();
    const config = DatabaseConfigFactory.forProduction();
    const stack = await factory.setupDatabase(config);
    
    // Start monitoring
    setInterval(async () => {
      await stack.monitor.logMetrics();
    }, 60000); // Log metrics every minute
    
    return stack;
  },

  /**
   * Testing setup with clean state
   */
  async forTesting() {
    const factory = DatabaseFactory.getInstance();
    factory.reset(); // Ensure clean state
    
    const config = DatabaseConfigFactory.forTesting();
    return await factory.setupDatabase(config);
  },

  /**
   * Graceful shutdown
   */
  async shutdown() {
    await shutdownDatabase();
  }
};

// Default export for simple usage
export default DatabaseSetup;