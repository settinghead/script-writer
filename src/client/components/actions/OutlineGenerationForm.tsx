import React, { useState, useCallback, useMemo } from 'react';
import { Button, Typography, Form, Input, InputNumber, Select, message } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { BaseActionProps } from './index';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { findChosenBrainstormIdea } from '../../utils/actionComputation';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface OutlineFormValues {
    title: string;
    requirements: string;
}

const OutlineGenerationForm: React.FC<BaseActionProps> = ({ projectId, onSuccess, onError }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const projectData = useProjectData();

    // Use the action computation function to find chosen brainstorm idea
    const chosenIdea = useMemo(() => {
        return findChosenBrainstormIdea(projectData);
    }, [projectData]);

    const chosenIdeaLoading = projectData.isLoading;

    // Get the chosen brainstorm idea artifact and data
    const { sourceArtifactId, ideaData } = useMemo(() => {
        if (!chosenIdea) return { sourceArtifactId: null, ideaData: null };

        // The findChosenBrainstormIdea function returns the artifact directly
        const artifactId = chosenIdea.id;

        // Get the artifact data
        const artifact = projectData.getArtifactById(artifactId);
        let ideaData = null;

        if (artifact) {
            try {
                if (artifact.type === 'user_input' && artifact.metadata && typeof artifact.metadata === 'object' && 'derived_data' in artifact.metadata) {
                    // User input artifact - use derived_data
                    ideaData = (artifact.metadata as any).derived_data;
                } else if (artifact.data) {
                    // Direct artifact data
                    ideaData = typeof artifact.data === 'string' ? JSON.parse(artifact.data) : artifact.data;
                }
            } catch (error) {
                console.warn('Failed to parse idea data:', error);
            }
        }

        return { sourceArtifactId: artifactId, ideaData };
    }, [chosenIdea, projectData]);

    // Handle outline generation
    const handleGenerateOutline = useCallback(async (values: OutlineFormValues) => {
        console.log('[OutlineGenerationForm] Starting outline generation with:', {
            sourceArtifactId,
            projectId,
            values,
            ideaData
        });

        if (!sourceArtifactId) {
            console.error('[OutlineGenerationForm] No source artifact ID found');
            message.error('未找到选中的创意');
            return;
        }

        setIsGenerating(true);
        try {
            const requestBody = {
                content: `请基于创意生成剧本框架。源创意ID: ${sourceArtifactId}，标题: ${values.title}，要求: ${values.requirements || '无特殊要求'}`,
                metadata: {
                    sourceArtifactId,
                    action: 'outline_generation',
                    title: values.title,
                    requirements: values.requirements
                }
            };

            console.log('[OutlineGenerationForm] Request body:', JSON.stringify(requestBody, null, 2));

            // Call the chat API to send the outline generation message
            const response = await fetch(`/api/chat/${projectId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer debug-auth-token-script-writer-dev',
                },
                credentials: 'include',
                body: JSON.stringify(requestBody)
            });

            console.log('[OutlineGenerationForm] Response status:', response.status);
            console.log('[OutlineGenerationForm] Response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[OutlineGenerationForm] Error response:', errorText);
                throw new Error(`Failed to generate outline: ${response.status}, body: ${errorText}`);
            }

            const result = await response.json();
            console.log('[OutlineGenerationForm] Success result:', result);

            // The response will be handled by the streaming framework
            message.success('大纲生成已启动');
            onSuccess?.();
        } catch (error) {
            console.error('[OutlineGenerationForm] Error generating outline:', error);
            const errorMessage = `生成大纲失败: ${error instanceof Error ? error.message : '未知错误'}`;
            message.error(errorMessage);
            onError?.(error instanceof Error ? error : new Error(errorMessage));
        } finally {
            setIsGenerating(false);
        }
    }, [sourceArtifactId, projectId, onSuccess, onError, ideaData]);

    // Show loading state while chosen idea is loading
    if (chosenIdeaLoading) {
        return (
            <div style={{ textAlign: 'center', }}>
                <Text type="secondary">加载选中的创意...</Text>
            </div>
        );
    }

    // Show error if no chosen idea found
    if (!chosenIdea || !sourceArtifactId) {
        return (
            <div style={{ textAlign: 'center', }}>
                <Text type="secondary">Nothing to do</Text>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center' }}>
            {/* Generate button */}
            <Button
                type="primary"
                onClick={() => handleGenerateOutline({ title: ideaData?.title || '', requirements: '' })}
                loading={isGenerating}
                disabled={isGenerating}
                icon={<FileTextOutlined />}
                style={{
                    background: '#1890ff',
                    borderColor: '#1890ff',
                    minWidth: '140px',
                    height: '40px'
                }}
            >
                {isGenerating ? '生成中...' : '生成剧本框架'}
            </Button>
        </div>
    );
};

export default OutlineGenerationForm; 