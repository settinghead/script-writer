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

export const EditableField: React.FC<EditableFieldProps> = React.memo(({
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
    const [hasUserInput, setHasUserInput] = useState(false);
    const lastTypingTime = useRef<number>(0);
    const lastExternalUpdate = useRef<number>(0);
    const isFocusedRef = useRef<boolean>(false);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    // Track focus state
    useEffect(() => {
        isFocusedRef.current = isFocused;
    }, [isFocused]);

    // Initialize local value when component mounts or when value changes from empty
    useEffect(() => {
        if (localValue === '' && value !== '') {
            setLocalValue(value);
            lastExternalUpdate.current = Date.now();
        }
    }, [value, localValue]);

    // Update local value when prop value changes, but be smart about concurrent editing
    useEffect(() => {
        const now = Date.now();
        const timeSinceLastTyping = now - lastTypingTime.current;
        const timeSinceLastExternal = now - lastExternalUpdate.current;

        // Don't update from external source if:
        // 1. User is currently focused on this field
        // 2. User has typed recently (within 3 seconds)
        // 3. User has made any input and the field is not empty
        // 4. We just received an external update very recently (within 100ms)
        const isUserActivelyEditing = (
            isFocusedRef.current ||
            (isTyping && timeSinceLastTyping < 3000) ||
            (hasUserInput && localValue !== '') ||
            timeSinceLastExternal < 100
        );

        // Only update from external source if user is not actively editing
        // and the values are actually different
        if (!isUserActivelyEditing && value !== localValue && value !== '') {

            setLocalValue(value);
            lastExternalUpdate.current = now;
            // Reset user input flag when we accept external updates
            setHasUserInput(false);
        }
    }, [value, localValue, isTyping, hasUserInput]);

    // Reset typing state after a delay
    useEffect(() => {
        if (isTyping) {
            const timeout = setTimeout(() => {
                setIsTyping(false);
            }, 2000); // Reset typing state after 2 seconds of no changes

            return () => clearTimeout(timeout);
        }
    }, [localValue, isTyping]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const now = Date.now();

        setLocalValue(newValue);
        setIsTyping(true);
        setHasUserInput(true);
        lastTypingTime.current = now;

        onChange(newValue);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setIsTyping(true);
        setHasUserInput(true);
        lastTypingTime.current = Date.now();
        onFocus();

        // Store reference to the input element
        if (inputRef.current !== e.target) {
            inputRef.current = e.target;
        }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        // Don't immediately stop typing state on blur, let the timeout handle it
        // This prevents issues when user clicks between fields quickly
        onBlur();
    };

    // Prevent focus loss during re-renders
    useEffect(() => {
        if (isFocused && inputRef.current && document.activeElement !== inputRef.current) {
            // Restore focus if it was lost during re-render
            const cursorPosition = inputRef.current.selectionStart || 0;
            inputRef.current.focus();

            // Use a timeout to ensure focus is restored before setting selection
            setTimeout(() => {
                if (inputRef.current && typeof inputRef.current.setSelectionRange === 'function') {
                    try {
                        inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
                    } catch (error) {
                        // Ignore errors - some elements might not support setSelectionRange
                        console.warn('Could not set selection range:', error);
                    }
                }
            }, 0);
        }
    }, [isFocused, localValue]);

    // Common props for both input types
    const commonProps = {
        ref: inputRef,
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
                autoSize={{ minRows: 3, }}
            />
        );
    }

    return (
        <Input
            {...commonProps}
            size="large"
        />
    );
}); 