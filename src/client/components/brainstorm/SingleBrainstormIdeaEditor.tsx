import React, { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Typography, Card, Spin } from 'antd';
import { EyeOutlined, LoadingOutlined } from '@ant-design/icons';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { ArtifactEditor } from '../../transform-artifact-framework/ArtifactEditor';
import { BRAINSTORM_IDEA_FIELDS } from '../shared/MIGUANG_APP_FIELDS';
import { SectionWrapper, ArtifactSchemaType } from '../shared';

const { Title, Text } = Typography;

interface SingleBrainstormIdeaEditorProps {
    onViewOriginalIdeas?: () => void;
}

export const SingleBrainstormIdeaEditor: React.FC<SingleBrainstormIdeaEditorProps> = ({
    onViewOriginalIdeas
}) => {
    const { projectId } = useParams<{ projectId: string }>();
    const projectData = useProjectData();
    const [isCreatingHumanTransform, setIsCreatingHumanTransform] = useState(false);

    // Find the editable brainstorm idea artifact and preview artifact using useMemo
    const { editableArtifactId, previewArtifactId, isEditable } = useMemo(() => {
        // Check if data is ready
        if (projectData.artifacts === "pending" || projectData.artifacts === "error" ||
            projectData.transformInputs === "pending" || projectData.transformInputs === "error") {
            return {
                editableArtifactId: null,
                previewArtifactId: null,
                isEditable: false
            };
        }

        // Get all brainstorm idea artifacts that are user_input type
        const brainstormIdeaArtifacts = projectData.artifacts.filter(artifact =>
            (artifact.schema_type === 'brainstorm_item_schema' || artifact.type === 'brainstorm_item_schema' ||
                artifact.schema_type === 'brainstorm_idea' || artifact.type === 'brainstorm_idea') &&
            artifact.origin_type === 'user_input'
        );

        // Find the one that doesn't have descendants (no transforms using it as input)
        const editableArtifacts = brainstormIdeaArtifacts.filter(artifact => {
            // Check if this artifact is used as input in any transform
            // We already checked that transformInputs is an array above
            const transformInputs = projectData.transformInputs as any[];
            const hasDescendants = transformInputs.some(input =>
                input.artifact_id === artifact.id
            );
            return !hasDescendants;
        });

        // If multiple editable artifacts exist, take the latest one
        if (editableArtifacts.length > 0) {
            editableArtifacts.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            return {
                editableArtifactId: editableArtifacts[0].id,
                previewArtifactId: editableArtifacts[0].id,
                isEditable: true
            };
        }

        // If no editable artifacts, find the latest brainstorm idea for preview
        if (brainstormIdeaArtifacts.length > 0) {
            brainstormIdeaArtifacts.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            return {
                editableArtifactId: null,
                previewArtifactId: brainstormIdeaArtifacts[0].id,
                isEditable: false
            };
        }

        return {
            editableArtifactId: null,
            previewArtifactId: null,
            isEditable: false
        };
    }, [projectData.artifacts, projectData.transformInputs]);

    // Get the preview artifact data to display title
    const previewArtifact = useMemo(() => {
        if (!previewArtifactId) return null;
        return projectData.getArtifactById(previewArtifactId);
    }, [previewArtifactId, projectData.getArtifactById]);

    const ideaTitle = useMemo(() => {
        if (!previewArtifact) return '选中的创意';
        try {
            const data = JSON.parse(previewArtifact.data);
            return data.title || '当前创意';
        } catch (error) {
            console.warn('Failed to parse preview artifact data:', error);
            return '当前创意';
        }
    }, [previewArtifact]);

    // If no artifacts at all, don't render the component
    if (!previewArtifactId) {
        return null;
    }

    let mainPart: React.ReactNode | null = null;

    // Render non-editable preview mode if not editable
    if (!isEditable) {
        mainPart = (
            <div className="single-brainstorm-idea-preview" style={{ marginBottom: '16px' }}>
                <Card
                    size="small"
                    style={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #555',
                        borderRadius: '6px',
                        opacity: 0.7
                    }}
                    styles={{ body: { padding: '16px' } }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

                    {/* Show preview data */}
                    {previewArtifactId && (
                        <div style={{ marginTop: '16px' }}>
                            <ArtifactEditor
                                artifactId={previewArtifactId}
                                fields={BRAINSTORM_IDEA_FIELDS}
                                statusColor="gray"
                                forceReadOnly={true}
                            />
                        </div>
                    )}
                </Card>
            </div>
        );
    }
    // Normal editing mode
    else {
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
                        border: '1px solid #52c41a',
                        borderRadius: '8px',
                        opacity: isCreatingHumanTransform ? 0.7 : 1,
                        pointerEvents: isCreatingHumanTransform ? 'none' : 'auto'
                    }}
                    styles={{ body: { padding: '24px' } }}
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
                    {editableArtifactId && (
                        <div style={{ marginBottom: '24px' }}>
                            <ArtifactEditor
                                artifactId={editableArtifactId}
                                fields={BRAINSTORM_IDEA_FIELDS}
                                statusColor="green"
                                forceReadOnly={!isEditable}
                            />
                        </div>
                    )}

                </Card>
            </div>
        );
    }

    return (
        <SectionWrapper
            schemaType={ArtifactSchemaType.BRAINSTORM_ITEM}
            title="初始创意"
            sectionId="ideation-edit"
            artifactId={editableArtifactId || previewArtifactId || undefined}
        >
            {mainPart}
        </SectionWrapper>
    );
}; 