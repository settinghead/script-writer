import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface EditableTextFieldProps {
    value: string;
    artifactId: string;
    artifactType: string;
    onChange: (newValue: string, newArtifactId: string) => void;
    placeholder?: string;
    multiline?: boolean;
    label?: string;
    className?: string;
}

export const EditableTextField: React.FC<EditableTextFieldProps> = ({
    value,
    artifactId,
    artifactType,
    onChange,
    placeholder,
    multiline = false,
    label,
    className = ''
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

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
            // Create new artifact with edited content
            const newArtifactId = uuidv4();

            // Call the onChange handler with new value and artifact ID
            // The parent component should handle the API call to create artifacts and transforms
            await onChange(editValue.trim(), newArtifactId);

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

    const baseClassName = `w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`;

    if (isEditing) {
        return (
            <div className="space-y-2">
                {label && (
                    <label className="block text-sm font-medium text-gray-700">
                        {label}
                    </label>
                )}
                {multiline ? (
                    <textarea
                        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        className={`${baseClassName} min-h-[100px] resize-vertical`}
                        disabled={isSaving}
                        rows={4}
                    />
                ) : (
                    <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        className={baseClassName}
                        disabled={isSaving}
                    />
                )}

                <div className="flex justify-end space-x-2">
                    <button
                        onClick={handleCancel}
                        className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                        disabled={isSaving}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50"
                        disabled={isSaving || editValue.trim() === ''}
                    >
                        {isSaving ? '保存中...' : '保存'}
                    </button>
                </div>

                {multiline && (
                    <div className="text-xs text-gray-500">
                        按 Ctrl+Enter 保存，Esc 取消
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="group relative">
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}
                </label>
            )}
            <div
                onClick={handleEdit}
                className={`cursor-pointer p-3 border border-gray-200 rounded-md hover:border-gray-300 hover:bg-gray-50 transition-colors group-hover:shadow-sm ${value ? 'text-gray-900' : 'text-gray-500'
                    }`}
            >
                {value || placeholder || '点击编辑...'}

                {/* Edit icon */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </div>
            </div>
        </div>
    );
}; 