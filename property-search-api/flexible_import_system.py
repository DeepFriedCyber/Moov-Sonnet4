#!/usr/bin/env python3
"""
Flexible Property Import System
Handles property listings from different estate agents with varying formats
"""

import os
import json
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from difflib import get_close_matches
from typing import Dict, List, Optional, Tuple, Any
import re
from datetime import datetime

class FlexiblePropertyImporter:
    def __init__(self):
        """Initialize the flexible property importer"""
        load_dotenv()
        self.db_url = os.getenv('NEON_DATABASE_URL')
        self.field_mappings = self.load_field_mappings()
        self.standard_fields = {
            'address', 'price', 'bedrooms', 'bathrooms', 'property_type',
            'square_feet', 'lot_size', 'year_built', 'listing_date',
            'description', 'agent_name', 'agent_phone', 'agent_email',
            'latitude', 'longitude', 'postcode', 'city', 'state'
        }
        
    def load_field_mappings(self) -> Dict[str, Dict[str, List[str]]]:
        """Load field mapping configurations for different agents"""
        mappings_file = 'agent_field_mappings.json'
        
        # Default mappings for common variations
        default_mappings = {
            "default": {
                "address": ["address", "property_address", "full_address", "street_address"],
                "price": ["price", "asking_price", "sale_price", "list_price", "value"],
                "bedrooms": ["bedrooms", "beds", "bedroom_count", "bed_count", "no_of_bedrooms"],
                "bathrooms": ["bathrooms", "baths", "bathroom_count", "bath_count", "no_of_bathrooms"],
                "property_type": ["property_type", "type", "home_type", "building_type", "category"],
                "square_feet": ["square_feet", "sqft", "sq_ft", "floor_area", "internal_area", "size"],
                "lot_size": ["lot_size", "plot_size", "land_area", "garden_size", "outdoor_space"],
                "year_built": ["year_built", "built_year", "construction_year", "age", "built"],
                "listing_date": ["listing_date", "date_listed", "available_from", "date_added"],
                "description": ["description", "details", "property_description", "summary"],
                "agent_name": ["agent_name", "agent", "contact_name", "listed_by"],
                "agent_phone": ["agent_phone", "phone", "contact_phone", "telephone"],
                "agent_email": ["agent_email", "email", "contact_email"],
                "postcode": ["postcode", "postal_code", "zip_code", "zip"],
                "city": ["city", "town", "area", "locality"],
                "state": ["state", "county", "region", "province"]
            }
        }
        
        try:
            if os.path.exists(mappings_file):
                with open(mappings_file, 'r') as f:
                    loaded_mappings = json.load(f)
                    # Merge with defaults
                    for agent, mappings in loaded_mappings.items():
                        if agent not in default_mappings:
                            default_mappings[agent] = mappings
            return default_mappings
        except Exception as e:
            print(f"⚠️ Could not load field mappings: {e}")
            return default_mappings
    
    def fuzzy_match_columns(self, columns: List[str], agent_id: str = "default") -> Dict[str, str]:
        """Use fuzzy matching to map columns to standard fields"""
        column_mapping = {}
        agent_mappings = self.field_mappings.get(agent_id, self.field_mappings["default"])
        
        for standard_field, possible_names in agent_mappings.items():
            # First try exact matches (case insensitive)
            for col in columns:
                if col.lower().strip() in [name.lower() for name in possible_names]:
                    column_mapping[col] = standard_field
                    break
            
            # If no exact match, try fuzzy matching
            if standard_field not in column_mapping.values():
                for col in columns:
                    if col not in column_mapping:
                        matches = get_close_matches(col.lower(), 
                                                  [name.lower() for name in possible_names], 
                                                  n=1, cutoff=0.6)
                        if matches:
                            column_mapping[col] = standard_field
                            break
        
        return column_mapping
    
    def load_file(self, file_path: str) -> pd.DataFrame:
        """Load CSV or Excel file into DataFrame"""
        file_ext = os.path.splitext(file_path)[1].lower()
        
        try:
            if file_ext == '.csv':
                # Try different encodings and separators
                for encoding in ['utf-8', 'latin-1', 'cp1252']:
                    for sep in [',', ';', '\t']:
                        try:
                            df = pd.read_csv(file_path, encoding=encoding, sep=sep)
                            if len(df.columns) > 1:  # Success if we got multiple columns
                                print(f"✅ Successfully loaded CSV with encoding: {encoding}, separator: '{sep}'")
                                return df
                        except:
                            continue
                
                # Fallback to default
                df = pd.read_csv(file_path)
                
            elif file_ext in ['.xlsx', '.xls']:
                df = pd.read_excel(file_path)
            else:
                raise ValueError(f"Unsupported file format: {file_ext}")
            
            print(f"📄 Loaded file with {len(df)} rows and {len(df.columns)} columns")
            print(f"📋 Columns: {list(df.columns)}")
            return df
            
        except Exception as e:
            raise Exception(f"Failed to load file {file_path}: {e}")
    
    def clean_and_standardize_data(self, df: pd.DataFrame, column_mapping: Dict[str, str]) -> pd.DataFrame:
        """Clean and standardize the data"""
        standardized_df = pd.DataFrame()
        
        for original_col, standard_field in column_mapping.items():
            if original_col in df.columns:
                series = df[original_col].copy()
                
                # Clean based on field type
                if standard_field == 'price':
                    # Remove currency symbols and convert to number
                    series = series.astype(str).str.replace(r'[£$€,]', '', regex=True)
                    series = pd.to_numeric(series, errors='coerce')
                
                elif standard_field in ['bedrooms', 'bathrooms']:
                    # Convert to integer
                    series = pd.to_numeric(series, errors='coerce').fillna(0).astype(int)
                
                elif standard_field == 'square_feet':
                    # Handle different units and convert to numeric
                    series = series.astype(str).str.replace(r'[,\s]', '', regex=True)
                    series = pd.to_numeric(series, errors='coerce')
                
                elif standard_field in ['postcode', 'city', 'state']:
                    # Clean text fields
                    series = series.astype(str).str.strip().str.title()
                
                elif standard_field == 'listing_date':
                    # Try to parse dates
                    series = pd.to_datetime(series, errors='coerce')
                
                standardized_df[standard_field] = series
        
        return standardized_df
    
    def validate_data(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """Validate property data and return cleaned data with warnings"""
        warnings = []
        
        # Remove rows with missing critical fields
        critical_fields = ['address', 'price']
        before_count = len(df)
        
        for field in critical_fields:
            if field in df.columns:
                mask = df[field].notna() & (df[field] != '') & (df[field] != 0)
                df = df[mask]
        
        after_count = len(df)
        if before_count != after_count:
            warnings.append(f"Removed {before_count - after_count} rows missing critical data")
        
        # Validate price ranges
        if 'price' in df.columns:
            price_mask = (df['price'] > 0) & (df['price'] < 50000000)  # Reasonable price range
            invalid_prices = len(df) - price_mask.sum()
            if invalid_prices > 0:
                warnings.append(f"Found {invalid_prices} rows with invalid prices")
                df = df[price_mask]
        
        # Validate bedrooms/bathrooms
        for field in ['bedrooms', 'bathrooms']:
            if field in df.columns:
                mask = (df[field] >= 0) & (df[field] <= 20)  # Reasonable range
                invalid_count = len(df) - mask.sum()
                if invalid_count > 0:
                    warnings.append(f"Found {invalid_count} rows with invalid {field}")
                    df = df[mask]
        
        return df, warnings
    
    def import_to_database(self, df: pd.DataFrame) -> int:
        """Import cleaned data to database"""
        if len(df) == 0:
            return 0
        
        try:
            conn = psycopg2.connect(self.db_url)
            cursor = conn.cursor()
            
            inserted_count = 0
            
            for _, row in df.iterrows():
                try:
                    # Build insert query dynamically based on available fields
                    fields = []
                    values = []
                    placeholders = []
                    
                    for field in self.standard_fields:
                        if field in row and pd.notna(row[field]) and row[field] != '':
                            fields.append(field)
                            values.append(row[field])
                            placeholders.append('%s')
                    
                    if len(fields) >= 2:  # At least address and price
                        query = f"""
                        INSERT INTO properties ({', '.join(fields)}) 
                        VALUES ({', '.join(placeholders)})
                        ON CONFLICT (address) DO UPDATE SET
                        {', '.join([f"{field} = EXCLUDED.{field}" for field in fields[1:]])}
                        """
                        
                        cursor.execute(query, values)
                        inserted_count += 1
                
                except Exception as e:
                    print(f"⚠️ Error inserting row: {e}")
                    continue
            
            conn.commit()
            cursor.close()
            conn.close()
            
            return inserted_count
            
        except Exception as e:
            print(f"❌ Database error: {e}")
            return 0
    
    def process_file(self, file_path: str, agent_id: str = "default") -> Dict[str, Any]:
        """Main method to process a property file"""
        print(f"🚀 Starting flexible import for: {file_path}")
        print(f"🏢 Agent ID: {agent_id}")
        
        try:
            # Load file
            df = self.load_file(file_path)
            
            # Map columns using fuzzy matching
            column_mapping = self.fuzzy_match_columns(list(df.columns), agent_id)
            print(f"🗺️ Column mapping: {column_mapping}")
            
            # Clean and standardize data
            standardized_df = self.clean_and_standardize_data(df, column_mapping)
            print(f"🧹 Standardized {len(standardized_df)} rows")
            
            # Validate data
            validated_df, warnings = self.validate_data(standardized_df)
            
            if warnings:
                print("⚠️ Validation warnings:")
                for warning in warnings:
                    print(f"   - {warning}")
            
            # Import to database
            imported_count = self.import_to_database(validated_df)
            
            result = {
                "success": True,
                "original_rows": len(df),
                "processed_rows": len(standardized_df),
                "validated_rows": len(validated_df),
                "imported_rows": imported_count,
                "warnings": warnings,
                "column_mapping": column_mapping
            }
            
            print(f"✅ Import complete: {imported_count}/{len(df)} rows imported")
            return result
            
        except Exception as e:
            print(f"❌ Import failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "original_rows": 0,
                "imported_rows": 0
            }

def main():
    """Main function for command line usage"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python flexible_import_system.py <file_path> [agent_id]")
        sys.exit(1)
    
    file_path = sys.argv[1]
    agent_id = sys.argv[2] if len(sys.argv) > 2 else "default"
    
    importer = FlexiblePropertyImporter()
    result = importer.process_file(file_path, agent_id)
    
    if result["success"]:
        print("🎉 Import completed successfully!")
    else:
        print("💥 Import failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()