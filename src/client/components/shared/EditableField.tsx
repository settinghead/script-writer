import React, { useState, useEffect, useRef } from 'react';
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
    const lastTypingTime = useRef<number>(0);
    const lastExternalUpdate = useRef<number>(0);
    const isFocusedRef = useRef<boolean>(false);

    // Track focus state
    useEffect(() => {
        isFocusedRef.current = isFocused;
    }, [isFocused]);

    // Update local value when prop value changes, but be smart about concurrent editing
    useEffect(() => {
        const now = Date.now();
        const timeSinceLastTyping = now - lastTypingTime.current;
        const timeSinceLastExternal = now - lastExternalUpdate.current;
        
        // Only update from external source if:
        // 1. User is not currently typing (not focused and not recently typed)
        // 2. OR it's been more than 2 seconds since last typing (user stopped typing)
        // 3. OR this is the first value (initialization)
        const shouldUpdateFromExternal = (
            (!isFocusedRef.current && !isTyping && timeSinceLastTyping > 2000) ||
            timeSinceLastTyping > 2000 ||
            localValue === '' ||
            lastExternalUpdate.current === 0
        );

        if (shouldUpdateFromExternal && value !== localValue) {
            console.log('EditableField: Updating from external source', {
                value,
                localValue,
                isTyping,
                isFocused: isFocusedRef.current,
                timeSinceLastTyping,
                shouldUpdateFromExternal
            });
            setLocalValue(value);
            lastExternalUpdate.current = now;
        }
    }, [value, localValue, isTyping]);

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
        const now = Date.now();
        
        setLocalValue(newValue);
        setIsTyping(true);
        lastTypingTime.current = now;
        
        onChange(newValue);
    };

    const handleFocus = () => {
        setIsTyping(true);
        lastTypingTime.current = Date.now();
        onFocus();
    };

    const handleBlur = () => {
        // Don't immediately stop typing state on blur, let the timeout handle it
        // This prevents issues when user clicks between fields quickly
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