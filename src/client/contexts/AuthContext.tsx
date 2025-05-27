import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
    id: string;
    username: string;
    display_name?: string;
    status: string;
    created_at?: string;
}

export interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
}

export interface AuthContextType extends AuthState {
    login: (provider: string, username: string, data?: any) => Promise<boolean>;
    logout: () => Promise<void>;
    checkAuthStatus: () => Promise<void>;
    clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [state, setState] = useState<AuthState>({
        user: null,
        isAuthenticated: false,
        isLoading: true, // Start with loading true to check initial auth status
        error: null
    });

    // API helper function
    const apiCall = async (url: string, options: RequestInit = {}) => {
        const response = await fetch(url, {
            credentials: 'include', // Include cookies in requests
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Network error' }));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return response.json();
    };

    // Check authentication status
    const checkAuthStatus = async () => {
        try {
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            const data = await apiCall('/auth/status');

            setState(prev => ({
                ...prev,
                user: data.user,
                isAuthenticated: data.authenticated,
                isLoading: false,
                error: null
            }));
        } catch (error) {
            console.error('Failed to check auth status:', error);
            setState(prev => ({
                ...prev,
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: null // Don't show error for status check
            }));
        }
    };

    // Login function
    const login = async (provider: string, username: string, data?: any): Promise<boolean> => {
        try {
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            const response = await apiCall('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ provider, username, data }),
            });

            setState(prev => ({
                ...prev,
                user: response.user,
                isAuthenticated: true,
                isLoading: false,
                error: null
            }));

            return true;
        } catch (error) {
            console.error('Login failed:', error);
            setState(prev => ({
                ...prev,
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: error instanceof Error ? error.message : 'Login failed'
            }));
            return false;
        }
    };

    // Logout function
    const logout = async () => {
        try {
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            await apiCall('/auth/logout', {
                method: 'POST',
            });

            setState(prev => ({
                ...prev,
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: null
            }));
        } catch (error) {
            console.error('Logout failed:', error);
            // Even if logout API fails, clear local state
            setState(prev => ({
                ...prev,
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: null
            }));
        }
    };

    // Clear error
    const clearError = () => {
        setState(prev => ({ ...prev, error: null }));
    };

    // Check auth status on mount
    useEffect(() => {
        checkAuthStatus();
    }, []);

    // Setup request interceptor for 401 responses
    useEffect(() => {
        const handleUnauthorized = (event: Event) => {
            if (event instanceof CustomEvent && event.detail === 401) {
                setState(prev => ({
                    ...prev,
                    user: null,
                    isAuthenticated: false,
                    error: 'Session expired. Please log in again.'
                }));
            }
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, []);

    const contextValue: AuthContextType = {
        ...state,
        login,
        logout,
        checkAuthStatus,
        clearError,
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

// Helper function to dispatch 401 events from API calls
export const dispatchUnauthorized = () => {
    window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: 401 }));
};

// Enhanced fetch wrapper that handles 401s automatically
export const authFetch = async (url: string, options: RequestInit = {}) => {
    try {
        const response = await fetch(url, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });

        if (response.status === 401) {
            dispatchUnauthorized();
            const errorData = await response.json().catch(() => ({ error: 'Unauthorized' }));
            throw new Error(errorData.error || 'Authentication required');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Network error' }));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return response.json();
    } catch (error) {
        if (error instanceof Error && error.message.includes('401')) {
            dispatchUnauthorized();
        }
        throw error;
    }
}; 