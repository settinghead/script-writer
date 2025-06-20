import { useState, useEffect } from 'react';

/**
 * Hook that debounces a value by the specified delay
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds (default: 500)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Hook that provides a debounced callback function
 * @param callback - The callback function to debounce
 * @param delay - The delay in milliseconds (default: 500)
 * @returns The debounced callback function
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
    callback: T,
    delay: number = 500
): T {
    const [debouncedCallback] = useState(() => {
        let timeoutId: NodeJS.Timeout | null = null;

        return ((...args: Parameters<T>) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            timeoutId = setTimeout(() => {
                callback(...args);
                timeoutId = null;
            }, delay);
        }) as T;
    });

    return debouncedCallback;
} 