import React, { useState, useCallback, useMemo } from 'react';
import { Typography, Form, Input, InputNumber, Select, message, Button, Space } from 'antd';
import { FileTextOutlined, RightOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { BaseActionProps } from './index';
import { ActionComponentProps } from '../../utils/lineageBasedActionComputation';
import { apiService } from '../../services/apiService';
import { AIButton } from '../shared';
import { useProjectData } from '../../contexts/ProjectDataContext';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface OutlineFormValues {
    title: string;
    requirements: string;
}

// Support both old BaseActionProps and new ActionComponentProps
type OutlineGenerationFormProps = BaseActionProps | ActionComponentProps;

const OutlineGenerationForm: React.FC<OutlineGenerationFormProps> = (props) => {
    const { projectId, onSuccess, onError } = props;
    const [isGenerating, setIsGenerating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const projectData = useProjectData();

    // Use pre-computed canonical context from project data
    const canonicalContext = projectData.canonicalContext;

    // Get the canonical brainstorm idea jsondoc from computed context
    const canonicalBrainstormIdea = canonicalContext === "pending" || canonicalContext === "error"
        ? null
        : canonicalContext?.canonicalBrainstormIdea || null;

    // Check if we have the required brainstorm idea to generate the outline
    const hasBrainstormIdea = !!canonicalBrainstormIdea;

    // Check if the brainstorm idea is original (no parent) to determine if we should show go back button
    const isOriginalIdea = useMemo(() => {
        if (!canonicalBrainstormIdea || !canonicalContext || projectData.lineageGraph === "pending" || projectData.lineageGraph === "error") {
            return false;
        }

        const lineageNode = projectData.lineageGraph.nodes.get(canonicalBrainstormIdea.id);
        if (!lineageNode || lineageNode.type !== 'jsondoc') {
            return false;
        }

        // If sourceTransform is 'none', it means this is the original/root jsondoc
        return lineageNode.sourceTransform === 'none';
    }, [canonicalBrainstormIdea, canonicalContext, projectData.lineageGraph]);

    // Get the chosen brainstorm idea data
    const { sourceJsondocId, ideaData } = useMemo(() => {
        if (!canonicalBrainstormIdea) return { sourceJsondocId: null, ideaData: null };

        // canonicalBrainstormIdea is an ElectricJsondoc, so use its id directly
        const jsondocId = canonicalBrainstormIdea.id;

        // Parse the jsondoc data to get the actual idea content
        let parsedIdeaData;
        try {
            parsedIdeaData = JSON.parse(canonicalBrainstormIdea.data);
        } catch (error) {
            console.warn('Failed to parse brainstorm idea data:', error);
            parsedIdeaData = {
                title: '剧本概要',
                body: '创意详情将在此显示'
            };
        }

        return { sourceJsondocId: jsondocId, ideaData: parsedIdeaData };
    }, [canonicalBrainstormIdea]);

    // Handle outline generation
    const handleGenerateOutline = useCallback(async (values: OutlineFormValues) => {
        if (!sourceJsondocId) {
            console.error('[OutlineGenerationForm] No source jsondoc ID found');
            message.error('未找到选中的创意');
            return;
        }

        setIsGenerating(true);
        try {
            await apiService.generateOutlineFromIdea(
                projectId,
                sourceJsondocId,
                values.title,
                values.requirements || ''
            );

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
    }, [sourceJsondocId, projectId, onSuccess, onError, ideaData]);

    // Handle go back - delete the chosen brainstorm idea jsondoc
    const handleGoBack = useCallback(async () => {
        if (isDeleting || !sourceJsondocId) return;

        try {
            setIsDeleting(true);

            // Use apiService to delete the brainstorm idea jsondoc
            await apiService.deleteBrainstormInput(sourceJsondocId);

            message.success('已返回');
            onSuccess?.(); // This will trigger a re-render and return to previous state
        } catch (error) {
            console.error('[OutlineGenerationForm] Error deleting brainstorm idea:', error);
            const errorMessage = `返回失败：${error instanceof Error ? error.message : '未知错误'}`;
            message.error(errorMessage);
            onError?.(error instanceof Error ? error : new Error(errorMessage));
        } finally {
            setIsDeleting(false);
        }
    }, [sourceJsondocId, onSuccess, onError]);

    // Show loading state while fetching canonical data
    if (!canonicalContext || projectData.isLoading) {
        return (
            <div style={{ textAlign: 'center', }}>
                <Text type="secondary">加载中...</Text>
            </div>
        );
    }

    // Show error if no chosen idea found
    if (!canonicalBrainstormIdea || !sourceJsondocId) {
        return (
            <div style={{ textAlign: 'center', }}>
                <Text type="secondary">Nothing to do</Text>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center' }}>
            {/* Go back button - only show if this is the original idea (not derived) */}
            {isOriginalIdea && (
                <Button
                    icon={<ArrowLeftOutlined />}
                    loading={isDeleting}
                    onClick={handleGoBack}
                    style={{
                        minWidth: '120px',
                        height: '40px'
                    }}
                >
                    {isDeleting ? '返回中...' : '返回'}
                </Button>
            )}

            {/* Generate button */}
            <AIButton
                type="primary"
                onClick={() => handleGenerateOutline({ title: ideaData?.title || '', requirements: '' })}
                loading={isGenerating}
                disabled={isGenerating || isDeleting}
                style={{
                    minWidth: '140px',
                    height: '40px'
                }}
            >
                {isGenerating ? '生成中...' : <> 生成剧本设定 <RightOutlined /></>}
            </AIButton>
        </div>
    );
};

export default OutlineGenerationForm; 