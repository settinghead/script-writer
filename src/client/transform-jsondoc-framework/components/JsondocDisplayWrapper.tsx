import React, { useMemo, useState, useCallback } from 'react';
import { Card, Typography, Button, Spin, message } from 'antd';
import { EditOutlined, LoadingOutlined } from '@ant-design/icons';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { YJSJsondocProvider } from '../contexts/YJSJsondocContext';
import { ReadOnlyJsondocDisplay } from '../../components/shared/ReadOnlyJsondocDisplay';
import { canBecomeEditable, isDirectlyEditable } from '../../utils/actionComputation';
import { TypedJsondoc } from '../../../common/types';

const { Text, Title } = Typography;

interface JsondocDisplayWrapperProps {
    jsondoc?: any;
    isEditable?: boolean;
    title: string;
    icon: string;
    editableComponent: React.ComponentType<any>;
    schemaType: TypedJsondoc['schema_type'];
    enableClickToEdit?: boolean;
    onClickToEdit?: () => Promise<void>;
    clickToEditLoading?: boolean;
    // NEW: Support for hierarchical context
    parentJsondocId?: string;
    jsondocPath?: string;
}

/**
 * Generic wrapper component that handles jsondoc display logic
 * Determines whether to show editable or read-only mode
 * Can be reused for any jsondoc type
 */
export const JsondocDisplayWrapper: React.FC<JsondocDisplayWrapperProps> = ({
    jsondoc,
    isEditable = false,
    title,
    icon,
    editableComponent: EditableComponent,
    schemaType,
    enableClickToEdit = true,
    onClickToEdit,
    clickToEditLoading = false,
    parentJsondocId,
    jsondocPath
}) => {



    const projectData = useProjectData();
    const [isCreatingTransform, setIsCreatingTransform] = useState(false);

    // Check editability with the new logic
    const editabilityState = useMemo(() => {
        if (!jsondoc || !Array.isArray(projectData.transformInputs)) {
            return { isDirectlyEditable: false, canBecomeEditable: false };
        }

        return {
            isDirectlyEditable: isDirectlyEditable(jsondoc, projectData.transformInputs),
            canBecomeEditable: canBecomeEditable(jsondoc, projectData.transformInputs)
        };
    }, [jsondoc, projectData.transformInputs]);

    // Determine the effective editability
    const effectiveIsEditable = useMemo(() => {
        // If explicitly set as editable, use that
        if (isEditable) return true;

        // If it's a user-created jsondoc with no descendants, it should be directly editable
        if (editabilityState.isDirectlyEditable) return true;

        return false;
    }, [isEditable, editabilityState.isDirectlyEditable]);

    // Check if this jsondoc can become editable via click-to-edit (only for AI-generated)
    const canEdit = useMemo(() => {
        if (effectiveIsEditable || !jsondoc) return false;
        return editabilityState.canBecomeEditable;
    }, [effectiveIsEditable, jsondoc, editabilityState.canBecomeEditable]);

    // Handle creating an editable version
    const handleCreateEditableVersion = useCallback(async () => {
        // If custom click handler is provided, use it
        if (onClickToEdit) {
            await onClickToEdit();
            return;
        }

        // Default behavior
        if (!canEdit || isCreatingTransform || !jsondoc) return;

        setIsCreatingTransform(true);
        try {
            const response = await fetch(`/api/jsondocs/${jsondoc.id}/human-transform`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer debug-auth-token-script-writer-dev`
                },
                credentials: 'include',
                body: JSON.stringify({
                    transformName: `edit_${schemaType.replace('_schema', '')}`,
                    derivationPath: '$',
                    fieldUpdates: {}
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            await response.json();
            message.success('已创建可编辑版本');
        } catch (error) {
            console.error('Failed to create editable version:', error);
            message.error('创建可编辑版本失败');
        } finally {
            setIsCreatingTransform(false);
        }
    }, [jsondoc, canEdit, isCreatingTransform, schemaType, onClickToEdit]);

    // Determine effective loading state
    const effectiveLoading = clickToEditLoading || isCreatingTransform;

    // Determine if click-to-edit is available
    const clickToEditAvailable = enableClickToEdit && (onClickToEdit || canEdit);

    if (!jsondoc) {

        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px' }}>
                    <Text style={{ color: '#666' }}>加载{title}中...</Text>
                </div>
            </div>
        );
    }


    if (effectiveIsEditable) {
        // Editable mode - green border, user can edit with YJS
        return (
            <Card
                style={{
                    backgroundColor: '#1a1a1a',
                    border: '2px solid #52c41a',
                    borderRadius: '8px'
                }}
                styles={{ body: { padding: '24px' } }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '6px',
                            height: '32px',
                            backgroundColor: '#52c41a',
                            borderRadius: '3px'
                        }} />
                        <div>
                            <Title level={4} style={{ margin: 0, color: '#fff' }}>
                                {icon} {title}
                            </Title>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                {(() => {

                                    // Parse metadata if it's a string
                                    let parsedMetadata;
                                    try {
                                        parsedMetadata = typeof jsondoc.metadata === 'string'
                                            ? JSON.parse(jsondoc.metadata)
                                            : jsondoc.metadata;
                                    } catch (e) {
                                        parsedMetadata = jsondoc.metadata;
                                    }

                                    if (jsondoc.origin_type === 'user_input') {
                                        // For brainstorm ideas, check if it came from a collection or was directly created
                                        if (jsondoc.schema_type === '灵感创意') {
                                            // If it has original_jsondoc_id in metadata, it's an edited version
                                            if (parsedMetadata && typeof parsedMetadata === 'object' && 'original_jsondoc_id' in parsedMetadata) {
                                                return '已编辑';
                                            }
                                            // If it has no metadata or empty metadata, it was directly created
                                            if (!parsedMetadata || Object.keys(parsedMetadata).length === 0) {
                                                return '故事创意';
                                            }
                                            // If it has metadata but no original_jsondoc_id, it might be from collection selection
                                            return '选中的创意';
                                        }
                                        return '用户创建';
                                    }
                                    return '可编辑';
                                })()}
                            </Text>
                        </div>
                    </div>
                </div>

                {/* Editable Content */}
                <YJSJsondocProvider jsondocId={jsondoc.id}>
                    <EditableComponent />
                </YJSJsondocProvider>
            </Card>
        );
    } else {
        // Read-only mode - gray border, with optional click-to-edit
        return (
            <Card
                onClick={clickToEditAvailable && !effectiveLoading ? handleCreateEditableVersion : undefined}
                style={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #555',
                    borderRadius: '6px',
                    opacity: 0.7,
                    cursor: (clickToEditAvailable && !effectiveLoading) ? 'pointer' : 'default',
                    transition: 'all 0.2s ease'
                }}
                styles={{ body: { padding: '24px' } }}
                onMouseEnter={(e) => {
                    if (clickToEditAvailable && !effectiveLoading) {
                        e.currentTarget.style.opacity = '0.9';
                        e.currentTarget.style.borderColor = '#52c41a';
                    }
                }}
                onMouseLeave={(e) => {
                    if (clickToEditAvailable && !effectiveLoading) {
                        e.currentTarget.style.opacity = '0.7';
                        e.currentTarget.style.borderColor = '#555';
                    }
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '6px',
                            height: '32px',
                            backgroundColor: '#555',
                            borderRadius: '3px'
                        }} />
                        <div>
                            <Title level={4} style={{ margin: 0, color: '#888' }}>
                                {icon} {title}
                            </Title>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                {jsondoc.origin_type === 'ai_generated' ? 'AI生成' : '只读'}
                                {clickToEditAvailable && ' • 点击编辑'}
                            </Text>
                        </div>
                    </div>

                    {/* Edit button for click-to-edit */}
                    {clickToEditAvailable && (
                        <Button
                            type="text"
                            icon={effectiveLoading ? <LoadingOutlined /> : <EditOutlined />}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!effectiveLoading) {
                                    handleCreateEditableVersion();
                                }
                            }}
                            disabled={effectiveLoading}
                            style={{ color: '#52c41a' }}
                        >
                            {effectiveLoading ? '创建中...' : '编辑'}
                        </Button>
                    )}
                </div>

                {/* Read-only Content */}
                <ReadOnlyJsondocDisplay data={jsondoc.data} schemaType={jsondoc.schema_type} />
            </Card>
        );
    }
}; 