import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useShape } from '@electric-sql/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { message } from 'antd';
import { useDebouncedCallback } from '../../hooks/useDebounce';
import { EditableField } from './EditableField';
import type { ElectricArtifact } from '../../../common/types';
import { getElectricConfig } from '../../../common/config/electric';
import { extractDataAtPath, getPathDescription } from '../../../common/utils/pathExtraction';
import { HUMAN_TRANSFORM_DEFINITIONS } from '../../../common/schemas/transforms';
import { CheckOutlined } from '@ant-design/icons';

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
    'brainstorm_idea_collection': [
        { field: 'title', component: 'input', maxLength: 50, placeholder: '故事标题...' },
        { field: 'body', component: 'textarea', rows: 6, placeholder: '详细描述...' }
    ],
    'brainstorm_idea': [
        { field: 'title', component: 'input', maxLength: 50, placeholder: '故事标题...' },
        { field: 'body', component: 'textarea', rows: 6, placeholder: '详细描述...' }
    ],
    'user_input': [
        { field: 'text', component: 'textarea', rows: 4, placeholder: '输入内容...' }
    ],
    'outline_input': [
        { field: 'content', component: 'textarea', rows: 8, placeholder: '大纲内容...' }
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

interface SchemaTransformRequest {
    transformName: string;
    derivationPath: string;
    fieldUpdates: Record<string, any>;
}

interface SchemaTransformResponse {
    transform: any;
    derivedArtifact: any;
    wasTransformed: boolean;
}

export const ArtifactEditor: React.FC<ArtifactEditorProps> = React.memo(({
    artifactId,
    path = "",
    transformName,
    className = '',
    onTransition,
    onSaveSuccess
}) => {
    // State for artifact ID management - use a more stable approach
    const [currentArtifactId, setCurrentArtifactId] = useState(artifactId);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingField, setEditingField] = useState<string | null>(null);
    const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set());
    const [typingFields, setTypingFields] = useState<Set<string>>(new Set());

    // Memoize the Electric SQL query parameters to prevent unnecessary re-renders
    const electricQueryParams = useMemo(() => ({
        table: 'artifacts',
        where: `id = '${currentArtifactId}'`
    }), [currentArtifactId]);

    // 1. Check for existing human transform for this path
    const { data: existingTransform, refetch: refetchTransform } = useQuery({
        queryKey: ['human-transform', artifactId, path],
        queryFn: async () => {
            const response = await fetch(`/api/artifacts/${artifactId}/human-transform?path=${encodeURIComponent(path)}`, {
                credentials: 'include'
            });
            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error('Failed to fetch human transform');
            }
            return response.json();
        },
        // Add staleTime to reduce refetching
        staleTime: 5000,
        // Only refetch when explicitly needed
        refetchOnWindowFocus: false
    });

    // 2. Determine which artifact to load - use memoization for stability
    const targetArtifactId = useMemo(() => {
        return currentArtifactId !== artifactId ? currentArtifactId : (existingTransform?.derived_artifact_id || artifactId);
    }, [currentArtifactId, artifactId, existingTransform?.derived_artifact_id]);

    // 3. Electric SQL real-time data with memoized config
    const electricConfig = useMemo(() => getElectricConfig(), []);
    const { data: artifacts, isLoading, error } = useShape({
        url: electricConfig.url,
        params: {
            table: 'artifacts',
            where: `id = '${targetArtifactId}'`
        }
    });

    // Memoize artifact processing to prevent unnecessary recalculations
    const processedArtifactData = useMemo(() => {
        const artifact = artifacts?.[0] as unknown as ElectricArtifact | undefined;
        if (!artifact) return { artifact: null, artifactData: null, actualData: null };

        const rawArtifactData = artifact ? JSON.parse(artifact.data as string) : null;
        
        // 4. Handle different artifact types and extract data appropriately
        let actualData = rawArtifactData;
        
        if (artifact?.type === 'user_input' && artifact.metadata) {
            // Handle user_input artifacts with derived data
            const metadata = JSON.parse(artifact.metadata as string);
            if (metadata.derived_data) {
                // Use the derived data stored in metadata
                actualData = metadata.derived_data;
            } else if (rawArtifactData?.text) {
                // Fallback: try to parse the text field
                try {
                    actualData = JSON.parse(rawArtifactData.text);
                } catch (e) {
                    console.warn('Failed to parse user_input text field:', e);
                    actualData = rawArtifactData;
                }
            }
        } else if (artifact?.type === 'brainstorm_idea') {
            // Handle brainstorm_idea artifacts - normalize legacy structure
            if (rawArtifactData?.idea_title && rawArtifactData?.idea_text) {
                // Legacy structure: convert to new format
                actualData = {
                    title: rawArtifactData.idea_title,
                    body: rawArtifactData.idea_text
                };
            } else if (rawArtifactData?.title && rawArtifactData?.body) {
                // New structure: use as-is
                actualData = rawArtifactData;
            }
        }
        
        // 5. Extract data using path if needed
        let artifactData;
        if (path && actualData) {
            // Special case: brainstorm_idea artifacts are single objects, not arrays
            if (artifact?.type === 'brainstorm_idea' && path.match(/^\[\d+\]$/)) {
                // For brainstorm_idea artifacts, the data is the direct object
                // The path [0], [1], [2] etc. was used to extract from the original collection
                // but now we have a single idea artifact, so return the object itself
                artifactData = actualData;
            }
            // Special case: user_input artifacts from legacy edit_brainstorm_idea transforms
            else if (artifact?.type === 'user_input' && path.match(/^\[\d+\]$/) && 
                actualData && typeof actualData === 'object' && !Array.isArray(actualData) &&
                (actualData.title || actualData.body)) {
                // This is a user_input artifact that contains brainstorm idea data
                // The path [0] should return the object itself since it's not an array
                artifactData = actualData;
            } else {
                // Normal path extraction
                artifactData = extractDataAtPath(actualData, path);
            }
        } else {
            artifactData = actualData;
        }

        return { artifact, artifactData, actualData, rawArtifactData };
    }, [artifacts, path]);

    const { artifact, artifactData, actualData, rawArtifactData } = processedArtifactData;
    
    // Reduced debug logging - only when path exists and limit frequency
    useEffect(() => {
        if (path && artifact) {
            console.log('ArtifactEditor Debug:', {
                artifactId,
                path,
                artifactType: artifact?.type,
                rawArtifactData,
                actualData,
                extractedData: artifactData,
                hasExistingTransform: !!existingTransform,
                targetArtifactId,
                metadata: artifact?.metadata ? JSON.parse(artifact.metadata as string) : null
            });
        }
    }, [artifact?.type, targetArtifactId, !!existingTransform]); // Reduced dependencies
    
    const isLLMGenerated = existingTransform ? false : (artifact?.metadata ? JSON.parse(artifact.metadata as string).source === 'llm' : false);

    // Memoize transform name detection
    const detectedTransformName = useMemo(() => {
        if (transformName) return transformName;
        
        // Auto-detect transform based on artifact type and path
        // Handle both original and derived artifact types
        if ((artifact?.type === 'brainstorm_idea_collection' || 
             artifact?.type === 'user_input' || 
             artifact?.type === 'brainstorm_idea') && path.match(/^\[\d+\]$/)) {
            return 'edit_brainstorm_idea'; // Object-level editing
        }
        if ((artifact?.type === 'brainstorm_idea_collection' || 
             artifact?.type === 'user_input') && path.match(/^\[\d+\]\.(title|body)$/)) {
            return 'edit_brainstorm_idea_field'; // Field-level editing
        }
        
        return null;
    }, [transformName, artifact?.type, path]);

    // TanStack Query mutation for schema-based transforms
    const editMutation = useMutation<SchemaTransformResponse, Error, Record<string, any>>({
        mutationFn: async (fieldUpdates) => {
            if (!detectedTransformName) {
                throw new Error('No transform definition found for this artifact type and path');
            }

            const response = await fetch(`/api/artifacts/${artifactId}/schema-transform`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    transformName: detectedTransformName,
                    derivationPath: path,
                    fieldUpdates
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            return response.json();
        },
        onSuccess: (response) => {
            // Clear pending saves and typing states
            setPendingSaves(new Set());
            setTypingFields(new Set());

            if (response.wasTransformed) {
                // Artifact ID changed due to new transform
                setCurrentArtifactId(response.derivedArtifact.id);
                setIsTransitioning(true);

                // Refetch the human transform query to get the updated transform
                refetchTransform();

                // Trigger green glow animation
                setTimeout(() => setIsTransitioning(false), 600);

                // Notify parent component
                onTransition?.(response.derivedArtifact.id);

                // No toast notification - just rely on visual indicators
            }
            // No toast notification for regular saves either

            // Call onSaveSuccess callback
            onSaveSuccess?.();
        },
        onError: (error) => {
            // Clear pending saves and typing states on error
            setPendingSaves(new Set());
            setTypingFields(new Set());
            message.error(`保存失败: ${error.message}`);
        }
    });

    // Debounced save function for schema-based transforms
    const debouncedSave = useDebouncedCallback((field: string, value: any) => {
        // Clear typing state and set pending save when actually executing
        setTypingFields(prev => {
            const newSet = new Set(prev);
            newSet.delete(field);
            return newSet;
        });
        setPendingSaves(prev => new Set(prev).add(field));

        // Create field updates object
        const fieldUpdates = { [field]: value };
        
        editMutation.mutate(fieldUpdates);
    }, 500);

    // Memoize event handlers to prevent unnecessary re-renders
    const handleFieldChange = useCallback((field: string, value: any) => {
        // Mark field as being typed in (but not yet saved)
        setTypingFields(prev => new Set(prev).add(field));
        
        // Clear any pending save state for this field (user is still typing)
        setPendingSaves(prev => {
            const newSet = new Set(prev);
            newSet.delete(field);
            return newSet;
        });
        
        debouncedSave(field, value);
    }, [debouncedSave]);

    const handleFieldFocus = useCallback((field: string) => {
        setIsEditing(true);
        setEditingField(field);
    }, []);

    const handleFieldBlur = useCallback(() => {
        setIsEditing(false);
        setEditingField(null);
    }, []);

    // Update current artifact ID when prop changes - but only if necessary
    useEffect(() => {
        if (artifactId !== currentArtifactId && !isTransitioning) {
            setCurrentArtifactId(artifactId);
        }
    }, [artifactId, currentArtifactId, isTransitioning]);

    // Loading state
    if (isLoading) {
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

    // Get field mapping - prioritize schema-based approach
    let fieldMapping: FieldConfig[] | null = null;
    
    // 1. Check if we have a transform definition for this path
    if (detectedTransformName && path && artifactData && typeof artifactData === 'object') {
        // Use schema-based field mapping for path-based editing
        fieldMapping = Object.keys(artifactData).map(key => {
            const value = artifactData[key];
            if (typeof value === 'string') {
                return {
                    field: key,
                    component: value.length > 50 ? 'textarea' as const : 'input' as const,
                    maxLength: key === 'title' ? 50 : undefined,
                    rows: key === 'body' ? 6 : key === 'content' ? 8 : undefined,
                    placeholder: key === 'title' ? '标题...' : key === 'body' ? '内容...' : key === 'content' ? '大纲内容...' : `${key}...`
                };
            }
            return null;
        }).filter(Boolean) as FieldConfig[];
    } else {
        // 2. Fallback to static mapping for known artifact types
        fieldMapping = ARTIFACT_FIELD_MAPPING[artifact.type as keyof typeof ARTIFACT_FIELD_MAPPING];
    }

    console.log('ArtifactEditor field mapping:', {
        artifactType: artifact.type,
        path,
        detectedTransformName,
        artifactData,
        fieldMapping,
        hasTransformDef: !!detectedTransformName
    });

    if (!fieldMapping || fieldMapping.length === 0) {
        return (
            <div className={`artifact-editor unsupported ${className}`}>
                <div className="text-yellow-400 text-sm">
                    不支持的内容类型: {artifact.type}
                    {path && ` (路径: ${path})`}
                    {!detectedTransformName && path && <div className="text-xs mt-1">未找到匹配的转换定义</div>}
                </div>
            </div>
        );
    }

    // Dynamic CSS classes for visual states
    const editorClasses = [
        'artifact-editor',
        'transition-all duration-300 ease-in-out',
        'border-2 rounded-lg p-4',
        className,
        isLLMGenerated && !isTransitioning ? 'border-blue-300' : '',
        isTransitioning ? 'border-green-400 shadow-lg animate-glow' : '',
        !isLLMGenerated && !isTransitioning ? 'border-green-300' : '',
        isEditing ? 'border-blue-500' : '',
        editMutation.isPending ? 'opacity-70' : ''
    ].filter(Boolean).join(' ');

    return (
        <div className={editorClasses}>
            {/* Status indicator */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div
                        className={`w-2 h-2 rounded-full ${isLLMGenerated && !isTransitioning ? 'bg-blue-400' : 'bg-green-400'
                            }`}
                    />
                    <span className="text-xs text-gray-400">
                        {isLLMGenerated && !isTransitioning ? 'AI生成' : '用户修改'}
                        {path && ` • ${getPathDescription(path)}`}

                        {editMutation.isPending && (
                        <span className="w-4 h-4 border border-blue-400 border-t-transparent rounded-full animate-spin"></span>
                    )}
                    {!editMutation.isPending && editMutation.isSuccess && pendingSaves.size === 0 && typingFields.size === 0 && (
                        <span className="text-green-400">
                            <CheckOutlined />
                        </span>
                    )}
                    </span>
                </div>

                {/* Simple save indicator */}
                <div className="flex items-center gap-2">
           
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
                        isLLMGenerated={isLLMGenerated && !isTransitioning}
                        isTransitioning={isTransitioning}
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
}); 