import React, { useState, useCallback, useMemo } from 'react';
import { Button, Typography, Card, Spin, Alert, message } from 'antd';
import { CheckOutlined, EditOutlined } from '@ant-design/icons';
import { BaseActionProps } from './index';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useLatestBrainstormIdeas } from '../../transform-artifact-framework/useLineageResolution';

const { Text, Title } = Typography;

const BrainstormIdeaSelection: React.FC<BaseActionProps> = ({ projectId, onSuccess, onError }) => {
    const [selectedIdea, setSelectedIdea] = useState<number | null>(null);
    const [isCreatingTransform, setIsCreatingTransform] = useState(false);
    const projectData = useProjectData();
    const latestIdeas = useLatestBrainstormIdeas();

    // Process ideas for display
    const ideas = useMemo(() => {
        if (latestIdeas === "pending" || latestIdeas === "error") {
            return [];
        }
        return latestIdeas;
    }, [latestIdeas]);

    // Handle idea selection and creation of human transform
    const handleIdeaSelect = useCallback(async (index: number) => {
        if (isCreatingTransform) return;

        const clickedIdea = ideas[index];
        if (!clickedIdea || !clickedIdea.artifactId || !clickedIdea.artifactPath) {
            console.warn('Invalid idea selected:', clickedIdea);
            message.error('无效的创意选择');
            return;
        }

        setIsCreatingTransform(true);
        setSelectedIdea(index);

        try {
            // Determine the correct transform parameters based on artifact type
            let transformName: string;
            let sourceArtifactId: string;
            let derivationPath: string;

            if (clickedIdea.artifactPath === '$') {
                // This is a standalone brainstorm idea (derived from collection or original)
                transformName = 'edit_brainstorm_idea';
                sourceArtifactId = clickedIdea.artifactId;
                derivationPath = '$';
            } else {
                // This is an item within a collection (original collection item)
                transformName = 'edit_brainstorm_collection_idea';
                sourceArtifactId = clickedIdea.originalArtifactId || clickedIdea.artifactId;
                derivationPath = clickedIdea.artifactPath;
            }

            console.log('[BrainstormIdeaSelection] Creating human transform:', {
                transformName,
                sourceArtifactId,
                derivationPath,
                clickedIdea
            });

            // Create human transform to start editing
            await new Promise((resolve, reject) => {
                projectData.createHumanTransform.mutate({
                    transformName,
                    sourceArtifactId,
                    derivationPath,
                    fieldUpdates: {} // Start with empty updates
                }, {
                    onSuccess: (response) => {
                        console.log('Human transform created successfully');
                        message.success('创意已选择，可以开始编辑');
                        onSuccess?.();
                        resolve(response);
                    },
                    onError: (error) => {
                        console.error('Failed to create human transform:', error);
                        message.error('选择创意失败');
                        onError?.(error instanceof Error ? error : new Error('Failed to create human transform'));
                        reject(error);
                    }
                });
            });
        } catch (error) {
            console.error('Error selecting idea:', error);
        } finally {
            setIsCreatingTransform(false);
        }
    }, [ideas, projectData.createHumanTransform, onSuccess, onError, isCreatingTransform]);

    // Show loading state
    if (latestIdeas === "pending" || projectData.isLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '24px' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px' }}>
                    <Text type="secondary">加载创意想法...</Text>
                </div>
            </div>
        );
    }

    // Show error state
    if (latestIdeas === "error" || projectData.error) {
        return (
            <Alert
                message="加载创意想法失败"
                description={typeof projectData.error === 'string' ? projectData.error : '无法获取创意想法'}
                type="error"
                showIcon
                style={{ margin: '16px 0' }}
            />
        );
    }

    // Show empty state
    if (ideas.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '24px' }}>
                <Text type="secondary">暂无创意想法可选择</Text>
            </div>
        );
    }

    return (
        <div style={{ padding: '16px 0' }}>
            <Title level={4} style={{ marginBottom: '16px', color: '#fff', textAlign: 'center' }}>
                <EditOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                选择一个创意继续开发
            </Title>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '16px',
                maxWidth: '1200px',
                margin: '0 auto'
            }}>
                {ideas.map((idea, index) => (
                    <Card
                        key={`${idea.artifactId}-${index}`}
                        hoverable
                        style={{
                            background: '#2a2a2a',
                            borderColor: selectedIdea === index ? '#1890ff' : '#434343',
                            borderWidth: selectedIdea === index ? 2 : 1
                        }}
                        bodyStyle={{ padding: '16px' }}
                        onClick={() => handleIdeaSelect(index)}
                    >
                        <div style={{ position: 'relative' }}>
                            {/* Selection indicator */}
                            {selectedIdea === index && (
                                <div style={{
                                    position: 'absolute',
                                    top: -8,
                                    right: -8,
                                    background: '#1890ff',
                                    borderRadius: '50%',
                                    width: 24,
                                    height: 24,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <CheckOutlined style={{ color: '#fff', fontSize: 12 }} />
                                </div>
                            )}

                            {/* Idea content */}
                            <div style={{ marginBottom: '12px' }}>
                                <Text strong style={{ color: '#fff', fontSize: '16px' }}>
                                    {idea.title || `创意 ${index + 1}`}
                                </Text>
                            </div>

                            <div style={{ marginBottom: '12px' }}>
                                <Text style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.5' }}>
                                    {idea.body || '内容加载中...'}
                                </Text>
                            </div>

                            {/* Action button */}
                            <Button
                                type={selectedIdea === index ? 'primary' : 'default'}
                                size="small"
                                loading={isCreatingTransform && selectedIdea === index}
                                style={{
                                    width: '100%',
                                    marginTop: '8px'
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleIdeaSelect(index);
                                }}
                            >
                                {isCreatingTransform && selectedIdea === index ? '选择中...' : '选择此创意'}
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>

            {isCreatingTransform && (
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <Text type="secondary">正在准备编辑界面...</Text>
                </div>
            )}
        </div>
    );
};

export default BrainstormIdeaSelection; 