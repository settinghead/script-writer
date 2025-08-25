import React, { useState, useCallback } from 'react';
import { message, Alert, Typography } from 'antd';
import TextareaAutosize from 'react-textarea-autosize';
import { apiService } from '../../services/apiService';
import { ActionComponentProps } from '../../utils/lineageBasedActionComputation';
import { SmartAIButton } from '../shared';
import { useGenerationState } from '../../hooks/useGenerationState';

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
    const [additionalInstructions, setAdditionalInstructions] = useState('');

    const episodeSynopsis = jsondocs.episodeSynopsis;

    // Centralized generation state
    const {
        isAnyGenerating,
        isLocalGenerating,
        setLocalGenerating
    } = useGenerationState('episode-script-generation');

    const handleGenerate = useCallback(async () => {
        if (!episodeSynopsis) {
            message.error('未找到分集大纲');
            return;
        }

        setIsGenerating(true);
        setLocalGenerating(true);
        try {
            // Get or create conversation ID
            const conversationId = await (apiService as any).getOrCreateConversation(projectId);

            // Send chat message with intent field to trigger shortcut
            await apiService.sendChatMessage(
                projectId,
                conversationId,
                `生成第${targetEpisode.episodeNumber}集剧本。 ${additionalInstructions ? `要求: ${additionalInstructions}` : ''}`,
                {
                    intent: 'generate_episode_script',
                    episodeNumber: targetEpisode.episodeNumber,
                    episodeSynopsisJsondocId: targetEpisode.synopsisId,
                    userRequirements: additionalInstructions
                }
            );

            message.success(`第${targetEpisode.episodeNumber}集剧本生成已完成`);
            onSuccess?.();
        } catch (error) {
            console.error('Error generating episode script:', error);
            message.error(`生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
            onError?.(error instanceof Error ? error : new Error('生成失败'));
        } finally {
            setIsGenerating(false);
            setLocalGenerating(false);
        }
    }, [episodeSynopsis, targetEpisode, projectId, additionalInstructions, onSuccess, onError]);

    if (!episodeSynopsis) {
        return (
            <Alert message="需要先生成分集大纲" type="warning" showIcon />
        );
    }

    return (
        <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                <TextareaAutosize
                    placeholder={isAnyGenerating ? '生成中，请稍等...' : '补充要求（可选）：例如台词风格、场景要求、镜头节奏、表演语气等。按 Ctrl/⌘+Enter 立即生成。'}
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    disabled={isAnyGenerating}
                    minRows={1}
                    maxRows={6}
                    onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isAnyGenerating) {
                            e.preventDefault();
                            handleGenerate();
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
                    componentId="episode-script-generation"
                    type="primary"
                    size="large"
                    onClick={handleGenerate}
                    loading={isLocalGenerating}
                    generatingText="生成完成后可点击"
                    style={{ fontSize: '16px' }}
                >
                    {isGenerating ? '生成中...' : `生成第${targetEpisode.episodeNumber}集剧本`}
                </SmartAIButton>
            </div>

        </div>
    );
};

export default EpisodeScriptGenerationAction; 