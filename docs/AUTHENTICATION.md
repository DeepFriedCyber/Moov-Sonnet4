# 🔐 Moov Property Search - Authentication & Authorization

## 📋 Table of Contents

- [Overview](#overview)
- [Authentication Methods](#authentication-methods)
- [JWT Token Structure](#jwt-token-structure)
- [User Roles & Permissions](#user-roles--permissions)
- [Authentication Flow](#authentication-flow)
- [Security Best Practices](#security-best-practices)
- [API Key Management](#api-key-management)
- [Session Management](#session-management)
- [Password Security](#password-security)
- [Two-Factor Authentication](#two-factor-authentication)
- [OAuth Integration](#oauth-integration)
- [Error Handling](#error-handling)
- [Implementation Examples](#implementation-examples)

## 🎯 Overview

The Moov Property Search platform uses a multi-layered authentication and authorization system to ensure secure access to resources. The system supports multiple authentication methods and implements role-based access control (RBAC).

### Security Features
- ✅ JWT-based authentication
- ✅ Role-based access control (RBAC)
- ✅ API key authentication for services
- ✅ Password hashing with bcrypt
- ✅ Rate limiting and brute force protection
- ✅ Session management
- ✅ Two-factor authentication (2FA)
- ✅ OAuth integration (Google, Facebook)
- ✅ Audit logging

## 🔑 Authentication Methods

### 1. JWT Bearer Token Authentication

Primary authentication method for web and mobile applications.

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Use Cases:**
- Web application authentication
- Mobile app authentication
- API access for authenticated users

### 2. API Key Authentication

For service-to-service communication and third-party integrations.

```http
X-API-Key: ak_live_1234567890abcdef
```

**Use Cases:**
- Webhook endpoints
- Third-party integrations
- Internal service communication

### 3. Session-Based Authentication

For web applications requiring traditional session management.

```http
Cookie: session_id=abc123def456; HttpOnly; Secure
```

**Use Cases:**
- Admin panel access
- Legacy system integration

## 🎫 JWT Token Structure

### Access Token Payload
```json
{
  "sub": "user_123456789",
  "email": "user@example.com",
  "role": "buyer",
  "permissions": [
    "properties:read",
    "search:execute",
    "chat:participate"
  ],
  "iat": 1640995200,
  "exp": 1640998800,
  "iss": "moov-property-api",
  "aud": "moov-property-app"
}
```

### Refresh Token Payload
```json
{
  "sub": "user_123456789",
  "type": "refresh",
  "iat": 1640995200,
  "exp": 1643587200,
  "iss": "moov-property-api"
}
```

### Token Lifecycle
- **Access Token**: 1 hour expiry
- **Refresh Token**: 30 days expiry
- **Remember Me**: 90 days expiry (optional)

## 👥 User Roles & Permissions

### Role Hierarchy

```
Admin
├── Agent Manager
│   └── Agent
└── User Manager
    └── Buyer/Seller
```

### Role Definitions

#### 1. Admin
**Permissions:**
- `*:*` (Full system access)
- User management
- System configuration
- Analytics access
- Audit log access

**Capabilities:**
- Manage all users and properties
- Access system settings
- View all analytics and reports
- Manage API keys and integrations

#### 2. Agent Manager
**Permissions:**
- `agents:manage`
- `properties:manage`
- `leads:manage`
- `analytics:view`

**Capabilities:**
- Manage agent accounts
- Oversee property listings
- Access team analytics
- Manage lead distribution

#### 3. Agent
**Permissions:**
- `properties:create`
- `properties:update:own`
- `properties:delete:own`
- `leads:view:assigned`
- `chat:participate`

**Capabilities:**
- Create and manage own property listings
- Communicate with potential buyers
- Access assigned leads
- Update property information

#### 4. Buyer/Seller
**Permissions:**
- `properties:read`
- `search:execute`
- `chat:participate`
- `profile:update:own`

**Capabilities:**
- Search and view properties
- Save favorite properties
- Communicate with agents
- Manage own profile

### Permission Format
Permissions follow the format: `resource:action:scope`

**Examples:**
- `properties:read` - Read all properties
- `properties:update:own` - Update own properties only
- `users:manage:team` - Manage team users only
- `analytics:view:limited` - View limited analytics

## 🔄 Authentication Flow

### 1. Registration Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant D as Database
    participant E as Email Service

    C->>A: POST /api/auth/register
    A->>A: Validate input
    A->>A: Hash password
    A->>D: Create user record
    A->>E: Send verification email
    A->>C: Return user + tokens
```

### 2. Login Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant D as Database
    participant R as Redis

    C->>A: POST /api/auth/login
    A->>D: Verify credentials
    A->>A: Generate JWT tokens
    A->>R: Store refresh token
    A->>C: Return tokens + user info
```

### 3. Token Refresh Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant R as Redis

    C->>A: POST /api/auth/refresh
    A->>A: Validate refresh token
    A->>R: Check token blacklist
    A->>A: Generate new access token
    A->>C: Return new access token
```

### 4. Logout Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant R as Redis

    C->>A: POST /api/auth/logout
    A->>R: Blacklist refresh token
    A->>R: Clear session data
    A->>C: Confirm logout
```

## 🛡️ Security Best Practices

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character
- Cannot be common passwords
- Cannot contain user information

### Token Security
- Tokens are signed with HS256 algorithm
- Secrets are rotated regularly
- Refresh tokens are stored securely
- Blacklisting for compromised tokens
- Short expiry times for access tokens

### Rate Limiting
```typescript
// Login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts',
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Rate limit exceeded',
});
```

### Brute Force Protection
- Account lockout after 5 failed attempts
- Progressive delays between attempts
- CAPTCHA after 3 failed attempts
- IP-based blocking for suspicious activity

## 🔐 API Key Management

### API Key Types

#### 1. Live Keys
- Production environment
- Full access to live data
- Prefix: `ak_live_`

#### 2. Test Keys
- Development/staging environment
- Limited access to test data
- Prefix: `ak_test_`

#### 3. Restricted Keys
- Limited scope and permissions
- Specific endpoint access
- Prefix: `ak_restricted_`

### API Key Structure
```
ak_live_1234567890abcdef1234567890abcdef
│  │    │
│  │    └── Random identifier (32 chars)
│  └── Environment (live/test)
└── Prefix
```

### API Key Permissions
```json
{
  "keyId": "ak_live_1234567890abcdef",
  "name": "Property Integration Key",
  "permissions": [
    "properties:read",
    "search:execute"
  ],
  "rateLimit": {
    "requests": 1000,
    "window": "1h"
  },
  "ipWhitelist": [
    "192.168.1.0/24",
    "10.0.0.1"
  ],
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

## 🕐 Session Management

### Session Configuration
```typescript
const sessionConfig = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict'
  },
  store: new RedisStore({
    client: redisClient,
    prefix: 'sess:',
    ttl: 86400 // 24 hours
  })
};
```

### Session Data Structure
```json
{
  "userId": "user_123456789",
  "email": "user@example.com",
  "role": "buyer",
  "loginTime": "2024-01-01T12:00:00Z",
  "lastActivity": "2024-01-01T12:30:00Z",
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "permissions": ["properties:read", "search:execute"]
}
```

## 🔒 Password Security

### Password Hashing
```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

// Hash password
const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

// Verify password
const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};
```

### Password Reset Flow
1. User requests password reset
2. Generate secure reset token
3. Send reset email with token
4. User clicks link and enters new password
5. Validate token and update password
6. Invalidate all existing sessions

### Password History
- Store hash of last 5 passwords
- Prevent password reuse
- Automatic cleanup after 1 year

## 📱 Two-Factor Authentication (2FA)

### Supported Methods
1. **TOTP (Time-based One-Time Password)**
   - Google Authenticator
   - Authy
   - Microsoft Authenticator

2. **SMS-based OTP**
   - Fallback method
   - 6-digit codes
   - 5-minute expiry

3. **Email-based OTP**
   - Backup method
   - 6-digit codes
   - 10-minute expiry

### 2FA Setup Flow
```typescript
// Generate TOTP secret
const generateTOTPSecret = (userId: string) => {
  const secret = speakeasy.generateSecret({
    name: `Moov Property (${userId})`,
    issuer: 'Moov Property Search'
  });
  
  return {
    secret: secret.base32,
    qrCode: qrcode.toDataURL(secret.otpauth_url)
  };
};

// Verify TOTP token
const verifyTOTP = (token: string, secret: string) => {
  return speakeasy.totp.verify({
    secret,
    token,
    window: 2 // Allow 2 time steps
  });
};
```

## 🔗 OAuth Integration

### Supported Providers
- Google OAuth 2.0
- Facebook Login
- Apple Sign In
- Microsoft Azure AD

### OAuth Flow
```typescript
// Google OAuth configuration
const googleStrategy = new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });
    
    if (!user) {
      user = await User.create({
        googleId: profile.id,
        email: profile.emails[0].value,
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        avatar: profile.photos[0].value,
        emailVerified: true
      });
    }
    
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
});
```

## ❌ Error Handling

### Authentication Errors

#### Invalid Credentials
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "statusCode": 401
  }
}
```

#### Token Expired
```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Access token has expired",
    "statusCode": 401,
    "details": {
      "expiredAt": "2024-01-01T13:00:00Z"
    }
  }
}
```

#### Insufficient Permissions
```json
{
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "You don't have permission to access this resource",
    "statusCode": 403,
    "details": {
      "required": "properties:create",
      "current": ["properties:read"]
    }
  }
}
```

#### Account Locked
```json
{
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "Account temporarily locked due to multiple failed login attempts",
    "statusCode": 423,
    "details": {
      "lockedUntil": "2024-01-01T13:15:00Z",
      "remainingTime": 900
    }
  }
}
```

## 💻 Implementation Examples

### Frontend Authentication Hook (React)

```typescript
import { useState, useEffect, createContext, useContext } from 'react';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      validateToken(token).then(setUser).catch(() => {
        localStorage.removeItem('accessToken');
      }).finally(() => {
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    localStorage.setItem('accessToken', data.tokens.accessToken);
    localStorage.setItem('refreshToken', data.tokens.refreshToken);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated: !!user,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

### Backend Middleware

```typescript
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

// Authentication middleware
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;

    let user;

    if (authHeader?.startsWith('Bearer ')) {
      // JWT authentication
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      user = await User.findById(decoded.sub);
    } else if (apiKey) {
      // API key authentication
      const key = await APIKey.findOne({ key: apiKey, active: true });
      if (!key) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
      user = { id: 'api', permissions: key.permissions };
    }

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Authorization middleware
export const authorize = (requiredPermission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasPermission = req.user.permissions.includes(requiredPermission) ||
                         req.user.permissions.includes('*:*');

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: requiredPermission,
        current: req.user.permissions
      });
    }

    next();
  };
};

// Usage
app.get('/api/properties',
  authenticate,
  authorize('properties:read'),
  getProperties
);
```

### Token Refresh Implementation

```typescript
// Axios interceptor for automatic token refresh
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post('/api/auth/refresh', {
          refreshToken
        });

        const { accessToken } = response.data;
        localStorage.setItem('accessToken', accessToken);
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);
```

## 📊 Security Monitoring

### Audit Logging
```typescript
interface AuditLog {
  userId: string;
  action: string;
  resource: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  details?: any;
}

const logAuditEvent = async (event: AuditLog) => {
  await AuditLog.create(event);
  
  // Send to monitoring system
  if (!event.success) {
    await alertingService.sendAlert({
      type: 'security',
      severity: 'warning',
      message: `Failed ${event.action} attempt by ${event.userId}`,
      details: event
    });
  }
};
```

### Security Metrics
- Failed login attempts per hour
- Token refresh rate
- API key usage patterns
- Suspicious IP addresses
- Account lockout frequency

---

## 📞 Support

For authentication and security questions:
- **Security Team**: security@moov-property.com
- **Documentation**: https://docs.moov-property.com/auth
- **Emergency**: security-emergency@moov-property.com

## 📄 Compliance

This authentication system complies with:
- OWASP Authentication Guidelines
- GDPR Privacy Requirements
- SOC 2 Type II Standards
- PCI DSS (where applicable)