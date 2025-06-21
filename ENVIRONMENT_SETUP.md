# 🔧 Environment Setup Guide

This guide will help you configure all the necessary environment variables for PropertySearch UK.

## 📋 Quick Setup Checklist

- [ ] **Database**: Neon PostgreSQL connection
- [ ] **API Keys**: Google Places, MapTiler
- [ ] **Authentication**: JWT secrets
- [ ] **Services**: Redis (optional)
- [ ] **External APIs**: Email, payments (optional)

## 🚀 Step-by-Step Setup

### 1. **Copy Environment Templates**

```bash
# Frontend environment
cd property-search-frontend
cp .env.local.example .env.local

# API environment  
cd ../property-search-api
cp .env.example .env

# AI service environment
cd ../property-embedding-service
cp .env.example .env
```

### 2. **🗄️ Database Setup (Required)**

#### Get Neon PostgreSQL Database:

1. **Sign up**: Go to [https://neon.tech/](https://neon.tech/)
2. **Create database**: Click "Create Database"
3. **Copy connection string**: It looks like:
   ```
   postgresql://username:password@ep-example-123456.us-east-1.aws.neon.tech/property_search?sslmode=require
   ```
4. **Update API .env**:
   ```env
   DATABASE_URL=your_neon_connection_string_here
   ```

### 3. **🗺️ Maps & Location APIs (Required)**

#### Google Places API:
1. **Go to**: [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. **Create project** or select existing
3. **Enable APIs**: Places API, Geocoding API
4. **Create credentials**: API Key
5. **Restrict key**: Add domain restrictions
6. **Update both .env files**:
   ```env
   # API .env
   GOOGLE_PLACES_API_KEY=your_google_places_key
   
   # Frontend .env.local
   NEXT_PUBLIC_GOOGLE_PLACES_KEY=your_google_places_key
   ```

#### MapTiler API:
1. **Sign up**: [https://www.maptiler.com/](https://www.maptiler.com/)
2. **Get API key** from dashboard
3. **Update both .env files**:
   ```env
   # API .env
   MAPTILER_API_KEY=your_maptiler_key
   
   # Frontend .env.local
   NEXT_PUBLIC_MAPTILER_KEY=your_maptiler_key
   ```

### 4. **🔐 Security Configuration (Required)**

#### Generate JWT Secrets:
```bash
# Generate secure random strings
openssl rand -base64 32
```

**Update .env files**:
```env
# API .env
JWT_SECRET=your_generated_jwt_secret

# Frontend .env.local  
NEXTAUTH_SECRET=your_generated_nextauth_secret
```

### 5. **📦 Optional Services**

#### Redis (Recommended):
- **Local**: Install Redis locally or use Docker
- **Cloud**: [Upstash](https://upstash.com/), [Redis Cloud](https://redis.com/redis-enterprise-cloud/)

```env
# All .env files
REDIS_URL=redis://localhost:6379
# Or cloud Redis:
# REDIS_URL=redis://default:password@redis-12345.upstash.io:12345
```

#### Email Service (Optional):
```env
# API .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

#### Payments (Optional):
```env
# API .env
STRIPE_SECRET_KEY=sk_test_your_stripe_secret
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Frontend .env.local
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_public
```

## 📝 Environment Files Summary

### 🔌 **API Server** (`property-search-api/.env`)
**Required:**
- `DATABASE_URL` - Neon PostgreSQL connection
- `JWT_SECRET` - Secure random string
- `GOOGLE_PLACES_API_KEY` - Google Places API
- `MAPTILER_API_KEY` - MapTiler API

**Optional:**
- `REDIS_URL` - Redis for caching
- `SMTP_*` - Email configuration
- `STRIPE_*` - Payment processing

### 🌐 **Frontend** (`property-search-frontend/.env.local`)
**Required:**
- `NEXT_PUBLIC_API_URL=http://localhost:3001`
- `NEXT_PUBLIC_EMBEDDING_SERVICE_URL=http://localhost:8001`
- `NEXTAUTH_SECRET` - Secure random string
- `NEXT_PUBLIC_GOOGLE_PLACES_KEY` - Google Places API
- `NEXT_PUBLIC_MAPTILER_KEY` - MapTiler API

**Optional:**
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe payments
- `NEXT_PUBLIC_GA_ID` - Google Analytics

### 🤖 **AI Service** (`property-embedding-service/.env`)
**Default settings work out of the box:**
- `API_HOST=0.0.0.0`
- `API_PORT=8001`
- `MODEL_NAME=all-MiniLM-L6-v2`

**Optional:**
- `REDIS_URL` - Redis for caching
- `API_BASE_URL=http://localhost:3001`

## ✅ Testing Your Configuration

### 1. **Test Database Connection**
```bash
cd property-search-api
npm run dev
# Should connect to database without errors
```

### 2. **Test All Services**
```bash
# Start all services
npm run dev

# Check health endpoints
curl http://localhost:3001/health
curl http://localhost:8001/health
```

### 3. **Test Frontend**
```bash
# Open browser
http://localhost:3000
# Should load without API errors
```

## 🐛 Common Issues

### **Database Connection Errors**
```
Error: connection timeout
```
**Solution:** Check your `DATABASE_URL` format and network connectivity.

### **API Key Errors**
```
Error: API key invalid
```
**Solution:** Verify your API keys are correct and have proper permissions.

### **Port Conflicts**
```
Error: Port 3001 already in use
```
**Solution:** Kill existing processes or change ports:
```bash
npm run kill-ports
```

### **Missing Environment Variables**
```
Error: DATABASE_URL is not defined
```
**Solution:** Ensure you've copied `.env.example` to `.env` and filled in the values.

## 🔒 Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use strong, unique secrets** for JWT tokens
3. **Restrict API keys** to specific domains/IPs
4. **Use environment-specific values** for production
5. **Regular key rotation** for production systems

## 📞 Need Help?

If you're having trouble with environment setup:

1. **Check the logs** in your terminal
2. **Verify all required variables** are set
3. **Test API keys** in their respective consoles
4. **Create an issue** with your error details (don't include secrets!)

---

**🎯 Once configured, your PropertySearch UK platform will be ready for development!**