import { useState, useEffect } from 'react';

/**
 * Custom hook for persisting state in localStorage
 * @param key - The localStorage key
 * @param defaultValue - Default value if nothing is stored
 * @returns [state, setState] tuple similar to useState
 */
export function useStorageState<T>(
    key: string,
    initialValue: T,
    storage: Storage = localStorage
): [T, (value: T | ((prev: T) => T)) => void] {
    const [state, setState] = useState<T>(() => {
        try {
            const item = storage.getItem(key);
            if (item === null) return initialValue;
            return JSON.parse(item);
        } catch (error) {
            return initialValue;
        }
    });

    const setValue = (value: T | ((prev: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(state) : value;
            setState(valueToStore);
            storage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            // Failed to save to storage, silently continue
        }
    };

    return [state, setValue];
} 