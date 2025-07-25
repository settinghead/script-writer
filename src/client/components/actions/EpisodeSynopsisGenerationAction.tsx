import React, { useState, useCallback } from 'react';
import { Button, message, Alert, Typography } from 'antd';
import { apiService } from '../../services/apiService';
import { ActionComponentProps } from '../../utils/lineageBasedActionComputation';

const { Text } = Typography;

interface EpisodeSynopsisGenerationActionProps extends ActionComponentProps {
    nextGroup: {
        groupTitle: string;
        episodeRange: string;
        episodes: number[];
    };
}

const EpisodeSynopsisGenerationAction: React.FC<EpisodeSynopsisGenerationActionProps> = (props) => {
    const { projectId, onSuccess, onError, nextGroup, jsondocs } = props;
    const [isGenerating, setIsGenerating] = useState(false);

    const episodePlanning = jsondocs.episodePlanning;

    const handleGenerate = useCallback(async () => {
        if (!episodePlanning) {
            message.error('未找到分集结构');
            return;
        }

        setIsGenerating(true);
        try {
            // Send chat message to trigger generation (following existing pattern)
            await apiService.sendChatMessage(projectId,
                `生成第${nextGroup.episodeRange}集每集大纲：${nextGroup.groupTitle}`,
                {
                    action: 'generate_episode_synopsis',
                    episodePlanningId: episodePlanning.id,
                    groupTitle: nextGroup.groupTitle,
                    episodeRange: nextGroup.episodeRange,
                    episodes: nextGroup.episodes
                }
            );

            message.success(`第${nextGroup.episodeRange}集大纲生成已启动`);
            onSuccess?.();
        } catch (error) {
            console.error('Error generating episode synopsis:', error);
            message.error(`生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
            onError?.(error instanceof Error ? error : new Error('生成失败'));
        } finally {
            setIsGenerating(false);
        }
    }, [episodePlanning, nextGroup, projectId, onSuccess, onError]);

    if (!episodePlanning) {
        return (
            <Alert message="需要先生成分集结构" type="warning" showIcon />
        );
    }

    return (
        <div style={{ textAlign: 'center' }}>
            <Button
                type="primary"
                size="large"
                loading={isGenerating}
                onClick={handleGenerate}
                style={{ fontSize: '16px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none' }}
            >
                {isGenerating ? '生成中...' : `生成第${nextGroup.episodeRange}集每集大纲`}
            </Button>

            <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                    将为"{nextGroup.groupTitle}"生成详细的每集大纲
                </Text>
            </div>
        </div>
    );
};

export default EpisodeSynopsisGenerationAction; 