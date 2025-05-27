import { useState, useEffect } from 'react';

/**
 * Custom hook for persisting state in localStorage
 * @param key - The localStorage key
 * @param defaultValue - Default value if nothing is stored
 * @returns [state, setState] tuple similar to useState
 */
export function useStorageState<T>(key: string, defaultValue: T): [T, (value: T) => void] {
    // Initialize state with value from localStorage or default
    const [state, setState] = useState<T>(() => {
        try {
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : defaultValue;
        } catch (error) {
            console.warn(`Failed to parse localStorage key "${key}":`, error);
            return defaultValue;
        }
    });

    // Update localStorage whenever state changes
    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.warn(`Failed to save to localStorage key "${key}":`, error);
        }
    }, [key, state]);

    return [state, setState];
} 