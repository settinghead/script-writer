// Electric config for authenticated requests (browser-safe)
export const createElectricConfig = () => {
    // Use absolute URL to avoid "Invalid URL" errors in Electric client
    const baseUrl = typeof window !== 'undefined'
        ? window.location.origin
        : 'http://127.0.0.1:4600';

    return {
        // Use our auth proxy instead of direct Electric URL
        url: `${baseUrl}/api/electric/v1/shape`,
        // Headers will be handled by the browser's cookie system
        // No need to manually set Authorization header since we use HTTP-only cookies
    };
};

// For development with debug token (browser-safe)
export const createElectricConfigWithDebugAuth = () => {
    // Use absolute URL to avoid "Invalid URL" errors in Electric client
    const baseUrl = typeof window !== 'undefined'
        ? window.location.origin
        : 'http://127.0.0.1:4600';

    return {
        url: `${baseUrl}/api/electric/v1/shape`,
        headers: {
            'Authorization': 'Bearer debug-auth-token-script-writer-dev'
        }
    };
};

// Helper to get the right config based on environment (browser-safe)
export const getElectricConfig = () => {
    // Check if we're in browser environment
    if (typeof window !== 'undefined') {
        // In browser, use the standard authenticated config
        // Debug mode can be enabled by setting a flag in localStorage for development
        const isDebugMode = localStorage.getItem('electric-debug-auth') === 'true';
        return isDebugMode ? createElectricConfigWithDebugAuth() : createElectricConfig();
    }

    // Server-side (Node.js) - can use process.env
    const isDebugMode = process.env.NODE_ENV === 'development' && process.env.USE_DEBUG_AUTH === 'true';
    return isDebugMode ? createElectricConfigWithDebugAuth() : createElectricConfig();
};

// Development helper functions (browser-safe)
export const enableElectricDebugAuth = () => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('electric-debug-auth', 'true');
        console.log('🔧 Electric debug auth enabled. Refresh the page to use debug tokens.');
    }
};

export const disableElectricDebugAuth = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('electric-debug-auth');
        console.log('🔧 Electric debug auth disabled. Refresh the page to use normal auth.');
    }
};

// Electric debugging utilities (browser-safe)
export const enableElectricDebugLogging = () => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('electric-debug-logging', 'true');
        console.log('🔧 Electric debug logging enabled. Shape errors will be logged in detail.');
    }
};

export const disableElectricDebugLogging = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('electric-debug-logging');
        console.log('🔧 Electric debug logging disabled.');
    }
};

export const isElectricDebugLoggingEnabled = (): boolean => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('electric-debug-logging') === 'true';
    }
    return false;
};



// Helper to clear Electric client cache (useful after 409 conflicts)
export const clearElectricCache = () => {
    if (typeof window !== 'undefined') {
        // Clear any Electric-related localStorage entries
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('electric-') || key.includes('shape-'))) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));

        console.log(`🧹 Cleared ${keysToRemove.length} Electric cache entries. Consider refreshing the page.`);
        return keysToRemove.length;
    }
    return 0;
}; 