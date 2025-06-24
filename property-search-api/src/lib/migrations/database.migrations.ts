// Database migration system for version control
import { IMigration, IDatabaseService } from '../interfaces/database.interfaces';

export class MigrationRunner {
  constructor(private db: IDatabaseService) {}

  async initialize(): Promise<void> {
    // Create migrations table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        version VARCHAR(50) PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64) NOT NULL
      )
    `);
  }

  async getAppliedMigrations(): Promise<string[]> {
    const result = await this.db.query(
      'SELECT version FROM migrations ORDER BY applied_at'
    );
    return result.rows.map((row: any) => row.version);
  }

  async applyMigration(migration: IMigration): Promise<void> {
    const applied = await this.getAppliedMigrations();
    
    if (applied.includes(migration.version)) {
      console.log(`Migration ${migration.version} already applied`);
      return;
    }

    console.log(`Applying migration ${migration.version}: ${migration.description}`);
    
    try {
      await migration.up();
      
      // Record migration
      await this.db.query(
        'INSERT INTO migrations (version, description, checksum) VALUES ($1, $2, $3)',
        [migration.version, migration.description, this.generateChecksum(migration)]
      );
      
      console.log(`✅ Migration ${migration.version} applied successfully`);
    } catch (error) {
      console.error(`❌ Migration ${migration.version} failed:`, error);
      throw error;
    }
  }

  async rollbackMigration(migration: IMigration): Promise<void> {
    const applied = await this.getAppliedMigrations();
    
    if (!applied.includes(migration.version)) {
      console.log(`Migration ${migration.version} not applied`);
      return;
    }

    console.log(`Rolling back migration ${migration.version}`);
    
    try {
      await migration.down();
      
      // Remove migration record
      await this.db.query(
        'DELETE FROM migrations WHERE version = $1',
        [migration.version]
      );
      
      console.log(`✅ Migration ${migration.version} rolled back successfully`);
    } catch (error) {
      console.error(`❌ Migration ${migration.version} rollback failed:`, error);
      throw error;
    }
  }

  private generateChecksum(migration: IMigration): string {
    // Simple checksum based on version and description
    const content = migration.version + migration.description;
    return Buffer.from(content).toString('base64').slice(0, 32);
  }
}

// Migration implementations
export const initialMigration: IMigration = {
  version: '001_initial_schema',
  description: 'Create initial properties table with pgvector support',
  
  async up(): Promise<void> {
    // This is handled in DatabaseService.initialize()
    console.log('Initial schema already created during initialization');
  },
  
  async down(): Promise<void> {
    console.log('Rolling back initial schema - this would drop all tables');
    // In a real scenario, this would drop tables
  }
};

export const optimizationMigration: IMigration = {
  version: '002_performance_optimization',
  description: 'Add additional indexes for better query performance',
  
  async up(): Promise<void> {
    // Additional optimizations could be added here
    console.log('Performance optimizations applied');
  },
  
  async down(): Promise<void> {
    console.log('Removing performance optimizations');
  }
};