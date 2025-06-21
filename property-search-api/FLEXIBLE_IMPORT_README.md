# Flexible Property Import System

This system allows estate agents to upload property listings in various formats (CSV, Excel) and automatically maps their column names to the standard database schema.

## Features

- **Multiple Format Support**: CSV, Excel (.xlsx, .xls)
- **Intelligent Column Mapping**: Uses fuzzy matching and predefined mappings
- **Agent-Specific Configurations**: Custom mappings for different estate agents
- **Data Validation**: Cleans and validates property data before import
- **Duplicate Handling**: Updates existing properties based on address
- **Flexible API**: REST endpoints for web integration

## Quick Start

### 1. Command Line Usage

```bash
# Import with default mapping
python flexible_import_system.py sample_properties.csv

# Import with specific agent mapping
python flexible_import_system.py rightmove_export.csv rightmove
```

### 2. API Usage

```bash
# Upload a file
curl -X POST http://localhost:3000/api/upload/property-file \
  -F "file=@properties.csv" \
  -F "agentId=rightmove"

# Preview file columns
curl -X POST http://localhost:3000/api/upload/preview-columns \
  -F "file=@properties.csv"

# Get supported agents
curl http://localhost:3000/api/upload/supported-agents
```

### 3. Test the System

```bash
# Run the test script to see how it works
python test_flexible_import.py
```

## Column Mapping

The system uses intelligent column mapping to match agent-specific column names to standard fields:

### Standard Fields
- `address` - Property address
- `price` - Property price
- `bedrooms` - Number of bedrooms
- `bathrooms` - Number of bathrooms
- `property_type` - Type of property (House, Flat, etc.)
- `square_feet` - Floor area
- `description` - Property description
- `agent_name` - Estate agent name
- `postcode` - Postal code
- `city` - City/town

### Agent-Specific Mappings

Edit `agent_field_mappings.json` to add custom mappings for different agents:

```json
{
  "your_agent_name": {
    "address": ["Property Address", "Full Address"],
    "price": ["Asking Price", "Price £"],
    "bedrooms": ["No. Bedrooms", "Bed Count"],
    "bathrooms": ["No. Bathrooms", "Bath Count"]
  }
}
```

## Data Validation

The system performs several validation checks:

- **Required Fields**: Ensures address and price are present
- **Price Validation**: Checks for reasonable price ranges (£0 - £50M)
- **Numeric Validation**: Validates bedroom/bathroom counts
- **Data Cleaning**: Removes currency symbols, normalizes text

## File Format Examples

### CSV Format
```csv
Property Address,Asking Price,No. Bedrooms,No. Bathrooms,Property Type
123 Main St,£350000,3,2,House
456 Oak Ave,£275000,2,1,Flat
```

### Excel Format
Same structure but in .xlsx/.xls format.

## API Endpoints

### POST /api/upload/property-file
Upload and process a property file.

**Parameters:**
- `file` (multipart) - CSV or Excel file
- `agentId` (optional) - Agent mapping to use

**Response:**
```json
{
  "success": true,
  "importedRows": 25,
  "message": "File processed successfully",
  "agentId": "rightmove",
  "originalFilename": "properties.csv"
}
```

### POST /api/upload/preview-columns
Preview file columns before importing.

**Parameters:**
- `file` (multipart) - CSV or Excel file

**Response:**
```json
{
  "success": true,
  "columns": ["Property Address", "Price", "Bedrooms"],
  "row_count": 100,
  "sample_data": [...]
}
```

### GET /api/upload/supported-agents
Get list of supported agent mappings.

**Response:**
```json
{
  "success": true,
  "agents": [
    {
      "id": "rightmove",
      "name": "Rightmove",
      "fields": ["address", "price", "bedrooms"]
    }
  ]
}
```

## Error Handling

The system provides detailed error messages for:
- Unsupported file formats
- Missing required fields
- Database connection issues
- Invalid data formats

## Adding New Agent Mappings

1. Edit `agent_field_mappings.json`
2. Add a new agent configuration:
```json
{
  "new_agent": {
    "address": ["agent_specific_address_field"],
    "price": ["agent_specific_price_field"]
  }
}
```
3. Use the agent ID when importing: `python flexible_import_system.py file.csv new_agent`

## Requirements

- Python 3.7+
- pandas
- psycopg2
- python-dotenv
- Node.js (for API)
- Express.js
- Multer

## Environment Variables

```bash
NEON_DATABASE_URL=postgresql://user:password@host:port/database
```

## Troubleshooting

### Common Issues

1. **File encoding problems**: The system tries multiple encodings (UTF-8, Latin-1, CP1252)
2. **Column separator detection**: Automatically detects commas, semicolons, and tabs
3. **Date format issues**: Uses pandas flexible date parsing
4. **Price format variations**: Handles £, $, € symbols and thousands separators

### Debug Mode

Add debug logging by setting environment variable:
```bash
DEBUG=true python flexible_import_system.py file.csv
```

## Contributing

To add new features:
1. Update the field mappings in `agent_field_mappings.json`
2. Add validation rules in the `validate_data()` method
3. Update the API endpoints if needed
4. Add tests to `test_flexible_import.py`