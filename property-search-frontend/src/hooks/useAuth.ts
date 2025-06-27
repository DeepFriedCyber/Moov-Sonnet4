// Enhanced Authentication hooks using React Query
'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAuthState, LoginCredentials, RegisterData } from '@/lib/auth-api-client';
import { User } from '@/types';

// Legacy interface for backward compatibility
interface LegacyAuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
    isAuthenticated: boolean;
}

const AuthContext = createContext<LegacyAuthContextType | undefined>(undefined);

// Get the auth state singleton
const authState = getAuthState();

// Enhanced auth hook with React Query
export const useAuth = () => {
    const [user, setUser] = useState<User | null>(authState.getUser());
    const queryClient = useQueryClient();

    useEffect(() => {
        // Subscribe to auth state changes
        const unsubscribe = authState.subscribe((newUser) => {
            setUser(newUser);
            if (!newUser) {
                // Clear all queries when user logs out
                queryClient.clear();
            }
        });

        return unsubscribe;
    }, [queryClient]);

    const login = useMutation({
        mutationFn: (credentials: LoginCredentials) => authState.login(credentials),
        onSuccess: (user) => {
            setUser(user);
            // Invalidate all queries to refetch with new auth
            queryClient.invalidateQueries();
        },
    });

    const register = useMutation({
        mutationFn: (data: RegisterData) => authState.register(data),
        onSuccess: (user) => {
            setUser(user);
            queryClient.invalidateQueries();
        },
    });

    const logout = useMutation({
        mutationFn: () => authState.logout(),
        onSuccess: () => {
            setUser(null);
            queryClient.clear();
        },
    });

    // Legacy wrapper functions for backward compatibility
    const legacyLogin = async (email: string, password: string): Promise<void> => {
        await new Promise<void>((resolve, reject) => {
            login.mutate({ email, password }, {
                onSuccess: () => resolve(),
                onError: (error) => reject(error),
            });
        });
    };

    const legacyRegister = async (name: string, email: string, password: string): Promise<void> => {
        await new Promise<void>((resolve, reject) => {
            register.mutate({
                firstName: name.split(' ')[0] || name,
                lastName: name.split(' ').slice(1).join(' ') || '',
                email,
                password
            }, {
                onSuccess: () => resolve(),
                onError: (error) => reject(error),
            });
        });
    };

    const legacyLogout = (): void => {
        logout.mutate();
    };

    return {
        user,
        isAuthenticated: !!user,
        isLoading: login.isPending || register.isPending || logout.isPending,

        // New enhanced methods
        loginMutation: login.mutate,
        registerMutation: register.mutate,
        logoutMutation: logout.mutate,
        loginError: login.error,
        registerError: register.error,
        logoutError: logout.error,

        // Legacy methods for backward compatibility
        login: legacyLogin,
        register: legacyRegister,
        logout: legacyLogout,
    };
};

// Hook for getting the authenticated API client
export const useAuthenticatedApiClient = () => {
    return authState.getClient();
};

// Hook for protecting routes
export const useRequireAuth = () => {
    const { user, isAuthenticated } = useAuth();

    return {
        user,
        isAuthenticated,
        requireAuth: useCallback(() => {
            if (!isAuthenticated) {
                throw new Error('Authentication required');
            }
            return user!;
        }, [isAuthenticated, user]),
    };
};

// Hook for current user data with auto-refresh
export const useCurrentUser = () => {
    const { isAuthenticated } = useAuth();

    return useQuery({
        queryKey: ['currentUser'],
        queryFn: () => authState.getClient().getCurrentUser(),
        enabled: isAuthenticated,
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: false,
    });
};

// Hook for auth status checking
export const useAuthStatus = () => {
    const [isChecking, setIsChecking] = useState(true);
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        // Simulate auth check completion
        const timer = setTimeout(() => {
            setIsChecking(false);
        }, 100);

        return () => clearTimeout(timer);
    }, []);

    return {
        isChecking,
        isAuthenticated,
        isReady: !isChecking,
    };
};

// Legacy context provider for backward compatibility
export const useAuthContext = () => {
    const context = useContext(AuthContext);
    const fallbackAuth = useAuth(); // Always call hooks unconditionally

    if (context === undefined) {
        // Fallback to the new enhanced auth
        return fallbackAuth;
    }
    return context;
};

export { AuthContext };
export type { User, LegacyAuthContextType as AuthContextType };