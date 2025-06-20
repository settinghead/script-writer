import React, { useState, useEffect, useCallback } from 'react';
import { useShape } from '@electric-sql/react';
import { useMutation } from '@tanstack/react-query';
import { message } from 'antd';
import { debounce } from 'lodash';
import { EditableField } from './EditableField';
import type { ElectricArtifact } from '../../../common/types';
import { getElectricConfig } from '../../../common/config/electric';

// Artifact type to field mapping
interface FieldConfig {
    field: string;
    component: 'input' | 'textarea';
    maxLength?: number;
    rows?: number;
    placeholder?: string;
}

const ARTIFACT_FIELD_MAPPING: Record<string, FieldConfig[]> = {
    'brainstorm_idea': [
        { field: 'idea_title', component: 'input', maxLength: 20, placeholder: '故事标题...' },
        { field: 'idea_text', component: 'textarea', rows: 6, placeholder: '详细描述...' }
    ],
    'user_input': [
        { field: 'text', component: 'textarea', rows: 4, placeholder: '输入内容...' }
    ],
    'outline_title': [
        { field: 'title', component: 'input', maxLength: 50, placeholder: '大纲标题...' }
    ]
};

interface ArtifactEditorProps {
    artifactId: string;
    className?: string;
    onTransition?: (newArtifactId: string) => void;
}

interface EditArtifactRequest {
    field: string;
    value: any;
    projectId: string;
}

interface EditArtifactResponse {
    artifactId: string;
    wasTransformed: boolean;
    transformId?: string;
}

export const ArtifactEditor: React.FC<ArtifactEditorProps> = ({
    artifactId,
    className = '',
    onTransition
}) => {
    // Electric SQL real-time data
    const electricConfig = getElectricConfig();
    const { data: artifacts, isLoading, error } = useShape({
        url: electricConfig.url,
        params: {
            table: 'artifacts',
            where: `id = '${artifactId}'`
        }
    });

    // Local component state
    const [isEditing, setIsEditing] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [currentArtifactId, setCurrentArtifactId] = useState(artifactId);
    const [editingField, setEditingField] = useState<string | null>(null);

    const artifact = artifacts?.[0] as unknown as ElectricArtifact | undefined;
    const artifactData = artifact ? JSON.parse(artifact.data as string) : null;
    const isLLMGenerated = artifact?.metadata ? JSON.parse(artifact.metadata as string).source === 'llm' : false;

    // TanStack Query mutation for edits
    const editMutation = useMutation<EditArtifactResponse, Error, EditArtifactRequest>({
        mutationFn: async (editData) => {
            const response = await fetch(`/api/artifacts/${currentArtifactId}/edit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(editData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            return response.json();
        },
        onSuccess: (response) => {
            if (response.wasTransformed) {
                // Artifact ID changed due to LLM→Human transform
                setCurrentArtifactId(response.artifactId);
                setIsTransitioning(true);

                // Trigger green glow animation
                setTimeout(() => setIsTransitioning(false), 600);

                // Notify parent component
                onTransition?.(response.artifactId);

                message.success('内容已修改并保存');
            } else {
                message.success('内容已保存');
            }
        },
        onError: (error) => {
            message.error(`保存失败: ${error.message}`);
        }
    });

    // Debounced save function
    const debouncedSave = useCallback(
        debounce((field: string, value: any) => {
            if (!artifact?.project_id) return;

            editMutation.mutate({
                field,
                value,
                projectId: artifact.project_id
            });
        }, 500),
        [artifact?.project_id, editMutation]
    );

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

    // Get field mapping for this artifact type
    const fieldMapping = ARTIFACT_FIELD_MAPPING[artifact.type as keyof typeof ARTIFACT_FIELD_MAPPING];

    if (!fieldMapping) {
        return (
            <div className={`artifact-editor unsupported ${className}`}>
                <div className="text-yellow-400 text-sm">
                    不支持的内容类型: {artifact.type}
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
                    </span>
                </div>

                {editMutation.isPending && (
                    <div className="text-xs text-blue-400">保存中...</div>
                )}
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
                        onChange={(value) => handleFieldChange(field, value)}
                        onFocus={() => handleFieldFocus(field)}
                        onBlur={handleFieldBlur}
                    />
                </div>
            ))}
        </div>
    );
}; 