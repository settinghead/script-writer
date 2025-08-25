import React from 'react';
import { Card, Typography, Space, Tag, Collapse } from 'antd';
import { ElectricJsondoc } from '@/common/transform-jsondoc-types';
import { JsondocDisplayWrapper } from '../../transform-jsondoc-framework/components/JsondocDisplayWrapper';
import EditableEpisodeScriptForm from './EditableEpisodeScriptForm';
import { useScrollSync } from '../../contexts/ScrollSyncContext';

const { Title, Paragraph, Text } = Typography;
const { Panel } = Collapse;

interface EpisodeContentItem {
    jsondoc: ElectricJsondoc;
    isEditable: boolean;
    isClickToEditable: boolean;
}

interface EpisodeContentDisplayProps {
    synopsisItems: EpisodeContentItem[];
    scriptItems: EpisodeContentItem[];
}

interface EpisodePair {
    episodeNumber: number;
    synopsis: EpisodeContentItem | null;
    script: EpisodeContentItem | null;
}

export const EpisodeContentDisplay: React.FC<EpisodeContentDisplayProps> = ({
    synopsisItems,
    scriptItems
}) => {
    const { registerScrollHandler, unregisterScrollHandler } = useScrollSync();

    // Group items by episode number and create pairs
    const episodePairs = React.useMemo(() => {
        const pairs = new Map<number, EpisodePair>();

        // Add synopsis items
        synopsisItems.forEach(item => {
            try {
                const data = typeof item.jsondoc.data === 'string'
                    ? JSON.parse(item.jsondoc.data)
                    : item.jsondoc.data;
                const episodeNumber = data.episodeNumber || 0;

                if (!pairs.has(episodeNumber)) {
                    pairs.set(episodeNumber, { episodeNumber, synopsis: null, script: null });
                }
                pairs.get(episodeNumber)!.synopsis = item;
            } catch (error) {
                console.error('Failed to parse synopsis data:', error);
            }
        });

        // Add script items
        scriptItems.forEach(item => {
            try {
                const data = typeof item.jsondoc.data === 'string'
                    ? JSON.parse(item.jsondoc.data)
                    : item.jsondoc.data;
                const episodeNumber = data.episodeNumber || 0;

                if (!pairs.has(episodeNumber)) {
                    pairs.set(episodeNumber, { episodeNumber, synopsis: null, script: null });
                }
                pairs.get(episodeNumber)!.script = item;
            } catch (error) {
                console.error('Failed to parse script data:', error);
            }
        });

        // Convert to sorted array
        return Array.from(pairs.values()).sort((a, b) => a.episodeNumber - b.episodeNumber);
    }, [synopsisItems, scriptItems]);

    // Register scroll handler for episode content navigation
    React.useEffect(() => {
        const scrollHandler = (subId?: string) => {
            if (!subId) {
                // Scroll to the top of episode content section
                const element = document.getElementById('episode-content-section');
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                return;
            }

            // Handle specific episode or episode sub-item navigation
            if (subId.includes('-synopsis')) {
                // Navigate to specific episode synopsis
                const match = subId.match(/^episode-(\d+)-synopsis$/);
                if (match) {
                    const episodeNumber = parseInt(match[1]);
                    const element = document.getElementById(`episode-${episodeNumber}-synopsis`);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            } else if (subId.includes('-script')) {
                // Navigate to specific episode script
                const match = subId.match(/^episode-(\d+)-script$/);
                if (match) {
                    const episodeNumber = parseInt(match[1]);
                    const element = document.getElementById(`episode-${episodeNumber}-script`);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            } else if (subId.startsWith('episode-')) {
                // Navigate to specific episode (general)
                const match = subId.match(/^episode-(\d+)$/);
                if (match) {
                    const episodeNumber = parseInt(match[1]);
                    const element = document.getElementById(`episode-${episodeNumber}`);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            }
        };

        registerScrollHandler('episode-content', scrollHandler);

        return () => {
            unregisterScrollHandler('episode-content');
        };
    }, [registerScrollHandler, unregisterScrollHandler]);

    if (episodePairs.length === 0) {
        return null;
    }

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="large" id="episode-content-section">

            {episodePairs.map((pair) => (
                <Card
                    key={pair.episodeNumber}
                    id={`episode-${pair.episodeNumber}`}
                    title={
                        <Space>
                            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>第{pair.episodeNumber}集</span>
                            {pair.synopsis && <Tag color="blue">大纲</Tag>}
                            {pair.script && <Tag color="green">剧本</Tag>}
                        </Space>
                    }
                    style={{
                        backgroundColor: '#141414',
                        border: '2px solid #434343',
                        borderRadius: '8px',
                        marginBottom: '20px'
                    }}
                    headStyle={{
                        borderBottom: '1px solid #434343',
                        backgroundColor: '#1f1f1f'
                    }}
                    bodyStyle={{ padding: '16px' }}
                >
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        {/* Episode Synopsis */}
                        {pair.synopsis && (
                            <div>
                                {pair.script ? (
                                    // If script exists, show synopsis in a collapsible panel (collapsed by default)
                                    <Collapse
                                        ghost
                                        size="small"
                                        style={{
                                            backgroundColor: '#1a1a1a',
                                            border: '1px solid #434343',
                                            borderRadius: '6px'
                                        }}
                                    >
                                        <Panel
                                            header={
                                                <Space>
                                                    <span>本集大纲</span>
                                                    <Tag color="orange">已收起</Tag>
                                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                                        (点击展开查看详情)
                                                    </Text>
                                                </Space>
                                            }
                                            key="synopsis"
                                            id={`episode-${pair.episodeNumber}-synopsis`}
                                            style={{
                                                backgroundColor: '#1a1a1a',
                                                border: 'none'
                                            }}
                                        >
                                            {(() => {
                                                try {
                                                    const synopsisData = typeof pair.synopsis.jsondoc.data === 'string'
                                                        ? JSON.parse(pair.synopsis.jsondoc.data)
                                                        : pair.synopsis.jsondoc.data;

                                                    return (
                                                        <Space direction="vertical" style={{ width: '100%' }} size="small">
                                                            <div>
                                                                <Text strong style={{ color: '#1890ff' }}>标题：</Text>
                                                                <Text>{synopsisData.title}</Text>
                                                            </div>

                                                            <div>
                                                                <Text strong style={{ color: '#52c41a' }}>开场钩子：</Text>
                                                                <Paragraph style={{ margin: '4px 0', paddingLeft: '16px' }}>
                                                                    {synopsisData.openingHook}
                                                                </Paragraph>
                                                            </div>

                                                            <div>
                                                                <Text strong style={{ color: '#faad14' }}>主要剧情：</Text>
                                                                <Paragraph style={{ margin: '4px 0', paddingLeft: '16px' }}>
                                                                    {synopsisData.mainPlot}
                                                                </Paragraph>
                                                            </div>

                                                            <div>
                                                                <Text strong style={{ color: '#f5222d' }}>情感高潮：</Text>
                                                                <Paragraph style={{ margin: '4px 0', paddingLeft: '16px' }}>
                                                                    {synopsisData.emotionalClimax}
                                                                </Paragraph>
                                                            </div>

                                                            <div>
                                                                <Text strong style={{ color: '#722ed1' }}>结尾悬念：</Text>
                                                                <Paragraph style={{ margin: '4px 0', paddingLeft: '16px' }}>
                                                                    {synopsisData.cliffhanger}
                                                                </Paragraph>
                                                            </div>

                                                            {synopsisData.suspenseElements && synopsisData.suspenseElements.length > 0 && (
                                                                <div>
                                                                    <Text strong style={{ color: '#13c2c2' }}>悬念元素：</Text>
                                                                    <div style={{ paddingLeft: '16px', marginTop: '4px' }}>
                                                                        {synopsisData.suspenseElements.map((element: string, idx: number) => (
                                                                            <Tag key={idx} style={{ margin: '2px' }}>{element}</Tag>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div style={{ marginTop: '8px' }}>
                                                                <Tag color="cyan">{synopsisData.estimatedDuration || 120}秒</Tag>
                                                            </div>

                                                            {pair.synopsis.isClickToEditable && (
                                                                <div style={{ marginTop: '8px' }}>
                                                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                                                        点击内容可编辑
                                                                    </Text>
                                                                </div>
                                                            )}
                                                        </Space>
                                                    );
                                                } catch (error) {
                                                    console.error('Failed to parse synopsis data:', error);
                                                    return <Text type="secondary">数据解析错误</Text>;
                                                }
                                            })()}
                                        </Panel>
                                    </Collapse>
                                ) : (
                                    // If no script exists, show synopsis in a regular card (expanded)
                                    <Card
                                        id={`episode-${pair.episodeNumber}-synopsis`}
                                        title="大纲详情"
                                        size="small"
                                        style={{
                                            backgroundColor: '#1a1a1a',
                                            border: '1px solid #434343'
                                        }}
                                        headStyle={{ borderBottom: '1px solid #434343' }}
                                    >
                                        {(() => {
                                            try {
                                                const synopsisData = typeof pair.synopsis.jsondoc.data === 'string'
                                                    ? JSON.parse(pair.synopsis.jsondoc.data)
                                                    : pair.synopsis.jsondoc.data;

                                                return (
                                                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                                                        <div>
                                                            <Text strong style={{ color: '#1890ff' }}>标题：</Text>
                                                            <Text>{synopsisData.title}</Text>
                                                        </div>

                                                        <div>
                                                            <Text strong style={{ color: '#52c41a' }}>开场钩子：</Text>
                                                            <Paragraph style={{ margin: '4px 0', paddingLeft: '16px' }}>
                                                                {synopsisData.openingHook}
                                                            </Paragraph>
                                                        </div>

                                                        <div>
                                                            <Text strong style={{ color: '#faad14' }}>主要剧情：</Text>
                                                            <Paragraph style={{ margin: '4px 0', paddingLeft: '16px' }}>
                                                                {synopsisData.mainPlot}
                                                            </Paragraph>
                                                        </div>

                                                        <div>
                                                            <Text strong style={{ color: '#f5222d' }}>情感高潮：</Text>
                                                            <Paragraph style={{ margin: '4px 0', paddingLeft: '16px' }}>
                                                                {synopsisData.emotionalClimax}
                                                            </Paragraph>
                                                        </div>

                                                        <div>
                                                            <Text strong style={{ color: '#722ed1' }}>结尾悬念：</Text>
                                                            <Paragraph style={{ margin: '4px 0', paddingLeft: '16px' }}>
                                                                {synopsisData.cliffhanger}
                                                            </Paragraph>
                                                        </div>

                                                        {synopsisData.suspenseElements && synopsisData.suspenseElements.length > 0 && (
                                                            <div>
                                                                <Text strong style={{ color: '#13c2c2' }}>悬念元素：</Text>
                                                                <div style={{ paddingLeft: '16px', marginTop: '4px' }}>
                                                                    {synopsisData.suspenseElements.map((element: string, idx: number) => (
                                                                        <Tag key={idx} style={{ margin: '2px' }}>{element}</Tag>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div style={{ marginTop: '8px' }}>
                                                            <Tag color="cyan">{synopsisData.estimatedDuration || 120}秒</Tag>
                                                        </div>

                                                        {pair.synopsis.isClickToEditable && (
                                                            <div style={{ marginTop: '8px' }}>
                                                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                                                    点击内容可编辑
                                                                </Text>
                                                            </div>
                                                        )}
                                                    </Space>
                                                );
                                            } catch (error) {
                                                console.error('Failed to parse synopsis data:', error);
                                                return <Text type="secondary">数据解析错误</Text>;
                                            }
                                        })()}
                                    </Card>
                                )}
                            </div>
                        )}

                        {/* Episode Script */}
                        {pair.script && (
                            <div id={`episode-${pair.episodeNumber}-script`}>
                                <JsondocDisplayWrapper
                                    jsondoc={pair.script.jsondoc}
                                    isEditable={pair.script.isEditable}
                                    title="剧本内容"
                                    icon="📝"
                                    editableComponent={EditableEpisodeScriptForm}
                                    schemaType="单集剧本"
                                    enableClickToEdit={pair.script.isClickToEditable}
                                />
                            </div>
                        )}
                    </Space>
                </Card>
            ))}

            {/* Remove the divider since we now have card separation */}
        </Space>
    );
};

export default EpisodeContentDisplay; 