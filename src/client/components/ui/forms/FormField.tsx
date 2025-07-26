import React from 'react';
import { motion } from 'framer-motion';
import { Typography, Spin } from 'antd';
import { StyledInput, StyledTextArea } from '@/client/styled-system';
import { fadeVariants } from '@/client/styled-system/motion/variants';

const { Text } = Typography;

interface FormFieldProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    onSave?: (value: string) => Promise<void>;
    placeholder?: string;
    multiline?: boolean;
    maxLength?: number;
    disabled?: boolean;
    hasError?: boolean;
    errorMessage?: string;
    isLoading?: boolean;
    variant?: 'default' | 'dark' | 'glass';
    size?: 'small' | 'medium' | 'large';
    debounceMs?: number;
    rows?: number;
    maxRows?: number;
}

export const FormField: React.FC<FormFieldProps> = ({
    label,
    value,
    onChange,
    onSave,
    placeholder,
    multiline = false,
    maxLength,
    disabled = false,
    hasError = false,
    errorMessage,
    isLoading = false,
    variant = 'dark',
    size = 'medium',
    debounceMs = 500,
    rows = 3,
    maxRows = 8
}) => {
    const [isSaving, setIsSaving] = React.useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
    const [saveError, setSaveError] = React.useState<string | null>(null);
    const saveTimeoutRef = React.useRef<NodeJS.Timeout>();

    // Handle input change with debounced save
    const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        onChange(newValue);
        setHasUnsavedChanges(true);
        setSaveError(null);

        if (onSave && debounceMs > 0) {
            // Clear existing timeout
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }

            // Set new timeout for debounced save
            saveTimeoutRef.current = setTimeout(async () => {
                try {
                    setIsSaving(true);
                    await onSave(newValue);
                    setHasUnsavedChanges(false);
                } catch (error) {
                    setSaveError(error instanceof Error ? error.message : '保存失败');
                } finally {
                    setIsSaving(false);
                }
            }, debounceMs);
        }
    }, [onChange, onSave, debounceMs]);

    // Cleanup timeout on unmount
    React.useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    // Determine if field should show error state
    const showError = hasError || !!saveError;
    const displayError = errorMessage || saveError;

    return (
        <motion.div
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            style={{ marginBottom: '16px' }}
        >
            {/* Field Label */}
            {label && (
                <motion.div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '8px',
                        gap: '8px'
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <Text
                        strong
                        style={{
                            color: '#fff',
                            fontSize: size === 'small' ? '12px' : size === 'large' ? '16px' : '14px'
                        }}
                    >
                        {label}
                    </Text>

                    {/* Save Status Indicators */}
                    {isSaving && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                        >
                            <Spin size="small" />
                        </motion.div>
                    )}

                    {hasUnsavedChanges && !isSaving && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Text style={{ fontSize: '12px', color: '#fadb14' }}>
                                未保存
                            </Text>
                        </motion.div>
                    )}

                    {!hasUnsavedChanges && !isSaving && onSave && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Text style={{ fontSize: '12px', color: '#52c41a' }}>
                                已保存
                            </Text>
                        </motion.div>
                    )}
                </motion.div>
            )}

            {/* Input Field */}
            {multiline ? (
                <StyledTextArea
                    value={value}
                    onChange={handleChange}
                    placeholder={placeholder}
                    disabled={disabled || isSaving}
                    hasError={showError}
                    isLoading={isLoading}
                    variant={variant}
                    size={size}
                    maxLength={maxLength}
                    minRows={rows}
                    maxRows={maxRows}
                />
            ) : (
                <StyledInput
                    value={value}
                    onChange={handleChange}
                    placeholder={placeholder}
                    disabled={disabled || isSaving}
                    hasError={showError}
                    isLoading={isLoading}
                    variant={variant}
                    size={size}
                    maxLength={maxLength}
                />
            )}

            {/* Error Message */}
            {showError && displayError && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    style={{ marginTop: '4px' }}
                >
                    <Text style={{ fontSize: '12px', color: '#ff4d4f' }}>
                        {displayError}
                    </Text>
                </motion.div>
            )}
        </motion.div>
    );
};

export default FormField; 