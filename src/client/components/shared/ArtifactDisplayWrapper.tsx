import React, { useMemo, useState, useCallback } from 'react';
import { Card, Typography, Button, Spin, message } from 'antd';
import { EditOutlined, LoadingOutlined } from '@ant-design/icons';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { YJSArtifactProvider } from '../../contexts/YJSArtifactContext';
import { ReadOnlyArtifactDisplay } from './ReadOnlyArtifactDisplay';
import { canBecomeEditable } from '../../utils/actionComputation';

const { Text, Title } = Typography;

interface ArtifactDisplayWrapperProps {
    artifact?: any;
    isEditable?: boolean;
    title: string;
    icon: string;
    editableComponent: React.ComponentType<any>;
    schemaType: string;
    enableClickToEdit?: boolean;
    onClickToEdit?: () => Promise<void>;
    clickToEditLoading?: boolean;
}

/**
 * Generic wrapper component that handles artifact display logic
 * Determines whether to show editable or read-only mode
 * Can be reused for any artifact type
 */
export const ArtifactDisplayWrapper: React.FC<ArtifactDisplayWrapperProps> = ({
    artifact,
    isEditable = false,
    title,
    icon,
    editableComponent: EditableComponent,
    schemaType,
    enableClickToEdit = true,
    onClickToEdit,
    clickToEditLoading = false
}) => {
    const projectData = useProjectData();
    const [isCreatingTransform, setIsCreatingTransform] = useState(false);

    // Check if this artifact can become editable (only for read-only mode)
    const canEdit = useMemo(() => {
        if (isEditable || !artifact || !Array.isArray(projectData.transformInputs)) return false;
        return canBecomeEditable(artifact, projectData.transformInputs);
    }, [artifact, projectData.transformInputs, isEditable]);

    // Handle creating an editable version
    const handleCreateEditableVersion = useCallback(async () => {
        // If custom click handler is provided, use it
        if (onClickToEdit) {
            await onClickToEdit();
            return;
        }

        // Default behavior
        if (!canEdit || isCreatingTransform || !artifact) return;

        setIsCreatingTransform(true);
        try {
            const response = await fetch(`/api/artifacts/${artifact.id}/human-transform`, {
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
    }, [artifact, canEdit, isCreatingTransform, schemaType, onClickToEdit]);

    // Determine effective loading state
    const effectiveLoading = clickToEditLoading || isCreatingTransform;

    // Determine if click-to-edit is available
    const clickToEditAvailable = enableClickToEdit && (onClickToEdit || canEdit);

    if (!artifact) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px' }}>
                    <Text style={{ color: '#666' }}>加载{title}中...</Text>
                </div>
            </div>
        );
    }

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
                            <Title level={4} style={{ margin: 0, color: '#52c41a' }}>
                                ✏️ 编辑{title}
                            </Title>
                        </div>
                    </div>
                </div>

                {/* YJS-enabled form */}
                <YJSArtifactProvider artifactId={artifact.id} enableCollaboration={true}>
                    <EditableComponent />
                </YJSArtifactProvider>
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
                <ReadOnlyArtifactDisplay
                    data={artifact.data}
                    schemaType={schemaType}
                />
            </Card>
        );
    }
}; 