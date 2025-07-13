import React, { useState, useCallback } from 'react';
import { message } from 'antd';
import { LoadingOutlined, CheckOutlined } from '@ant-design/icons';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useJsondocEditor } from '../hooks/useJsondocEditor';
import { extractDataAtPath } from '../../common/utils/pathExtraction';
import { EditableField } from './EditableField';
import { TypedJsondoc } from '@/common/types';

export interface FieldConfig {
    field: string;
    component: 'input' | 'textarea';
    maxLength?: number;
    rows?: number;
    placeholder?: string;
}

interface JsondocEditorProps {
    jsondocId: string;
    sourceJsondocId?: string;
    path?: string;
    transformName?: string;
    className?: string;
    onTransition?: (newJsondocId: string) => void;
    onSaveSuccess?: () => void;
    fields?: FieldConfig[];
    statusLabel?: string;
    statusColor?: string;
    forceReadOnly?: boolean;
}

interface JsondocFragment {
    jsondocId: string;
    data: any;
    isEditable: boolean;
    schema_type: TypedJsondoc['schema_type'];
    origin_type: 'ai_generated' | 'user_input';
    path?: string;

    // DEPRECATED: Keep for backward compatibility during refactor
    type: string;
}

// Sub-component for read-only display with click-to-edit
interface ReadOnlyViewProps {
    fragment: JsondocFragment;
    fields: FieldConfig[];
    transformName?: string;
    onTransition?: (newJsondocId: string) => void;
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
            sourceJsondocId: fragment.jsondocId,
            derivationPath: fragment.path || "",
            fieldUpdates: {}
        }, {
            onSuccess: (response) => {
                setIsCreatingTransform(false);
                onTransition?.(response.derivedJsondoc.id);
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
            className={`jsondoc-editor readonly ${className}`}
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

            <div className="mt-3 p-3 bg-gray-800 rounded overflow-hidden">
                {fields.length > 0 && fragment.data && typeof fragment.data === 'object' ? (
                    <div className="space-y-3">
                        {fields.map(({ field }) => (
                            fragment.data[field] && (
                                <div key={field} className="overflow-hidden">
                                    <div className="text-xs text-gray-500 mb-1 capitalize">
                                        {field === 'title' ? '标题' : field === 'body' ? '内容' : field}
                                    </div>
                                    <div className="text-sm text-gray-300 text-wrap-anywhere">
                                        {fragment.data[field]}
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-gray-300 text-wrap-anywhere overflow-hidden">
                        {JSON.stringify(fragment.data, null, 2)}
                    </div>
                )}
            </div>
        </div>
    );
};

// Sub-component for editable mode
interface EditableViewProps {
    fragment: JsondocFragment;
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
    // Use the reusable jsondoc editor hook
    const {
        pendingSaves,
        editingField,
        handleFieldChange,
        setEditingField,
        isPending,
        isSuccess
    } = useJsondocEditor({
        jsondocId: fragment.jsondocId,
        debounceMs: 1000,
        onSaveSuccess,
        onSaveError: (error) => {
            message.error(`保存失败: ${error.message}`);
        }
    });

    return (
        <div className={`jsondoc-editor editable border-2 border-green-500 rounded-lg p-4 ${className}`}>
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

// Main component that resolves the jsondoc fragment and decides which sub-component to render
const JsondocEditor: React.FC<JsondocEditorProps> = ({
    jsondocId,
    sourceJsondocId,
    path = "",
    transformName,
    className = '',
    onTransition,
    onSaveSuccess,
    fields = [],
    statusLabel,
    statusColor = 'blue',
    forceReadOnly
}) => {
    const projectData = useProjectData();

    // Resolve the jsondoc fragment
    const fragment: JsondocFragment | null = React.useMemo(() => {
        // First, try to find existing human transform for this path
        const humanTransforms = projectData.getHumanTransformsForJsondoc(
            sourceJsondocId || jsondocId,
            path
        );

        let targetJsondoc;
        if (humanTransforms.length > 0) {
            // Use the derived jsondoc from the latest human transform
            const latestTransform = humanTransforms[humanTransforms.length - 1];
            if (typeof latestTransform !== 'string' && latestTransform.derived_jsondoc_id) {
                targetJsondoc = projectData.getJsondocById(latestTransform.derived_jsondoc_id);
            }
        } else {
            // Use the original jsondoc
            targetJsondoc = projectData.getJsondocById(jsondocId);
        }

        if (!targetJsondoc) {
            return null;
        }

        // Parse and extract data
        if (!targetJsondoc.data) {
            return null;
        }

        let parsedData;
        try {
            parsedData = typeof targetJsondoc.data === 'string'
                ? JSON.parse(targetJsondoc.data)
                : targetJsondoc.data;
        } catch (error) {
            console.error('Failed to parse jsondoc data:', error);
            return null;
        }

        // Extract data at path if specified
        const extractedData = (path && path !== "") ? extractDataAtPath(parsedData, path) : parsedData;



        return {
            jsondocId: targetJsondoc.id,
            data: extractedData,
            isEditable: targetJsondoc.origin_type === 'user_input',
            schema_type: targetJsondoc.schema_type,
            origin_type: targetJsondoc.origin_type,
            path,

            // DEPRECATED: Keep for backward compatibility during refactor  
            type: (targetJsondoc.schema_type) as string
        };
    }, [jsondocId, sourceJsondocId, path, projectData]);

    // Loading state
    if (projectData.isLoading) {
        return (
            <div className={`jsondoc-editor loading ${className}`}>
                <div className="animate-pulse bg-gray-700 h-20 rounded"></div>
            </div>
        );
    }

    // Error state
    if (projectData.error || !fragment) {
        return (
            <div className={`jsondoc-editor error ${className}`}>
                <div className="text-red-400 text-sm">
                    {projectData.error ? `加载错误: ${projectData.error.message}` : '未找到指定的内容'}
                </div>
            </div>
        );
    }

    // Decide which sub-component to render
    if (fragment.isEditable && fields.length > 0 && !forceReadOnly) {
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

export { JsondocEditor }; 