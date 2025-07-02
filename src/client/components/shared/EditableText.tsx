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
    disableAutoSave?: boolean; // Disable auto-save functionality (for array items)
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
    style = {},
    disableAutoSave = false
}) => {
    const [localValue, setLocalValue] = useState(value);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [hasRecentSave, setHasRecentSave] = useState(false);
    const inputRef = useRef<any>(null);
    const valueRef = useRef(value);
    const lastSavedValueRef = useRef(value); // Track the last value we actually saved
    const savingRef = useRef(false); // Track if we're currently saving
    const onSaveRef = useRef(onSave); // Track the onSave function to prevent stale closure

    // Update onSave ref when the prop changes
    useEffect(() => {
        onSaveRef.current = onSave;
    }, [onSave]);

    // Update local value when prop changes
    useEffect(() => {
        setLocalValue(value);
        setHasUnsavedChanges(false);
        setSaveError(null);
        valueRef.current = value; // Update ref
        // Only update lastSavedValueRef if we're not currently saving
        // This prevents overwriting the ref while a save is in progress
        if (!savingRef.current) {
            lastSavedValueRef.current = value;
        }
    }, [value]);

    // Debounced save function - Remove value from dependencies to prevent infinite loop
    const debouncedSave = useMemo(
        () => debounce(async (newValue: string) => {
            console.log(`🔧 [EditableText] Debounced save triggered for path ${path}:`, {
                newValue,
                currentValueRef: valueRef.current,
                lastSavedValueRef: lastSavedValueRef.current,
                localValue,
                shouldSave: newValue !== lastSavedValueRef.current && !savingRef.current,
                timestamp: new Date().toISOString(),
                isCurrentlySaving: savingRef.current
            });

            // Check if we should actually save:
            // 1. onSave function exists
            // 2. newValue is different from the last value we saved to the database
            // 3. We're not currently saving (prevents race conditions)
            if (onSaveRef.current && newValue !== lastSavedValueRef.current && !savingRef.current) {
                savingRef.current = true; // Mark as saving
                setIsSaving(true);
                setSaveError(null);
                try {
                    console.log(`💾 [EditableText] Calling onSave for path ${path} with value:`, newValue);
                    await onSaveRef.current(path, newValue);
                    // Update the last saved value after successful save
                    lastSavedValueRef.current = newValue;
                    setHasUnsavedChanges(false);
                    setHasRecentSave(true);
                    setTimeout(() => setHasRecentSave(false), 2000);
                } catch (error) {
                    console.error('Auto-save failed:', error);
                    setSaveError('保存失败');
                } finally {
                    setIsSaving(false);
                    savingRef.current = false; // Mark as not saving
                }
            } else {
                console.log(`⏭️ [EditableText] Skipping save for path ${path} - no change or already saving`);
            }
        }, debounceMs),
        [debounceMs, path] // Removed 'onSave' and 'value' to prevent recreation
    );

    // Auto-save on value change
    useEffect(() => {
        if (localValue !== lastSavedValueRef.current && isEditable && !savingRef.current) {
            if (disableAutoSave) {
                // For array items, call onSave immediately without debouncing
                // This will trigger handleItemChange in EditableArray
                onSaveRef.current(path, localValue);
                lastSavedValueRef.current = localValue;
            } else {
                setHasUnsavedChanges(true);
                debouncedSave(localValue);
            }
        }
    }, [localValue, debouncedSave, isEditable, disableAutoSave, path]); // Removed onSave to prevent infinite loop

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
            setLocalValue(lastSavedValueRef.current); // Reset to last saved value
            setHasUnsavedChanges(false);
            debouncedSave.cancel();
            handleBlur();
        }
    }, [multiline, handleBlur, debouncedSave]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setLocalValue(e.target.value);
    }, []);

    // Status indicator - Enhanced with error state
    const statusIndicator = useMemo(() => {
        // Don't show status for array items - the EditableArray handles status
        if (disableAutoSave) {
            return null;
        }

        if (isSaving) {
            return <LoadingOutlined style={{ color: '#1890ff', fontSize: '12px' }} />;
        }
        if (saveError) {
            return <span style={{ color: '#ff4d4f', fontSize: '10px' }}>{saveError}</span>;
        }
        if (hasRecentSave) {
            return <CheckOutlined style={{ color: '#52c41a', fontSize: '12px' }} />;
        }
        if (localValue !== lastSavedValueRef.current && !isSaving) {
            return <span style={{ color: '#faad14', fontSize: '10px' }}>未保存</span>;
        }
        if (isEditable && !isEditing) {
            return <EditOutlined style={{ color: '#8c8c8c', fontSize: '12px', opacity: 0.5 }} />;
        }
        return null;
    }, [isSaving, saveError, hasRecentSave, hasUnsavedChanges, isEditable, isEditing, disableAutoSave]);

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
    const lastSavedValueRef = useRef(value);
    const savingRef = useRef(false);

    // Update local items when prop changes
    useEffect(() => {
        setLocalItems(value);
        setHasUnsavedChanges(false);
        setSaveError(null);
        valueRef.current = value; // Update ref
        if (!savingRef.current) {
            lastSavedValueRef.current = value;
        }
    }, [value]);

    // Debounced save function - Remove value from dependencies to prevent infinite loop
    const debouncedSave = useMemo(
        () => debounce(async (newItems: string[]) => {
            if (onSave && JSON.stringify(newItems) !== JSON.stringify(lastSavedValueRef.current) && !savingRef.current) {
                savingRef.current = true;
                setIsSaving(true);
                setSaveError(null);
                try {
                    await onSave(path, newItems);
                    lastSavedValueRef.current = newItems;
                    setHasUnsavedChanges(false);
                } catch (error) {
                    console.error('Auto-save failed:', error);
                    setSaveError('保存失败');
                } finally {
                    setIsSaving(false);
                    savingRef.current = false;
                }
            }
        }, debounceMs),
        [onSave, debounceMs, path] // Removed 'value' to prevent recreation
    );

    // Auto-save on value change
    useEffect(() => {
        if (JSON.stringify(localItems) !== JSON.stringify(lastSavedValueRef.current) && isEditable && !savingRef.current) {
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
                    {JSON.stringify(localItems) !== JSON.stringify(lastSavedValueRef.current) && !isSaving && (
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
                        disableAutoSave={true} // Disable auto-save for individual items in array
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