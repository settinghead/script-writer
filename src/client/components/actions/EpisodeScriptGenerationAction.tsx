import React, { useState, useCallback } from 'react';
import { Button, message, Alert, Typography } from 'antd';
import { apiService } from '../../services/apiService';
import { ActionComponentProps } from '../../utils/lineageBasedActionComputation';

const { Text } = Typography;

interface EpisodeScriptGenerationActionProps extends ActionComponentProps {
    targetEpisode: {
        episodeNumber: number;
        synopsisId: string;
    };
    jsondocs: ActionComponentProps['jsondocs'] & {
        episodeSynopsis?: any;
        previousEpisodeScript?: any;
    };
}

const EpisodeScriptGenerationAction: React.FC<EpisodeScriptGenerationActionProps> = (props) => {
    const { projectId, onSuccess, onError, targetEpisode, jsondocs } = props;
    const [isGenerating, setIsGenerating] = useState(false);

    const episodeSynopsis = jsondocs.episodeSynopsis;

    const handleGenerate = useCallback(async () => {
        if (!episodeSynopsis) {
            message.error('未找到分集大纲');
            return;
        }

        setIsGenerating(true);
        try {
            // Send chat message to trigger generation (following existing pattern)
            await apiService.sendChatMessage(projectId,
                `生成第${targetEpisode.episodeNumber}集剧本`,
                {
                    action: 'generate_episode_script',
                    episodeNumber: targetEpisode.episodeNumber,
                    episodeSynopsisJsondocId: targetEpisode.synopsisId
                }
            );

            message.success(`第${targetEpisode.episodeNumber}集剧本生成已启动`);
            onSuccess?.();
        } catch (error) {
            console.error('Error generating episode script:', error);
            message.error(`生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
            onError?.(error instanceof Error ? error : new Error('生成失败'));
        } finally {
            setIsGenerating(false);
        }
    }, [episodeSynopsis, targetEpisode, projectId, onSuccess, onError]);

    if (!episodeSynopsis) {
        return (
            <Alert message="需要先生成分集大纲" type="warning" showIcon />
        );
    }

    return (
        <div style={{ textAlign: 'center' }}>
            <Button
                type="primary"
                size="large"
                loading={isGenerating}
                onClick={handleGenerate}
                style={{
                    fontSize: '16px',
                    background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                    border: 'none'
                }}
            >
                {isGenerating ? '生成中...' : `生成第${targetEpisode.episodeNumber}集剧本`}
            </Button>

            <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                    基于分集大纲生成完整剧本内容
                </Text>
            </div>
        </div>
    );
};

export default EpisodeScriptGenerationAction; 