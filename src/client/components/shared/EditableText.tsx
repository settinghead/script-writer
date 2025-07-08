import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Input, Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
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
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [showSavedState, setShowSavedState] = useState(false);
    const valueRef = useRef(value);
    const lastSavedValueRef = useRef(value); // Track the last value we actually saved
    const savingRef = useRef(false); // Track if we're currently saving
    const onSaveRef = useRef(onSave); // Track the onSave function to prevent stale closure

    // Update onSave ref when the prop changes
    useEffect(() => {
        onSaveRef.current = onSave;
    }, [onSave]);

    // Update local value when prop changes, but preserve edits during saves
    useEffect(() => {
        // Don't reset local value if we're currently saving or have pending saves
        // This prevents losing user edits during optimistic state updates
        if (savingRef.current || pendingSaveRef.current) {
            return;
        }

        // Only update if the value actually changed from what we expect
        if (value !== lastSavedValueRef.current) {
            setLocalValue(value);
            lastSavedValueRef.current = value;
            setHasUnsavedChanges(false);
            setSaveError(null);
            setShowSavedState(false);
        }
    }, [value]);

    // Queue for pending saves during concurrent edits
    const pendingSaveRef = useRef<string | null>(null);

    // Save function that handles concurrent edits properly
    const saveValue = useCallback(async (valueToSave: string) => {
        if (!onSaveRef.current || valueToSave === lastSavedValueRef.current) {
            return;
        }

        // If already saving, queue this value
        if (savingRef.current) {
            pendingSaveRef.current = valueToSave;
            return;
        }

        savingRef.current = true;
        setIsSaving(true);
        setSaveError(null);
        setShowSavedState(false);

        try {
            await onSaveRef.current(path, valueToSave);
            lastSavedValueRef.current = valueToSave;
            setHasUnsavedChanges(false);
            setShowSavedState(true);
            setTimeout(() => setShowSavedState(false), 2000);

            // Process any queued save after current save completes
            if (pendingSaveRef.current && pendingSaveRef.current !== valueToSave) {
                const queuedValue = pendingSaveRef.current;
                pendingSaveRef.current = null;
                // Recursively save the queued value
                setTimeout(() => saveValue(queuedValue), 0);
            } else {
                pendingSaveRef.current = null;
            }
        } catch (error) {
            console.error(`[EditableText] Save failed for ${path}:`, error);
            setSaveError('保存失败');
            pendingSaveRef.current = null;
        } finally {
            setIsSaving(false);
            savingRef.current = false;
        }
    }, [path]);

    // Debounced save function
    const debouncedSave = useMemo(
        () => debounce(saveValue, debounceMs),
        [saveValue, debounceMs]
    );

    // Track if component has been initialized to prevent auto-save on initial render
    const initializedRef = useRef(false);

    // Refs for functions to avoid dependency issues
    const debouncedSaveRef = useRef(debouncedSave);
    const isEditableRef = useRef(isEditable);
    const disableAutoSaveRef = useRef(disableAutoSave);

    // Update refs when values change
    useEffect(() => {
        debouncedSaveRef.current = debouncedSave;
        isEditableRef.current = isEditable;
        disableAutoSaveRef.current = disableAutoSave;
    });

    // Auto-save on value change (but not on initial render)
    useEffect(() => {
        // Skip auto-save on initial render
        if (!initializedRef.current) {
            initializedRef.current = true;
            return;
        }

        if (localValue !== lastSavedValueRef.current && isEditableRef.current && !savingRef.current) {
            if (disableAutoSaveRef.current) {
                onSaveRef.current(path, localValue);
                lastSavedValueRef.current = localValue;
            } else {
                setHasUnsavedChanges(true);
                debouncedSaveRef.current(localValue);
            }
        } else if (localValue === lastSavedValueRef.current) {
            // Value matches saved value, no unsaved changes
            setHasUnsavedChanges(false);
        }
    }, [localValue, path]); // Only include actual data dependencies

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            debouncedSave.cancel();
        };
    }, [debouncedSave]);

    const handleBlur = useCallback(() => {
        // No longer need to track editing state since we removed click-to-edit
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

    // Dynamic border styling based on save state
    const getBorderStyle = () => {
        if (saveError) {
            return {
                borderColor: '#ff4d4f',
                borderWidth: '2px',
                animation: 'none'
            };
        }
        if (isSaving) {
            return {
                borderColor: '#1890ff',
                borderWidth: '2px',
                animation: 'pulse-blue 1.5s ease-in-out infinite'
            };
        }
        if (showSavedState) {
            return {
                borderColor: '#52c41a',
                borderWidth: '2px',
                animation: 'none'
            };
        }
        if (hasUnsavedChanges) {
            return {
                borderColor: '#1890ff',
                borderWidth: '2px',
                animation: 'none'
            };
        }
        return {
            borderColor: isEditable ? '#434343' : 'transparent',
            borderWidth: '1px',
            animation: 'none'
        };
    };

    const inputStyle = {
        backgroundColor: isEditable ? '#001529' : 'transparent',
        color: '#fff',
        fontSize: '14px',
        transition: 'border-color 0.3s ease',
        cursor: isEditable ? 'text' : 'default', // Remove pointer cursor on read-only fields
        ...getBorderStyle(),
        ...style
    };

    return (
        <div className={className}>
            <style>{`
                @keyframes pulse-blue {
                    0% { border-color: #1890ff; }
                    50% { border-color: #69c0ff; }
                    100% { border-color: #1890ff; }
                }
            `}</style>

            {saveError && (
                <div style={{ marginBottom: '4px', fontSize: '12px', color: '#ff4d4f' }}>
                    {saveError}
                </div>
            )}

            {multiline ? (
                <TextArea
                    value={localValue}
                    onChange={handleChange}
                    placeholder={placeholder}
                    disabled={!isEditable}
                    rows={rows}
                    maxLength={maxLength}
                    style={inputStyle}
                />
            ) : (
                <Input
                    value={localValue}
                    onChange={handleChange}
                    placeholder={placeholder}
                    disabled={!isEditable}
                    maxLength={maxLength}
                    style={inputStyle}
                />
            )}
        </div>
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
    mode: 'list' | 'textarea'; // New prop to control editing mode
}

export const EditableArray: React.FC<EditableArrayProps> = ({
    value = [],
    path,
    placeholder = '添加新项',
    isEditable,
    onSave,
    debounceMs = 1000,
    className = '',
    addButtonText = '添加',
    mode
}) => {
    const [localItems, setLocalItems] = useState<string[]>(value);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showSavedState, setShowSavedState] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newItemValue, setNewItemValue] = useState('');
    const [textareaValue, setTextareaValue] = useState(() => {
        // Initialize with proper value for textarea mode
        if (mode === 'textarea') {
            return value.join('\n');
        }
        return '';
    });

    // Refs to prevent stale closures
    const lastSavedValueRef = useRef<string[]>(value);
    const lastSavedTextareaRef = useRef<string>('');
    const savingRef = useRef(false);
    const pendingSaveRef = useRef<string[] | null>(null);

    // Helper functions to convert between array and textarea - Remove from useCallback dependencies
    const arrayToTextarea = useCallback((items: string[]) => items.join('\n'), []);
    const textareaToArray = useCallback((text: string) => {
        return text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    }, []);

    // Initialize textarea value and refs
    useEffect(() => {
        if (mode === 'textarea' && !textareaInitializedRef.current) {
            const initialValue = arrayToTextarea(value);

            // Only update if the current value doesn't match what it should be
            if (textareaValue !== initialValue) {
                setTextareaValue(initialValue);
            }
            lastSavedTextareaRef.current = initialValue;
            textareaInitializedRef.current = true;
        }
    }, [mode, arrayToTextarea, value]); // Keep original dependencies

    // Update local state when value prop changes, but preserve edits during saves
    useEffect(() => {
        // Don't reset local state if we're currently saving or have pending saves
        // This prevents losing user edits during optimistic state updates
        if (savingRef.current || pendingSaveRef.current) {
            return;
        }

        // Only update if the value actually changed from what we expect
        if (JSON.stringify(value) !== JSON.stringify(lastSavedValueRef.current)) {
            if (mode === 'list') {
                setLocalItems(value);
                lastSavedValueRef.current = value;
            }

            // Update textarea value for textarea mode
            if (mode === 'textarea') {
                const newTextareaValue = arrayToTextarea(value);
                setTextareaValue(newTextareaValue);
                lastSavedTextareaRef.current = newTextareaValue;
            }

            // Reset status indicators when props change
            setShowSavedState(false);
            setSaveError(null);
            setHasUnsavedChanges(false);
        }
    }, [value, mode, arrayToTextarea]);

    // Update textarea value when value prop changes (handled in main useEffect above)
    // No separate useEffect needed since textarea value is updated in the main prop sync useEffect

    // Save function that handles concurrent edits properly
    const saveArrayValue = useCallback(async (itemsToSave: string[]) => {
        if (!onSave || JSON.stringify(itemsToSave) === JSON.stringify(lastSavedValueRef.current)) {
            return;
        }

        // If already saving, queue this value
        if (savingRef.current) {
            pendingSaveRef.current = itemsToSave;
            return;
        }

        savingRef.current = true;
        setIsSaving(true);
        setSaveError(null);
        setShowSavedState(false);

        try {
            await onSave(path, itemsToSave);
            lastSavedValueRef.current = itemsToSave;
            // Update textarea ref if in textarea mode
            if (mode === 'textarea') {
                const savedTextareaValue = arrayToTextarea(itemsToSave);
                lastSavedTextareaRef.current = savedTextareaValue;
            }
            setHasUnsavedChanges(false);
            setShowSavedState(true);
            setTimeout(() => setShowSavedState(false), 2000);

            // Process any queued save after current save completes
            if (pendingSaveRef.current && JSON.stringify(pendingSaveRef.current) !== JSON.stringify(itemsToSave)) {
                const queuedValue = pendingSaveRef.current;
                pendingSaveRef.current = null;
                // Recursively save the queued value
                setTimeout(() => saveArrayValue(queuedValue), 0);
            } else {
                pendingSaveRef.current = null;
            }
        } catch (error) {
            console.error(`[EditableArray] SAVE FAILED ${path}:`, error);
            setSaveError('保存失败');
            pendingSaveRef.current = null;
        } finally {
            setIsSaving(false);
            savingRef.current = false;
        }
    }, [onSave, path, mode, arrayToTextarea]);

    // Debounced save function
    const debouncedSave = useMemo(
        () => debounce(saveArrayValue, debounceMs),
        [saveArrayValue, debounceMs]
    );

    // Track if component has been initialized to prevent auto-save on initial render
    const arrayInitializedRef = useRef(false);
    const textareaInitializedRef = useRef(false);

    // Synchronously mark textarea as initialized if we're in textarea mode
    // This prevents auto-save from running before proper initialization
    if (mode === 'textarea' && !textareaInitializedRef.current) {
        // Mark as initialized immediately to prevent race conditions
        textareaInitializedRef.current = true;
    }

    // Refs for functions to avoid dependency issues
    const debouncedSaveRef = useRef(debouncedSave);
    const textareaToArrayRef = useRef(textareaToArray);
    const isEditableRef = useRef(isEditable);
    const modeRef = useRef(mode);
    const valueRef = useRef(value);

    // Update refs when values change
    useEffect(() => {
        debouncedSaveRef.current = debouncedSave;
        textareaToArrayRef.current = textareaToArray;
        isEditableRef.current = isEditable;
        modeRef.current = mode;
        valueRef.current = value;
    });

    // Auto-save on value change (but not on initial render)
    useEffect(() => {
        // Skip auto-save on initial render
        if (!arrayInitializedRef.current) {
            arrayInitializedRef.current = true;
            return;
        }

        if (modeRef.current === 'list') {
            // List mode: save when localItems change
            if (JSON.stringify(localItems) !== JSON.stringify(lastSavedValueRef.current) && isEditableRef.current && !savingRef.current) {
                setHasUnsavedChanges(true);
                debouncedSaveRef.current(localItems);
            }
        } else if (modeRef.current === 'textarea') {
            // For textarea mode, also check if textarea has been initialized
            if (isEditableRef.current && !savingRef.current && textareaInitializedRef.current) {
                const newItems = textareaToArrayRef.current(textareaValue);
                const databaseItems = Array.isArray(valueRef.current) ? valueRef.current : [];

                // Compare with database value, not our local tracking  
                if (JSON.stringify(newItems) !== JSON.stringify(databaseItems)) {
                    setHasUnsavedChanges(true);
                    debouncedSaveRef.current(newItems);
                }
            }
        }
    }, [localItems, textareaValue, path]); // Only include actual data dependencies

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

    // Textarea mode handlers
    const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setTextareaValue(newValue);
    }, []);

    // Dynamic border styling based on save state
    const getBorderStyle = () => {
        if (saveError) {
            return {
                borderColor: '#ff4d4f',
                borderWidth: '2px',
                animation: 'none'
            };
        }
        if (isSaving) {
            return {
                borderColor: '#1890ff',
                borderWidth: '2px',
                animation: 'pulse-blue 1.5s ease-in-out infinite'
            };
        }
        if (showSavedState) {
            return {
                borderColor: '#52c41a',
                borderWidth: '2px',
                animation: 'none'
            };
        }
        if (hasUnsavedChanges) {
            return {
                borderColor: '#1890ff',
                borderWidth: '2px',
                animation: 'none'
            };
        }
        return {
            borderColor: isEditable ? '#434343' : 'transparent',
            borderWidth: '1px',
            animation: 'none'
        };
    };

    // Check if there are unsaved changes based on mode
    const hasUnsavedData = useMemo(() => {
        if (mode === 'list') {
            return JSON.stringify(localItems) !== JSON.stringify(lastSavedValueRef.current);
        } else {
            return textareaValue !== lastSavedTextareaRef.current;
        }
    }, [mode, localItems, textareaValue]);

    return (
        <div className={className}>
            <style>{`
                @keyframes pulse-blue {
                    0% { border-color: #1890ff; }
                    50% { border-color: #69c0ff; }
                    100% { border-color: #1890ff; }
                }
            `}</style>

            {saveError && (
                <div style={{ marginBottom: '4px', fontSize: '12px', color: '#ff4d4f' }}>
                    {saveError}
                </div>
            )}

            {mode === 'textarea' ? (
                // Textarea mode: single auto-sized textarea where each line is an array item
                <TextArea
                    value={textareaValue}
                    onChange={handleTextareaChange}
                    placeholder={placeholder || '每行一个项目...'}
                    autoSize={{ minRows: 3, maxRows: 15 }}
                    disabled={!isEditable}
                    style={{
                        backgroundColor: isEditable ? '#001529' : 'transparent',
                        color: '#fff',
                        fontSize: '14px',
                        transition: 'border-color 0.3s ease',
                        cursor: isEditable ? 'text' : 'default', // Remove pointer cursor on read-only fields
                        ...getBorderStyle()
                    }}
                />
            ) : (
                // List mode: individual EditableText components (existing behavior)
                <>
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
                                        style={{
                                            flex: 1,
                                            backgroundColor: '#001529',
                                            borderColor: '#434343',
                                            color: '#fff'
                                        }}
                                        autoFocus
                                    />
                                    <Button
                                        type="primary"
                                        size="small"
                                        onClick={handleAddItem}
                                        disabled={!newItemValue.trim()}
                                    >
                                        确认
                                    </Button>
                                    <Button
                                        size="small"
                                        onClick={handleCancelAdd}
                                    >
                                        取消
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    type="dashed"
                                    onClick={() => setIsAdding(true)}
                                    style={{
                                        borderColor: '#434343',
                                        color: '#8c8c8c',
                                        backgroundColor: 'transparent'
                                    }}
                                    block
                                >
                                    {addButtonText}
                                </Button>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}; 