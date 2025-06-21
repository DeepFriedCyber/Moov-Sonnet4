#!/usr/bin/env python3
"""
Execute historical property data import
Handles CSV import and runs the migration script
"""

import os
import csv
import psycopg2
from dotenv import load_dotenv
import tempfile
import shutil

def execute_historical_import():
    """Execute the historical property data import"""
    load_dotenv()
    
    database_url = os.getenv('NEON_DATABASE_URL')
    if not database_url:
        print("❌ NEON_DATABASE_URL not found in environment variables")
        return False
    
    csv_file = 'property-search-api/search_results(4).csv'
    migration_file = 'property-search-api/migrations/004_import_historical_data.sql'
    
    if not os.path.exists(csv_file):
        print(f"❌ CSV file {csv_file} not found")
        return False
    
    if not os.path.exists(migration_file):
        print(f"❌ Migration file {migration_file} not found")
        return False
    
    print("🚀 Starting historical property data import...")
    print("=" * 60)
    
    try:
        # Connect to database
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        print("📁 Connected to Neon database")
        
        # Step 1: Read and execute the migration script up to the COPY command
        print("📄 Reading migration script...")
        with open(migration_file, 'r', encoding='utf-8') as f:
            migration_sql = f.read()
        
        # Split the migration into parts
        parts = migration_sql.split('-- COPY temp_historical_properties FROM')
        
        if len(parts) != 2:
            print("❌ Migration script format not as expected")
            return False
        
        # Execute the part before COPY
        print("🏗️ Creating temporary table...")
        cursor.execute(parts[0])
        
        # Step 2: Import CSV data using Python
        print("📊 Importing CSV data...")
        imported_count = 0
        
        with open(csv_file, 'r', encoding='utf-8-sig') as csvfile:
            reader = csv.DictReader(csvfile)
            
            for row in reader:
                try:
                    # Clean and validate data
                    address = row.get('Address', '').strip()
                    if not address or address == 'Address':
                        continue
                    
                    url = row.get('URL', '').strip()
                    last_sold = row.get('Last sold', '').strip()
                    
                    # Parse numeric fields
                    try:
                        price_paid = int(row.get('Price paid', '0').replace(',', '')) if row.get('Price paid') else None
                    except (ValueError, AttributeError):
                        price_paid = None
                    
                    try:
                        floor_area_str = row.get('Floor area', '0')
                        floor_area = int(floor_area_str) if floor_area_str and floor_area_str.isdigit() else None
                    except (ValueError, AttributeError):
                        floor_area = None
                    
                    try:
                        price_per_sqm_str = row.get('£ per square metre', '0')
                        price_per_sqm = int(price_per_sqm_str) if price_per_sqm_str and price_per_sqm_str.isdigit() else None
                    except (ValueError, AttributeError):
                        price_per_sqm = None
                    
                    try:
                        beds_str = row.get('Beds', '0')
                        beds = int(beds_str) if beds_str and beds_str.isdigit() else None
                    except (ValueError, AttributeError):
                        beds = None
                    
                    try:
                        plot_size_str = row.get('Plot size', '0')
                        plot_size = int(plot_size_str) if plot_size_str and plot_size_str.isdigit() else None
                    except (ValueError, AttributeError):
                        plot_size = None
                    
                    property_type = row.get('Type', '').strip()
                    tenure = row.get('Tenure', '').strip()
                    
                    # Skip invalid records
                    if not price_paid or price_paid <= 0:
                        continue
                    
                    # Insert into temp table
                    insert_query = """
                        INSERT INTO temp_historical_properties 
                        (address, url, last_sold, price_paid, floor_area, price_per_sqm, 
                         property_type, beds, tenure, plot_size)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """
                    
                    cursor.execute(insert_query, (
                        address, url, last_sold, price_paid, floor_area, 
                        price_per_sqm, property_type, beds, tenure, plot_size
                    ))
                    
                    imported_count += 1
                    
                except Exception as e:
                    print(f"⚠️ Error processing row: {e}")
                    continue
        
        print(f"✅ Imported {imported_count} records to temporary table")
        
        # Step 3: Execute the rest of the migration
        print("🔄 Executing data transformation...")
        
        # Get the part after COPY command
        remaining_sql = parts[1].split('WITH CSV HEADER;', 1)
        if len(remaining_sql) > 1:
            transformation_sql = remaining_sql[1]
            cursor.execute(transformation_sql)
        
        # Commit all changes
        conn.commit()
        
        # Step 4: Get final statistics
        print("📊 Getting import statistics...")
        cursor.execute("""
            SELECT 
                COUNT(*) as total_properties,
                ROUND(AVG(price)) as avg_price,
                MIN(price) as min_price,
                MAX(price) as max_price,
                COUNT(DISTINCT postcode) as unique_postcodes
            FROM properties
        """)
        
        stats = cursor.fetchone()
        if stats:
            total, avg_price, min_price, max_price, postcodes = stats
            print(f"📈 Final Statistics:")
            print(f"   🏠 Total Properties: {total}")
            print(f"   💰 Average Price: £{avg_price:,}")
            print(f"   📊 Price Range: £{min_price:,} - £{max_price:,}")
            print(f"   📍 Unique Postcodes: {postcodes}")
        
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Import failed: {e}")
        return False

if __name__ == "__main__":
    print("🏡 Historical Property Data Import")
    print("=" * 60)
    success = execute_historical_import()
    print("=" * 60)
    if success:
        print("🎉 Import completed successfully!")
        print("💡 Your property database is now ready with historical data")
        print("🔍 You can now run analytics and use the search API")
    else:
        print("💥 Import failed!")
        print("🔧 Check the error messages above and try again")