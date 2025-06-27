// Authentication-enhanced API Client
import { ApiClient } from './api-client';
import { User } from '@/types';

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: 'user' | 'agent';
}

export interface AuthResponse {
    user: User;
    tokens: AuthTokens;
}

export interface ApiClientConfig {
    baseURL: string;
    timeout?: number;
    headers?: Record<string, string>;
}

export class AuthenticatedApiClient extends ApiClient {
    private tokens: AuthTokens | null = null;
    private refreshPromise: Promise<AuthTokens> | null = null;

    constructor(config: ApiClientConfig) {
        super(config);
        this.loadTokensFromStorage();
    }

    // Token Management
    private loadTokensFromStorage(): void {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('auth_tokens');
            if (stored) {
                try {
                    this.tokens = JSON.parse(stored);
                    if (this.tokens?.accessToken) {
                        this.setAuthToken(this.tokens.accessToken);
                    }
                } catch (error) {
                    console.error('Failed to parse stored tokens:', error);
                    this.clearTokens();
                }
            }
        }
    }

    private saveTokensToStorage(tokens: AuthTokens): void {
        if (typeof window !== 'undefined') {
            localStorage.setItem('auth_tokens', JSON.stringify(tokens));
        }
        this.tokens = tokens;
        this.setAuthToken(tokens.accessToken);
    }

    private clearTokens(): void {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_tokens');
        }
        this.tokens = null;
        this.setAuthToken(null);
    }

    private isTokenExpired(): boolean {
        if (!this.tokens) return true;
        return Date.now() >= this.tokens.expiresAt;
    }

    // Authentication Methods
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const response = await this.client.post<{ status: string; data: AuthResponse }>('/api/auth/login', credentials);
        const authData = this.extractData(response.data);

        this.saveTokensToStorage(authData.tokens);
        return authData;
    }

    async register(data: RegisterData): Promise<AuthResponse> {
        const response = await this.client.post<{ status: string; data: AuthResponse }>('/api/auth/register', data);
        const authData = this.extractData(response.data);

        this.saveTokensToStorage(authData.tokens);
        return authData;
    }

    async logout(): Promise<void> {
        try {
            if (this.tokens?.refreshToken) {
                await this.client.post('/api/auth/logout', {
                    refreshToken: this.tokens.refreshToken,
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.clearTokens();
        }
    }

    async refreshTokens(): Promise<AuthTokens> {
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        if (!this.tokens?.refreshToken) {
            throw new Error('No refresh token available');
        }

        this.refreshPromise = (async () => {
            try {
                const response = await this.client.post<{ status: string; data: AuthTokens }>('/api/auth/refresh', {
                    refreshToken: this.tokens!.refreshToken,
                });

                const newTokens = this.extractData(response.data);
                this.saveTokensToStorage(newTokens);
                return newTokens;
            } catch (error) {
                this.clearTokens();
                throw error;
            } finally {
                this.refreshPromise = null;
            }
        })();

        return this.refreshPromise;
    }

    async getCurrentUser(): Promise<User> {
        const response = await this.client.get<{ status: string; data: User }>('/api/auth/me');
        return this.extractData(response.data);
    }

    // Override request method to handle token refresh
    async makeAuthenticatedRequest<T>(requestFn: () => Promise<T>): Promise<T> {
        // Check if token needs refresh
        if (this.tokens && this.isTokenExpired()) {
            try {
                await this.refreshTokens();
            } catch (error) {
                throw new Error('Authentication failed. Please log in again.');
            }
        }

        try {
            return await requestFn();
        } catch (error: any) {
            // If we get a 401, try refreshing once
            if (error.statusCode === 401 && this.tokens?.refreshToken) {
                try {
                    await this.refreshTokens();
                    return await requestFn();
                } catch (refreshError) {
                    this.clearTokens();
                    throw new Error('Authentication failed. Please log in again.');
                }
            }
            throw error;
        }
    }

    // Utility Methods
    isAuthenticated(): boolean {
        return !!this.tokens && !this.isTokenExpired();
    }

    getTokens(): AuthTokens | null {
        return this.tokens;
    }

    // Override parent methods to add authentication
    async searchProperties(options: any): Promise<any> {
        return this.makeAuthenticatedRequest(() => super.searchProperties(options));
    }

    async getProperty(id: string): Promise<any> {
        return this.makeAuthenticatedRequest(() => super.getProperty(id));
    }

    async createProperty(data: any): Promise<any> {
        return this.makeAuthenticatedRequest(() => super.createProperty(data));
    }

    async updateProperty(id: string, data: any): Promise<any> {
        return this.makeAuthenticatedRequest(() => super.updateProperty(id, data));
    }

    async deleteProperty(id: string): Promise<void> {
        return this.makeAuthenticatedRequest(() => super.deleteProperty(id));
    }
}

// Factory function for authenticated client
export const createAuthenticatedApiClient = (config: any = {}) => {
    const defaultConfig = {
        baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
        timeout: 10000,
        retryAttempts: 3,
        retryDelay: 1000,
        ...config,
    };

    return new AuthenticatedApiClient(defaultConfig);
};

// Auth state management
export class AuthState {
    private client: AuthenticatedApiClient;
    private user: User | null = null;
    private listeners: Array<(user: User | null) => void> = [];

    constructor(client: AuthenticatedApiClient) {
        this.client = client;
        this.initializeAuth();
    }

    private async initializeAuth(): Promise<void> {
        if (this.client.isAuthenticated()) {
            try {
                this.user = await this.client.getCurrentUser();
                this.notifyListeners();
            } catch (error) {
                console.error('Failed to get current user:', error);
                this.client.logout();
            }
        }
    }

    private notifyListeners(): void {
        this.listeners.forEach(listener => listener(this.user));
    }

    subscribe(listener: (user: User | null) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    async login(credentials: LoginCredentials): Promise<User> {
        const { user } = await this.client.login(credentials);
        this.user = user;
        this.notifyListeners();
        return user;
    }

    async register(data: RegisterData): Promise<User> {
        const { user } = await this.client.register(data);
        this.user = user;
        this.notifyListeners();
        return user;
    }

    async logout(): Promise<void> {
        await this.client.logout();
        this.user = null;
        this.notifyListeners();
    }

    getUser(): User | null {
        return this.user;
    }

    isAuthenticated(): boolean {
        return this.client.isAuthenticated();
    }

    getClient(): AuthenticatedApiClient {
        return this.client;
    }
}

// Singleton auth state
let authStateInstance: AuthState | null = null;

export const getAuthState = (): AuthState => {
    if (!authStateInstance) {
        const client = createAuthenticatedApiClient();
        authStateInstance = new AuthState(client);
    }
    return authStateInstance;
};