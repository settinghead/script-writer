import React, { useState, useCallback, useMemo } from 'react';
import { Typography, Alert, message } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { BaseActionProps } from './index';
import { ActionComponentProps } from '../../utils/lineageBasedActionComputation';
import { apiService } from '../../services/apiService';
import { AIButton } from '../shared';

const { Title, Text } = Typography;

// Support both old BaseActionProps and new ActionComponentProps
type EpisodeGenerationActionProps = BaseActionProps | ActionComponentProps;

const EpisodeGenerationAction: React.FC<EpisodeGenerationActionProps> = (props) => {
    const { projectId, onSuccess, onError } = props;
    const [isGenerating, setIsGenerating] = useState(false);

    // Get chronicles from props (new way) or null (old way)
    const latestChronicles = 'jsondocs' in props ? props.jsondocs.chronicles : null;

    // Handle episode generation
    const handleGenerateEpisodes = useCallback(async () => {
        if (!latestChronicles) {
            message.error('未找到时间顺序大纲');
            return;
        }

        setIsGenerating(true);
        try {
            await apiService.generateEpisodesFromChronicles(projectId, latestChronicles.id);

            message.success('单集大纲生成已启动');
            onSuccess?.();
        } catch (error) {
            console.error('Error generating episodes:', error);
            const errorMessage = `生成单集大纲失败: ${error instanceof Error ? error.message : '未知错误'}`;
            message.error(errorMessage);
            onError?.(error instanceof Error ? error : new Error(errorMessage));
        } finally {
            setIsGenerating(false);
        }
    }, [latestChronicles, projectId, onSuccess, onError]);

    // Show error if no chronicles found
    if (!latestChronicles) {
        return (
            <Alert
                message="需要先生成时间顺序大纲"
                description="请先完成时间顺序大纲，然后再生成单集大纲"
                type="warning"
                showIcon
                style={{ margin: '16px 0' }}
            />
        );
    }

    // Get chronicles data for display
    const chroniclesData = useMemo(() => {
        if (!latestChronicles?.data) return null;
        try {
            return typeof latestChronicles.data === 'string'
                ? JSON.parse(latestChronicles.data)
                : latestChronicles.data;
        } catch (error) {
            console.warn('Failed to parse chronicles data:', error);
            return null;
        }
    }, [latestChronicles]);

    return (


        <div style={{ margin: '0 auto', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            {/* Generate button */}
            <div style={{ textAlign: 'center' }}>
                <AIButton
                    type="primary"
                    size="large"
                    loading={isGenerating}
                    onClick={handleGenerateEpisodes}
                    style={{
                        fontSize: '16px'
                    }}
                >
                    {isGenerating ? '生成中...' : '生成单集大纲 ➤'}
                </AIButton>
            </div>
        </div>
    );
};

export default EpisodeGenerationAction; 