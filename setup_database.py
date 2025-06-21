#!/usr/bin/env python3
"""
Database setup script - runs all migrations in order
"""

import os
import psycopg2
from dotenv import load_dotenv
import glob

def run_migrations():
    """Run all migration files in order"""
    load_dotenv()
    
    # Try multiple environment variable names for flexibility
    database_url = os.getenv('DATABASE_URL') or os.getenv('NEON_DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not found in environment variables")
        print("💡 Make sure to set DATABASE_URL in your .env file")
        print("   Example: DATABASE_URL=postgresql://user:pass@host:5432/dbname")
        return False
    
    migrations_dir = 'property-search-api/migrations'
    
    # Get all migration files and sort them
    migration_files = sorted(glob.glob(f"{migrations_dir}/*.sql"))
    
    if not migration_files:
        print(f"❌ No migration files found in {migrations_dir}")
        return False
    
    print("🚀 Setting up database schema...")
    print("=" * 50)
    
    try:
        # Connect to database
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        print("📁 Connected to Neon database")
        
        # Run each migration
        for migration_file in migration_files:
            filename = os.path.basename(migration_file)
            print(f"🔄 Running {filename}...")
            
            # Skip the historical import for now
            if 'import_historical_data' in filename:
                print(f"⏭️ Skipping {filename} (run separately with data import)")
                continue
            
            try:
                with open(migration_file, 'r', encoding='utf-8') as f:
                    migration_sql = f.read().strip()
                
                # Skip empty files
                if not migration_sql:
                    print(f"⏭️ Skipping {filename} (empty file)")
                    continue
                
                # Execute the migration
                cursor.execute(migration_sql)
                conn.commit()
                print(f"✅ {filename} completed successfully")
                
            except Exception as e:
                print(f"❌ Error in {filename}: {e}")
                conn.rollback()
                return False
        
        # Verify the setup
        print("\n📊 Verifying database setup...")
        
        # Check tables exist
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        
        tables = cursor.fetchall()
        print(f"📋 Created tables: {', '.join([t[0] for t in tables])}")
        
        # Check users table (if it exists)
        try:
            cursor.execute("SELECT COUNT(*) FROM users")
            result = cursor.fetchone()
            if result:
                user_count = result[0]
                print(f"👤 Users in database: {user_count}")
            else:
                print("👤 Users table exists but query returned no results")
        except psycopg2.ProgrammingError:
            print("👤 Users table not found (may not have been created yet)")
        
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Database setup failed: {e}")
        return False

if __name__ == "__main__":
    print("🏗️ Database Setup")
    print("=" * 50)
    success = run_migrations()
    print("=" * 50)
    if success:
        print("🎉 Database setup completed successfully!")
        print("💡 Next steps:")
        print("   1. Run: python run_historical_import.py")
        print("   2. Start your API server")
        print("   3. Begin property searches!")
    else:
        print("💥 Database setup failed!")
        print("🔧 Check the error messages above and try again")