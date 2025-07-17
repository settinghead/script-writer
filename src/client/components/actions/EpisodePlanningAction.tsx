import React, { useState, useCallback, useMemo } from 'react';
import { Typography, Alert, message, Form, InputNumber, Space } from 'antd';
import { VideoCameraOutlined } from '@ant-design/icons';
import { BaseActionProps } from './index';
import { ActionComponentProps } from '../../utils/lineageBasedActionComputation';
import { apiService } from '../../services/apiService';
import { AIButton } from '../shared';
import { MIN_EPISODES, MAX_EPISODES, DEFAULT_EPISODES } from '../../../common/config/constants';

const { Title, Text } = Typography;

// Support both old BaseActionProps and new ActionComponentProps
type EpisodePlanningActionProps = BaseActionProps | ActionComponentProps;

const EpisodePlanningAction: React.FC<EpisodePlanningActionProps> = (props) => {
    const { projectId, onSuccess, onError } = props;
    const [isGenerating, setIsGenerating] = useState(false);
    const [numberOfEpisodes, setNumberOfEpisodes] = useState<number>(DEFAULT_EPISODES);

    // Get chronicles from props (new way) or null (old way)
    const latestChronicles = 'jsondocs' in props ? props.jsondocs.chronicles : null;

    // Handle episode planning generation
    const handleGenerateEpisodePlanning = useCallback(async () => {
        if (!latestChronicles) {
            message.error('未找到时间顺序大纲');
            return;
        }

        if (numberOfEpisodes < MIN_EPISODES || numberOfEpisodes > MAX_EPISODES) {
            message.error(`集数必须在${MIN_EPISODES}-${MAX_EPISODES}之间`);
            return;
        }

        setIsGenerating(true);
        try {
            await apiService.generateEpisodePlanningFromChronicles(projectId, latestChronicles.id, numberOfEpisodes);

            message.success('剧集框架生成已启动');
            onSuccess?.();
        } catch (error) {
            console.error('Error generating episode planning:', error);
            const errorMessage = `生成剧集框架失败: ${error instanceof Error ? error.message : '未知错误'}`;
            message.error(errorMessage);
            onError?.(error instanceof Error ? error : new Error(errorMessage));
        } finally {
            setIsGenerating(false);
        }
    }, [latestChronicles, projectId, numberOfEpisodes, onSuccess, onError]);

    // Show error if no chronicles found
    if (!latestChronicles) {
        return (
            <Alert
                message="需要先生成时间顺序大纲"
                description="请先完成时间顺序大纲，然后再生成剧集框架"
                type="warning"
                showIcon
            />
        );
    }

    // Show chronicles info
    const chroniclesData = useMemo(() => {
        try {
            if (typeof latestChronicles.data === 'string') {
                return JSON.parse(latestChronicles.data);
            }
            return latestChronicles.data;
        } catch {
            return null;
        }
    }, [latestChronicles.data]);

    const stagesCount = chroniclesData?.stages?.length || 0;

    return (
        <Space direction="vertical" style={{ width: '100%' }}>
            <Title level={4}>
                <VideoCameraOutlined style={{ color: '#722ed1' }} />
                生成剧集框架
            </Title>

            <Text type="secondary">
                基于时间顺序大纲（{stagesCount}个阶段）生成适合抖音短剧的剧集框架，优化观看顺序和情感节奏
            </Text>

            <Form layout="vertical">
                <Form.Item
                    label="总集数"
                    help="建议根据故事复杂度设置，每集约2分钟"
                >
                    <InputNumber
                        min={MIN_EPISODES}
                        max={MAX_EPISODES}
                        value={numberOfEpisodes}
                        onChange={(value) => setNumberOfEpisodes(value || DEFAULT_EPISODES)}
                        style={{ width: '100%' }}
                        placeholder={`输入总集数（${MIN_EPISODES}-${MAX_EPISODES}`}
                        data-testid="episode-count-input"
                    />
                </Form.Item>
            </Form>

            <AIButton
                type="primary"
                loading={isGenerating}
                onClick={handleGenerateEpisodePlanning}
                disabled={!latestChronicles || numberOfEpisodes < MIN_EPISODES || numberOfEpisodes > MAX_EPISODES}
                style={{ width: '100%' }}
                data-testid="generate-episode-planning-btn"
            >
                {isGenerating ? '正在生成剧集框架...' : '生成剧集框架'}
            </AIButton>

            {isGenerating && (
                <Alert
                    message="正在生成中"
                    description="AI正在基于时间顺序大纲生成适合短视频平台的剧集框架，请稍候..."
                    type="info"
                    showIcon
                />
            )}
        </Space>
    );
};

export default EpisodePlanningAction; 