import React, { useState, useCallback } from 'react';
import { message, Alert, Typography } from 'antd';
import TextareaAutosize from 'react-textarea-autosize';
import { apiService } from '../../services/apiService';
import { ActionComponentProps } from '../../utils/lineageBasedActionComputation';
import { SmartAIButton } from '../shared';
import { useGenerationState } from '../../hooks/useGenerationState';

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
    const [additionalInstructions, setAdditionalInstructions] = useState('');

    const episodePlanning = jsondocs.episodePlanning;

    // Centralized generation state: disable while parent steps are generating
    const {
        isAnyGenerating,
        isLocalGenerating,
        setLocalGenerating
    } = useGenerationState('episode-synopsis-generation');

    const handleGenerate = useCallback(async () => {
        if (!episodePlanning) {
            message.error('未找到分集结构');
            return;
        }

        setIsGenerating(true);
        setLocalGenerating(true);
        try {
            // Get or create conversation ID (following the pattern used in other generation methods)
            const conversationId = await (apiService as any).getOrCreateConversation(projectId);

            // Send chat message to trigger generation with correct API signature
            await apiService.sendChatMessage(
                projectId,
                conversationId,
                `生成第${nextGroup.episodeRange}集单集大纲：${nextGroup.groupTitle}。${additionalInstructions ? `要求: ${additionalInstructions}` : ''}`,
                {
                    action: 'generate_单集大纲',
                    episodePlanningId: episodePlanning.id,
                    groupTitle: nextGroup.groupTitle,
                    episodeRange: nextGroup.episodeRange,
                    episodes: nextGroup.episodes,
                    requirements: additionalInstructions
                }
            );

            message.success(`第${nextGroup.episodeRange}集大纲生成已完成`);
            onSuccess?.();
        } catch (error) {
            console.error('Error generating episode synopsis:', error);
            message.error(`生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
            onError?.(error instanceof Error ? error : new Error('生成失败'));
        } finally {
            setIsGenerating(false);
            setLocalGenerating(false);
        }
    }, [episodePlanning, nextGroup, projectId, additionalInstructions, onSuccess, onError]);

    if (!episodePlanning) {
        return (
            <Alert message="需要先生成分集结构" type="warning" showIcon />
        );
    }

    return (
        <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                <TextareaAutosize
                    placeholder={isAnyGenerating ? '生成中，请稍等...' : '补充要求（可选）：例如强调开场钩子更强、埋更清晰的悬念、增加角色情感冲突等。按 Ctrl/⌘+Enter 立即生成。'}
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
                    componentId="episode-synopsis-generation"
                    type="primary"
                    size="large"
                    onClick={handleGenerate}
                    loading={isLocalGenerating}
                    generatingText="处理中..."
                    style={{ fontSize: '16px' }}
                >
                    {isGenerating ? '生成中...' : `生成第${nextGroup.episodeRange}集单集大纲`}
                </SmartAIButton>
            </div>

        </div>
    );
};

export default EpisodeSynopsisGenerationAction; 