# User Authentication & API Documentation - Complete TDD Implementation

Let's add a complete authentication system with JWT tokens and comprehensive API documentation.

## User Authentication System

### Step 1: RED - Write Failing Tests First

#### Authentication Service Tests

```bash
cd property-search-api
touch src/services/__tests__/auth.test.ts
```

```typescript
// src/services/__tests__/auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService, AuthError } from '../auth';
import { UserRepository } from '@/repositories/user';
import { TokenService } from '../token';
import bcrypt from 'bcrypt';

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepo: Partial<UserRepository>;
  let mockTokenService: Partial<TokenService>;

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: vi.fn(),
      create: vi.fn(),
      findById: vi.fn(),
      updateLastLogin: vi.fn(),
    };

    mockTokenService = {
      generateAccessToken: vi.fn(),
      generateRefreshToken: vi.fn(),
      verifyAccessToken: vi.fn(),
      verifyRefreshToken: vi.fn(),
    };

    authService = new AuthService(
      mockUserRepo as UserRepository,
      mockTokenService as TokenService
    );
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      // Arrange
      const registerData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      mockUserRepo.findByEmail.mockResolvedValueOnce(null);
      mockUserRepo.create.mockResolvedValueOnce({
        id: 'user-123',
        email: registerData.email,
        firstName: registerData.firstName,
        lastName: registerData.lastName,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockTokenService.generateAccessToken.mockReturnValueOnce('access-token');
      mockTokenService.generateRefreshToken.mockReturnValueOnce('refresh-token');

      // Act
      const result = await authService.register(registerData);

      // Assert
      expect(result.user.email).toBe(registerData.email);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: registerData.email,
          firstName: registerData.firstName,
          lastName: registerData.lastName,
          passwordHash: expect.any(String),
        })
      );
    });

    it('should throw error if email already exists', async () => {
      // Arrange
      const registerData = {
        email: 'existing@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      mockUserRepo.findByEmail.mockResolvedValueOnce({
        id: 'existing-user',
        email: registerData.email,
      });

      // Act & Assert
      await expect(authService.register(registerData)).rejects.toThrow(AuthError);
      await expect(authService.register(registerData)).rejects.toThrow('Email already registered');
    });

    it('should validate password strength', async () => {
      // Arrange
      const weakPasswords = [
        'short',
        'no-uppercase-123',
        'NO-LOWERCASE-123',
        'NoNumbers!',
        'NoSpecialChars123',
      ];

      mockUserRepo.findByEmail.mockResolvedValue(null);

      // Act & Assert
      for (const password of weakPasswords) {
        await expect(
          authService.register({
            email: 'test@example.com',
            password,
            firstName: 'John',
            lastName: 'Doe',
          })
        ).rejects.toThrow('Password does not meet security requirements');
      }
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      // Arrange
      const loginData = {
        email: 'user@example.com',
        password: 'CorrectPassword123!',
      };

      const hashedPassword = await bcrypt.hash(loginData.password, 10);
      const user = {
        id: 'user-123',
        email: loginData.email,
        passwordHash: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
      };

      mockUserRepo.findByEmail.mockResolvedValueOnce(user);
      mockUserRepo.updateLastLogin.mockResolvedValueOnce(undefined);
      mockTokenService.generateAccessToken.mockReturnValueOnce('access-token');
      mockTokenService.generateRefreshToken.mockReturnValueOnce('refresh-token');

      // Act
      const result = await authService.login(loginData);

      // Assert
      expect(result.user.email).toBe(loginData.email);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(mockUserRepo.updateLastLogin).toHaveBeenCalledWith(user.id);
    });

    it('should throw error for invalid credentials', async () => {
      // Arrange
      const loginData = {
        email: 'user@example.com',
        password: 'WrongPassword123!',
      };

      const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);
      mockUserRepo.findByEmail.mockResolvedValueOnce({
        id: 'user-123',
        email: loginData.email,
        passwordHash: hashedPassword,
      });

      // Act & Assert
      await expect(authService.login(loginData)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for non-existent user', async () => {
      // Arrange
      mockUserRepo.findByEmail.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      const userId = 'user-123';

      mockTokenService.verifyRefreshToken.mockReturnValueOnce({ userId });
      mockUserRepo.findById.mockResolvedValueOnce({
        id: userId,
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });
      mockTokenService.generateAccessToken.mockReturnValueOnce('new-access-token');
      mockTokenService.generateRefreshToken.mockReturnValueOnce('new-refresh-token');

      // Act
      const result = await authService.refreshToken(refreshToken);

      // Assert
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should throw error for invalid refresh token', async () => {
      // Arrange
      mockTokenService.verifyRefreshToken.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(authService.refreshToken('invalid-token')).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('validateToken', () => {
    it('should validate and return user for valid token', async () => {
      // Arrange
      const token = 'valid-access-token';
      const userId = 'user-123';

      mockTokenService.verifyAccessToken.mockReturnValueOnce({ userId });
      mockUserRepo.findById.mockResolvedValueOnce({
        id: userId,
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      // Act
      const user = await authService.validateToken(token);

      // Assert
      expect(user.id).toBe(userId);
      expect(user.email).toBe('user@example.com');
    });

    it('should throw error for invalid token', async () => {
      // Arrange
      mockTokenService.verifyAccessToken.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(authService.validateToken('invalid-token')).rejects.toThrow('Invalid token');
    });
  });
});
```

#### Auth Middleware Tests

```bash
touch src/middleware/__tests__/auth.test.ts
```

```typescript
// src/middleware/__tests__/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware, requireAuth } from '../auth';
import { AuthService } from '@/services/auth';

describe('Auth Middleware', () => {
  let mockAuthService: Partial<AuthService>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    mockAuthService = {
      validateToken: vi.fn(),
    };

    req = {
      headers: {},
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    next = vi.fn();
  });

  describe('authMiddleware', () => {
    it('should attach user to request for valid token', async () => {
      // Arrange
      const middleware = authMiddleware(mockAuthService as AuthService);
      const user = { id: 'user-123', email: 'user@example.com' };
      
      req.headers = { authorization: 'Bearer valid-token' };
      mockAuthService.validateToken.mockResolvedValueOnce(user);

      // Act
      await middleware(req as Request, res as Response, next);

      // Assert
      expect(req.user).toEqual(user);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should continue without user for missing token', async () => {
      // Arrange
      const middleware = authMiddleware(mockAuthService as AuthService);

      // Act
      await middleware(req as Request, res as Response, next);

      // Assert
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should continue without user for invalid token', async () => {
      // Arrange
      const middleware = authMiddleware(mockAuthService as AuthService);
      req.headers = { authorization: 'Bearer invalid-token' };
      mockAuthService.validateToken.mockRejectedValueOnce(new Error('Invalid token'));

      // Act
      await middleware(req as Request, res as Response, next);

      // Assert
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireAuth', () => {
    it('should allow authenticated requests', () => {
      // Arrange
      req.user = { id: 'user-123', email: 'user@example.com' };

      // Act
      requireAuth(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated requests', () => {
      // Arrange
      req.user = undefined;

      // Act
      requireAuth(req as Request, res as Response, next);

      // Assert
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Authentication required',
      });
    });
  });
});
```

### Step 2: GREEN - Write Minimal Code to Pass

#### User Model and Repository

```bash
touch src/models/user.ts
touch src/repositories/user.ts
```

```typescript
// src/models/user.ts
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  passwordHash: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  emailVerified: z.boolean().default(false),
  lastLoginAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;
export type UserWithoutPassword = Omit<User, 'passwordHash'>;

// src/repositories/user.ts
import { DatabaseService } from '@/lib/database';
import { User, UserWithoutPassword } from '@/models/user';

export class UserRepository {
  constructor(private db: DatabaseService) {}

  async create(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  }): Promise<UserWithoutPassword> {
    const result = await this.db.query<User>(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.email, data.passwordHash, data.firstName, data.lastName]
    );

    const user = result.rows[0];
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query<User>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    return result.rows[0] || null;
  }

  async findById(id: string): Promise<UserWithoutPassword | null> {
    const result = await this.db.query<User>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    if (!result.rows[0]) return null;

    const { passwordHash, ...userWithoutPassword } = result.rows[0];
    return userWithoutPassword;
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.db.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  }
}
```

#### Token Service

```bash
touch src/services/token.ts
```

```typescript
// src/services/token.ts
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getEnv } from '@/config/env';

const TokenPayloadSchema = z.object({
  userId: z.string(),
  type: z.enum(['access', 'refresh']),
});

type TokenPayload = z.infer<typeof TokenPayloadSchema>;

export class TokenService {
  private readonly jwtSecret: string;
  private readonly accessTokenExpiry = '15m';
  private readonly refreshTokenExpiry = '7d';

  constructor() {
    const env = getEnv();
    this.jwtSecret = env.JWT_SECRET;
  }

  generateAccessToken(userId: string): string {
    const payload: TokenPayload = { userId, type: 'access' };
    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.accessTokenExpiry });
  }

  generateRefreshToken(userId: string): string {
    const payload: TokenPayload = { userId, type: 'refresh' };
    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.refreshTokenExpiry });
  }

  verifyAccessToken(token: string): TokenPayload {
    const decoded = jwt.verify(token, this.jwtSecret);
    const payload = TokenPayloadSchema.parse(decoded);
    
    if (payload.type !== 'access') {
      throw new Error('Invalid token type');
    }
    
    return payload;
  }

  verifyRefreshToken(token: string): TokenPayload {
    const decoded = jwt.verify(token, this.jwtSecret);
    const payload = TokenPayloadSchema.parse(decoded);
    
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    return payload;
  }
}
```

#### Auth Service

```bash
touch src/services/auth.ts
```

```typescript
// src/services/auth.ts
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { UserRepository } from '@/repositories/user';
import { TokenService } from './token';
import { UserWithoutPassword } from '@/models/user';

export class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AuthError';
  }
}

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const PasswordSchema = z.string()
  .min(8)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export interface AuthResult {
  user: UserWithoutPassword;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private readonly saltRounds = 10;

  constructor(
    private userRepo: UserRepository,
    private tokenService: TokenService
  ) {}

  async register(data: z.infer<typeof RegisterSchema>): Promise<AuthResult> {
    const validated = RegisterSchema.parse(data);

    // Validate password strength
    try {
      PasswordSchema.parse(validated.password);
    } catch (error) {
      throw new AuthError('Password does not meet security requirements', 'WEAK_PASSWORD');
    }

    // Check if email already exists
    const existing = await this.userRepo.findByEmail(validated.email);
    if (existing) {
      throw new AuthError('Email already registered', 'EMAIL_EXISTS');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validated.password, this.saltRounds);

    // Create user
    const user = await this.userRepo.create({
      email: validated.email,
      passwordHash,
      firstName: validated.firstName,
      lastName: validated.lastName,
    });

    // Generate tokens
    const accessToken = this.tokenService.generateAccessToken(user.id);
    const refreshToken = this.tokenService.generateRefreshToken(user.id);

    return { user, accessToken, refreshToken };
  }

  async login(data: z.infer<typeof LoginSchema>): Promise<AuthResult> {
    const validated = LoginSchema.parse(data);

    // Find user
    const user = await this.userRepo.findByEmail(validated.email);
    if (!user) {
      throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Verify password
    const valid = await bcrypt.compare(validated.password, user.passwordHash);
    if (!valid) {
      throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Update last login
    await this.userRepo.updateLastLogin(user.id);

    // Generate tokens
    const accessToken = this.tokenService.generateAccessToken(user.id);
    const refreshToken = this.tokenService.generateRefreshToken(user.id);

    const { passwordHash, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, accessToken, refreshToken };
  }

  async refreshToken(refreshToken: string): Promise<Omit<AuthResult, 'user'>> {
    try {
      const payload = this.tokenService.verifyRefreshToken(refreshToken);
      
      // Verify user still exists
      const user = await this.userRepo.findById(payload.userId);
      if (!user) {
        throw new AuthError('User not found', 'USER_NOT_FOUND');
      }

      // Generate new tokens
      const newAccessToken = this.tokenService.generateAccessToken(user.id);
      const newRefreshToken = this.tokenService.generateRefreshToken(user.id);

      return { 
        accessToken: newAccessToken, 
        refreshToken: newRefreshToken 
      };
    } catch (error) {
      throw new AuthError('Invalid refresh token', 'INVALID_TOKEN');
    }
  }

  async validateToken(token: string): Promise<UserWithoutPassword> {
    try {
      const payload = this.tokenService.verifyAccessToken(token);
      const user = await this.userRepo.findById(payload.userId);
      
      if (!user) {
        throw new AuthError('User not found', 'USER_NOT_FOUND');
      }

      return user;
    } catch (error) {
      throw new AuthError('Invalid token', 'INVALID_TOKEN');
    }
  }
}
```

#### Auth Middleware

```bash
touch src/middleware/auth.ts
```

```typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@/services/auth';
import { UserWithoutPassword } from '@/models/user';

declare global {
  namespace Express {
    interface Request {
      user?: UserWithoutPassword;
    }
  }
}

export const authMiddleware = (authService: AuthService) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const user = await authService.validateToken(token);
      req.user = user;
    } catch (error) {
      // Invalid token, continue without user
    }

    next();
  };
};

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      status: 'error',
      message: 'Authentication required',
    });
    return;
  }

  next();
};
```

### Step 3: REFACTOR - Improve Structure

#### Refactored Auth Service with Better Error Handling

```typescript
// src/services/auth.ts - REFACTORED
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { UserRepository } from '@/repositories/user';
import { TokenService } from './token';
import { UserWithoutPassword } from '@/models/user';
import { logger } from '@/lib/logger';
import { metrics } from '@/middleware/metrics';

// Error codes enum
export enum AuthErrorCode {
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  EMAIL_EXISTS = 'EMAIL_EXISTS',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_TOKEN = 'INVALID_TOKEN',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
}

export class AuthError extends Error {
  constructor(message: string, public code: AuthErrorCode) {
    super(message);
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

// Schemas
const RegisterSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string(),
  firstName: z.string().min(1).trim(),
  lastName: z.string().min(1).trim(),
});

const LoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string(),
});

const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must be less than 100 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Types
export type RegisterData = z.infer<typeof RegisterSchema>;
export type LoginData = z.infer<typeof LoginSchema>;

export interface AuthResult {
  user: UserWithoutPassword;
  accessToken: string;
  refreshToken: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Constants
const SALT_ROUNDS = 10;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export class AuthService {
  private loginAttempts = new Map<string, { count: number; lockedUntil?: Date }>();

  constructor(
    private readonly userRepo: UserRepository,
    private readonly tokenService: TokenService
  ) {}

  async register(data: RegisterData): Promise<AuthResult> {
    const validated = RegisterSchema.parse(data);

    // Validate password strength
    this.validatePassword(validated.password);

    // Check if email already exists
    const existing = await this.userRepo.findByEmail(validated.email);
    if (existing) {
      metrics.authFailures.inc({ reason: 'email_exists' });
      throw new AuthError('Email already registered', AuthErrorCode.EMAIL_EXISTS);
    }

    // Hash password
    const passwordHash = await this.hashPassword(validated.password);

    // Create user
    const user = await this.userRepo.create({
      email: validated.email,
      passwordHash,
      firstName: validated.firstName,
      lastName: validated.lastName,
    });

    logger.info('User registered', { userId: user.id, email: user.email });
    metrics.usersRegistered.inc();

    // Generate tokens
    const tokens = this.generateTokenPair(user.id);

    return { user, ...tokens };
  }

  async login(data: LoginData): Promise<AuthResult> {
    const validated = LoginSchema.parse(data);

    // Check if account is locked
    this.checkAccountLock(validated.email);

    // Find user
    const user = await this.userRepo.findByEmail(validated.email);
    if (!user) {
      this.recordFailedAttempt(validated.email);
      throw new AuthError('Invalid credentials', AuthErrorCode.INVALID_CREDENTIALS);
    }

    // Verify password
    const valid = await this.verifyPassword(validated.password, user.passwordHash);
    if (!valid) {
      this.recordFailedAttempt(validated.email);
      throw new AuthError('Invalid credentials', AuthErrorCode.INVALID_CREDENTIALS);
    }

    // Clear failed attempts
    this.clearFailedAttempts(validated.email);

    // Update last login
    await this.userRepo.updateLastLogin(user.id);

    logger.info('User logged in', { userId: user.id, email: user.email });
    metrics.successfulLogins.inc();

    // Generate tokens
    const tokens = this.generateTokenPair(user.id);
    const { passwordHash, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, ...tokens };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = this.tokenService.verifyRefreshToken(refreshToken);
      
      // Verify user still exists and is active
      const user = await this.userRepo.findById(payload.userId);
      if (!user) {
        throw new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND);
      }

      logger.info('Token refreshed', { userId: user.id });
      metrics.tokensRefreshed.inc();

      return this.generateTokenPair(user.id);
    } catch (error) {
      metrics.authFailures.inc({ reason: 'invalid_refresh_token' });
      throw new AuthError('Invalid refresh token', AuthErrorCode.INVALID_TOKEN);
    }
  }

  async validateToken(token: string): Promise<UserWithoutPassword> {
    try {
      const payload = this.tokenService.verifyAccessToken(token);
      const user = await this.userRepo.findById(payload.userId);
      
      if (!user) {
        throw new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND);
      }

      return user;
    } catch (error) {
      throw new AuthError('Invalid token', AuthErrorCode.INVALID_TOKEN);
    }
  }

  private validatePassword(password: string): void {
    try {
      PasswordSchema.parse(password);
    } catch (error) {
      throw new AuthError(
        'Password does not meet security requirements',
        AuthErrorCode.WEAK_PASSWORD
      );
    }
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private generateTokenPair(userId: string): TokenPair {
    return {
      accessToken: this.tokenService.generateAccessToken(userId),
      refreshToken: this.tokenService.generateRefreshToken(userId),
    };
  }

  private checkAccountLock(email: string): void {
    const attempts = this.loginAttempts.get(email);
    if (attempts?.lockedUntil && attempts.lockedUntil > new Date()) {
      metrics.authFailures.inc({ reason: 'account_locked' });
      throw new AuthError(
        'Account temporarily locked due to multiple failed login attempts',
        AuthErrorCode.ACCOUNT_LOCKED
      );
    }
  }

  private recordFailedAttempt(email: string): void {
    const attempts = this.loginAttempts.get(email) || { count: 0 };
    attempts.count++;

    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
      attempts.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION);
      logger.warn('Account locked due to failed attempts', { email });
    }

    this.loginAttempts.set(email, attempts);
    metrics.failedLogins.inc();
  }

  private clearFailedAttempts(email: string): void {
    this.loginAttempts.delete(email);
  }
}

// Add auth metrics
declare module '@/middleware/metrics' {
  interface Metrics {
    usersRegistered: Counter;
    successfulLogins: Counter;
    failedLogins: Counter;
    tokensRefreshed: Counter;
    authFailures: Counter;
  }
}
```

## API Documentation with OpenAPI/Swagger

### Step 1: Install Dependencies

```bash
cd property-search-api
npm install @fastify/swagger @fastify/swagger-ui
npm install --save-dev @types/swagger-ui-express
```

### Step 2: Create OpenAPI Schema Definitions

```bash
touch src/docs/openapi.ts
```

```typescript
// src/docs/openapi.ts
import { OpenAPIV3 } from 'openapi-types';
import { getEnv } from '@/config/env';

const env = getEnv();

export const openApiDocument: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: {
    title: 'Moov Property Search API',
    version: '1.0.0',
    description: 'AI-powered property search platform API',
    contact: {
      name: 'Moov Support',
      email: 'support@moov.com',
      url: 'https://moov.com/support',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: env.NODE_ENV === 'production' ? 'https://api.moov.com' : 'http://localhost:3001',
      description: env.NODE_ENV === 'production' ? 'Production' : 'Development',
    },
  ],
  tags: [
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Properties', description: 'Property search and management' },
    { name: 'Users', description: 'User profile management' },
    { name: 'Health', description: 'Health check endpoints' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT authentication token',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['status', 'message'],
        properties: {
          status: { type: 'string', enum: ['error'] },
          message: { type: 'string' },
          errors: {
            type: 'array',
            items: { type: 'object' },
          },
        },
      },
      User: {
        type: 'object',
        required: ['id', 'email', 'firstName', 'lastName', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          emailVerified: { type: 'boolean' },
          lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Property: {
        type: 'object',
        required: ['id', 'title', 'description', 'price', 'bedrooms', 'bathrooms', 'area', 'location', 'propertyType', 'listingType'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string' },
          price: { type: 'number', minimum: 0 },
          bedrooms: { type: 'integer', minimum: 0 },
          bathrooms: { type: 'integer', minimum: 0 },
          area: { type: 'number', minimum: 0 },
          location: {
            type: 'object',
            required: ['address', 'city', 'postcode', 'coordinates'],
            properties: {
              address: { type: 'string' },
              city: { type: 'string' },
              postcode: { type: 'string' },
              coordinates: {
                type: 'object',
                required: ['lat', 'lng'],
                properties: {
                  lat: { type: 'number' },
                  lng: { type: 'number' },
                },
              },
            },
          },
          images: {
            type: 'array',
            items: { type: 'string', format: 'uri' },
          },
          features: {
            type: 'array',
            items: { type: 'string' },
          },
          propertyType: {
            type: 'string',
            enum: ['house', 'flat', 'bungalow', 'maisonette', 'studio'],
          },
          listingType: {
            type: 'string',
            enum: ['sale', 'rent'],
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      SearchRequest: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 1 },
          filters: {
            type: 'object',
            properties: {
              minPrice: { type: 'number', minimum: 0 },
              maxPrice: { type: 'number', minimum: 0 },
              minBedrooms: { type: 'integer', minimum: 0 },
              maxBedrooms: { type: 'integer', minimum: 0 },
              propertyTypes: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['house', 'flat', 'bungalow', 'maisonette', 'studio'],
                },
              },
              location: { type: 'string' },
            },
          },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          similarityThreshold: { type: 'number', minimum: 0, maximum: 1, default: 0.3 },
        },
      },
      SearchResponse: {
        type: 'object',
        required: ['status', 'data'],
        properties: {
          status: { type: 'string', enum: ['success'] },
          data: {
            type: 'object',
            required: ['properties', 'total', 'searchTime'],
            properties: {
              properties: {
                type: 'array',
                items: {
                  allOf: [
                    { $ref: '#/components/schemas/Property' },
                    {
                      type: 'object',
                      properties: {
                        similarity_score: { type: 'number', minimum: 0, maximum: 1 },
                      },
                    },
                  ],
                },
              },
              total: { type: 'integer', minimum: 0 },
              searchTime: { type: 'integer', minimum: 0 },
            },
          },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          firstName: { type: 'string', minLength: 1 },
          lastName: { type: 'string', minLength: 1 },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      AuthResponse: {
        type: 'object',
        required: ['status', 'data'],
        properties: {
          status: { type: 'string', enum: ['success'] },
          data: {
            type: 'object',
            required: ['user', 'accessToken', 'refreshToken'],
            properties: {
              user: { $ref: '#/components/schemas/User' },
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
            },
          },
        },
      },
      RefreshTokenRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
      TokenResponse: {
        type: 'object',
        required: ['status', 'data'],
        properties: {
          status: { type: 'string', enum: ['success'] },
          data: {
            type: 'object',
            required: ['accessToken', 'refreshToken'],
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
            },
          },
        },
      },
    },
  },
  paths: {
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        operationId: 'register',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'User registered successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          '400': {
            description: 'Validation error or email already exists',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with email and password',
        operationId: 'login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        operationId: 'refreshToken',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RefreshTokenRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Token refreshed successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TokenResponse' },
              },
            },
          },
          '401': {
            description: 'Invalid refresh token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/properties/search': {
      post: {
        tags: ['Properties'],
        summary: 'Search properties using natural language',
        operationId: 'searchProperties',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SearchRequest' },
              examples: {
                basic: {
                  summary: 'Basic search',
                  value: {
                    query: 'Modern flat near tube station',
                  },
                },
                withFilters: {
                  summary: 'Search with filters',
                  value: {
                    query: 'Family home with garden',
                    filters: {
                      minBedrooms: 3,
                      maxPrice: 500000,
                      location: 'London',
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Search results',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SearchResponse' },
              },
            },
          },
          '400': {
            description: 'Invalid search parameters',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/properties/{id}': {
      get: {
        tags: ['Properties'],
        summary: 'Get property by ID',
        operationId: 'getProperty',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Property details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status', 'data'],
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: { $ref: '#/components/schemas/Property' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Property not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check endpoint',
        operationId: 'healthCheck',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['healthy', 'unhealthy'] },
                    timestamp: { type: 'string', format: 'date-time' },
                    uptime: { type: 'number' },
                    checks: {
                      type: 'object',
                      properties: {
                        database: { type: 'boolean' },
                        redis: { type: 'boolean' },
                        embedding: { type: 'boolean' },
                      },
                    },
                    version: { type: 'string' },
                  },
                },
              },
            },
          },
          '503': {
            description: 'Service is unhealthy',
          },
        },
      },
    },
  },
};
```

### Step 3: Add Swagger UI to Express

```typescript
// src/app.ts - Add Swagger documentation
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './docs/openapi';
import { createAuthRouter } from './routes/auth';
import { createPropertiesRouter } from './routes/properties';
import { createHealthRouter } from './routes/health';
import { errorHandler } from './middleware/error-handler';
import { metricsMiddleware, metricsHandler } from './middleware/metrics';
import { authMiddleware } from './middleware/auth';
import { apiLimiter, authLimiter } from './middleware/rate-limit';

export const createApp = (dependencies: AppDependencies): express.Application => {
  const app = express();

  // Basic middleware
  app.use(express.json());
  app.use(metricsMiddleware);

  // API Documentation
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Moov API Documentation',
  }));

  // Serve OpenAPI spec
  app.get('/api/openapi.json', (req, res) => {
    res.json(openApiDocument);
  });

  // Health checks (no auth required)
  app.use('/api', createHealthRouter(dependencies.database));

  // Metrics endpoint (consider adding auth in production)
  app.get('/metrics', metricsHandler);

  // Auth routes with specific rate limiting
  app.use('/api/auth', authLimiter, createAuthRouter(dependencies.authService));

  // API routes with auth middleware
  app.use('/api', apiLimiter, authMiddleware(dependencies.authService));
  app.use('/api/properties', createPropertiesRouter(
    dependencies.propertyRepository,
    dependencies.searchService
  ));

  // Error handling
  app.use(errorHandler);

  return app;
};
```

### Create Auth Routes

```bash
touch src/routes/auth.ts
```

```typescript
// src/routes/auth.ts
import { Router } from 'express';
import { z } from 'zod';
import { AuthService } from '@/services/auth';
import { ValidationError } from '@/lib/errors';

export const createAuthRouter = (authService: AuthService): Router => {
  const router = Router();

  router.post('/register', async (req, res, next) => {
    try {
      const result = await authService.register(req.body);
      
      res.status(201).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Validation error', []));
      } else {
        next(error);
      }
    }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const result = await authService.login(req.body);
      
      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/refresh', async (req, res, next) => {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);
      
      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
```

## Database Migration for Users Table

Create `migrations/002_create_users_table.sql`:

```sql
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Add trigger for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create saved searches table
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  query TEXT NOT NULL,
  filters JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create favorites table
CREATE TABLE IF NOT EXISTS favorite_properties (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, property_id)
);

-- Create indexes for user features
CREATE INDEX idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX idx_favorite_properties_user_id ON favorite_properties(user_id);
```

## Frontend Authentication Integration

### Auth Context and Hooks

```bash
cd property-search-frontend
touch src/contexts/AuthContext.tsx
```

```typescript
// src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClient } from '@/lib/api-client';
import { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
  apiClient: ApiClient;
}

export const AuthProvider = ({ children, apiClient }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check for stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      apiClient.setAuthToken(token);
      // Validate token and get user
      validateToken();
    } else {
      setIsLoading(false);
    }
  }, []);

  const validateToken = async () => {
    try {
      const user = await apiClient.getCurrentUser();
      setUser(user);
    } catch (error) {
      // Token invalid, clear it
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      apiClient.setAuthToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const result = await apiClient.login({ email, password });
    
    // Store tokens
    localStorage.setItem('accessToken', result.accessToken);
    localStorage.setItem('refreshToken', result.refreshToken);
    
    // Set auth header
    apiClient.setAuthToken(result.accessToken);
    
    // Set user
    setUser(result.user);
    
    // Redirect to dashboard
    router.push('/dashboard');
  };

  const register = async (data: RegisterData) => {
    const result = await apiClient.register(data);
    
    // Store tokens
    localStorage.setItem('accessToken', result.accessToken);
    localStorage.setItem('refreshToken', result.refreshToken);
    
    // Set auth header
    apiClient.setAuthToken(result.accessToken);
    
    // Set user
    setUser(result.user);
    
    // Redirect to dashboard
    router.push('/dashboard');
  };

  const logout = () => {
    // Clear tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    
    // Clear auth header
    apiClient.setAuthToken(null);
    
    // Clear user
    setUser(null);
    
    // Redirect to home
    router.push('/');
  };

  const refreshToken = async () => {
    const storedRefreshToken = localStorage.getItem('refreshToken');
    if (!storedRefreshToken) {
      throw new Error('No refresh token available');
    }

    const result = await apiClient.refreshToken(storedRefreshToken);
    
    // Update tokens
    localStorage.setItem('accessToken', result.accessToken);
    localStorage.setItem('refreshToken', result.refreshToken);
    
    // Update auth header
    apiClient.setAuthToken(result.accessToken);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      register,
      logout,
      refreshToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### Login Page Component

```bash
touch src/app/login/page.tsx
```

```typescript
// src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
              create a new account
            </Link>
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                Forgot your password?
              </a>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

## Summary

We've now added:

### Authentication System:
1. ✅ **User Registration & Login** - With secure password hashing
2. ✅ **JWT Token Management** - Access and refresh tokens
3. ✅ **Auth Middleware** - Protect routes requiring authentication
4. ✅ **Account Security** - Rate limiting, lockout after failed attempts
5. ✅ **Frontend Integration** - Auth context and hooks

### API Documentation:
1. ✅ **OpenAPI 3.0 Specification** - Complete API documentation
2. ✅ **Swagger UI Integration** - Interactive API explorer
3. ✅ **Request/Response Examples** - Clear usage examples
4. ✅ **Authentication Documentation** - Security scheme definitions
5. ✅ **Endpoint Descriptions** - Comprehensive API reference

The system now has:
- **Secure user authentication** with JWT tokens
- **Professional API documentation** at `/api/docs`
- **Account protection** with rate limiting and lockout
- **Type-safe API client** with auth support
- **User session management** in the frontend

Next steps could include:
- Email verification
- Password reset functionality
- OAuth integration (Google, GitHub)
- Two-factor authentication
- User profile management
- Admin dashboard for property management