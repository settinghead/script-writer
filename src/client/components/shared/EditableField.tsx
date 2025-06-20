import React from 'react';
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
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onChange(e.target.value);
    };

    // Common props for both input types
    const commonProps = {
        value,
        placeholder,
        maxLength,
        onChange: handleChange,
        onFocus,
        onBlur,
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