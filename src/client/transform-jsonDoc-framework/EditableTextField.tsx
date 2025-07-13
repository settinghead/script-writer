import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, Typography } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import TextareaAutosize from 'react-textarea-autosize';
import { v4 as uuidv4 } from 'uuid';

const { Text } = Typography;

interface EditableTextFieldProps {
    value: string;
    jsonDocId: string;
    jsonDocType: string;
    onChange: (newValue: string, newJsonDocId: string) => void;
    placeholder?: string;
    multiline?: boolean;
    label?: string;
    className?: string;
    size?: 'small' | 'middle' | 'large';
}

export const EditableTextField: React.FC<EditableTextFieldProps> = ({
    value,
    jsonDocId,
    jsonDocType,
    onChange,
    placeholder,
    multiline = false,
    label,
    className = '',
    size = 'middle'
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<any>(null);

    useEffect(() => {
        setEditValue(value);
    }, [value]);

    const handleEdit = () => {
        setIsEditing(true);
        setEditValue(value);
    };

    const handleSave = async () => {
        if (editValue.trim() === value.trim()) {
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        try {
            // Create new jsonDoc with edited content
            const newJsonDocId = uuidv4();

            // Call the onChange handler with new value and jsonDoc ID
            // The parent component should handle the API call to create jsonDocs and transforms
            await onChange(editValue.trim(), newJsonDocId);

            setIsEditing(false);
        } catch (error) {
            console.error('Error saving edit:', error);
            // Keep editing mode open on error
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setEditValue(value);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Enter' && e.ctrlKey && multiline) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    // Focus input when entering edit mode
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            if (inputRef.current instanceof HTMLInputElement) {
                inputRef.current.select();
            } else if (inputRef.current instanceof HTMLTextAreaElement) {
                inputRef.current.setSelectionRange(0, inputRef.current.value.length);
            }
        }
    }, [isEditing]);

    const getLabelStyle = () => {
        const baseStyle = { color: '#fff', display: 'block' as const };
        if (size === 'small') {
            return { ...baseStyle, marginBottom: '4px', fontSize: '12px' };
        }
        return { ...baseStyle, marginBottom: '8px' };
    };

    const getContainerStyle = () => {
        if (size === 'small') {
            return { marginBottom: '8px' };
        }
        return { marginBottom: '16px' };
    };

    if (isEditing) {
        return (
            <div style={getContainerStyle()}>
                {label && (
                    <Text strong style={getLabelStyle()}>
                        {label}
                    </Text>
                )}

                {multiline ? (
                    <TextareaAutosize
                        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        disabled={isSaving}
                        minRows={3}
                        maxRows={20}
                        style={{
                            width: '100%',
                            backgroundColor: '#1f1f1f',
                            border: '1px solid #404040',
                            borderRadius: '6px',
                            color: '#fff',
                            padding: '8px 12px',
                            fontSize: '14px',
                            lineHeight: '1.5715',
                            resize: 'none',
                            outline: 'none'
                        }}
                    />
                ) : (
                    <Input
                        ref={inputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        disabled={isSaving}
                        size={size}
                        style={{
                            backgroundColor: '#1f1f1f',
                            borderColor: '#404040',
                            color: '#fff'
                        }}
                    />
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                    <Button
                        onClick={handleCancel}
                        disabled={isSaving}
                        size="small"
                    >
                        取消
                    </Button>
                    <Button
                        type="primary"
                        onClick={handleSave}
                        disabled={isSaving || editValue.trim() === ''}
                        loading={isSaving}
                        size="small"
                    >
                        保存
                    </Button>
                </div>

                {multiline && (
                    <Text type="secondary" style={{ fontSize: '12px', color: '#888' }}>
                        按 Ctrl+Enter 保存，Esc 取消
                    </Text>
                )}
            </div>
        );
    }

    return (
        <div>
            {label && (
                <Text strong style={getLabelStyle()}>
                    {label}
                </Text>
            )}
            <div
                onClick={handleEdit}
                style={{
                    cursor: 'pointer',
                    padding: '12px',
                    border: '1px solid #404040',
                    borderRadius: '6px',
                    backgroundColor: '#1f1f1f',
                    color: value ? '#fff' : '#888',
                    transition: 'all 0.2s',
                    position: 'relative',
                    minHeight: multiline ? '80px' : '40px',
                    display: 'flex',
                    alignItems: multiline ? 'flex-start' : 'center'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#606060';
                    e.currentTarget.style.backgroundColor = '#2a2a2a';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#404040';
                    e.currentTarget.style.backgroundColor = '#1f1f1f';
                }}
            >
                <span style={{ wordBreak: 'break-word', whiteSpace: multiline ? 'pre-wrap' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                    {value || placeholder || '点击编辑...'}
                </span>

                {/* Edit icon */}
                <EditOutlined
                    style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        color: '#666',
                        opacity: 0.6
                    }}
                />
            </div>
        </div>
    );
}; 