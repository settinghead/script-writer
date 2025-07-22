import React, { useMemo, useRef, useEffect } from 'react';
import { Card, Descriptions, Typography, Tag, Space } from 'antd';
import { ClockCircleOutlined, ThunderboltOutlined, EyeOutlined, FireOutlined } from '@ant-design/icons';
import type { ElectricJsondoc } from '../../../common/types';
import { useScrollSyncObserver, type SubItem } from '../../hooks/useScrollSyncObserver';

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
                const data = typeof synopsisJsondoc.data === 'string'
                    ? JSON.parse(synopsisJsondoc.data)
                    : synopsisJsondoc.data;
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

    // Create refs for each episode for scroll sync
    const episodeRefs = useRef<Map<string, React.RefObject<HTMLElement | null>>>(new Map());

    // Build sub-items for scroll sync observer
    const subItems = useMemo((): SubItem[] => {
        return allEpisodes.map(episode => {
            const episodeId = `episode-${episode.episodeNumber}`;
            let ref = episodeRefs.current.get(episodeId);
            if (!ref) {
                ref = { current: null };
                episodeRefs.current.set(episodeId, ref);
            }
            return {
                id: episodeId,
                ref: ref!
            };
        });
    }, [allEpisodes]);

    // Initialize scroll sync observer
    useScrollSyncObserver('episode-synopsis', subItems, {
        enabled: allEpisodes.length > 0,
        threshold: 0.3, // Lower threshold for better episode detection
        rootMargin: '-10% 0px -50% 0px' // Bias towards upper part
    });

    return (
        <div id="episode-synopsis" style={{ marginBottom: 24 }}>
            <Title level={3} style={{ marginBottom: 16, color: '#1890ff' }}>
                每集大纲 ({allEpisodes.length}集)
            </Title>

            {allEpisodes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                    <Text type="secondary">暂无每集大纲</Text>
                </div>
            ) : (
                allEpisodes.map((episode, index) => {
                    const episodeId = `episode-${episode.episodeNumber}`;
                    const episodeRef = subItems[index]?.ref;

                    return (
                        <div
                            ref={episodeRef as React.RefObject<HTMLDivElement>}
                            id={episodeId}
                        >
                            <Card
                                key={`${episode.jsondocId}-${episode.episodeNumber}`}
                                style={{
                                    marginBottom: 16,
                                    backgroundColor: '#1f1f1f',
                                    borderColor: '#434343'
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
                        </div>
                    );
                })
            )}
        </div>
    );
};

export default EpisodeSynopsisDisplay; 