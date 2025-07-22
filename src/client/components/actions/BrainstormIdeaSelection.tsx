import React, { useState, useCallback, useMemo } from 'react';
import { Typography, Alert, message } from 'antd';
import { CheckOutlined, EditOutlined, RightOutlined } from '@ant-design/icons';
import { BaseActionProps } from './index';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useActionItemsStore } from '../../stores/actionItemsStore';
import { getJsondocAtPath } from '../../../common/transform-jsondoc-framework/lineageResolution';
import { HumanButton } from '../shared';

const { Text, Title } = Typography;

const BrainstormIdeaSelection: React.FC<BaseActionProps> = ({ projectId, onSuccess, onError }) => {
    const [isCreatingTransform, setIsCreatingTransform] = useState(false);
    const projectData = useProjectData();
    const store = useActionItemsStore(projectId);

    // Independently extract the title from the selected jsondoc
    const selectedIdeaTitle = useMemo(() => {
        if (!store.selectedJsondocAndPath) return '';

        const { jsondocId, jsondocPath } = store.selectedJsondocAndPath;

        // Get the jsondoc from project data
        const jsondoc = projectData.getJsondocById(jsondocId);
        if (!jsondoc) return '';

        try {
            const parsedData = JSON.parse(jsondoc.data);

            if (jsondocPath === '$') {
                // Standalone jsondoc - use the title directly
                return parsedData.title || '';
            } else {
                // Collection jsondoc - extract from the specific path
                const ideaData = getJsondocAtPath(jsondoc, jsondocPath);
                return ideaData?.title || '';
            }
        } catch (error) {
            console.warn('Failed to parse jsondoc data for title extraction:', error);
            return '';
        }
    }, [store.selectedJsondocAndPath, projectData]);

    // Handle confirm selection and create human transform
    const handleConfirmSelection = useCallback(async () => {
        if (!store.selectedJsondocAndPath || isCreatingTransform) {
            return;
        }

        const selectedIdea = store.selectedJsondocAndPath;
        setIsCreatingTransform(true);

        try {
            // Determine the correct transform parameters based on jsondoc type
            let transformName: string;
            let sourceJsondocId: string;
            let derivationPath: string;

            if (selectedIdea.jsondocPath === '$') {
                // This is a standalone brainstorm idea (derived from collection or original)
                transformName = 'edit_灵感创意';
                sourceJsondocId = selectedIdea.jsondocId;
                derivationPath = '$';
            } else {
                // This is an item within a collection (original collection item)
                transformName = 'edit_brainstorm_collection_idea';
                sourceJsondocId = selectedIdea.originalJsondocId || selectedIdea.jsondocId;
                derivationPath = selectedIdea.jsondocPath;
            }

            // Create human transform to start editing
            await new Promise((resolve, reject) => {
                projectData.createHumanTransform.mutate({
                    transformName,
                    sourceJsondocId,
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
    }, [store.selectedJsondocAndPath, projectData.createHumanTransform, onSuccess, onError, isCreatingTransform]);

    // Show error state if no selection
    if (!store.selectedJsondocAndPath) {
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
        <div style={{ padding: '16px 0', textAlign: 'center', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>


            <div style={{
                background: '#2a2a2a',
                border: '2px solid #1890ff',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
                maxWidth: '600px',
                margin: '0 auto 16px',
                marginRight: '16px'
            }}>
                <Text style={{ color: '#1890ff', fontWeight: 'bold' }}>
                    已选择
                </Text>
                <div style={{ marginBottom: '8px' }}>

                    <Text strong style={{ color: '#fff', fontSize: '16px' }}>
                        <CheckOutlined />
                        创意 "{selectedIdeaTitle || `第${(store.selectedJsondocAndPath.index || 0) + 1}个创意`}"
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