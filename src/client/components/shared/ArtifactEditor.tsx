import React, { useState, useEffect } from 'react';
import { useShape } from '@electric-sql/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { message } from 'antd';
import { useDebouncedCallback } from '../../hooks/useDebounce';
import { EditableField } from './EditableField';
import type { ElectricArtifact } from '../../../common/types';
import { getElectricConfig } from '../../../common/config/electric';
import { extractDataAtPath, getPathDescription } from '../../../common/utils/pathExtraction';
import { HUMAN_TRANSFORM_DEFINITIONS } from '../../../common/schemas/transforms';

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

export const ArtifactEditor: React.FC<ArtifactEditorProps> = ({
    artifactId,
    path = "",
    transformName,
    className = '',
    onTransition
}) => {
    // 1. Look up existing human transform for (artifactId, path)
    const { data: existingTransform } = useQuery({
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
        }
    });

    // 2. Determine which artifact to load
    const targetArtifactId = existingTransform?.derived_artifact_id || artifactId;

    // 3. Electric SQL real-time data
    const electricConfig = getElectricConfig();
    const { data: artifacts, isLoading, error } = useShape({
        url: electricConfig.url,
        params: {
            table: 'artifacts',
            where: `id = '${targetArtifactId}'`
        }
    });

    // Local component state
    const [isEditing, setIsEditing] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [currentArtifactId, setCurrentArtifactId] = useState(artifactId);
    const [editingField, setEditingField] = useState<string | null>(null);
    const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set());

    const artifact = artifacts?.[0] as unknown as ElectricArtifact | undefined;
    const rawArtifactData = artifact ? JSON.parse(artifact.data as string) : null;
    
    // 4. Handle user_input artifacts with derived data
    let actualData = rawArtifactData;
    if (artifact?.type === 'user_input' && artifact.metadata) {
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
    }
    
    // 5. Extract data using path if needed
    const artifactData = path && actualData ? 
        extractDataAtPath(actualData, path) : 
        actualData;
    
    // Debug logging
    if (path) {
        console.log('ArtifactEditor Debug:', {
            artifactId,
            path,
            artifactType: artifact?.type,
            rawArtifactData,
            actualData,
            extractedData: artifactData,
            hasExistingTransform: !!existingTransform,
            targetArtifactId
        });
    }
    
    const isLLMGenerated = existingTransform ? false : (artifact?.metadata ? JSON.parse(artifact.metadata as string).source === 'llm' : false);

    // Determine transform name based on artifact type and path
    const getTransformName = (): string | null => {
        if (transformName) return transformName;
        
        // Auto-detect transform based on artifact type and path
        if (artifact?.type === 'brainstorm_idea_collection' && path.match(/^\[\d+\]\.(title|body)$/)) {
            return 'edit_brainstorm_idea';
        }
        if (artifact?.type === 'brainstorm_idea_collection' && path.match(/^\[\d+\]$/)) {
            return 'brainstorm_to_outline';
        }
        
        return null;
    };

    // TanStack Query mutation for schema-based transforms
    const editMutation = useMutation<SchemaTransformResponse, Error, Record<string, any>>({
        mutationFn: async (fieldUpdates) => {
            const detectedTransformName = getTransformName();
            
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
            // Clear pending saves
            setPendingSaves(new Set());

            if (response.wasTransformed) {
                // Artifact ID changed due to new transform
                setCurrentArtifactId(response.derivedArtifact.id);
                setIsTransitioning(true);

                // Trigger green glow animation
                setTimeout(() => setIsTransitioning(false), 600);

                // Notify parent component
                onTransition?.(response.derivedArtifact.id);

                message.success('内容已修改并保存');
            } else {
                message.success('内容已保存');
            }
        },
        onError: (error) => {
            // Clear pending saves on error
            setPendingSaves(new Set());
            message.error(`保存失败: ${error.message}`);
        }
    });

    // Debounced save function for schema-based transforms
    const debouncedSave = useDebouncedCallback((field: string, value: any) => {
        // Track pending save
        setPendingSaves(prev => new Set(prev).add(field));

        // Create field updates object
        const fieldUpdates = { [field]: value };
        
        editMutation.mutate(fieldUpdates);
    }, 500);

    // Handle field changes
    const handleFieldChange = (field: string, value: any) => {
        debouncedSave(field, value);
    };

    // Handle field focus/blur
    const handleFieldFocus = (field: string) => {
        setIsEditing(true);
        setEditingField(field);
    };

    const handleFieldBlur = () => {
        setIsEditing(false);
        setEditingField(null);
    };

    // Update current artifact ID when prop changes
    useEffect(() => {
        if (artifactId !== currentArtifactId) {
            setCurrentArtifactId(artifactId);
        }
    }, [artifactId, currentArtifactId]);

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
    const detectedTransformName = getTransformName();
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
                    </span>
                </div>

                {/* Save status */}
                <div className="flex items-center gap-2">
                    {pendingSaves.size > 0 && !editMutation.isPending && (
                        <div className="text-xs text-yellow-400">待保存...</div>
                    )}
                    {editMutation.isPending && (
                        <div className="text-xs text-blue-400">保存中...</div>
                    )}
                    {!editMutation.isPending && pendingSaves.size === 0 && editMutation.isSuccess && (
                        <div className="text-xs text-green-400">已保存</div>
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
}; 