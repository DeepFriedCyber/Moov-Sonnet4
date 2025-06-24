// Database factory for dependency injection and service creation
import { DatabaseService, PropertyRepository } from '../database';
import { DatabaseConfigFactory, loadDatabaseConfig } from '../config/database.config';
import { DatabaseMonitor } from '../monitoring/database.monitoring';
import { MigrationRunner } from '../migrations/database.migrations';
import {
    IDatabaseService,
    IPropertyRepository,
    DatabaseConfig
} from '../interfaces/database.interfaces';

export class DatabaseFactory {
    private static instance: DatabaseFactory;
    private databaseService: IDatabaseService | null = null;
    private propertyRepository: IPropertyRepository | null = null;
    private monitor: DatabaseMonitor | null = null;
    private migrationRunner: MigrationRunner | null = null;

    private constructor() { }

    static getInstance(): DatabaseFactory {
        if (!DatabaseFactory.instance) {
            DatabaseFactory.instance = new DatabaseFactory();
        }
        return DatabaseFactory.instance;
    }

    async createDatabaseService(config?: DatabaseConfig): Promise<IDatabaseService> {
        if (this.databaseService) {
            return this.databaseService;
        }

        const dbConfig = config || loadDatabaseConfig();
        this.databaseService = new DatabaseService(dbConfig);

        await this.databaseService.initialize();
        return this.databaseService;
    }

    async createPropertyRepository(config?: DatabaseConfig): Promise<IPropertyRepository> {
        if (this.propertyRepository) {
            return this.propertyRepository;
        }

        const dbService = await this.createDatabaseService(config);
        this.propertyRepository = new PropertyRepository(dbService);

        return this.propertyRepository;
    }

    async createMonitor(config?: DatabaseConfig): Promise<DatabaseMonitor> {
        if (this.monitor) {
            return this.monitor;
        }

        const dbService = await this.createDatabaseService(config);
        this.monitor = new DatabaseMonitor(dbService);

        return this.monitor;
    }

    async createMigrationRunner(config?: DatabaseConfig): Promise<MigrationRunner> {
        if (this.migrationRunner) {
            return this.migrationRunner;
        }

        const dbService = await this.createDatabaseService(config);
        this.migrationRunner = new MigrationRunner(dbService);

        await this.migrationRunner.initialize();
        return this.migrationRunner;
    }

    // Complete database setup with all services
    async setupDatabase(config?: DatabaseConfig) {
        console.log('🏗️  Setting up database services...');

        const dbService = await this.createDatabaseService(config);
        const repository = await this.createPropertyRepository(config);
        const monitor = await this.createMonitor(config);
        const migrationRunner = await this.createMigrationRunner(config);

        // Run health check
        const healthStatus = await monitor.getHealthStatus();
        console.log(`📊 Database health: ${healthStatus.status}`);

        if (healthStatus.status === 'unhealthy') {
            throw new Error('Database is unhealthy - setup aborted');
        }

        console.log('✅ Database setup complete');

        return {
            database: dbService,
            repository,
            monitor,
            migrationRunner,
        };
    }

    // Reset factory (useful for testing)
    reset(): void {
        this.databaseService = null;
        this.propertyRepository = null;
        this.monitor = null;
        this.migrationRunner = null;
    }

    // Graceful shutdown
    async shutdown(): Promise<void> {
        console.log('🔄 Shutting down database connections...');

        if (this.databaseService) {
            await this.databaseService.close();
        }

        this.reset();
        console.log('✅ Database shutdown complete');
    }
}

// Convenience functions for common use cases
export async function createDatabaseStack(config?: DatabaseConfig) {
    const factory = DatabaseFactory.getInstance();
    return await factory.setupDatabase(config);
}

export async function createPropertyService(config?: DatabaseConfig) {
    const factory = DatabaseFactory.getInstance();
    return await factory.createPropertyRepository(config);
}

export async function shutdownDatabase() {
    const factory = DatabaseFactory.getInstance();
    await factory.shutdown();
}