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
    const { getField, setField, isLoading } = useYJSArtifactContext();

    // Local editing state
    const [isEditing, setIsEditing] = useState(false);
    const [localValue, setLocalValue] = useState('');
    const inputRef = useRef<any>(null);

    // Get current value from context
    const currentValue = getField(path) || '';

    // Debounced save function - use useCallback to prevent recreation
    const debouncedSave = useDebouncedCallback(
        React.useCallback((value: string) => {
            // Don't save if value is undefined, null, or hasn't actually changed
            if (value === undefined || value === null) {
                return;
            }

            const normalizedCurrentValue = currentValue || '';
            const normalizedNewValue = value || '';

            if (normalizedNewValue !== normalizedCurrentValue) {
                setField(path, value);
            }
        }, [setField, path, currentValue]),
        300
    );

    // Initialize local value when entering edit mode
    const handleEditStart = () => {
        setLocalValue(currentValue || '');
        setIsEditing(true);
        // Focus input after state update
        setTimeout(() => {
            inputRef.current?.focus();
        }, 0);
    };

    // Handle input changes
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setLocalValue(newValue);
        debouncedSave(newValue);
    };

    // Handle blur (exit editing)
    const handleBlur = () => {
        setIsEditing(false);
        // Final save on blur
        if (localValue !== currentValue) {
            setField(path, localValue);
        }
    };

    // Handle key press
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleBlur();
        }
        if (e.key === 'Escape') {
            setLocalValue(currentValue || '');
            setIsEditing(false);
        }
    };

    // Update local value when context value changes (but only when not editing)
    useEffect(() => {
        if (!isEditing) {
            setLocalValue(currentValue || '');
        }
    }, [currentValue, isEditing]);

    if (isEditing) {
        return (
            <Input
                ref={inputRef}
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyPress}
                placeholder={placeholder}
                disabled={disabled || isLoading}
                className={className}
                style={{ minWidth: '200px' }}
            />
        );
    }

    return (
        <Text
            onClick={disabled ? undefined : handleEditStart}
            style={{
                cursor: disabled ? 'default' : 'pointer',
                minHeight: '22px',
                display: 'inline-block',
                padding: '4px 8px',
                border: '1px solid transparent',
                borderRadius: '6px',
                minWidth: '200px',
                backgroundColor: 'transparent' // Ensure transparent background for dark theme
            }}
            className={className}
        >
            {currentValue || (
                <span style={{ color: '#999', fontStyle: 'italic' }}>
                    {placeholder || '点击编辑...'}
                </span>
            )}
        </Text>
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
    const { getField, setField, isLoading } = useYJSArtifactContext();

    // Local editing state
    const [isEditing, setIsEditing] = useState(false);
    const [localValue, setLocalValue] = useState('');
    const textAreaRef = useRef<any>(null);

    // Get current value from context
    const currentValue = getField(path) || '';

    // Debounced save function - use useCallback to prevent recreation
    const debouncedSave = useDebouncedCallback(
        React.useCallback((value: string) => {
            // Don't save if value is undefined, null, or hasn't actually changed
            if (value === undefined || value === null) {
                return;
            }

            const normalizedCurrentValue = currentValue || '';
            const normalizedNewValue = value || '';

            if (normalizedNewValue !== normalizedCurrentValue) {
                setField(path, value);
            }
        }, [setField, path, currentValue]),
        500
    );

    // Initialize local value when entering edit mode
    const handleEditStart = () => {
        setLocalValue(currentValue || '');
        setIsEditing(true);
        // Focus textarea after state update
        setTimeout(() => {
            textAreaRef.current?.focus();
        }, 0);
    };

    // Handle input changes
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setLocalValue(newValue);
        debouncedSave(newValue);
    };

    // Handle blur (exit editing)
    const handleBlur = () => {
        setIsEditing(false);
        // Final save on blur
        if (localValue !== currentValue) {
            setField(path, localValue);
        }
    };

    // Handle key press
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setLocalValue(currentValue || '');
            setIsEditing(false);
        }
    };

    // Update local value when context value changes (but only when not editing)
    useEffect(() => {
        if (!isEditing) {
            setLocalValue(currentValue || '');
        }
    }, [currentValue, isEditing]);

    if (isEditing) {
        return (
            <Input.TextArea
                ref={textAreaRef}
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyPress}
                placeholder={placeholder}
                disabled={disabled || isLoading}
                className={className}
                rows={rows}
                autoSize={autoSize}
            />
        );
    }

    return (
        <div
            onClick={disabled ? undefined : handleEditStart}
            style={{
                cursor: disabled ? 'default' : 'pointer',
                minHeight: '60px',
                padding: '8px 12px',
                border: '1px solid #424242', // Darker border for dark theme
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)' // Very subtle dark background
            }}
            className={className}
        >
            {currentValue || (
                <span style={{ color: '#999', fontStyle: 'italic' }}>
                    {placeholder || '点击编辑...'}
                </span>
            )}
        </div>
    );
};

// YJS Array Field Component (for string arrays)
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
    const { getField, setField, isLoading } = useYJSArtifactContext();

    // Local editing state
    const [isEditing, setIsEditing] = useState(false);
    const [localValue, setLocalValue] = useState('');
    const textAreaRef = useRef<any>(null);

    // Get current value from context with proper type checking
    const rawCurrentValue = getField(path);

    // Ensure we always have an array
    const currentArray = React.useMemo(() => {
        if (Array.isArray(rawCurrentValue)) {
            return rawCurrentValue;
        } else if (rawCurrentValue === null || rawCurrentValue === undefined || rawCurrentValue === '') {
            return [];
        } else {
            // Try to convert non-array values to array
            if (typeof rawCurrentValue === 'string') {
                return rawCurrentValue.split('\n').filter(line => line.trim().length > 0);
            } else {
                return [String(rawCurrentValue)];
            }
        }
    }, [rawCurrentValue, path]);

    // Convert array to textarea format with null safety
    const arrayToTextarea = (arr: string[] | null | undefined): string => {
        if (!arr || !Array.isArray(arr)) {
            return '';
        }
        return arr.filter(item => item && item.trim()).join('\n');
    };

    // Convert textarea to array format with null safety
    const textareaToArray = (text: string | null | undefined): string[] => {
        if (!text || typeof text !== 'string') return [];
        return text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
    };

    // Debounced save function - use useCallback to prevent recreation
    const debouncedSave = useDebouncedCallback(
        React.useCallback((value: string) => {
            // Don't save if value is undefined or null
            if (value === undefined || value === null) {
                return;
            }

            const newArray = textareaToArray(value);
            const currentArrayText = arrayToTextarea(currentArray);

            if (value !== currentArrayText) {  // Only save if value actually changed
                setField(path, newArray);
            }
        }, [setField, path, currentArray]),
        500
    );

    // Initialize local value when entering edit mode
    const handleEditStart = () => {
        setLocalValue(arrayToTextarea(currentArray) || '');
        setIsEditing(true);
        // Focus textarea after state update
        setTimeout(() => {
            textAreaRef.current?.focus();
        }, 0);
    };

    // Handle input changes
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setLocalValue(newValue);
        debouncedSave(newValue);
    };

    // Handle blur (exit editing)
    const handleBlur = () => {
        setIsEditing(false);
        // Final save on blur
        const newArray = textareaToArray(localValue);
        if (JSON.stringify(newArray) !== JSON.stringify(currentArray)) {
            setField(path, newArray);
        }
    };

    // Handle key press
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setLocalValue(arrayToTextarea(currentArray) || '');
            setIsEditing(false);
        }
    };

    // Update local value when context value changes (but only when not editing)
    useEffect(() => {
        if (!isEditing) {
            setLocalValue(arrayToTextarea(currentArray) || '');
        }
    }, [currentArray, isEditing]);

    if (isEditing) {
        return (
            <Input.TextArea
                ref={textAreaRef}
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyPress}
                placeholder={`${placeholder || '每行一个项目'}\n${itemPlaceholder}\n${itemPlaceholder}`}
                disabled={disabled || isLoading}
                className={className}
                rows={Math.max(3, Math.min(8, localValue.split('\n').length + 1))}
                style={{ fontFamily: 'monospace' }}
            />
        );
    }

    return (
        <div
            onClick={disabled ? undefined : handleEditStart}
            style={{
                cursor: disabled ? 'default' : 'pointer',
                minHeight: '60px',
                padding: '8px 12px',
                border: '1px solid #424242', // Darker border for dark theme
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)' // Very subtle dark background
            }}
            className={className}
        >
            {Array.isArray(currentArray) && currentArray.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                    {currentArray.map((item: string, index: number) => (
                        <li key={index} style={{ marginBottom: '4px' }}>
                            {String(item)}
                        </li>
                    ))}
                </ul>
            ) : (
                <span style={{ color: '#999', fontStyle: 'italic' }}>
                    {placeholder || '点击添加项目...'}
                </span>
            )}
        </div>
    );
}; 