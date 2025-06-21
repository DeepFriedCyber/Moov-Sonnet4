# 🗄️ Database Setup Guide

This guide will help you set up the PostgreSQL database for PropertySearch UK using Neon cloud hosting.

## 📋 Quick Setup Checklist

- [ ] Create Neon PostgreSQL database
- [ ] Configure DATABASE_URL in .env
- [ ] Install Python dependencies
- [ ] Test database connection
- [ ] Run database migrations
- [ ] Verify setup

## 🚀 Step-by-Step Setup

### 1. **Create Neon Database**

1. **Sign up**: Go to [https://neon.tech/](https://neon.tech/)
2. **Create project**: Click "Create a project"
3. **Choose region**: Select closest to your location
4. **Database name**: `property_search` (or your preferred name)
5. **Copy connection string**: Save it for next step

### 2. **Configure Environment**

Create or update your `.env` file in the API directory:

```bash
cd property-search-api
cp .env.example .env
```

Edit `.env` file and add your database URL:
```env
DATABASE_URL=postgresql://username:password@ep-example-123456.us-east-1.aws.neon.tech/property_search?sslmode=require
```

### 3. **Install Python Dependencies**

Install the required Python packages for database scripts:

```bash
# Install database script dependencies
pip install -r database_requirements.txt
```

Or install manually:
```bash
pip install psycopg2-binary python-dotenv
```

### 4. **Test Database Connection**

Run the connection test script:

```bash
python test_neon_connection.py
```

**Expected Output:**
```
🧪 Neon Database Connection Test
========================================
🔍 Testing connection to Neon database...
📍 Host: ep-example-123456.us-east-1.aws.neon.tech
✅ Connection successful!
📊 Database: property_search
👤 User: username
🕒 Server time: 2024-01-15 10:30:45.123456+00:00
🐘 PostgreSQL version: PostgreSQL 16.1 on x86_64...
========================================
🎉 All tests passed!
```

### 5. **Run Database Setup**

Execute the database setup script to create all tables:

```bash
python setup_database.py
```

**Expected Output:**
```
🏗️ Database Setup
==================================================
🚀 Setting up database schema...
==================================================
📁 Connected to Neon database
🔄 Running 001_initial_schema.sql...
✅ 001_initial_schema.sql completed successfully
🔄 Running 002_add_chat_tables.sql...
✅ 002_add_chat_tables.sql completed successfully
🔄 Running 003_add_subscriptions.sql...
✅ 003_add_subscriptions.sql completed successfully
⏭️ Skipping 004_import_historical_data.sql (run separately with data import)

📊 Verifying database setup...
📋 Created tables: chat_messages, chat_sessions, properties, searches, subscriptions, users
👤 Users in database: 0
==================================================
🎉 Database setup completed successfully!
💡 Next steps:
   1. Run: python run_historical_import.py
   2. Start your API server
   3. Begin property searches!
```

### 6. **Verify Database Setup**

Check that everything was created correctly:

```bash
python check_db.py
```

**Expected Output:**
```
🔍 Database Status Check
========================================
🔍 Connecting to database...
📊 Database: property_search
👤 User: username

📋 Current database tables:
  • chat_messages: 0 rows
  • chat_sessions: 0 rows
  • properties: 0 rows
  • searches: 0 rows
  • subscriptions: 0 rows
  • users: 0 rows

✅ Database has 6 tables

🎉 All core tables present!

🧪 Testing database operations...
  ✅ SELECT operations working
  ✅ Server time: 2024-01-15 10:30:45.123456+00:00

🎊 Database check completed successfully!
========================================
```

## 🧪 Testing All Scripts

Run the comprehensive test suite:

```bash
python test_database_scripts.py
```

This will verify:
- ✅ Python modules are installed
- ✅ Environment files are configured
- ✅ Database scripts have valid syntax
- ✅ Migration files exist and are readable

## 📁 Database Scripts Overview

| Script | Purpose | When to Run |
|--------|---------|-------------|
| `test_database_scripts.py` | Test all scripts work | Before setup |
| `test_neon_connection.py` | Test database connectivity | First step |
| `setup_database.py` | Create all database tables | After connection test |
| `check_db.py` | Verify database status | After setup |
| `run_historical_import.py` | Import sample data | Optional |

## 🗄️ Database Schema

After setup, your database will have these tables:

### **Core Tables:**
- **`users`** - User accounts and profiles
- **`properties`** - Property listings and details
- **`searches`** - User search history and preferences

### **Chat System:**
- **`chat_sessions`** - Chat conversation sessions
- **`chat_messages`** - Individual chat messages

### **Business Logic:**
- **`subscriptions`** - User subscription plans
- **`agents`** - Property agent profiles (if applicable)

## 🚨 Troubleshooting

### **Connection Errors**

**Problem:** `connection timeout` or `connection refused`
```bash
❌ Database connection failed!
🚫 Error: connection to server failed
```

**Solutions:**
1. Check your `DATABASE_URL` format
2. Verify Neon database is running
3. Check network connectivity
4. Ensure SSL mode is enabled: `?sslmode=require`

### **Authentication Errors**

**Problem:** `authentication failed`
```bash
❌ Database connection failed!
🚫 Error: FATAL: password authentication failed
```

**Solutions:**
1. Verify username and password in connection string
2. Check if database user exists
3. Regenerate password in Neon dashboard

### **Missing Tables**

**Problem:** Scripts run but tables aren't created
```bash
❌ No tables found
💡 Run: python setup_database.py
```

**Solutions:**
1. Check migration files exist in `property-search-api/migrations/`
2. Verify SQL syntax in migration files
3. Check database permissions
4. Run setup script with verbose output

### **Module Import Errors**

**Problem:** `ModuleNotFoundError: No module named 'psycopg2'`

**Solutions:**
```bash
# Install required packages
pip install -r database_requirements.txt

# Or install individually
pip install psycopg2-binary python-dotenv
```

### **Environment Variable Errors**

**Problem:** `DATABASE_URL not found in environment variables`

**Solutions:**
1. Create `.env` file: `cp .env.example .env`
2. Add `DATABASE_URL=your_connection_string`
3. Verify file is in correct directory
4. Check environment variable name matches

## 🔒 Security Notes

1. **Never commit** `.env` files with real credentials
2. **Use SSL** connections for production (`sslmode=require`)
3. **Limit database permissions** to required operations only
4. **Rotate passwords** regularly in production
5. **Use connection pooling** for high-traffic applications

## 📊 Next Steps

After successful database setup:

1. **Import Sample Data** (optional):
   ```bash
   python run_historical_import.py
   ```

2. **Start API Server**:
   ```bash
   cd property-search-api
   npm run dev
   ```

3. **Start Frontend**:
   ```bash
   cd property-search-frontend
   npm run dev
   ```

4. **Test the Application**:
   - Visit: http://localhost:3000
   - Perform property searches
   - Check database for stored data

---

**🎉 Your PropertySearch UK database is now ready for action!**