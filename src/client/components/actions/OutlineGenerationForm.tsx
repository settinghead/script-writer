import React, { useState, useCallback, useMemo } from 'react';
import { Typography, Form, Input, InputNumber, Select, message } from 'antd';
import { FileTextOutlined, RightOutlined } from '@ant-design/icons';
import { BaseActionProps } from './index';
import { ActionComponentProps } from '../../utils/lineageBasedActionComputation';
import { apiService } from '../../services/apiService';
import { AIButton } from '../shared';

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

    // Get chosen idea from props (new way) or null (old way - will show nothing to do)
    const chosenIdea = 'jsondocs' in props ? props.jsondocs.chosenIdea : null;
    const chosenIdeaLoading = false; // No longer needed with resolved props

    // Get the chosen brainstorm idea data (simplified with resolved props)
    const { sourceJsondocId, ideaData } = useMemo(() => {
        if (!chosenIdea) return { sourceJsondocId: null, ideaData: null };

        // EffectiveBrainstormIdea has jsondocId property
        const jsondocId = chosenIdea.jsondocId;

        // For new ActionComponentProps with resolved data, we need to get the actual idea data
        // This will be handled by the parent component that resolves the lineage
        // For now, provide a placeholder that will work with the existing form
        const ideaData = {
            title: '选中的创意',
            body: '创意详情将在此显示'
        };

        return { sourceJsondocId: jsondocId, ideaData };
    }, [chosenIdea]);

    // Handle outline generation
    const handleGenerateOutline = useCallback(async (values: OutlineFormValues) => {
        console.log('[OutlineGenerationForm] Starting outline generation with:', {
            sourceJsondocId,
            projectId,
            values,
            ideaData
        });

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

    // Show loading state while chosen idea is loading
    if (chosenIdeaLoading) {
        return (
            <div style={{ textAlign: 'center', }}>
                <Text type="secondary">加载选中的创意...</Text>
            </div>
        );
    }

    // Show error if no chosen idea found
    if (!chosenIdea || !sourceJsondocId) {
        return (
            <div style={{ textAlign: 'center', }}>
                <Text type="secondary">Nothing to do</Text>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center' }}>
            {/* Generate button */}
            <AIButton
                type="primary"
                onClick={() => handleGenerateOutline({ title: ideaData?.title || '', requirements: '' })}
                loading={isGenerating}
                disabled={isGenerating}
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