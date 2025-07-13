import React, { useState, useEffect, useRef } from 'react';
import { Input, Typography } from 'antd';
import { useYJSJsonDoc } from '../../transform-jsonDoc-framework/hooks/useYJSJsonDoc';

const { Text } = Typography;

export interface YJSEditableTextProps {
    jsonDocId: string;
    field: string;
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    multiline?: boolean;
    enableCollaboration?: boolean;
    onSave?: (value: string) => void;
    style?: React.CSSProperties;
    className?: string;
}

export const YJSEditableText: React.FC<YJSEditableTextProps> = ({
    jsonDocId,
    field,
    value: externalValue,
    placeholder = '',
    disabled = false,
    multiline = false,
    enableCollaboration = true,
    onSave,
    style,
    className
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localValue, setLocalValue] = useState('');
    const inputRef = useRef<any>(null);
    const lastSavedValueRef = useRef<string>('');

    // Use YJS hook for collaborative editing
    const {
        data,
        updateField,
        isCollaborative,
        isLoading,
        error
    } = useYJSJsonDoc(jsonDocId, {
        enableCollaboration
    });

    // Get current value (prioritize collaborative data over external value)
    const currentValue = data?.[field] ?? externalValue ?? '';

    // Update local value when current value changes
    useEffect(() => {
        if (!isEditing) {
            // For collaborative mode, prefer the YJS data or last saved value
            const valueToUse = isCollaborative ?
                (data?.[field] || lastSavedValueRef.current || externalValue || '') :
                currentValue;
            setLocalValue(valueToUse);
        }
    }, [currentValue, isEditing, isCollaborative, data, field, externalValue]);

    // Handle edit start
    const handleEditStart = () => {
        if (disabled) return;
        setIsEditing(true);

        // Use the most current value for editing
        const valueToEdit = isCollaborative ?
            (data?.[field] || lastSavedValueRef.current || externalValue || '') :
            currentValue;
        setLocalValue(valueToEdit);

        // Focus input after state update
        setTimeout(() => {
            inputRef.current?.focus();
        }, 0);
    };

    // Handle edit save
    const handleSave = () => {
        const trimmedValue = localValue.trim();
        console.log('YJSEditableText handleSave called:', { field, trimmedValue, isCollaborative });

        if (isCollaborative) {
            // Update via YJS for collaborative editing
            console.log('YJSEditableText: calling updateField for collaborative editing');
            updateField(field, trimmedValue);

            // Remember the value we just saved to prevent reverting
            lastSavedValueRef.current = trimmedValue;
            setIsEditing(false);
        } else {
            // Fallback to external save handler
            console.log('YJSEditableText: calling external onSave handler');
            onSave?.(trimmedValue);
            setIsEditing(false);
        }
    };

    // Handle edit cancel
    const handleCancel = () => {
        setLocalValue(currentValue);
        setIsEditing(false);
    };

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setLocalValue(e.target.value);
    };

    // Handle key press
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    };

    // Handle blur
    const handleBlur = () => {
        handleSave();
    };

    // Show loading state
    if (isLoading) {
        return (
            <div style={style} className={className}>
                <Text type="secondary">Loading...</Text>
            </div>
        );
    }

    // Show error state
    if (error) {
        return (
            <div style={style} className={className}>
                <Text type="danger">Error: {error}</Text>
            </div>
        );
    }

    // Render input when editing
    if (isEditing) {
        const inputProps = {
            ref: inputRef,
            value: localValue,
            onChange: handleInputChange,
            onKeyDown: handleKeyPress,
            onBlur: handleBlur,
            placeholder,
            style: {
                ...style,
                // Visual indicator for collaborative mode
                borderColor: isCollaborative ? '#1890ff' : undefined,
                boxShadow: isCollaborative ? '0 0 0 2px rgba(24, 144, 255, 0.2)' : undefined
            },
            className
        };

        if (multiline) {
            return (
                <Input.TextArea
                    {...inputProps}
                    autoSize={{ minRows: 2, maxRows: 6 }}
                />
            );
        } else {
            return <Input {...inputProps} />;
        }
    }

    // For display mode, use the most up-to-date value
    const displayValue = isCollaborative ?
        (data?.[field] || lastSavedValueRef.current || externalValue || '') :
        currentValue;

    // Render display text when not editing
    return (
        <div
            style={{
                ...style,
                cursor: disabled ? 'default' : 'pointer',
                minHeight: '32px',
                display: 'flex',
                alignItems: 'center',
                padding: '4px 11px',
                border: '1px solid transparent',
                borderRadius: '6px',
                transition: 'all 0.2s',
                // Visual indicator for collaborative mode
                borderColor: isCollaborative ? 'rgba(24, 144, 255, 0.2)' : 'transparent',
                backgroundColor: isCollaborative ? 'rgba(24, 144, 255, 0.05)' : 'transparent'
            }}
            className={className}
            onClick={handleEditStart}
            onDoubleClick={handleEditStart}
        >
            {displayValue ? (
                <Text style={{ wordBreak: 'break-word' }}>
                    {displayValue}
                </Text>
            ) : (
                <Text type="secondary" style={{ fontStyle: 'italic' }}>
                    {placeholder || 'Click to edit...'}
                </Text>
            )}

            {isCollaborative && (
                <div style={{
                    marginLeft: '8px',
                    fontSize: '12px',
                    color: '#1890ff',
                    opacity: 0.7
                }}>
                    ⚡ Live
                </div>
            )}
        </div>
    );
}; 