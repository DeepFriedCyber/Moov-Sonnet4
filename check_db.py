#!/usr/bin/env python3
"""
Database status checker - shows tables, data counts, and health status
"""

import os
import psycopg2
from dotenv import load_dotenv

def check_database_status():
    """Check database tables, data, and overall health"""
    load_dotenv()
    
    # Get database URL (try multiple variable names)
    database_url = os.getenv('DATABASE_URL') or os.getenv('NEON_DATABASE_URL')
    
    if not database_url:
        print("❌ DATABASE_URL not found in environment variables")
        print("💡 Make sure to set DATABASE_URL in your .env file")
        return False
    
    try:
        print("🔍 Connecting to database...")
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Get database info
        cursor.execute("SELECT current_database(), current_user;")
        db_info = cursor.fetchone()
        print(f"📊 Database: {db_info[0]}")
        print(f"👤 User: {db_info[1]}")
        
        # Get all tables
        print('\n📋 Current database tables:')
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        
        tables = cursor.fetchall()
        if not tables:
            print('  ❌ No tables found')
            print('  💡 Run: python setup_database.py')
            return False
        
        # Show tables with row counts
        for table in tables:
            table_name = table[0]
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                count = cursor.fetchone()[0]
                print(f'  • {table_name}: {count:,} rows')
            except Exception as e:
                print(f'  • {table_name}: Error counting rows ({e})')
        
        print(f'\n✅ Database has {len(tables)} tables')
        
        # Check key tables exist
        expected_tables = ['users', 'properties', 'searches', 'chat_sessions']
        table_names = [t[0] for t in tables]
        
        missing_tables = [t for t in expected_tables if t not in table_names]
        if missing_tables:
            print(f'\n⚠️ Missing expected tables: {", ".join(missing_tables)}')
            print('💡 Run: python setup_database.py')
        else:
            print('\n🎉 All core tables present!')
        
        # Test basic operations
        print('\n🧪 Testing database operations...')
        
        # Test SELECT operation
        cursor.execute("SELECT 1 as test")
        result = cursor.fetchone()
        if result and result[0] == 1:
            print('  ✅ SELECT operations working')
        
        # Test timestamp
        cursor.execute("SELECT NOW()")
        timestamp = cursor.fetchone()
        print(f'  ✅ Server time: {timestamp[0]}')
        
        cursor.close()
        conn.close()
        
        print('\n🎊 Database check completed successfully!')
        return True
        
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    print("🔍 Database Status Check")
    print("=" * 40)
    success = check_database_status()
    print("=" * 40)
    if not success:
        print("💥 Database check failed!")
        print("🔧 Troubleshooting steps:")
        print("   1. Check your DATABASE_URL in .env file")
        print("   2. Verify database is accessible")
        print("   3. Run: python test_neon_connection.py")
        print("   4. Setup database: python setup_database.py")