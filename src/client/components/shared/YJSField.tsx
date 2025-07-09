import React, { useState, useEffect, useRef } from 'react';
import { Input, Typography } from 'antd';
import { useYJSArtifactContext } from '../../contexts/YJSArtifactContext';
import { useDebouncedCallback } from '../../hooks/useDebounce';

const { Text } = Typography;

// Base YJS Field Props
export interface YJSFieldProps {
    path: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

// YJS Text Field Component
export const YJSTextField: React.FC<YJSFieldProps> = ({
    path,
    placeholder,
    disabled = false,
    className
}) => {
    const { getField, setField, isLoading, isConnected, isCollaborative } = useYJSArtifactContext();

    // Initialize local value with empty string, will be set properly in useEffect
    const [localValue, setLocalValue] = useState('');
    const inputRef = useRef<any>(null);
    const initializedRef = useRef(false);

    // Initialize when component mounts and data is available
    useEffect(() => {
        if (!initializedRef.current) {
            // Small delay to ensure YJS context is ready
            const timer = setTimeout(() => {
                const currentValue = getField(path) || '';
                setLocalValue(currentValue);
                initializedRef.current = true;
            }, 100);

            return () => clearTimeout(timer);
        }
    }, []); // Empty dependency array - only run once on mount

    // Debounced save function - use useCallback to prevent recreation
    const debouncedSave = useDebouncedCallback(
        React.useCallback((value: string) => {
            // Don't save if value is undefined, null
            if (value === undefined || value === null) {
                return;
            }

            setField(path, value);
        }, [setField, path]),
        300
    );

    // Handle input changes
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setLocalValue(newValue);
        debouncedSave(newValue);
    };

    // Handle blur (save final value)
    const handleBlur = () => {
        // Final save on blur
        setField(path, localValue);
    };

    // Handle key press
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleBlur();
        }
        if (e.key === 'Escape') {
            // Reset to current YJS value on escape
            const currentYJSValue = getField(path) || '';
            setLocalValue(currentYJSValue);
        }
    };

    const effectiveDisabled = disabled || isLoading;

    return (
        <Input
            ref={inputRef}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyPress}
            placeholder={placeholder}
            disabled={effectiveDisabled}
            className={className}
            style={{ minWidth: '200px' }}
        />
    );
};

// YJS TextArea Field Component
export interface YJSTextAreaFieldProps extends YJSFieldProps {
    rows?: number;
    autoSize?: boolean | { minRows?: number; maxRows?: number };
}

export const YJSTextAreaField: React.FC<YJSTextAreaFieldProps> = ({
    path,
    placeholder,
    disabled = false,
    className,
    rows = 3,
    autoSize = { minRows: 3, maxRows: 8 }
}) => {
    const { getField, setField, isLoading, isConnected, isCollaborative } = useYJSArtifactContext();

    // Initialize local value with empty string, will be set properly in useEffect
    const [localValue, setLocalValue] = useState('');
    const textAreaRef = useRef<any>(null);
    const initializedRef = useRef(false);

    // Initialize when component mounts and data is available
    useEffect(() => {
        if (!initializedRef.current) {
            // Small delay to ensure YJS context is ready
            const timer = setTimeout(() => {
                const currentValue = getField(path) || '';
                console.log(`[YJSTextAreaField] Initializing path: ${path}, value:`, currentValue);
                setLocalValue(currentValue);
                initializedRef.current = true;
            }, 100);

            return () => clearTimeout(timer);
        }
    }, []); // Empty dependency array - only run once on mount

    // Debounced save function - use useCallback to prevent recreation
    const debouncedSave = useDebouncedCallback(
        React.useCallback((value: string) => {
            // Don't save if value is undefined, null
            if (value === undefined || value === null) {
                return;
            }

            setField(path, value);
        }, [setField, path]),
        300
    );

    // Handle input changes
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setLocalValue(newValue);
        debouncedSave(newValue);
    };

    // Handle blur (save final value)
    const handleBlur = () => {
        // Final save on blur
        setField(path, localValue);
    };

    // Handle key press
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            // Reset to current YJS value on escape
            const currentYJSValue = getField(path) || '';
            setLocalValue(currentYJSValue);
        }
    };

    const effectiveDisabled = disabled || isLoading;

    return (
        <Input.TextArea
            ref={textAreaRef}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyPress}
            placeholder={placeholder}
            disabled={effectiveDisabled}
            className={className}
            rows={rows}
            autoSize={autoSize}
            style={{ minWidth: '200px' }}
        />
    );
};

// YJS Array Field Component
export interface YJSArrayFieldProps extends YJSFieldProps {
    itemPlaceholder?: string;
}

export const YJSArrayField: React.FC<YJSArrayFieldProps> = ({
    path,
    placeholder,
    disabled = false,
    className,
    itemPlaceholder = '新项目'
}) => {
    const { getField, setField, isLoading, isConnected, isCollaborative } = useYJSArtifactContext();

    // Local value state for immediate UI updates
    const [localValue, setLocalValue] = useState('');
    const textAreaRef = useRef<any>(null);

    // Get current value from context
    const currentArray = getField(path) || [];
    const currentArrayRef = useRef(currentArray);

    // Update ref when currentArray changes
    useEffect(() => {
        currentArrayRef.current = currentArray;
    }, [currentArray]);

    // Convert array to textarea format (one item per line)
    const arrayToTextarea = (arr: string[] | null | undefined): string => {
        if (!Array.isArray(arr)) return '';
        return arr.filter(item => item && item.trim()).join('\n');
    };

    // Convert textarea to array format
    const textareaToArray = (text: string | null | undefined): string[] => {
        if (!text || typeof text !== 'string') return [];
        return text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
    };

    const currentValue = arrayToTextarea(currentArray);

    // Debounced save function
    const debouncedSave = useDebouncedCallback(
        React.useCallback((value: string) => {
            const newArray = textareaToArray(value);
            const currentArrayNormalized = Array.isArray(currentArrayRef.current) ? currentArrayRef.current : [];

            // Compare arrays
            const arraysEqual = JSON.stringify(newArray) === JSON.stringify(currentArrayNormalized);

            if (!arraysEqual) {
                setField(path, newArray);
            }
        }, [setField, path]), // Remove currentArray from dependencies
        300
    );

    // Handle input changes
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setLocalValue(newValue);
        debouncedSave(newValue);
    };

    // Handle blur (save final value)
    const handleBlur = () => {
        // Final save on blur
        const finalArray = textareaToArray(localValue);
        if (JSON.stringify(finalArray) !== JSON.stringify(currentArrayRef.current)) {
            setField(path, finalArray);
        }
    };

    // Handle key press
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setLocalValue(currentValue);
        }
    };

    // Update local value when context value changes
    useEffect(() => {
        const newValue = arrayToTextarea(currentArray);
        setLocalValue(newValue);
    }, [currentArray]);

    const effectiveDisabled = disabled || isLoading;

    return (
        <Input.TextArea
            ref={textAreaRef}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyPress}
            placeholder={placeholder || '每行一个项目...'}
            disabled={effectiveDisabled}
            rows={4}
            autoSize={{ minRows: 4, maxRows: 10 }}
            className={className}
            style={{ minWidth: '200px' }}
        />
    );
}; 