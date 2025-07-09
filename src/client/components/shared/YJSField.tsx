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

    console.log(`[YJSTextField] Rendering field ${path}:`, { isLoading, isConnected, isCollaborative, disabled });

    // Local value state for immediate UI updates
    const [localValue, setLocalValue] = useState('');
    const inputRef = useRef<any>(null);

    // Get current value from context
    const currentValue = getField(path) || '';

    console.log(`[YJSTextField] Current value for ${path}: ${JSON.stringify(currentValue)}`);

    // Debounced save function - use useCallback to prevent recreation
    const debouncedSave = useDebouncedCallback(
        React.useCallback((value: string) => {
            console.log(`[YJSTextField] Debounced save called for ${path}: ${JSON.stringify(value)}`);

            // Don't save if value is undefined, null, or hasn't actually changed
            if (value === undefined || value === null) {
                console.log(`[YJSTextField] Skipping save - value is undefined/null`);
                return;
            }

            const normalizedCurrentValue = currentValue || '';
            const normalizedNewValue = value || '';

            if (normalizedNewValue !== normalizedCurrentValue) {
                console.log(`[YJSTextField] Saving ${path}: "${normalizedCurrentValue}" -> "${normalizedNewValue}"`);
                setField(path, value);
            } else {
                console.log(`[YJSTextField] Skipping save - no change for ${path}`);
            }
        }, [setField, path, currentValue]),
        300
    );

    // Handle input changes
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        console.log(`[YJSTextField] Input change for ${path}: ${JSON.stringify(newValue)}`);
        setLocalValue(newValue);
        debouncedSave(newValue);
    };

    // Handle blur (save final value)
    const handleBlur = () => {
        console.log(`[YJSTextField] Blur for ${path}, final value: ${JSON.stringify(localValue)}`);
        // Final save on blur
        if (localValue !== currentValue) {
            console.log(`[YJSTextField] Final save on blur for ${path}: ${JSON.stringify(localValue)}`);
            setField(path, localValue);
        }
    };

    // Handle key press
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            console.log(`[YJSTextField] Enter pressed for ${path}`);
            handleBlur();
        }
        if (e.key === 'Escape') {
            console.log(`[YJSTextField] Escape pressed for ${path}, reverting`);
            setLocalValue(currentValue || '');
        }
    };

    // Update local value when context value changes
    useEffect(() => {
        console.log(`[YJSTextField] Context value changed for ${path}: ${JSON.stringify(currentValue)}`);
        setLocalValue(currentValue || '');
    }, [currentValue]);

    const effectiveDisabled = disabled || isLoading;
    console.log(`[YJSTextField] Field ${path} disabled state: ${effectiveDisabled} (disabled: ${disabled}, isLoading: ${isLoading}, isConnected: ${isConnected})`);

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

    console.log(`[YJSTextAreaField] Rendering field ${path}:`, { isLoading, isConnected, isCollaborative, disabled });

    // Local value state for immediate UI updates
    const [localValue, setLocalValue] = useState('');
    const textAreaRef = useRef<any>(null);

    // Get current value from context
    const currentValue = getField(path) || '';

    console.log(`[YJSTextAreaField] Current value for ${path}: ${JSON.stringify(currentValue)}`);

    // Debounced save function - use useCallback to prevent recreation
    const debouncedSave = useDebouncedCallback(
        React.useCallback((value: string) => {
            console.log(`[YJSTextAreaField] Debounced save called for ${path}: ${JSON.stringify(value)}`);

            // Don't save if value is undefined, null, or hasn't actually changed
            if (value === undefined || value === null) {
                console.log(`[YJSTextAreaField] Skipping save - value is undefined/null`);
                return;
            }

            const normalizedCurrentValue = currentValue || '';
            const normalizedNewValue = value || '';

            if (normalizedNewValue !== normalizedCurrentValue) {
                console.log(`[YJSTextAreaField] Saving ${path}: "${normalizedCurrentValue}" -> "${normalizedNewValue}"`);
                setField(path, value);
            } else {
                console.log(`[YJSTextAreaField] Skipping save - no change for ${path}`);
            }
        }, [setField, path, currentValue]),
        300
    );

    // Handle input changes
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        console.log(`[YJSTextAreaField] Input change for ${path}: ${JSON.stringify(newValue)}`);
        setLocalValue(newValue);
        debouncedSave(newValue);
    };

    // Handle blur (save final value)
    const handleBlur = () => {
        console.log(`[YJSTextAreaField] Blur for ${path}, final value: ${JSON.stringify(localValue)}`);
        // Final save on blur
        if (localValue !== currentValue) {
            console.log(`[YJSTextAreaField] Final save on blur for ${path}: ${JSON.stringify(localValue)}`);
            setField(path, localValue);
        }
    };

    // Handle key press
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            console.log(`[YJSTextAreaField] Escape pressed for ${path}, reverting`);
            setLocalValue(currentValue || '');
        }
    };

    // Update local value when context value changes
    useEffect(() => {
        console.log(`[YJSTextAreaField] Context value changed for ${path}: ${JSON.stringify(currentValue)}`);
        setLocalValue(currentValue || '');
    }, [currentValue]);

    const effectiveDisabled = disabled || isLoading;
    console.log(`[YJSTextAreaField] Field ${path} disabled state: ${effectiveDisabled} (disabled: ${disabled}, isLoading: ${isLoading}, isConnected: ${isConnected})`);

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

    console.log(`[YJSArrayField] Rendering field ${path}:`, { isLoading, isConnected, isCollaborative, disabled });

    // Local value state for immediate UI updates
    const [localValue, setLocalValue] = useState('');
    const textAreaRef = useRef<any>(null);

    // Get current value from context
    const currentArray = getField(path) || [];

    console.log(`[YJSArrayField] Current array for ${path}:`, currentArray);

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
            console.log(`[YJSArrayField] Debounced save called for ${path}: ${JSON.stringify(value)}`);

            const newArray = textareaToArray(value);
            const currentArrayNormalized = Array.isArray(currentArray) ? currentArray : [];

            // Compare arrays
            const arraysEqual = JSON.stringify(newArray) === JSON.stringify(currentArrayNormalized);

            if (!arraysEqual) {
                console.log(`[YJSArrayField] Saving ${path}: ${JSON.stringify(currentArrayNormalized)} -> ${JSON.stringify(newArray)}`);
                setField(path, newArray);
            } else {
                console.log(`[YJSArrayField] Skipping save - no change for ${path}`);
            }
        }, [setField, path, currentArray]),
        300
    );

    // Handle input changes
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        console.log(`[YJSArrayField] Input change for ${path}: ${JSON.stringify(newValue)}`);
        setLocalValue(newValue);
        debouncedSave(newValue);
    };

    // Handle blur (save final value)
    const handleBlur = () => {
        console.log(`[YJSArrayField] Blur for ${path}, final value: ${JSON.stringify(localValue)}`);
        // Final save on blur
        const finalArray = textareaToArray(localValue);
        if (JSON.stringify(finalArray) !== JSON.stringify(currentArray)) {
            console.log(`[YJSArrayField] Final save on blur for ${path}: ${JSON.stringify(finalArray)}`);
            setField(path, finalArray);
        }
    };

    // Handle key press
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            console.log(`[YJSArrayField] Escape pressed for ${path}, reverting`);
            setLocalValue(currentValue);
        }
    };

    // Update local value when context value changes
    useEffect(() => {
        const newValue = arrayToTextarea(currentArray);
        console.log(`[YJSArrayField] Context value changed for ${path}: ${JSON.stringify(newValue)}`);
        setLocalValue(newValue);
    }, [currentArray]);

    const effectiveDisabled = disabled || isLoading;
    console.log(`[YJSArrayField] Field ${path} disabled state: ${effectiveDisabled} (disabled: ${disabled}, isLoading: ${isLoading}, isConnected: ${isConnected})`);

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