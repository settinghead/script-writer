import React, { useState, useCallback, useMemo } from 'react';
import { Typography, Alert, message } from 'antd';
import { CheckOutlined, EditOutlined, RightOutlined } from '@ant-design/icons';
import { BaseActionProps } from './index';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useActionItemsStore } from '../../stores/actionItemsStore';
import { getJsonDocAtPath } from '../../../common/transform-jsonDoc-framework/lineageResolution';
import { HumanButton } from '../shared';

const { Text, Title } = Typography;

const BrainstormIdeaSelection: React.FC<BaseActionProps> = ({ projectId, onSuccess, onError }) => {
    const [isCreatingTransform, setIsCreatingTransform] = useState(false);
    const projectData = useProjectData();
    const store = useActionItemsStore(projectId);

    // Independently extract the title from the selected jsonDoc
    const selectedIdeaTitle = useMemo(() => {
        if (!store.selectedJsonDocAndPath) return '';

        const { jsonDocId, jsonDocPath } = store.selectedJsonDocAndPath;

        // Get the jsonDoc from project data
        const jsonDoc = projectData.getJsonDocById(jsonDocId);
        if (!jsonDoc) return '';

        try {
            const parsedData = JSON.parse(jsonDoc.data);

            if (jsonDocPath === '$') {
                // Standalone jsonDoc - use the title directly
                return parsedData.title || '';
            } else {
                // Collection jsonDoc - extract from the specific path
                const ideaData = getJsonDocAtPath(jsonDoc, jsonDocPath);
                return ideaData?.title || '';
            }
        } catch (error) {
            console.warn('Failed to parse jsonDoc data for title extraction:', error);
            return '';
        }
    }, [store.selectedJsonDocAndPath, projectData]);

    // Handle confirm selection and create human transform
    const handleConfirmSelection = useCallback(async () => {
        if (!store.selectedJsonDocAndPath || isCreatingTransform) {
            return;
        }

        const selectedIdea = store.selectedJsonDocAndPath;
        setIsCreatingTransform(true);

        try {
            // Determine the correct transform parameters based on jsonDoc type
            let transformName: string;
            let sourceJsonDocId: string;
            let derivationPath: string;

            if (selectedIdea.jsonDocPath === '$') {
                // This is a standalone brainstorm idea (derived from collection or original)
                transformName = 'edit_brainstorm_idea';
                sourceJsonDocId = selectedIdea.jsonDocId;
                derivationPath = '$';
            } else {
                // This is an item within a collection (original collection item)
                transformName = 'edit_brainstorm_collection_idea';
                sourceJsonDocId = selectedIdea.originalJsonDocId || selectedIdea.jsonDocId;
                derivationPath = selectedIdea.jsonDocPath;
            }

            // Create human transform to start editing
            await new Promise((resolve, reject) => {
                projectData.createHumanTransform.mutate({
                    transformName,
                    sourceJsonDocId,
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
    }, [store.selectedJsonDocAndPath, projectData.createHumanTransform, onSuccess, onError, isCreatingTransform]);

    // Show error state if no selection
    if (!store.selectedJsonDocAndPath) {
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


            <div style={{
                background: '#2a2a2a',
                border: '2px solid #1890ff',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
                maxWidth: '600px',
                margin: '0 auto 16px'
            }}>
                <Text style={{ color: '#1890ff', fontWeight: 'bold' }}>
                    已选择
                </Text>
                <div style={{ marginBottom: '8px' }}>

                    <Text strong style={{ color: '#fff', fontSize: '16px' }}>
                        <CheckOutlined />
                        创意 "{selectedIdeaTitle || `第${(store.selectedJsonDocAndPath.index || 0) + 1}个创意`}"
                    </Text>
                </div>


                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    color: '#1890ff'
                }}>

                </div>
                <div style={{ marginBottom: '16px' }}>
                    <Text style={{ color: '#ccc', fontSize: '14px' }}>
                        点击下方按钮继续
                    </Text>
                </div>
            </div>

            <HumanButton
                size="large"
                loading={isCreatingTransform}
                onClick={handleConfirmSelection}
                style={{
                    minWidth: '200px',
                    fontSize: '16px',
                    padding: '10px 16px',
                    height: 'auto'
                }}
            >
                {isCreatingTransform ? '确认中...' : (
                    <>
                        开始编辑<br />"{selectedIdeaTitle}" <RightOutlined />
                    </>
                )}
            </HumanButton>

            {isCreatingTransform && (
                <div style={{ marginTop: '16px' }}>
                    <Text type="secondary">正在准备编辑界面...</Text>
                </div>
            )}
        </div>
    );
};

export default BrainstormIdeaSelection; 