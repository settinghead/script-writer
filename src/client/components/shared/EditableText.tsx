import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Input, Button, Tag } from 'antd';
import { PlusOutlined, CloseOutlined, CheckOutlined, LoadingOutlined, EditOutlined } from '@ant-design/icons';
import { debounce } from 'lodash';

const { TextArea } = Input;

interface EditableTextProps {
    value: string;
    path: string;
    placeholder?: string;
    multiline?: boolean;
    rows?: number;
    maxLength?: number;
    isEditable: boolean;
    onSave: (path: string, value: string) => Promise<void>;
    debounceMs?: number;
    className?: string;
    style?: React.CSSProperties;
}

export const EditableText: React.FC<EditableTextProps> = ({
    value = '',
    path,
    placeholder = '',
    multiline = false,
    rows = 2,
    maxLength,
    isEditable,
    onSave,
    debounceMs = 1000,
    className = '',
    style = {}
}) => {
    const [localValue, setLocalValue] = useState(value);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [hasRecentSave, setHasRecentSave] = useState(false);
    const inputRef = useRef<any>(null);
    const valueRef = useRef(value);

    // Update local value when prop changes
    useEffect(() => {
        setLocalValue(value);
        setHasUnsavedChanges(false);
        setSaveError(null);
        valueRef.current = value; // Update ref
    }, [value]);

    // Debounced save function - Remove value from dependencies to prevent infinite loop
    const debouncedSave = useMemo(
        () => debounce(async (newValue: string) => {
            if (onSave && newValue !== valueRef.current) {
                setIsSaving(true);
                setSaveError(null);
                try {
                    await onSave(path, newValue);
                    setHasUnsavedChanges(false);
                    setHasRecentSave(true);
                    setTimeout(() => setHasRecentSave(false), 2000);
                } catch (error) {
                    console.error('Auto-save failed:', error);
                    setSaveError('保存失败');
                } finally {
                    setIsSaving(false);
                }
            }
        }, debounceMs),
        [onSave, debounceMs, path] // Removed 'value' to prevent recreation
    );

    // Auto-save on value change
    useEffect(() => {
        if (localValue !== valueRef.current && isEditable) {
            setHasUnsavedChanges(true);
            debouncedSave(localValue);
        }
    }, [localValue, debouncedSave, isEditable]); // Removed 'value' from dependencies

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            debouncedSave.cancel();
        };
    }, [debouncedSave]);

    const handleClick = useCallback(() => {
        if (isEditable && !isEditing) {
            setIsEditing(true);
            // Focus input after state update
            setTimeout(() => {
                inputRef.current?.focus();
            }, 0);
        }
    }, [isEditable, isEditing]);

    const handleBlur = useCallback(() => {
        setIsEditing(false);
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) {
            e.preventDefault();
            handleBlur();
        }
        if (e.key === 'Escape') {
            setLocalValue(value); // Reset to original value
            setHasUnsavedChanges(false);
            debouncedSave.cancel();
            handleBlur();
        }
    }, [multiline, value, handleBlur, debouncedSave]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setLocalValue(e.target.value);
    }, []);

    // Status indicator - Enhanced with error state
    const statusIndicator = useMemo(() => {
        if (isSaving) {
            return <LoadingOutlined style={{ color: '#1890ff', fontSize: '12px' }} />;
        }
        if (saveError) {
            return <span style={{ color: '#ff4d4f', fontSize: '10px' }}>{saveError}</span>;
        }
        if (hasRecentSave) {
            return <CheckOutlined style={{ color: '#52c41a', fontSize: '12px' }} />;
        }
        if (hasUnsavedChanges && !isSaving) {
            return <span style={{ color: '#faad14', fontSize: '10px' }}>未保存</span>;
        }
        if (isEditable && !isEditing) {
            return <EditOutlined style={{ color: '#8c8c8c', fontSize: '12px', opacity: 0.5 }} />;
        }
        return null;
    }, [isSaving, saveError, hasRecentSave, hasUnsavedChanges, isEditable, isEditing]);

    const containerStyle = {
        ...style,
        cursor: isEditable && !isEditing ? 'pointer' : 'default',
        position: 'relative' as const,
        display: 'inline-block',
        minWidth: '100px',
        borderRadius: isEditable ? '4px' : '0',
        padding: isEditable ? '4px 8px' : '0',
        border: isEditable ? (isEditing ? '2px solid #1890ff' : '1px solid transparent') : 'none',
        backgroundColor: isEditable ? (isEditing ? '#001529' : 'rgba(255, 255, 255, 0.02)') : 'transparent',
        transition: 'all 0.2s'
    };

    if (isEditing && isEditable) {
        const InputComponent = multiline ? TextArea : Input;
        return (
            <div style={containerStyle} className={className}>
                <InputComponent
                    ref={inputRef}
                    value={localValue}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    rows={multiline ? rows : undefined}
                    style={{
                        border: 'none',
                        background: 'transparent',
                        padding: '0',
                        fontSize: 'inherit',
                        color: 'inherit',
                        fontWeight: 'inherit',
                        lineHeight: 'inherit',
                        resize: multiline ? 'vertical' : 'none'
                    }}
                    autoSize={multiline ? { minRows: rows, maxRows: rows + 2 } : false}
                />
                {statusIndicator && (
                    <span style={{ position: 'absolute', right: '4px', top: '4px' }}>
                        {statusIndicator}
                    </span>
                )}
            </div>
        );
    }

    return (
        <span
            style={containerStyle}
            className={`${className} ${isEditable ? 'hover:bg-gray-800' : ''}`}
            onClick={handleClick}
            title={isEditable ? '点击编辑' : undefined}
        >
            {localValue || (isEditable ? placeholder : '')}
            {statusIndicator && (
                <span style={{ marginLeft: '8px' }}>
                    {statusIndicator}
                </span>
            )}
        </span>
    );
};

interface EditableArrayProps {
    value: string[];
    path: string;
    placeholder?: string;
    isEditable: boolean;
    onSave: (path: string, value: string[]) => Promise<void>;
    debounceMs?: number;
    className?: string;
    addButtonText?: string;
}

export const EditableArray: React.FC<EditableArrayProps> = ({
    value = [],
    path,
    placeholder = '添加新项',
    isEditable,
    onSave,
    debounceMs = 1000,
    className = '',
    addButtonText = '添加'
}) => {
    const [localItems, setLocalItems] = useState(value);
    const [isAdding, setIsAdding] = useState(false);
    const [newItemValue, setNewItemValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const valueRef = useRef(value);

    // Update local items when prop changes
    useEffect(() => {
        setLocalItems(value);
        setHasUnsavedChanges(false);
        setSaveError(null);
        valueRef.current = value; // Update ref
    }, [value]);

    // Debounced save function - Remove value from dependencies to prevent infinite loop
    const debouncedSave = useMemo(
        () => debounce(async (newItems: string[]) => {
            if (onSave && JSON.stringify(newItems) !== JSON.stringify(valueRef.current)) {
                setIsSaving(true);
                setSaveError(null);
                try {
                    await onSave(path, newItems);
                    setHasUnsavedChanges(false);
                } catch (error) {
                    console.error('Auto-save failed:', error);
                    setSaveError('保存失败');
                } finally {
                    setIsSaving(false);
                }
            }
        }, debounceMs),
        [onSave, debounceMs, path] // Removed 'value' to prevent recreation
    );

    // Auto-save on value change
    useEffect(() => {
        if (JSON.stringify(localItems) !== JSON.stringify(valueRef.current) && isEditable) {
            setHasUnsavedChanges(true);
            debouncedSave(localItems);
        }
    }, [localItems, debouncedSave, isEditable]); // Removed 'value' from dependencies

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            debouncedSave.cancel();
        };
    }, [debouncedSave]);

    const handleItemChange = useCallback((index: number, newValue: string) => {
        setLocalItems(prev => {
            const newItems = [...prev];
            newItems[index] = newValue;
            return newItems;
        });
    }, []);

    const handleRemoveItem = useCallback((index: number) => {
        setLocalItems(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleAddItem = useCallback(() => {
        if (newItemValue.trim()) {
            setLocalItems(prev => [...prev, newItemValue.trim()]);
            setNewItemValue('');
            setIsAdding(false);
        }
    }, [newItemValue]);

    const handleCancelAdd = useCallback(() => {
        setNewItemValue('');
        setIsAdding(false);
    }, []);

    const handleAddKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAddItem();
        }
        if (e.key === 'Escape') {
            handleCancelAdd();
        }
    }, [handleAddItem, handleCancelAdd]);

    return (
        <div className={className}>
            {/* Status indicator for the array */}
            {(isSaving || hasUnsavedChanges || saveError) && (
                <div style={{ marginBottom: '8px', fontSize: '12px' }}>
                    {isSaving && (
                        <span style={{ color: '#1890ff' }}>
                            <LoadingOutlined /> 保存中...
                        </span>
                    )}
                    {hasUnsavedChanges && !isSaving && (
                        <span style={{ color: '#faad14' }}>未保存</span>
                    )}
                    {saveError && (
                        <span style={{ color: '#ff4d4f' }}>{saveError}</span>
                    )}
                </div>
            )}

            {localItems.map((item, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <EditableText
                        value={item}
                        path={`${path}[${index}]`}
                        placeholder={placeholder}
                        isEditable={isEditable}
                        onSave={async (_, newValue) => {
                            handleItemChange(index, newValue);
                        }}
                        style={{ flex: 1 }}
                    />
                    {isEditable && (
                        <Button
                            type="text"
                            icon={<CloseOutlined />}
                            size="small"
                            onClick={() => handleRemoveItem(index)}
                            style={{ color: '#ff4d4f', opacity: 0.7 }}
                        />
                    )}
                </div>
            ))}

            {isEditable && (
                <div style={{ marginTop: '8px' }}>
                    {isAdding ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Input
                                value={newItemValue}
                                onChange={(e) => setNewItemValue(e.target.value)}
                                onKeyDown={handleAddKeyDown}
                                placeholder={placeholder}
                                size="small"
                                autoFocus
                                style={{ flex: 1 }}
                            />
                            <Button
                                type="text"
                                icon={<CheckOutlined />}
                                size="small"
                                onClick={handleAddItem}
                                style={{ color: '#52c41a' }}
                            />
                            <Button
                                type="text"
                                icon={<CloseOutlined />}
                                size="small"
                                onClick={handleCancelAdd}
                                style={{ color: '#ff4d4f' }}
                            />
                        </div>
                    ) : (
                        <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            size="small"
                            onClick={() => setIsAdding(true)}
                            style={{
                                borderColor: '#434343',
                                color: '#8c8c8c',
                                backgroundColor: 'transparent'
                            }}
                        >
                            {addButtonText}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}; 