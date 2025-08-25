import React, { useState, useCallback, useMemo } from 'react';
import { Typography, Alert, message } from 'antd';
import TextareaAutosize from 'react-textarea-autosize';
import { BaseActionProps } from './index';
import { ActionComponentProps } from '../../utils/lineageBasedActionComputation';
import { apiService } from '../../services/apiService';
import { SmartAIButton } from '../shared';
import { useGenerationState } from '../../hooks/useGenerationState';

const { Title, Text } = Typography;

// Support both old BaseActionProps and new ActionComponentProps
type ChroniclesGenerationActionProps = BaseActionProps | ActionComponentProps;

const ChroniclesGenerationAction: React.FC<ChroniclesGenerationActionProps> = (props) => {
    const { projectId, onSuccess, onError } = props;
    const [additionalInstructions, setAdditionalInstructions] = useState('');

    // Use centralized generation state management
    const {
        isAnyGenerating,
        isLocalGenerating,
        setLocalGenerating
    } = useGenerationState('chronicles-generation');

    // Get 故事设定 from props (new way) or null (old way)
    const latestOutlineSettings = 'jsondocs' in props ? props.jsondocs.outlineSettings : null;

    // Handle chronicles generation
    const handleGenerateChronicles = useCallback(async () => {
        if (!latestOutlineSettings) {
            message.error('未找到故事设定');
            return;
        }

        setLocalGenerating(true);
        try {
            await apiService.generateChroniclesFromOutline(
                projectId,
                latestOutlineSettings.id,
                additionalInstructions
            );

            message.success('时间顺序大纲生成已完成');
            onSuccess?.();
        } catch (error) {
            console.error('Error generating chronicles:', error);
            const errorMessage = `生成时间顺序大纲失败: ${error instanceof Error ? error.message : '未知错误'}`;
            message.error(errorMessage);
            onError?.(error instanceof Error ? error : new Error(errorMessage));
        } finally {
            setLocalGenerating(false);
        }
    }, [latestOutlineSettings, projectId, onSuccess, onError, additionalInstructions, setLocalGenerating]);

    // Show error if no 故事设定 found
    if (!latestOutlineSettings) {
        return (
            <Alert
                message="需要先生成故事设定"
                description="请先完成故事设定，然后再生成时间顺序大纲"
                type="warning"
                showIcon
                style={{ margin: '16px 0' }}
            />
        );
    }

    // Get 故事设定 data for display
    const outlineData = useMemo(() => {
        if (!latestOutlineSettings?.data) return null;
        try {
            return typeof latestOutlineSettings.data === 'string'
                ? JSON.parse(latestOutlineSettings.data)
                : latestOutlineSettings.data;
        } catch (error) {
            console.warn('Failed to parse 故事设定 data:', error);
            return null;
        }
    }, [latestOutlineSettings]);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
            <TextareaAutosize
                placeholder={isAnyGenerating ? "生成中，请稍等..." : "补充要求（可选）"}
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                disabled={isAnyGenerating}
                minRows={1}
                maxRows={6}
                onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isAnyGenerating) {
                        e.preventDefault();
                        handleGenerateChronicles();
                    }
                }}
                style={{
                    width: '420px',
                    resize: 'none',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: isAnyGenerating ? '#0f0f0f' : '#1f1f1f',
                    color: isAnyGenerating ? '#666' : '#fff',
                    border: `1px solid ${isAnyGenerating ? '#1a1a1a' : '#303030'}`,
                    lineHeight: 1.5,
                    cursor: isAnyGenerating ? 'not-allowed' : 'text',
                    opacity: isAnyGenerating ? 0.6 : 1,
                }}
            />
            <SmartAIButton
                componentId="chronicles-generation"
                type="primary"
                size="large"
                onClick={handleGenerateChronicles}
                loading={isLocalGenerating}
                generatingText="处理中..."
                style={{
                    fontSize: '16px',
                }}
            >
                生成时间顺序大纲
            </SmartAIButton>
        </div>
    );
};

export default ChroniclesGenerationAction; 