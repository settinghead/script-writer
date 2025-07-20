import React, { useMemo } from 'react';
import { Card, Descriptions, Typography, Tag, Space } from 'antd';
import { ClockCircleOutlined, ThunderboltOutlined, EyeOutlined, FireOutlined } from '@ant-design/icons';
import type { ElectricJsondoc } from '../../../common/types';

const { Title, Text, Paragraph } = Typography;

interface EpisodeSynopsisDisplayProps {
    episodeSynopsisList: ElectricJsondoc[];
}

const EpisodeSynopsisDisplay: React.FC<EpisodeSynopsisDisplayProps> = ({ episodeSynopsisList }) => {

    // Flatten and sort all episodes from all groups
    const allEpisodes = useMemo(() => {
        const episodes = [];
        for (const synopsisJsondoc of episodeSynopsisList) {
            try {
                const data = JSON.parse(synopsisJsondoc.data);
                if (data.episodes && Array.isArray(data.episodes)) {
                    episodes.push(...data.episodes.map((episode: any) => ({
                        ...episode,
                        groupTitle: data.groupTitle,
                        episodeRange: data.episodeRange,
                        jsondocId: synopsisJsondoc.id
                    })));
                }
            } catch (error) {
                console.warn('Failed to parse episode synopsis data:', error);
            }
        }
        return episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
    }, [episodeSynopsisList]);

    if (allEpisodes.length === 0) {
        return null;
    }

    return (
        <div id="episode-synopsis" style={{ marginBottom: 24 }}>
            <Title level={3} style={{ marginBottom: 16, color: '#1890ff' }}>
                每集大纲 ({allEpisodes.length}集)
            </Title>

            {allEpisodes.map(episode => (
                <Card
                    key={`${episode.jsondocId}-${episode.episodeNumber}`}
                    style={{
                        marginBottom: 16,
                        background: 'linear-gradient(135deg, #f6f9fc 0%, #ffffff 100%)',
                        border: '1px solid #e8f4fd'
                    }}
                    title={
                        <Space>
                            <Text strong style={{ fontSize: '16px', color: '#1890ff' }}>
                                第{episode.episodeNumber}集: {episode.title}
                            </Text>
                            <Tag color="blue">{episode.groupTitle}</Tag>
                        </Space>
                    }
                    extra={
                        <Space>
                            <ClockCircleOutlined />
                            <Text type="secondary">{episode.estimatedDuration || 120}秒</Text>
                        </Space>
                    }
                >
                    <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
                        <Descriptions.Item
                            label={
                                <Space>
                                    <EyeOutlined style={{ color: '#52c41a' }} />
                                    <Text strong>开场钩子</Text>
                                </Space>
                            }
                        >
                            <Paragraph style={{ marginBottom: 0, fontSize: '14px' }}>
                                {episode.openingHook}
                            </Paragraph>
                        </Descriptions.Item>

                        <Descriptions.Item
                            label={
                                <Space>
                                    <ThunderboltOutlined style={{ color: '#1890ff' }} />
                                    <Text strong>主要剧情</Text>
                                </Space>
                            }
                        >
                            <Paragraph style={{ marginBottom: 0, fontSize: '14px' }}>
                                {episode.mainPlot}
                            </Paragraph>
                        </Descriptions.Item>

                        <Descriptions.Item
                            label={
                                <Space>
                                    <FireOutlined style={{ color: '#ff4d4f' }} />
                                    <Text strong>情感高潮</Text>
                                </Space>
                            }
                        >
                            <Paragraph style={{ marginBottom: 0, fontSize: '14px' }}>
                                {episode.emotionalClimax}
                            </Paragraph>
                        </Descriptions.Item>

                        <Descriptions.Item
                            label={
                                <Space>
                                    <EyeOutlined style={{ color: '#faad14' }} />
                                    <Text strong>结尾悬念</Text>
                                </Space>
                            }
                        >
                            <Paragraph style={{ marginBottom: 0, fontSize: '14px' }}>
                                {episode.cliffhanger}
                            </Paragraph>
                        </Descriptions.Item>
                    </Descriptions>

                    {episode.suspenseElements && episode.suspenseElements.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                            <Text strong style={{ color: '#722ed1' }}>悬念元素:</Text>
                            <div style={{ marginTop: 8 }}>
                                {episode.suspenseElements.map((element: string, idx: number) => (
                                    <Tag key={idx} color="purple" style={{ marginBottom: 4 }}>
                                        {element}
                                    </Tag>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            ))}
        </div>
    );
};

export default EpisodeSynopsisDisplay; 