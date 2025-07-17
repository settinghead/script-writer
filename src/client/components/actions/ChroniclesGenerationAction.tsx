import React, { useState, useCallback, useMemo } from 'react';
import { Typography, Alert, message } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
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

    // Get outline settings from props (new way) or null (old way)
    const latestOutlineSettings = 'jsondocs' in props ? props.jsondocs.outlineSettings : null;

    // Handle chronicles generation
    const handleGenerateChronicles = useCallback(async () => {
        if (!latestOutlineSettings) {
            message.error('未找到剧本设定');
            return;
        }

        setIsGenerating(true);
        try {
            await apiService.generateChroniclesFromOutline(projectId, latestOutlineSettings.id);

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
    }, [latestOutlineSettings, projectId, onSuccess, onError]);

    // Show error if no outline settings found
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

    // Get outline settings data for display
    const outlineData = useMemo(() => {
        if (!latestOutlineSettings?.data) return null;
        try {
            return typeof latestOutlineSettings.data === 'string'
                ? JSON.parse(latestOutlineSettings.data)
                : latestOutlineSettings.data;
        } catch (error) {
            console.warn('Failed to parse outline settings data:', error);
            return null;
        }
    }, [latestOutlineSettings]);

    return (



        <div style={{ textAlign: 'center' }}>
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