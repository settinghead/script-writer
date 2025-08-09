import React, { useState, useCallback } from 'react';
import { Button, message, Alert, Typography } from 'antd';
import TextareaAutosize from 'react-textarea-autosize';
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
    const [additionalInstructions, setAdditionalInstructions] = useState('');

    const episodePlanning = jsondocs.episodePlanning;

    const handleGenerate = useCallback(async () => {
        if (!episodePlanning) {
            message.error('未找到分集结构');
            return;
        }

        setIsGenerating(true);
        try {
            // Get or create conversation ID (following the pattern used in other generation methods)
            const conversationId = await (apiService as any).getOrCreateConversation(projectId);

            // Send chat message to trigger generation with correct API signature
            await apiService.sendChatMessage(
                projectId,
                conversationId,
                `生成第${nextGroup.episodeRange}集单集大纲：${nextGroup.groupTitle}。要求: ${additionalInstructions || '无特殊要求'}`,
                {
                    action: 'generate_单集大纲',
                    episodePlanningId: episodePlanning.id,
                    groupTitle: nextGroup.groupTitle,
                    episodeRange: nextGroup.episodeRange,
                    episodes: nextGroup.episodes,
                    requirements: additionalInstructions
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
    }, [episodePlanning, nextGroup, projectId, additionalInstructions, onSuccess, onError]);

    if (!episodePlanning) {
        return (
            <Alert message="需要先生成分集结构" type="warning" showIcon />
        );
    }

    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 12 }}>
                <TextareaAutosize
                    placeholder="补充说明（可选）：例如强调开场钩子更强、埋更清晰的悬念、增加角色情感冲突等。按 Ctrl/⌘+Enter 立即生成。"
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    minRows={1}
                    maxRows={6}
                    onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            e.preventDefault();
                            handleGenerate();
                        }
                    }}
                    style={{
                        width: '100%',
                        resize: 'none',
                        padding: '8px 12px',
                        borderRadius: 6,
                        background: '#1f1f1f',
                        color: '#fff',
                        border: '1px solid #303030',
                        lineHeight: 1.5,
                    }}
                />
            </div>
            <Button
                type="primary"
                size="large"
                loading={isGenerating}
                onClick={handleGenerate}
                style={{ fontSize: '16px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none' }}
            >
                {isGenerating ? '生成中...' : `生成第${nextGroup.episodeRange}集单集大纲`}
            </Button>

            <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                    将为"{nextGroup.groupTitle}"生成详细的单集大纲
                </Text>
            </div>
        </div>
    );
};

export default EpisodeSynopsisGenerationAction; 