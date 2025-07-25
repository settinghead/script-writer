import React, { useRef, useEffect, useMemo } from 'react';
import { Card, Descriptions, Typography, Tag, Space } from 'antd';
import { ClockCircleOutlined, ThunderboltOutlined, EyeOutlined, FireOutlined } from '@ant-design/icons';
import type { ElectricJsondoc } from '../../../common/types';
import { useScrollSyncObserver, type SubItem } from '../../hooks/useScrollSyncObserver';

const { Title, Text, Paragraph } = Typography;

interface EpisodeSynopsisDisplayProps {
    episodeSynopsis?: ElectricJsondoc;
    episodeSynopsisList?: ElectricJsondoc[];
}

// Single episode display component - now a pure presentational component
const SingleEpisodeDisplay: React.FC<{ episodeSynopsis: ElectricJsondoc; setRef: (el: HTMLDivElement | null) => void }> = ({ episodeSynopsis, setRef }) => {
    // Parse episode data
    let episodeData: any = null;
    try {
        episodeData = typeof episodeSynopsis.data === 'string'
            ? JSON.parse(episodeSynopsis.data)
            : episodeSynopsis.data;
    } catch (error) {
        console.warn('Failed to parse episode synopsis data:', error);
        return (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#ff4d4f' }}>
                <Text type="danger">数据解析失败</Text>
            </div>
        );
    }

    if (!episodeData) {
        return (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                <Text type="secondary">暂无剧集大纲数据</Text>
            </div>
        );
    }

    return (
        <div
            ref={setRef} // Attach ref from parent
            id={`episode-${episodeData.episodeNumber}`}
        >
            <Card
                style={{
                    marginBottom: 16,
                    backgroundColor: '#1f1f1f',
                    borderColor: '#434343'
                }}
                title={
                    <Space>
                        <Text strong style={{ fontSize: '16px', color: '#1890ff' }}>
                            第{episodeData.episodeNumber}集: {episodeData.title}
                        </Text>
                    </Space>
                }
                extra={
                    <Space>
                        <ClockCircleOutlined />
                        <Text type="secondary">{episodeData.estimatedDuration || 120}秒</Text>
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
                            {episodeData.openingHook}
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
                            {episodeData.mainPlot}
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
                            {episodeData.emotionalClimax}
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
                            {episodeData.cliffhanger}
                        </Paragraph>
                    </Descriptions.Item>
                </Descriptions>

                {episodeData.suspenseElements && episodeData.suspenseElements.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                        <Text strong style={{ color: '#722ed1' }}>悬念元素:</Text>
                        <div style={{ marginTop: 8 }}>
                            {episodeData.suspenseElements.map((element: string, idx: number) => (
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
};

const EpisodeSynopsisDisplay: React.FC<EpisodeSynopsisDisplayProps> = ({ episodeSynopsis, episodeSynopsisList }) => {
    // Refs for each episode card
    const itemRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

    // Sort episodes by episode number
    const sortedEpisodes = useMemo(() => {
        const episodes = episodeSynopsisList || (episodeSynopsis ? [episodeSynopsis] : []);
        return episodes.sort((a, b) => {
            try {
                const aData = typeof a.data === 'string' ? JSON.parse(a.data) : a.data;
                const bData = typeof b.data === 'string' ? JSON.parse(b.data) : b.data;
                return (aData.episodeNumber || 0) - (bData.episodeNumber || 0);
            } catch (error) {
                return 0;
            }
        });
    }, [episodeSynopsis, episodeSynopsisList]);

    // Build sub-items for scroll sync observer from refs
    const subItems: SubItem[] = useMemo(() => {
        return sortedEpisodes
            .map(episode => {
                const ref = itemRefs.current.get(episode.id);
                if (ref) {
                    let episodeNumber = 0;
                    try {
                        const data = typeof episode.data === 'string' ? JSON.parse(episode.data) : episode.data;
                        episodeNumber = data.episodeNumber;
                    } catch { }

                    return { id: `episode-${episodeNumber}`, ref };
                }
                return null;
            })
            .filter((item): item is SubItem => item !== null && item.ref !== null);
    }, [sortedEpisodes, itemRefs.current]);

    // Initialize scroll sync observer once for all episodes
    useScrollSyncObserver('episode-synopsis', subItems, {
        enabled: true,
        threshold: 0.3,
        rootMargin: '-10% 0px -50% 0px'
    });

    // Callback to set refs in the map
    const setItemRef = (id: string) => (el: HTMLDivElement | null) => {
        if (el) {
            itemRefs.current.set(id, el);
        } else {
            itemRefs.current.delete(id);
        }
    };

    if (sortedEpisodes.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                <Text type="secondary">暂无剧集大纲</Text>
            </div>
        );
    }

    return (
        <div id="episode-synopsis" style={{ marginBottom: 24 }}>
            <Title level={3} style={{ marginBottom: 16, color: '#1890ff' }}>
                每集大纲 ({sortedEpisodes.length}集)
            </Title>
            {sortedEpisodes.map((episode) => (
                <SingleEpisodeDisplay
                    key={episode.id}
                    episodeSynopsis={episode}
                    setRef={setItemRef(episode.id)}
                />
            ))}
        </div>
    );
};

export default EpisodeSynopsisDisplay; 