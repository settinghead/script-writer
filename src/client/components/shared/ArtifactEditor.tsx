import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { message, Button } from 'antd';
import { useDebouncedCallback } from '../../hooks/useDebounce';
import { EditableField } from './EditableField';
import { useProjectData } from '../../contexts/ProjectDataContext';
import type { ElectricArtifact } from '../../../common/types';
import { extractDataAtPath, getPathDescription } from '../../../common/utils/pathExtraction';
import { CheckOutlined, LoadingOutlined } from '@ant-design/icons';

// Field configuration interface
export interface FieldConfig {
    field: string;
    component: 'input' | 'textarea';
    maxLength?: number;
    rows?: number;
    placeholder?: string;
}

// Display mode for the editor
export type EditorMode = 'readonly' | 'editable' | 'edit-button' | 'auto';

interface ArtifactEditorProps {
    artifactId: string;
    path?: string;           // JSON path for derivation (optional, defaults to root)
    transformName?: string;  // Transform name for schema-based editing
    className?: string;
    onTransition?: (newArtifactId: string) => void;
    onSaveSuccess?: () => void; // Callback when save is successful

    // NEW: Generic field configuration
    fields?: FieldConfig[];  // Field configurations to render
    mode?: EditorMode;       // Display mode
    statusLabel?: string;    // Custom status label (e.g., "AI生成", "已编辑")
    statusColor?: string;    // Status indicator color (e.g., "blue", "green")
}

interface CreateTransformRequest {
    transformName: string;
    derivationPath: string;
}

interface CreateTransformResponse {
    transform: any;
    derivedArtifact: any;
}

const ArtifactEditorComponent: React.FC<ArtifactEditorProps> = ({
    artifactId,
    path = "",
    transformName,
    className = '',
    onTransition,
    onSaveSuccess,
    fields = [],
    mode = 'auto', // Auto-detect mode if not specified
    statusLabel,
    statusColor = 'blue'
}) => {
    // Get unified project data context
    const projectData = useProjectData();

    // State management
    const [isEditing, setIsEditing] = useState(false);
    const [editingField, setEditingField] = useState<string | null>(null);
    const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set());
    const [typingFields, setTypingFields] = useState<Set<string>>(new Set());
    const [isCreatingTransform, setIsCreatingTransform] = useState(false);

    // 1. Check for existing human transform for this path using the unified context
    const existingTransform = useMemo(() => {
        const humanTransforms = projectData.getHumanTransformsForArtifact(artifactId, path);
        return humanTransforms.length > 0 ? humanTransforms[0] : null;
    }, [projectData, artifactId, path]);

    // 2. Get artifact from unified context
    const artifactToUse = useMemo(() => {
        if (existingTransform?.derived_artifact_id) {
            const derivedArtifact = projectData.getArtifactById(existingTransform.derived_artifact_id);
            return derivedArtifact;
        }

        const originalArtifact = projectData.getArtifactById(artifactId);
        return originalArtifact;
    }, [projectData, existingTransform?.derived_artifact_id, artifactId]);

    // 3. Determine display mode
    const effectiveMode = useMemo(() => {
        if (mode !== 'auto') return mode;

        // Auto-detect mode based on context
        if (existingTransform) return 'editable';
        if (transformName && fields.length > 0) return 'edit-button';
        return 'readonly';
    }, [mode, existingTransform, transformName, fields.length]);

    // 4. Determine target artifact and labels
    const targetArtifactId = existingTransform?.derived_artifact_id || artifactId;
    const isUserInput = artifactToUse?.type === 'user_input';

    const effectiveStatusLabel = statusLabel || (
        existingTransform ? (isUserInput ? '用户修改' : '已编辑') : 'AI生成'
    );

    const effectiveStatusColor = statusColor || (
        existingTransform ? (isUserInput ? 'green' : 'blue') : 'blue'
    );

    // Loading and error states from unified context
    const isLoadingArtifact = projectData.isLoading;
    const error = projectData.error;

    // Process artifact data
    const processedData = useMemo(() => {
        if (!artifactToUse) {
            return null;
        }

        try {
            const artifactData = typeof artifactToUse.data === 'string'
                ? JSON.parse(artifactToUse.data)
                : artifactToUse.data;

            return {
                isUserInput: artifactToUse.type === 'user_input',
                artifactData
            };
        } catch (error) {
            console.error('[ArtifactEditor] Error parsing artifact data:', error);
            return null;
        }
    }, [artifactToUse, artifactId]);

    const { artifactData } = processedData || {};

    // 5. Create transform mutation using unified context
    const createTransformMutation = projectData.createHumanTransform;

    // 6. Update mutation using unified context
    const updateMutation = projectData.updateArtifact;

    // 7. Debounced save function with ref to avoid stale closures
    const saveRef = useRef<(fieldUpdates: Record<string, any>, field: string) => void>(() => { });

    saveRef.current = (fieldUpdates: Record<string, any>, field: string) => {
        // Clear typing state when actually executing save
        setTypingFields(prev => {
            const newSet = new Set(prev);
            newSet.delete(field);
            return newSet;
        });

        // Prepare request based on artifact type
        let requestData;
        if (isUserInput) {
            // For user_input artifacts, we need to send the data as 'text' field
            requestData = { text: JSON.stringify(fieldUpdates) };
        } else {
            // For other artifacts, send the data directly
            requestData = fieldUpdates;
        }

        updateMutation.mutate({
            artifactId: targetArtifactId,
            data: requestData
        }, {
            onSuccess: () => {
                // Clear pending saves and typing states
                setPendingSaves(new Set());
                setTypingFields(new Set());
                onSaveSuccess?.();
            },
            onError: (error) => {
                // Clear pending saves and typing states on error
                setPendingSaves(new Set());
                setTypingFields(new Set());
                message.error(`保存失败: ${error.message}`);
            }
        });
    };

    const debouncedSave = useDebouncedCallback((fieldUpdates: Record<string, any>, field: string) => {
        saveRef.current?.(fieldUpdates, field);
    }, 500);

    // 8. Event handlers
    const handleEditClick = useCallback(() => {
        if (!transformName) {
            message.error('未指定转换类型');
            return;
        }

        setIsCreatingTransform(true);
        createTransformMutation.mutate({
            transformName,
            sourceArtifactId: artifactId,
            derivationPath: path,
            fieldUpdates: {} // Empty - just creating the transform
        }, {
            onSuccess: (response) => {
                setIsCreatingTransform(false);
                setIsEditing(true);

                // Notify parent component
                onTransition?.(response.derivedArtifact.id);

                message.success('选中灵感，开始编辑');
            },
            onError: (error) => {
                setIsCreatingTransform(false);
                message.error(`创建编辑失败: ${error.message}`);
            }
        });
    }, [transformName, path, createTransformMutation, artifactId, onTransition]);

    const handleFieldChange = useCallback((field: string, value: any) => {
        // Mark field as being typed in
        setTypingFields(prev => new Set(prev).add(field));

        // Clear any pending save state for this field
        setPendingSaves(prev => {
            const newSet = new Set(prev);
            newSet.delete(field);
            return newSet;
        });

        // Create the updated data object
        const updatedData = { ...artifactData, [field]: value };

        // Set pending save state
        setPendingSaves(prev => new Set(prev).add(field));

        debouncedSave(updatedData, field);
    }, [artifactData, debouncedSave]);

    const handleFieldFocus = useCallback((field: string) => {
        setEditingField(field);
    }, []);

    const handleFieldBlur = useCallback(() => {
        setEditingField(null);
    }, []);

    // Loading state
    if (isLoadingArtifact) {
        return (
            <div className={`artifact-editor loading ${className}`}>
                <div className="animate-pulse bg-gray-700 h-20 rounded"></div>
            </div>
        );
    }

    // Error state
    if (error || !artifactToUse) {
        return (
            <div className={`artifact-editor error ${className}`}>
                <div className="text-red-400 text-sm">
                    {error ? `加载错误: ${error.message}` : '未找到指定的内容'}
                </div>
            </div>
        );
    }

    // Edit button mode - show clickable preview with edit button
    if (effectiveMode === 'edit-button' && !isEditing) {
        return (
            <div
                className={`artifact-editor ${className}`}
                onClick={handleEditClick}
                style={{ cursor: 'text' }}
            >
                <div className="flex items-center justify-between p-4 border-2 border-gray-600 rounded-lg">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full bg-${effectiveStatusColor}-400`} />
                        <span className="text-xs text-gray-400">
                            {effectiveStatusLabel}
                            {path && ` • ${getPathDescription(path)}`}
                        </span>
                    </div>
                    {isCreatingTransform && (
                        <LoadingOutlined style={{ color: '#1890ff' }} />
                    )}
                </div>

                {/* Read-only display of original data */}
                <div className="mt-3 p-3 bg-gray-800 rounded">
                    {path ? (
                        // Show data at path in a more user-friendly format
                        (() => {
                            const dataAtPath = extractDataAtPath(JSON.parse(artifactToUse.data as string), path);
                            if (dataAtPath && typeof dataAtPath === 'object' && dataAtPath.title && dataAtPath.body) {
                                // Display brainstorm idea in a nice format
                                return (
                                    <div className="space-y-3">
                                        <div>
                                            <div className="text-xs text-gray-500 mb-1">标题</div>
                                            <div className="text-sm text-gray-300">{dataAtPath.title}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500 mb-1">内容</div>
                                            <div className="text-sm text-gray-300 whitespace-pre-wrap">{dataAtPath.body}</div>
                                        </div>
                                    </div>
                                );
                            } else {
                                // Fallback to JSON display
                                return (
                                    <div className="text-sm text-gray-300">
                                        {JSON.stringify(dataAtPath, null, 2)}
                                    </div>
                                );
                            }
                        })()
                    ) : (
                        // Show full data
                        <div className="text-sm text-gray-300">
                            {JSON.stringify(JSON.parse(artifactToUse.data as string), null, 2)}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Editable mode - show form fields
    if (effectiveMode === 'editable' && fields.length > 0 && artifactData) {
        const colorClass = effectiveStatusColor === 'green' ? 'green' : 'blue';

        const editorClasses = [
            'artifact-editor',
            'transition-all duration-300 ease-in-out',
            'border-2 rounded-lg p-4',
            className,
            `border-${colorClass}-300`,
            editingField ? `border-${colorClass}-500` : '',
            updateMutation.isPending ? 'opacity-70' : ''
        ].filter(Boolean).join(' ');

        return (
            <div className={editorClasses}>
                {/* Status indicator */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full bg-${colorClass}-400`} />
                        <span className="text-xs text-gray-400">
                            {effectiveStatusLabel}
                            {path && ` • ${getPathDescription(path)}`}
                        </span>

                        {updateMutation.isPending && (
                            <span className={`w-4 h-4 border border-${colorClass}-400 border-t-transparent rounded-full animate-spin`}></span>
                        )}
                        {!updateMutation.isPending && updateMutation.isSuccess && pendingSaves.size === 0 && typingFields.size === 0 && (
                            <span className={`text-${colorClass}-400`}>
                                <CheckOutlined />
                            </span>
                        )}
                    </div>
                </div>

                {/* Editable fields */}
                {fields.map(({ field, component, maxLength, rows, placeholder }) => (
                    <div key={field} className="mb-4 last:mb-0">
                        <EditableField
                            value={artifactData?.[field] || ''}
                            fieldType={component}
                            maxLength={maxLength}
                            rows={rows}
                            placeholder={placeholder}
                            isLLMGenerated={false}
                            isTransitioning={false}
                            isFocused={editingField === field}
                            hasPendingSave={pendingSaves.has(field)}
                            onChange={(value) => handleFieldChange(field, value)}
                            onFocus={() => handleFieldFocus(field)}
                            onBlur={handleFieldBlur}
                        />
                    </div>
                ))}
            </div>
        );
    }

    // Readonly mode - just display the data
    if (effectiveMode === 'readonly' && artifactData) {
        return (
            <div className={`artifact-editor readonly ${className}`}>
                <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2 h-2 rounded-full bg-${effectiveStatusColor}-400`} />
                    <span className="text-xs text-gray-400">
                        {effectiveStatusLabel}
                        {path && ` • ${getPathDescription(path)}`}
                    </span>
                </div>

                {fields.length > 0 ? (
                    // Display structured fields
                    <div className="space-y-3">
                        {fields.map(({ field }) => (
                            artifactData[field] && (
                                <div key={field}>
                                    <div className="text-xs text-gray-500 mb-1 capitalize">{field}</div>
                                    <div className="text-sm text-gray-300 whitespace-pre-wrap">
                                        {artifactData[field]}
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                ) : (
                    // Fallback to JSON display
                    <div className="text-sm text-gray-300">
                        {JSON.stringify(artifactData, null, 2)}
                    </div>
                )}
            </div>
        );
    }

    // Fallback for unsupported configurations
    return (
        <div className={`artifact-editor unsupported ${className}`}>
            <div className="text-yellow-400 text-sm">
                无效的编辑器配置: mode={effectiveMode}, fields={fields.length}
                {path && ` (路径: ${path})`}
            </div>
        </div>
    );
};

// Custom comparison function for React.memo to prevent unnecessary re-renders
const arePropsEqual = (prevProps: ArtifactEditorProps, nextProps: ArtifactEditorProps) => {
    const isEqual = (
        prevProps.artifactId === nextProps.artifactId &&
        prevProps.path === nextProps.path &&
        prevProps.transformName === nextProps.transformName &&
        prevProps.className === nextProps.className &&
        prevProps.mode === nextProps.mode &&
        prevProps.statusLabel === nextProps.statusLabel &&
        prevProps.statusColor === nextProps.statusColor &&
        JSON.stringify(prevProps.fields) === JSON.stringify(nextProps.fields)
        // Note: We don't compare onTransition and onSaveSuccess as they're likely to be new functions each render
    );

    return isEqual;
};

export const ArtifactEditor = React.memo(ArtifactEditorComponent, arePropsEqual); 