import React, { useMemo } from 'react';
import { Card, Descriptions, Typography, Tag, Space } from 'antd';
import { ClockCircleOutlined, ThunderboltOutlined, EyeOutlined, FireOutlined } from '@ant-design/icons';
import type { ElectricJsondoc } from '../../../common/types';
import EditableEpisodeSynopsisForm from './EditableEpisodeSynopsisForm';
import { YJSJsondocProvider } from '../../transform-jsondoc-framework/contexts/YJSJsondocContext';
import { useProjectData } from '../../contexts/ProjectDataContext';

const { Title, Text, Paragraph } = Typography;

interface SynopsisItem {
    jsondoc: ElectricJsondoc;
    isEditable: boolean;
    isClickToEditable: boolean;
}

interface EpisodeSynopsisDisplayProps {
    synopsisItems?: SynopsisItem[];
}

// Single episode display component - now a pure presentational component
const SingleEpisodeDisplay: React.FC<{
    item: SynopsisItem;
    onClick: () => void;
}> = ({ item, onClick }) => {
    const { jsondoc, isEditable, isClickToEditable } = item;

    // Parse episode data
    let episodeData: any = null;
    try {
        episodeData = typeof jsondoc.data === 'string'
            ? JSON.parse(jsondoc.data)
            : jsondoc.data;
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

    const cardStyle: React.CSSProperties = {
        marginBottom: 16,
        backgroundColor: '#1f1f1f',
        borderColor: '#434343',
    };

    if (isClickToEditable) {
        cardStyle.cursor = 'pointer';
        cardStyle.borderColor = '#1890ff';
    }

    if (isEditable) {
        return (
            <div id={`episode-${episodeData.episodeNumber}`}>
                <Card
                    style={cardStyle}
                    title={
                        <Space>
                            <Text strong style={{ fontSize: '16px', color: '#1890ff' }}>
                                第{episodeData.episodeNumber}集: {episodeData.title} (编辑中)
                            </Text>
                        </Space>
                    }
                >
                    <YJSJsondocProvider jsondocId={jsondoc.id}>
                        <EditableEpisodeSynopsisForm jsondoc={jsondoc} />
                    </YJSJsondocProvider>
                </Card>
            </div>
        );
    }

    return (
        <div
            id={`episode-${episodeData.episodeNumber}`}
            onClick={isClickToEditable ? onClick : undefined}
        >
            <Card
                style={cardStyle}
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

const EpisodeSynopsisDisplay: React.FC<EpisodeSynopsisDisplayProps> = ({ synopsisItems = [] }) => {
    const projectData = useProjectData();

    // Sort episodes by episode number
    const sortedItems = useMemo(() => {
        return [...synopsisItems].sort((a, b) => {
            try {
                const aData = typeof a.jsondoc.data === 'string' ? JSON.parse(a.jsondoc.data) : a.jsondoc.data;
                const bData = typeof b.jsondoc.data === 'string' ? JSON.parse(b.jsondoc.data) : b.jsondoc.data;
                return (aData.episodeNumber || 0) - (bData.episodeNumber || 0);
            } catch (error) {
                return 0;
            }
        });
    }, [synopsisItems]);

    const handleCardClick = (item: SynopsisItem) => {
        if (item.isClickToEditable) {
            projectData.createHumanTransform.mutate({
                transformName: 'user_edit_episode_synopsis',
                sourceJsondocId: item.jsondoc.id,
                derivationPath: '$',
                fieldUpdates: {}
            });
        }
    };

    if (sortedItems.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                <Text type="secondary">暂无剧集大纲</Text>
            </div>
        );
    }

    return (
        <div id="episode-synopsis" style={{ marginBottom: 24 }}>
            <Title level={3} style={{ marginBottom: 16, color: '#1890ff' }}>
                每集大纲 ({sortedItems.length}集)
            </Title>
            {sortedItems.map((item) => (
                <SingleEpisodeDisplay
                    key={item.jsondoc.id}
                    item={item}
                    onClick={() => handleCardClick(item)}
                />
            ))}
        </div>
    );
};

export default EpisodeSynopsisDisplay; 