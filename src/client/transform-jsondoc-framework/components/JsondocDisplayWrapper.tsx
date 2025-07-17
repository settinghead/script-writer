import React, { useMemo, useState, useCallback } from 'react';
import { Card, Typography, Button, Spin, message } from 'antd';
import { EditOutlined, LoadingOutlined } from '@ant-design/icons';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { YJSJsondocProvider } from '../contexts/YJSJsondocContext';
import { ReadOnlyJsondocDisplay } from '../../components/shared/ReadOnlyJsondocDisplay';
import { canBecomeEditable } from '../../utils/actionComputation';
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
    console.log('[JsondocDisplayWrapper] Rendering:', {
        title,
        schemaType,
        hasJsondoc: !!jsondoc,
        jsondocId: jsondoc?.id,
        isEditable,
        enableClickToEdit,
        icon
    });

    const projectData = useProjectData();
    const [isCreatingTransform, setIsCreatingTransform] = useState(false);

    // Check if this jsondoc can become editable (only for read-only mode)
    const canEdit = useMemo(() => {
        if (isEditable || !jsondoc || !Array.isArray(projectData.transformInputs)) return false;
        return canBecomeEditable(jsondoc, projectData.transformInputs);
    }, [jsondoc, projectData.transformInputs, isEditable]);

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
        console.log('[JsondocDisplayWrapper] No jsondoc provided, showing loading state:', {
            title,
            schemaType,
            jsondocValue: jsondoc,
            jsondocType: typeof jsondoc
        });
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px' }}>
                    <Text style={{ color: '#666' }}>加载{title}中...</Text>
                </div>
            </div>
        );
    }

    console.log('[JsondocDisplayWrapper] Jsondoc found, proceeding with render:', {
        jsondocId: jsondoc.id,
        schemaType: jsondoc.schema_type,
        isEditable,
        hasData: !!jsondoc.data
    });

    if (isEditable) {
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
                            <Title level={5} style={{ margin: 0, color: '#52c41a' }}>
                                ✏️ 编辑{title}
                            </Title>
                        </div>
                    </div>
                </div>

                {/* YJS-enabled form */}
                <YJSJsondocProvider
                    jsondocId={parentJsondocId || jsondoc.id}
                    enableCollaboration={true}
                    basePath={parentJsondocId ? jsondocPath : undefined}
                >
                    <EditableComponent />
                </YJSJsondocProvider>
            </Card>
        );
    } else {
        // Read-only mode
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
                                {clickToEditAvailable ?
                                    (effectiveLoading ? '创建编辑版本中...' : '点击编辑') :
                                    '只读模式'
                                }
                            </Text>
                        </div>
                    </div>
                    {clickToEditAvailable && !effectiveLoading && (
                        <EditOutlined style={{ color: '#52c41a', fontSize: '16px' }} />
                    )}
                    {effectiveLoading && (
                        <LoadingOutlined style={{ color: '#1890ff', fontSize: '16px' }} />
                    )}
                </div>

                {/* Read-only content */}
                <ReadOnlyJsondocDisplay
                    data={jsondoc.data}
                    schemaType={schemaType}
                />
            </Card>
        );
    }
}; 