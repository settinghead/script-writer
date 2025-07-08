import React, { useState, useCallback } from 'react';
import { Button, Typography, Alert, message } from 'antd';
import { CheckOutlined, EditOutlined } from '@ant-design/icons';
import { BaseActionProps } from './index';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useActionItemsStore } from '../../stores/actionItemsStore';

const { Text, Title } = Typography;

const BrainstormIdeaSelection: React.FC<BaseActionProps> = ({ projectId, onSuccess, onError }) => {
    const [isCreatingTransform, setIsCreatingTransform] = useState(false);
    const projectData = useProjectData();
    const store = useActionItemsStore(projectId);

    // Handle confirm selection and create human transform
    const handleConfirmSelection = useCallback(async () => {
        if (!store.selectedBrainstormIdea || isCreatingTransform) {
            return;
        }

        const selectedIdea = store.selectedBrainstormIdea;
        setIsCreatingTransform(true);

        try {
            // Determine the correct transform parameters based on artifact type
            let transformName: string;
            let sourceArtifactId: string;
            let derivationPath: string;

            if (selectedIdea.artifactPath === '$') {
                // This is a standalone brainstorm idea (derived from collection or original)
                transformName = 'edit_brainstorm_idea';
                sourceArtifactId = selectedIdea.artifactId;
                derivationPath = '$';
            } else {
                // This is an item within a collection (original collection item)
                transformName = 'edit_brainstorm_collection_idea';
                sourceArtifactId = selectedIdea.originalArtifactId || selectedIdea.artifactId;
                derivationPath = selectedIdea.artifactPath;
            }

            console.log('[BrainstormIdeaSelection] Creating human transform:', {
                transformName,
                sourceArtifactId,
                derivationPath,
                selectedIdea
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
                        message.success('创意已确认，可以开始编辑');
                        onSuccess?.();
                        resolve(response);
                    },
                    onError: (error) => {
                        console.error('Failed to create human transform:', error);
                        message.error('确认创意失败');
                        onError?.(error instanceof Error ? error : new Error('Failed to create human transform'));
                        reject(error);
                    }
                });
            });
        } catch (error) {
            console.error('Error confirming selection:', error);
        } finally {
            setIsCreatingTransform(false);
        }
    }, [store.selectedBrainstormIdea, projectData.createHumanTransform, onSuccess, onError, isCreatingTransform]);

    // Show error state if no selection
    if (!store.selectedBrainstormIdea) {
        return (
            <Alert
                message="请选择一个创意"
                description="请在上方的创意列表中选择一个想法继续开发"
                type="info"
                showIcon
                style={{ margin: '16px 0' }}
            />
        );
    }

    return (
        <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <Title level={4} style={{ marginBottom: '16px', color: '#fff' }}>
                <EditOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                确认选择的创意
            </Title>

            <div style={{
                background: '#2a2a2a',
                border: '2px solid #1890ff',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
                maxWidth: '600px',
                margin: '0 auto 16px'
            }}>
                <div style={{ marginBottom: '8px' }}>
                    <Text strong style={{ color: '#fff', fontSize: '16px' }}>
                        创意 {store.selectedBrainstormIdea.index + 1}
                    </Text>
                </div>
                <div style={{ marginBottom: '16px' }}>
                    <Text style={{ color: '#ccc', fontSize: '14px' }}>
                        已选择的创意，点击下方按钮确认并开始编辑
                    </Text>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    color: '#1890ff'
                }}>
                    <CheckOutlined />
                    <Text style={{ color: '#1890ff', fontWeight: 'bold' }}>
                        已选择
                    </Text>
                </div>
            </div>

            <Button
                type="primary"
                size="large"
                loading={isCreatingTransform}
                onClick={handleConfirmSelection}
                style={{
                    minWidth: '200px',
                    height: '48px',
                    fontSize: '16px'
                }}
            >
                {isCreatingTransform ? '确认中...' : '确认选择并开始编辑'}
            </Button>

            {isCreatingTransform && (
                <div style={{ marginTop: '16px' }}>
                    <Text type="secondary">正在准备编辑界面...</Text>
                </div>
            )}
        </div>
    );
};

export default BrainstormIdeaSelection; 