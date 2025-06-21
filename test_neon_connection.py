#!/usr/bin/env python3
"""
Test script to verify Neon database connection
"""

import os
import psycopg2
from dotenv import load_dotenv

def test_neon_connection():
    """Test the connection to Neon database"""
    # Load environment variables
    load_dotenv()
    
    # Get database URL from environment
    database_url = os.getenv('NEON_DATABASE_URL')
    
    if not database_url:
        print("❌ NEON_DATABASE_URL not found in environment variables")
        return False
    
    print(f"🔍 Testing connection to Neon database...")
    print(f"📍 Host: {database_url.split('@')[1].split('/')[0] if '@' in database_url else 'Unknown'}")
    
    try:
        # Attempt to connect to the database
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Test basic connectivity
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        
        # Test current timestamp
        cursor.execute("SELECT NOW();")
        timestamp = cursor.fetchone()
        
        # Get database info
        cursor.execute("SELECT current_database(), current_user;")
        db_info = cursor.fetchone()
        
        print("✅ Connection successful!")
        print(f"📊 Database: {db_info[0]}")
        print(f"👤 User: {db_info[1]}")
        print(f"🕒 Server time: {timestamp[0]}")
        print(f"🐘 PostgreSQL version: {version[0][:50]}...")
        
        # Close connections
        cursor.close()
        conn.close()
        
        return True
        
    except psycopg2.Error as e:
        print(f"❌ Database connection failed!")
        print(f"🚫 Error: {e}")
        return False
    
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Neon Database Connection Test")
    print("=" * 40)
    success = test_neon_connection()
    print("=" * 40)
    if success:
        print("🎉 All tests passed!")
    else:
        print("💥 Connection test failed!")