#!/usr/bin/env python3
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(os.getenv('NEON_DATABASE_URL'))
cursor = conn.cursor()

print('📋 Current database tables:')
cursor.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
""")

tables = cursor.fetchall()
for table in tables:
    print(f'  • {table[0]}')

if tables:
    print(f'\n✅ Database has {len(tables)} tables')
else:
    print('\n❌ No tables found')

cursor.close()
conn.close()