'use client'

import { useState, useEffect, createContext, useContext } from 'react'

interface User {
    id: string
    email: string
    name?: string
    role?: 'user' | 'agent' | 'admin'
}

interface AuthContextType {
    user: User | null
    login: (email: string, password: string) => Promise<void>
    register: (name: string, email: string, password: string) => Promise<void>
    logout: () => void
    isLoading: boolean
    isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        // If no provider is found, return a default implementation
        return useAuthWithoutProvider()
    }
    return context
}

// Default implementation when no provider is available
function useAuthWithoutProvider(): AuthContextType {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        // Check for stored authentication on mount
        const storedUser = localStorage.getItem('user')
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser))
            } catch (error) {
                console.error('Error parsing stored user:', error)
                localStorage.removeItem('user')
            }
        }
    }, [])

    const login = async (email: string, password: string): Promise<void> => {
        setIsLoading(true)

        try {
            // Simulate API call - replace with actual authentication logic
            await new Promise(resolve => setTimeout(resolve, 1000))

            // For demo purposes, accept any email/password combination
            // In a real app, you'd validate against your backend
            if (email && password) {
                // Simple role assignment logic for demo - in real app this would come from backend
                let role: 'user' | 'agent' | 'admin' = 'user'
                if (email.includes('admin')) {
                    role = 'admin'
                } else if (email.includes('agent')) {
                    role = 'agent'
                }

                const userData: User = {
                    id: '1',
                    email,
                    name: email.split('@')[0],
                    role
                }

                setUser(userData)
                localStorage.setItem('user', JSON.stringify(userData))
            } else {
                throw new Error('Invalid credentials')
            }
        } catch (error) {
            throw new Error('Login failed')
        } finally {
            setIsLoading(false)
        }
    }

    const register = async (name: string, email: string, password: string): Promise<void> => {
        setIsLoading(true)

        try {
            // Simulate API call - replace with actual registration logic
            await new Promise(resolve => setTimeout(resolve, 1000))

            // For demo purposes, accept any name/email/password combination
            // In a real app, you'd validate and send to your backend
            if (name && email && password) {
                const userData: User = {
                    id: Math.random().toString(36).substr(2, 9), // Generate random ID
                    email,
                    name,
                    role: 'user' // Default role for new registrations
                }

                setUser(userData)
                localStorage.setItem('user', JSON.stringify(userData))
            } else {
                throw new Error('All fields are required')
            }
        } catch (error) {
            throw new Error('Registration failed')
        } finally {
            setIsLoading(false)
        }
    }

    const logout = () => {
        setUser(null)
        localStorage.removeItem('user')
    }

    return {
        user,
        login,
        register,
        logout,
        isLoading,
        isAuthenticated: !!user
    }
}

export { AuthContext }
export type { User, AuthContextType }