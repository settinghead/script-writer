import React, { useState, useCallback, useMemo } from 'react';
import { Typography, Alert, message } from 'antd';
import TextareaAutosize from 'react-textarea-autosize';
import { BaseActionProps } from './index';
import { ActionComponentProps } from '../../utils/lineageBasedActionComputation';
import { apiService } from '../../services/apiService';
import { AIButton } from '../shared';

const { Title, Text } = Typography;

// Support both old BaseActionProps and new ActionComponentProps
type ChroniclesGenerationActionProps = BaseActionProps | ActionComponentProps;

const ChroniclesGenerationAction: React.FC<ChroniclesGenerationActionProps> = (props) => {
    const { projectId, onSuccess, onError } = props;
    const [isGenerating, setIsGenerating] = useState(false);
    const [additionalInstructions, setAdditionalInstructions] = useState('');

    // Get 剧本设定 from props (new way) or null (old way)
    const latestOutlineSettings = 'jsondocs' in props ? props.jsondocs.outlineSettings : null;

    // Handle chronicles generation
    const handleGenerateChronicles = useCallback(async () => {
        if (!latestOutlineSettings) {
            message.error('未找到剧本设定');
            return;
        }

        setIsGenerating(true);
        try {
            await apiService.generateChroniclesFromOutline(
                projectId,
                latestOutlineSettings.id,
                additionalInstructions
            );

            message.success('时间顺序大纲生成已启动');
            onSuccess?.();
        } catch (error) {
            console.error('Error generating chronicles:', error);
            const errorMessage = `生成时间顺序大纲失败: ${error instanceof Error ? error.message : '未知错误'}`;
            message.error(errorMessage);
            onError?.(error instanceof Error ? error : new Error(errorMessage));
        } finally {
            setIsGenerating(false);
        }
    }, [latestOutlineSettings, projectId, onSuccess, onError, additionalInstructions]);

    // Show error if no 剧本设定 found
    if (!latestOutlineSettings) {
        return (
            <Alert
                message="需要先生成剧本设定"
                description="请先完成剧本设定，然后再生成时间顺序大纲"
                type="warning"
                showIcon
                style={{ margin: '16px 0' }}
            />
        );
    }

    // Get 剧本设定 data for display
    const outlineData = useMemo(() => {
        if (!latestOutlineSettings?.data) return null;
        try {
            return typeof latestOutlineSettings.data === 'string'
                ? JSON.parse(latestOutlineSettings.data)
                : latestOutlineSettings.data;
        } catch (error) {
            console.warn('Failed to parse 剧本设定 data:', error);
            return null;
        }
    }, [latestOutlineSettings]);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
            <TextareaAutosize
                placeholder="补充说明（可选）"
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                minRows={1}
                maxRows={6}
                onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        handleGenerateChronicles();
                    }
                }}
                style={{
                    width: '420px',
                    resize: 'none',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: '#1f1f1f',
                    color: '#fff',
                    border: '1px solid #303030',
                    lineHeight: 1.5,
                }}
            />
            <AIButton
                type="primary"
                size="large"
                loading={isGenerating}
                onClick={handleGenerateChronicles}
                style={{
                    width: '200px',
                    height: '48px',
                    fontSize: '16px'
                }}
            >
                {isGenerating ? '生成中...' : '生成时间顺序大纲'}
            </AIButton>
        </div>
    );
};

export default ChroniclesGenerationAction; 