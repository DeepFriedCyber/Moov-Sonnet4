#!/usr/bin/env python3
"""
Test script for the flexible import system
Creates sample CSV files with different formats to test the system
"""

import pandas as pd
import os
from flexible_import_system import FlexiblePropertyImporter

def create_sample_files():
    """Create sample CSV files with different column formats"""
    
    # Sample 1: Standard format
    standard_data = {
        'address': ['123 Main St, London', '456 Oak Ave, Manchester', '789 Pine Rd, Birmingham'],
        'price': [350000, 275000, 425000],
        'bedrooms': [3, 2, 4],
        'bathrooms': [2, 1, 3],
        'property_type': ['House', 'Flat', 'House'],
        'square_feet': [1200, 850, 1800],
        'description': ['Beautiful family home', 'Modern apartment', 'Spacious detached house']
    }
    
    # Sample 2: Estate agent format with different column names
    agent_data = {
        'Property Address': ['321 High St, Leeds', '654 Church Lane, Bristol', '987 Market Square, York'],
        'Asking Price': ['£295,000', '£180,000', '£520,000'],
        'No. Bedrooms': [2, 1, 5],
        'No. Bathrooms': [1, 1, 3],
        'Type of Property': ['Terraced House', 'Studio', 'Detached House'],
        'Floor Area (sq ft)': ['950', '420', '2200'],
        'Property Description': ['Charming terraced home', 'Compact city studio', 'Luxury family residence'],
        'Agent Name': ['Smith & Co', 'Quick Sales', 'Premium Properties'],
        'Contact Number': ['0113 123 4567', '0117 987 6543', '01904 555 0123']
    }
    
    # Sample 3: Online portal format
    portal_data = {
        'full_address': ['147 Victoria Road, Cambridge', '258 Queen Street, Oxford', '369 King Avenue, Canterbury'],
        'current_price': [425000, 385000, 310000],
        'bed_count': [3, 3, 2],
        'bath_count': [2, 2, 1],
        'listing_condition': ['Semi-Detached', 'Terraced', 'End of Terrace'],
        'floor_area': [1350, 1150, 900],
        'details': ['Perfect family home with garden', 'Victorian terrace with character', 'Cozy home near amenities'],
        'post_code': ['CB1 3AA', 'OX1 4BB', 'CT1 2CC'],
        'county': ['Cambridgeshire', 'Oxfordshire', 'Kent']
    }
    
    # Create CSV files
    pd.DataFrame(standard_data).to_csv('sample_standard.csv', index=False)
    pd.DataFrame(agent_data).to_csv('sample_agent.csv', index=False)
    pd.DataFrame(portal_data).to_csv('sample_portal.csv', index=False)
    
    print("✅ Created sample CSV files:")
    print("   - sample_standard.csv (standard format)")
    print("   - sample_agent.csv (estate agent format)")
    print("   - sample_portal.csv (online portal format)")

def test_import_system():
    """Test the flexible import system with sample files"""
    
    importer = FlexiblePropertyImporter()
    
    test_files = [
        ('sample_standard.csv', 'default'),
        ('sample_agent.csv', 'local_agent_example'),
        ('sample_portal.csv', 'default')
    ]
    
    for filename, agent_id in test_files:
        if os.path.exists(filename):
            print(f"\n{'='*60}")
            print(f"Testing: {filename} with agent_id: {agent_id}")
            print('='*60)
            
            result = importer.process_file(filename, agent_id)
            
            if result['success']:
                print(f"✅ Success! Imported {result['imported_rows']} rows")
                print(f"📊 Original: {result['original_rows']}, Processed: {result['processed_rows']}, Validated: {result['validated_rows']}")
                if result['warnings']:
                    print("⚠️ Warnings:")
                    for warning in result['warnings']:
                        print(f"   - {warning}")
            else:
                print(f"❌ Failed: {result.get('error', 'Unknown error')}")

def cleanup_test_files():
    """Remove test files"""
    test_files = ['sample_standard.csv', 'sample_agent.csv', 'sample_portal.csv']
    
    for filename in test_files:
        if os.path.exists(filename):
            os.remove(filename)
            print(f"🗑️ Removed {filename}")

if __name__ == "__main__":
    print("🧪 Testing Flexible Property Import System")
    print("=" * 50)
    
    try:
        # Create sample files
        create_sample_files()
        
        # Test the import system
        test_import_system()
        
        print(f"\n{'='*50}")
        print("🎉 Testing completed!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
    
    finally:
        # Clean up
        print(f"\n{'='*50}")
        print("🧹 Cleaning up test files...")
        cleanup_test_files()