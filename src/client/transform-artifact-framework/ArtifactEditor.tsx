import React, { useState, useCallback } from 'react';
import { message } from 'antd';
import { LoadingOutlined, CheckOutlined } from '@ant-design/icons';
import { useProjectData } from '../contexts/ProjectDataContext';
import { extractDataAtPath } from '../../common/utils/pathExtraction';
import { EditableField } from './EditableField';

export interface FieldConfig {
    field: string;
    component: 'input' | 'textarea';
    maxLength?: number;
    rows?: number;
    placeholder?: string;
}

interface ArtifactEditorProps {
    artifactId: string;
    sourceArtifactId?: string;
    path?: string;
    transformName?: string;
    className?: string;
    onTransition?: (newArtifactId: string) => void;
    onSaveSuccess?: () => void;
    fields?: FieldConfig[];
    statusLabel?: string;
    statusColor?: string;
}

interface ArtifactFragment {
    artifactId: string;
    data: any;
    isEditable: boolean;
    schema_type: string;
    origin_type: 'ai_generated' | 'user_input';
    path?: string;

    // DEPRECATED: Keep for backward compatibility during refactor
    type: string;
}

// Sub-component for read-only display with click-to-edit
interface ReadOnlyViewProps {
    fragment: ArtifactFragment;
    fields: FieldConfig[];
    transformName?: string;
    onTransition?: (newArtifactId: string) => void;
    statusLabel?: string;
    statusColor?: string;
    className?: string;
}

const ReadOnlyView: React.FC<ReadOnlyViewProps> = ({
    fragment,
    fields,
    transformName,
    onTransition,
    statusLabel = "AI生成",
    statusColor = "blue",
    className = ""
}) => {
    const [isCreatingTransform, setIsCreatingTransform] = useState(false);
    const projectData = useProjectData();

    const handleEditClick = useCallback(() => {
        if (!transformName) {
            message.error('未指定转换类型');
            return;
        }

        setIsCreatingTransform(true);
        projectData.createHumanTransform.mutate({
            transformName,
            sourceArtifactId: fragment.artifactId,
            derivationPath: fragment.path || "",
            fieldUpdates: {}
        }, {
            onSuccess: (response) => {
                setIsCreatingTransform(false);
                onTransition?.(response.derivedArtifact.id);
                message.success('选中内容，开始编辑');
            },
            onError: (error) => {
                setIsCreatingTransform(false);
                message.error(`创建编辑失败: ${error.message}`);
            }
        });
    }, [transformName, fragment, projectData.createHumanTransform, onTransition]);

    return (
        <div
            className={`artifact-editor readonly ${className}`}
            onClick={handleEditClick}
            style={{ cursor: 'pointer' }}
        >
            <div className="flex items-center justify-between p-4 border-2 border-blue-500 rounded-lg hover:border-blue-400 transition-colors">
                <div className="flex items-center gap-2">
                    <div className="text-blue-400 text-xs font-bold">👁️ 点击编辑</div>
                    <div className={`w-2 h-2 rounded-full bg-${statusColor}-400`} />
                    <span className="text-xs text-gray-400">
                        {statusLabel}
                        {fragment.path && ` • ${fragment.path}`}
                    </span>
                </div>
                {isCreatingTransform && (
                    <LoadingOutlined style={{ color: '#1890ff' }} />
                )}
            </div>

            <div className="mt-3 p-3 bg-gray-800 rounded">
                {fields.length > 0 && fragment.data && typeof fragment.data === 'object' ? (
                    <div className="space-y-3">
                        {fields.map(({ field }) => (
                            fragment.data[field] && (
                                <div key={field}>
                                    <div className="text-xs text-gray-500 mb-1 capitalize">
                                        {field === 'title' ? '标题' : field === 'body' ? '内容' : field}
                                    </div>
                                    <div className="text-sm text-gray-300 whitespace-pre-wrap">
                                        {fragment.data[field]}
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-gray-300">
                        {JSON.stringify(fragment.data, null, 2)}
                    </div>
                )}
            </div>
        </div>
    );
};

// Sub-component for editable mode
interface EditableViewProps {
    fragment: ArtifactFragment;
    fields: FieldConfig[];
    onSaveSuccess?: () => void;
    statusLabel?: string;
    statusColor?: string;
    className?: string;
}

const EditableView: React.FC<EditableViewProps> = ({
    fragment,
    fields,
    onSaveSuccess,
    statusLabel = "已编辑",
    statusColor = "green",
    className = ""
}) => {
    const [editingField, setEditingField] = useState<string | null>(null);
    const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set());
    const projectData = useProjectData();

    // Get mutation state for this artifact
    const mutationState = projectData.mutationStates.artifacts.get(fragment.artifactId);
    const isPending = mutationState?.status === 'pending';
    const isSuccess = mutationState?.status === 'success';

    const handleFieldChange = useCallback((field: string, value: any) => {
        setPendingSaves(prev => new Set(prev).add(field));

        const updatedData = { ...fragment.data, [field]: value };

        // Prepare request based on artifact type to match backend expectations
        // Backend expects: { text: "..." } for user_input, { data: rawObject } for others
        let requestData;
        if (fragment.type === 'user_input') {
            requestData = { text: JSON.stringify(updatedData) };
        } else {
            // For non-user_input artifacts (like brainstorm_idea), send the raw data directly
            // The apiService will wrap it in { data: ... }, so the backend gets { data: rawObject }
            requestData = updatedData;
        }

        projectData.updateArtifact.mutate({
            artifactId: fragment.artifactId,
            data: requestData
        }, {
            onSuccess: () => {
                setPendingSaves(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(field);
                    return newSet;
                });
                onSaveSuccess?.();
            },
            onError: (error) => {
                setPendingSaves(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(field);
                    return newSet;
                });
                message.error(`保存失败: ${error.message}`);
            }
        });
    }, [fragment, projectData.updateArtifact, onSaveSuccess]);

    return (
        <div className={`artifact-editor editable border-2 border-green-500 rounded-lg p-4 ${className}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full bg-${statusColor}-400`} />
                    <span className="text-xs text-gray-400">
                        {statusLabel}
                        {fragment.path && ` • ${fragment.path}`}
                    </span>

                    {(pendingSaves.size > 0 || isPending) && (
                        <LoadingOutlined style={{ color: '#52c41a' }} />
                    )}
                    {isSuccess && (
                        <CheckOutlined style={{ color: '#52c41a' }} />
                    )}
                </div>
            </div>

            {fields.map(({ field, component, maxLength, rows, placeholder }) => (
                <div key={field} className="mb-4 last:mb-0">
                    <EditableField
                        value={fragment.data?.[field] || ''}
                        fieldType={component}
                        maxLength={maxLength}
                        rows={rows}
                        placeholder={placeholder}
                        isLLMGenerated={false}
                        isTransitioning={false}
                        isFocused={editingField === field}
                        hasPendingSave={pendingSaves.has(field)}
                        onChange={(value) => handleFieldChange(field, value)}
                        onFocus={() => setEditingField(field)}
                        onBlur={() => setEditingField(null)}
                    />
                </div>
            ))}
        </div>
    );
};

// Main component that resolves the artifact fragment and decides which sub-component to render
const ArtifactEditor: React.FC<ArtifactEditorProps> = ({
    artifactId,
    sourceArtifactId,
    path = "",
    transformName,
    className = '',
    onTransition,
    onSaveSuccess,
    fields = [],
    statusLabel,
    statusColor = 'blue'
}) => {
    const projectData = useProjectData();

    // Resolve the artifact fragment
    const fragment: ArtifactFragment | null = React.useMemo(() => {
        // First, try to find existing human transform for this path
        const humanTransforms = projectData.getHumanTransformsForArtifact(
            sourceArtifactId || artifactId,
            path
        );

        let targetArtifact;
        if (humanTransforms.length > 0) {
            // Use the derived artifact from the latest human transform
            const latestTransform = humanTransforms[humanTransforms.length - 1];
            if (latestTransform.derived_artifact_id) {
                targetArtifact = projectData.getArtifactById(latestTransform.derived_artifact_id);
            }
        } else {
            // Use the original artifact
            targetArtifact = projectData.getArtifactById(artifactId);
        }

        if (!targetArtifact) {
            return null;
        }

        // Parse and extract data
        if (!targetArtifact.data) {
            return null;
        }

        let parsedData;
        try {
            parsedData = typeof targetArtifact.data === 'string'
                ? JSON.parse(targetArtifact.data)
                : targetArtifact.data;
        } catch (error) {
            console.error('Failed to parse artifact data:', error);
            return null;
        }

        // Extract data at path if specified
        const extractedData = (path && path !== "") ? extractDataAtPath(parsedData, path) : parsedData;



        return {
            artifactId: targetArtifact.id,
            data: extractedData,
            isEditable: targetArtifact.origin_type === 'user_input',
            schema_type: targetArtifact.schema_type,
            origin_type: targetArtifact.origin_type,
            path,

            // DEPRECATED: Keep for backward compatibility during refactor  
            type: (targetArtifact.type || targetArtifact.schema_type) as string
        };
    }, [artifactId, sourceArtifactId, path, projectData]);

    // Loading state
    if (projectData.isLoading) {
        return (
            <div className={`artifact-editor loading ${className}`}>
                <div className="animate-pulse bg-gray-700 h-20 rounded"></div>
            </div>
        );
    }

    // Error state
    if (projectData.error || !fragment) {
        return (
            <div className={`artifact-editor error ${className}`}>
                <div className="text-red-400 text-sm">
                    {projectData.error ? `加载错误: ${projectData.error.message}` : '未找到指定的内容'}
                </div>
            </div>
        );
    }

    // Decide which sub-component to render
    if (fragment.isEditable && fields.length > 0) {
        return (
            <EditableView
                fragment={fragment}
                fields={fields}
                onSaveSuccess={onSaveSuccess}
                statusLabel={statusLabel}
                statusColor={statusColor}
                className={className}
            />
        );
    } else {
        return (
            <ReadOnlyView
                fragment={fragment}
                fields={fields}
                transformName={transformName}
                onTransition={onTransition}
                statusLabel={statusLabel}
                statusColor={statusColor}
                className={className}
            />
        );
    }
};

export { ArtifactEditor }; 