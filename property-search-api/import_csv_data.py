#!/usr/bin/env python3
"""
Import CSV data to Neon database
Transforms CSV columns to match analysis script expectations
"""

import os
import csv
import psycopg2
from dotenv import load_dotenv
import re
from datetime import datetime

def extract_postcode(address):
    """Extract postcode from address string"""
    # Look for UK postcode pattern at the end
    pattern = r'([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})(?=\s*$|,\s*$)'
    match = re.search(pattern, address)
    return match.group(1) if match else ''

def clean_property_type(prop_type):
    """Standardize property type names"""
    type_mapping = {
        'Semi-D': 'Semi-Detached',
        'Semi-D Bungalow': 'Semi-Detached Bungalow',
        'Detached Bungalow': 'Detached Bungalow',
        'Terrace Bungalow': 'Terraced Bungalow',
        'Terrace': 'Terraced',
        'Detached': 'Detached',
        'Flat': 'Flat'
    }
    return type_mapping.get(prop_type, prop_type)

def parse_date(date_str):
    """Parse date string to proper date format"""
    try:
        # Handle "Mar 2025" format
        month_year = date_str.strip()
        if month_year:
            # Convert "Mar 2025" to "2025-03-01" (first day of month)
            date_obj = datetime.strptime(month_year + " 01", "%b %Y %d")
            return date_obj.date()
    except:
        pass
    return None

def import_csv_to_neon():
    """Import CSV data to Neon database"""
    load_dotenv()
    
    database_url = os.getenv('NEON_DATABASE_URL')
    if not database_url:
        print("❌ NEON_DATABASE_URL not found")
        return False
    
    csv_file = 'search_results(4).csv'
    if not os.path.exists(csv_file):
        print(f"❌ CSV file {csv_file} not found")
        return False
    
    try:
        # Connect to database
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        print("🔍 Reading CSV file...")
        
        # Clear existing data
        cursor.execute("DELETE FROM properties")
        print("🗑️ Cleared existing property data")
        
        inserted_count = 0
        
        with open(csv_file, 'r', encoding='utf-8-sig') as file:
            reader = csv.DictReader(file)
            
            for row in reader:
                try:
                    # Extract and clean data
                    address = row['Address'].strip()
                    postcode = extract_postcode(address)
                    
                    # Parse numeric values
                    price = int(row['Price paid'].replace(',', '')) if row['Price paid'] else 0
                    floor_area = int(row['Floor area']) if row['Floor area'] and row['Floor area'].isdigit() else None
                    price_per_sqm = int(row['£ per square metre']) if row['£ per square metre'] and row['£ per square metre'].isdigit() else None
                    bedrooms = int(row['Beds']) if row['Beds'] and row['Beds'].isdigit() else None
                    plot_size = int(row['Plot size']) if row['Plot size'] and row['Plot size'].isdigit() else None
                    
                    # Skip rows with no price or invalid data
                    if price <= 0:
                        continue
                    
                    # Clean property type
                    property_type = clean_property_type(row['Type'].strip())
                    
                    # Parse date
                    last_sold = parse_date(row['Last sold'])
                    
                    # Create title from address (first part before comma)
                    title = address.split(',')[0].strip()
                    
                    # Insert into database
                    insert_query = """
                        INSERT INTO properties 
                        (title, address, url, postcode, last_sold, price, floor_area_sqm, 
                         price_per_sqm, property_type, bedrooms, tenure, plot_size)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """
                    
                    cursor.execute(insert_query, (
                        title,
                        address,
                        row['URL'].strip(),
                        postcode,
                        last_sold,
                        price,
                        floor_area,
                        price_per_sqm,
                        property_type,
                        bedrooms,
                        row['Tenure'].strip(),
                        plot_size
                    ))
                    
                    inserted_count += 1
                    
                except Exception as e:
                    print(f"⚠️ Error processing row: {e}")
                    continue
        
        # Commit changes
        conn.commit()
        
        print(f"✅ Successfully imported {inserted_count} properties")
        
        # Show sample data
        cursor.execute("SELECT COUNT(*) FROM properties")
        result = cursor.fetchone()
        if result:
            total_count = result[0]
            print(f"📊 Total properties in database: {total_count}")
        else:
            print("⚠️ Could not retrieve count from properties table")
        
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Import failed: {e}")
        return False

if __name__ == "__main__":
    print("📦 Importing CSV data to Neon database")
    print("=" * 50)
    success = import_csv_to_neon()
    print("=" * 50)
    if success:
        print("🎉 Import completed successfully!")
        print("💡 You can now run your analysis script")
    else:
        print("💥 Import failed!")