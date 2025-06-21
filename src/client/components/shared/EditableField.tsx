import React, { useState, useEffect } from 'react';
import { Input } from 'antd';

const { TextArea } = Input;

interface EditableFieldProps {
    value: string;
    fieldType: 'input' | 'textarea';
    maxLength?: number;
    rows?: number;
    placeholder?: string;
    isLLMGenerated: boolean;
    isTransitioning: boolean;
    isFocused: boolean;
    hasPendingSave?: boolean;
    onChange: (value: string) => void;
    onFocus: () => void;
    onBlur: () => void;
}

export const EditableField: React.FC<EditableFieldProps> = ({
    value,
    fieldType,
    maxLength,
    rows = 4,
    placeholder,
    isLLMGenerated,
    isTransitioning,
    isFocused,
    hasPendingSave = false,
    onChange,
    onFocus,
    onBlur
}) => {
    // Local state to handle typing smoothly
    const [localValue, setLocalValue] = useState(value);
    const [isTyping, setIsTyping] = useState(false);

    // Update local value when prop value changes (but not when user is typing)
    useEffect(() => {
        if (!isTyping) {
            setLocalValue(value);
        }
    }, [value, isTyping]);

    // Reset typing state after a delay
    useEffect(() => {
        if (isTyping) {
            const timeout = setTimeout(() => {
                setIsTyping(false);
            }, 1000); // Reset typing state after 1 second of no changes

            return () => clearTimeout(timeout);
        }
    }, [localValue, isTyping]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setLocalValue(newValue);
        setIsTyping(true);
        onChange(newValue);
    };

    const handleFocus = () => {
        setIsTyping(true);
        onFocus();
    };

    const handleBlur = () => {
        setIsTyping(false);
        onBlur();
    };

    // Common props for both input types
    const commonProps = {
        value: localValue, // Use local value instead of prop value
        placeholder,
        maxLength,
        onChange: handleChange,
        onFocus: handleFocus,
        onBlur: handleBlur,
        className: `
      !bg-transparent
      !border-none
      !shadow-none
      !outline-none
      !ring-0
      !focus:ring-0
      !focus:border-none
      !focus:shadow-none
      placeholder:text-gray-500
      ${isLLMGenerated && !isTransitioning ? 'text-blue-100' : 'text-green-100'}
      ${isFocused ? 'text-white' : ''}
      ${hasPendingSave ? 'text-yellow-200' : ''}
      resize-none
    `.replace(/\s+/g, ' ').trim()
    };

    if (fieldType === 'textarea') {
        return (
            <TextArea
                {...commonProps}
                rows={rows}
                autoSize={{ minRows: rows, maxRows: rows + 2 }}
            />
        );
    }

    return (
        <Input
            {...commonProps}
            size="large"
        />
    );
}; 