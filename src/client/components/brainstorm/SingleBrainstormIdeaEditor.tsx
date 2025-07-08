import React, { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Typography, Card, Spin } from 'antd';
import { EyeOutlined, LoadingOutlined, EditOutlined } from '@ant-design/icons';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { ArtifactEditor } from '../../transform-artifact-framework/ArtifactEditor';
import { BRAINSTORM_IDEA_FIELDS } from '../shared/MIGUANG_APP_FIELDS';
import { SectionWrapper, ArtifactSchemaType } from '../shared';

const { Title, Text } = Typography;

interface SingleBrainstormIdeaEditorProps {
    onViewOriginalIdeas?: () => void;
    isEditable?: boolean; // Global editability state from computation system
}

export const SingleBrainstormIdeaEditor: React.FC<SingleBrainstormIdeaEditorProps> = ({
    onViewOriginalIdeas,
    isEditable: globalIsEditable = true // Default to true if not provided
}) => {
    const { projectId } = useParams<{ projectId: string }>();
    const projectData = useProjectData();
    const [isCreatingHumanTransform, setIsCreatingHumanTransform] = useState(false);

    // Find the latest brainstorm idea artifact and determine editability
    const { latestArtifactId, isEditable, canBecomeEditable } = useMemo(() => {
        // Check if data is ready
        if (projectData.artifacts === "pending" || projectData.artifacts === "error" ||
            projectData.transformInputs === "pending" || projectData.transformInputs === "error") {
            return {
                latestArtifactId: null,
                isEditable: false,
                canBecomeEditable: false
            };
        }

        // Get all brainstorm idea artifacts (both user_input and ai_generated)
        const brainstormIdeaArtifacts = projectData.artifacts.filter(artifact =>
            artifact.schema_type === 'brainstorm_item_schema' || artifact.type === 'brainstorm_item_schema' ||
            artifact.schema_type === 'brainstorm_idea' || artifact.type === 'brainstorm_idea'
        );

        if (brainstormIdeaArtifacts.length === 0) {
            return {
                latestArtifactId: null,
                isEditable: false,
                canBecomeEditable: false
            };
        }

        // Sort by creation time to find the latest
        brainstormIdeaArtifacts.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        const latestArtifact = brainstormIdeaArtifacts[0];
        const transformInputs = projectData.transformInputs as any[];

        // Check if this artifact has descendants (is used as input in any transform)
        const hasDescendants = transformInputs.some(input =>
            input.artifact_id === latestArtifact.id
        );

        // Determine editability:
        // - If it's user_input and has no descendants, it's editable
        // - If it's ai_generated and has no descendants, it can become editable
        // - But global editability (transforms running) overrides everything
        const isCurrentlyEditable = latestArtifact.origin_type === 'user_input' && !hasDescendants && globalIsEditable;
        const canBecomeMadeEditable = latestArtifact.origin_type === 'ai_generated' && !hasDescendants && globalIsEditable;

        return {
            latestArtifactId: latestArtifact.id,
            isEditable: isCurrentlyEditable,
            canBecomeEditable: canBecomeMadeEditable
        };
    }, [projectData.artifacts, projectData.transformInputs, globalIsEditable]);

    // Get the latest artifact data to display title
    const latestArtifact = useMemo(() => {
        if (!latestArtifactId) return null;
        return projectData.getArtifactById(latestArtifactId);
    }, [latestArtifactId, projectData.getArtifactById]);

    const ideaTitle = useMemo(() => {
        if (!latestArtifact) return '选中的创意';
        try {
            const data = JSON.parse(latestArtifact.data);
            return data.title || '当前创意';
        } catch (error) {
            console.warn('Failed to parse latest artifact data:', error);
            return '当前创意';
        }
    }, [latestArtifact]);

    // Handle creating an editable version
    const handleCreateEditableVersion = useCallback(() => {
        if (!latestArtifactId || isCreatingHumanTransform || isEditable) return;

        setIsCreatingHumanTransform(true);
        projectData.createHumanTransform.mutate({
            transformName: 'edit_brainstorm_idea',
            sourceArtifactId: latestArtifactId,
            derivationPath: '$',
            fieldUpdates: {}
        }, {
            onSuccess: (response) => {
                setIsCreatingHumanTransform(false);
                // The new artifact will be automatically picked up by the useMemo
            },
            onError: (error) => {
                setIsCreatingHumanTransform(false);
                console.error('Failed to create editable version:', error);
            }
        });
    }, [latestArtifactId, isCreatingHumanTransform, isEditable, projectData.createHumanTransform]);

    // If no artifacts at all, don't render the component
    if (!latestArtifactId) {
        return null;
    }

    let mainPart: React.ReactNode | null = null;

    // Render based on current state
    if (!globalIsEditable) {
        // Disabled mode - transforms are running, show disabled state
        mainPart = (
            <div className="single-brainstorm-idea-disabled" style={{ marginBottom: '16px' }}>
                <Card
                    style={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #666',
                        borderRadius: '6px',
                        opacity: 0.6,
                        overflow: 'hidden'
                    }}
                    styles={{ body: { padding: '16px', overflow: 'hidden' } }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '4px',
                                height: '24px',
                                backgroundColor: '#666',
                                borderRadius: '2px'
                            }} />
                            <div>
                                <Title level={5} style={{ margin: 0, color: '#666' }}>
                                    ⏳ {ideaTitle}
                                </Title>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    正在处理中，请稍候...
                                </Text>
                            </div>
                        </div>
                    </div>

                    {/* Show read-only data */}
                    <div style={{ overflow: 'hidden' }}>
                        <ArtifactEditor
                            artifactId={latestArtifactId}
                            fields={BRAINSTORM_IDEA_FIELDS}
                            statusColor="gray"
                            forceReadOnly={true}
                        />
                    </div>
                </Card>
            </div>
        );
    } else if (isEditable) {
        // Editable mode - user can edit the artifact
        mainPart = (
            <div className="single-brainstorm-idea-editor" style={{ marginBottom: '24px', position: 'relative' }}>
                {/* Loading overlay for normal mode */}
                {isCreatingHumanTransform && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10,
                        borderRadius: '8px'
                    }}>
                        <Spin
                            indicator={<LoadingOutlined style={{ fontSize: 32, color: '#52c41a' }} spin />}
                            tip="创建编辑版本中..."
                        >
                            <div style={{ padding: '40px' }} />
                        </Spin>
                    </div>
                )}

                <Card
                    style={{
                        backgroundColor: '#1a1a1a',
                        border: '2px solid #52c41a',
                        borderRadius: '8px',
                        opacity: isCreatingHumanTransform ? 0.7 : 1,
                        pointerEvents: isCreatingHumanTransform ? 'none' : 'auto',
                        overflow: 'hidden'
                    }}
                    styles={{ body: { padding: '24px', overflow: 'hidden' } }}
                >
                    {/* Header */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '6px',
                                    height: '32px',
                                    backgroundColor: '#52c41a',
                                    borderRadius: '3px'
                                }} />
                                <div>
                                    <Title level={4} style={{ margin: 0, color: '#52c41a' }}>
                                        ✏️ 编辑创意
                                    </Title>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Artifact Editor */}
                    <div style={{ marginBottom: '24px', overflow: 'hidden' }}>
                        <ArtifactEditor
                            artifactId={latestArtifactId}
                            fields={BRAINSTORM_IDEA_FIELDS}
                            statusColor="green"
                            forceReadOnly={false}
                        />
                    </div>
                </Card>
            </div>
        );
    } else if (canBecomeEditable) {
        // Click-to-edit mode - AI-generated artifact that can be edited
        mainPart = (
            <div className="single-brainstorm-idea-clickable" style={{ marginBottom: '16px' }}>
                <Card
                    style={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #1890ff',
                        borderRadius: '8px',
                        cursor: isCreatingHumanTransform ? 'default' : 'pointer',
                        transition: 'all 0.2s ease',
                        overflow: 'hidden'
                    }}
                    styles={{ body: { padding: '20px', overflow: 'hidden' } }}
                    onClick={!isCreatingHumanTransform ? handleCreateEditableVersion : undefined}
                    onMouseEnter={(e) => {
                        if (!isCreatingHumanTransform) {
                            e.currentTarget.style.borderColor = '#40a9ff';
                            e.currentTarget.style.boxShadow = '0 0 8px rgba(24, 144, 255, 0.3)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isCreatingHumanTransform) {
                            e.currentTarget.style.borderColor = '#1890ff';
                            e.currentTarget.style.boxShadow = 'none';
                        }
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '4px',
                                height: '24px',
                                backgroundColor: '#1890ff',
                                borderRadius: '2px'
                            }} />
                            <div>
                                <Title level={5} style={{ margin: 0, color: '#1890ff' }}>
                                    🤖 {ideaTitle}
                                </Title>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    AI生成 • 点击编辑
                                </Text>
                            </div>
                        </div>

                        {!isCreatingHumanTransform && (
                            <Button
                                type="primary"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCreateEditableVersion();
                                }}
                                style={{
                                    backgroundColor: '#1890ff',
                                    border: 'none',
                                    borderRadius: '4px'
                                }}
                            >
                                编辑创意
                            </Button>
                        )}
                    </div>

                    {/* Show read-only preview */}
                    <div style={{ overflow: 'hidden' }}>
                        <ArtifactEditor
                            artifactId={latestArtifactId}
                            fields={BRAINSTORM_IDEA_FIELDS}
                            statusColor="blue"
                            forceReadOnly={true}
                        />
                    </div>

                    {/* Loading overlay */}
                    {isCreatingHumanTransform && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10,
                            borderRadius: '8px'
                        }}>
                            <Spin
                                indicator={<LoadingOutlined style={{ fontSize: 32, color: '#1890ff' }} spin />}
                                tip="创建编辑版本中..."
                            >
                                <div style={{ padding: '40px' }} />
                            </Spin>
                        </div>
                    )}
                </Card>
            </div>
        );
    } else {
        // Read-only mode - artifact has descendants and cannot be edited
        mainPart = (
            <div className="single-brainstorm-idea-readonly" style={{ marginBottom: '16px' }}>
                <Card
                    style={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #555',
                        borderRadius: '6px',
                        opacity: 0.7,
                        overflow: 'hidden'
                    }}
                    styles={{ body: { padding: '16px', overflow: 'hidden' } }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '4px',
                                height: '24px',
                                backgroundColor: '#555',
                                borderRadius: '2px'
                            }} />
                            <div>
                                <Title level={5} style={{ margin: 0, color: '#888' }}>
                                    📖 {ideaTitle}
                                </Title>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    已生成后续内容，无法编辑
                                </Text>
                            </div>
                        </div>
                    </div>

                    {/* Show read-only data */}
                    <div style={{ overflow: 'hidden' }}>
                        <ArtifactEditor
                            artifactId={latestArtifactId}
                            fields={BRAINSTORM_IDEA_FIELDS}
                            statusColor="gray"
                            forceReadOnly={true}
                        />
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <SectionWrapper
            schemaType={ArtifactSchemaType.BRAINSTORM_ITEM}
            title="初始创意"
            sectionId="ideation-edit"
            artifactId={latestArtifactId || undefined}
        >
            {mainPart}
        </SectionWrapper>
    );
}; 