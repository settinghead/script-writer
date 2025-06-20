import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { message, Button } from 'antd';
import { useDebouncedCallback } from '../../hooks/useDebounce';
import { EditableField } from './EditableField';
import { useProjectData } from '../../contexts/ProjectDataContext';
import type { ElectricArtifact } from '../../../common/types';
import { extractDataAtPath, getPathDescription } from '../../../common/utils/pathExtraction';
import { CheckOutlined, EditOutlined, LoadingOutlined } from '@ant-design/icons';

// Artifact type to field mapping
interface FieldConfig {
    field: string;
    component: 'input' | 'textarea';
    maxLength?: number;
    rows?: number;
    placeholder?: string;
}

// Schema-based field mapping for known artifact types
const ARTIFACT_FIELD_MAPPING: Record<string, FieldConfig[]> = {
    'user_input': [
        { field: 'title', component: 'input', maxLength: 50, placeholder: '标题...' },
        { field: 'body', component: 'textarea', rows: 6, placeholder: '内容...' }
    ],
    'brainstorm_idea': [
        { field: 'title', component: 'input', maxLength: 50, placeholder: '标题...' },
        { field: 'body', component: 'textarea', rows: 6, placeholder: '内容...' }
    ]
};

interface ArtifactEditorProps {
    artifactId: string;
    path?: string;           // JSON path for derivation (optional, defaults to root)
    transformName?: string;  // Transform name for schema-based editing
    className?: string;
    onTransition?: (newArtifactId: string) => void;
    onSaveSuccess?: () => void; // Callback when save is successful
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
    onSaveSuccess
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

    // 2. Determine which artifact to display/edit
    const targetArtifactId = existingTransform?.derived_artifact_id || artifactId;
    const shouldShowEditButton = !existingTransform && transformName;

    // 3. Get artifact from unified context
    const artifact = useMemo(() => {
        // If we have a derived artifact ID, prefer that one
        if (existingTransform?.derived_artifact_id) {
            return projectData.getArtifactById(existingTransform.derived_artifact_id);
        }
        
        // Otherwise, use the original artifact
        return projectData.getArtifactById(artifactId);
    }, [projectData, existingTransform?.derived_artifact_id, artifactId]);

    // Loading and error states from unified context
    const isLoadingArtifact = projectData.isLoading;
    const error = projectData.error;

    // 4. Process artifact data
    const processedArtifactData = useMemo(() => {
        if (!artifact) return { artifactData: null, isUserInput: false };

        const rawArtifactData = JSON.parse(artifact.data as string);
        let artifactData = rawArtifactData;
        const isUserInput = artifact.type === 'user_input';

        if (isUserInput && artifact.metadata) {
            // For user_input artifacts, check if we have derived_data in metadata
            const metadata = JSON.parse(artifact.metadata as string);
            if (metadata.derived_data) {
                artifactData = metadata.derived_data;
            } else if (rawArtifactData?.text) {
                // Fallback: try to parse the text field
                try {
                    artifactData = JSON.parse(rawArtifactData.text);
                } catch (e) {
                    console.warn('Failed to parse user_input text field:', e);
                    artifactData = rawArtifactData;
                }
            }
        }

        return { artifactData, isUserInput };
    }, [artifact]);

    const { artifactData, isUserInput } = processedArtifactData;

    // 5. Create transform mutation using unified context
    const createTransformMutation = projectData.createSchemaTransform;

    // 6. Update mutation for user_input and brainstorm_idea artifacts using unified context
    const updateMutation = projectData.updateArtifact;

    // 7. Debounced save function with ref to avoid stale closures
    const saveRef = useRef<(fieldUpdates: Record<string, any>, field: string) => void>();
    
    saveRef.current = (fieldUpdates: Record<string, any>, field: string) => {
        if (isUserInput || (artifact && artifact.type === 'brainstorm_idea')) {
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
            } else if (artifact.type === 'brainstorm_idea') {
                // For brainstorm_idea artifacts, send the data directly
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
        }
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
                
                message.success('开始编辑');
            },
            onError: (error) => {
                setIsCreatingTransform(false);
                message.error(`创建编辑失败: ${error.message}`);
            }
        });
    }, [transformName, path, createTransformMutation, artifactId, onTransition]);

    const handleFieldChange = useCallback((field: string, value: any) => {
        if (!isUserInput && (!artifact || artifact.type !== 'brainstorm_idea')) return;

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
    }, [isUserInput, artifact, artifactData, debouncedSave]);

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
    if (error || !artifact) {
        return (
            <div className={`artifact-editor error ${className}`}>
                <div className="text-red-400 text-sm">
                    {error ? `加载错误: ${error.message}` : '未找到指定的内容'}
                </div>
            </div>
        );
    }

    // Show edit button if no transform exists yet
    if (shouldShowEditButton && !isEditing) {
        return (
            <div className={`artifact-editor ${className}`}>
                <div className="flex items-center justify-between p-4 border-2 border-gray-600 rounded-lg">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                        <span className="text-xs text-gray-400">
                            AI生成
                            {path && ` • ${getPathDescription(path)}`}
                        </span>
                    </div>
                    <Button
                        type="primary"
                        size="small"
                        icon={isCreatingTransform ? <LoadingOutlined /> : <EditOutlined />}
                        onClick={handleEditClick}
                        loading={isCreatingTransform}
                        disabled={isCreatingTransform}
                    >
                        {isCreatingTransform ? '创建中...' : '编辑'}
                    </Button>
                </div>
                
                {/* Read-only display of original data */}
                <div className="mt-3 p-3 bg-gray-800 rounded">
                    {path ? (
                        // Show data at path in a more user-friendly format
                        (() => {
                            const dataAtPath = extractDataAtPath(JSON.parse(artifact.data as string), path);
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
                            {JSON.stringify(JSON.parse(artifact.data as string), null, 2)}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // For user_input artifacts or brainstorm_idea artifacts (from transforms), show the editor
    if ((isUserInput || artifact.type === 'brainstorm_idea') && artifactData) {
        const fieldMapping = ARTIFACT_FIELD_MAPPING[isUserInput ? 'user_input' : artifact.type];

        const editorClasses = [
            'artifact-editor',
            'transition-all duration-300 ease-in-out',
            'border-2 rounded-lg p-4',
            className,
            isUserInput ? 'border-green-300' : 'border-blue-300',
            editingField ? (isUserInput ? 'border-green-500' : 'border-blue-500') : '',
            updateMutation.isPending ? 'opacity-70' : ''
        ].filter(Boolean).join(' ');

        return (
            <div className={editorClasses}>
                {/* Status indicator */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isUserInput ? 'bg-green-400' : 'bg-blue-400'}`} />
                        <span className="text-xs text-gray-400">
                            {isUserInput ? '用户修改' : '已编辑'}
                            {path && ` • ${getPathDescription(path)}`}
                        </span>
                    {/* Save indicator */}

                        {updateMutation.isPending && (
                            <span className={`w-4 h-4 border ${isUserInput ? 'border-green-400' : 'border-blue-400'} border-t-transparent rounded-full animate-spin`}></span>
                        )}
                        {!updateMutation.isPending && updateMutation.isSuccess && pendingSaves.size === 0 && typingFields.size === 0 && (
                            <span className={isUserInput ? 'text-green-400' : 'text-blue-400'}>
                                <CheckOutlined />
                            </span>
                        )}
                    </div>

                
                </div>

                {/* Editable fields */}
                {fieldMapping.map(({ field, component, maxLength, rows, placeholder }) => (
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

    // Fallback for unsupported artifact types
    return (
        <div className={`artifact-editor unsupported ${className}`}>
            <div className="text-yellow-400 text-sm">
                不支持的内容类型: {artifact.type}
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
        prevProps.className === nextProps.className
        // Note: We don't compare onTransition and onSaveSuccess as they're likely to be new functions each render
    );
    
    // Props should now be stable with proper useCallback usage in parent components
    
    return isEqual;
};

export const ArtifactEditor = React.memo(ArtifactEditorComponent, arePropsEqual); 