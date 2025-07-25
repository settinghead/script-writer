import React from 'react';
import { Card, Typography, Space, Tag, Divider } from 'antd';
import { ElectricJsondoc } from '../../../common/types';
import { JsondocDisplayWrapper } from '../../transform-jsondoc-framework/components/JsondocDisplayWrapper';
import EditableEpisodeScriptForm from './EditableEpisodeScriptForm';

const { Title, Paragraph, Text } = Typography;

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

    if (episodePairs.length === 0) {
        return null;
    }

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Title level={3}>分集内容</Title>

            {episodePairs.map((pair) => (
                <div key={pair.episodeNumber}>
                    {/* Episode Synopsis */}
                    {pair.synopsis && (
                        <Card
                            title={
                                <Space>
                                    <span>第{pair.episodeNumber}集大纲</span>
                                    <Tag color="blue">大纲</Tag>
                                </Space>
                            }
                            style={{
                                backgroundColor: '#1a1a1a',
                                border: '1px solid #434343',
                                marginBottom: '12px'
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

                    {/* Episode Script */}
                    {pair.script && (
                        <div style={{ marginBottom: '24px' }}>
                            <JsondocDisplayWrapper
                                jsondoc={pair.script.jsondoc}
                                isEditable={pair.script.isEditable}
                                title={`第${pair.episodeNumber}集剧本`}
                                icon="📝"
                                editableComponent={EditableEpisodeScriptForm}
                                schemaType="episode_script"
                                enableClickToEdit={pair.script.isClickToEditable}
                            />
                        </div>
                    )}

                    {/* Add divider between episodes (except last) */}
                    {pair !== episodePairs[episodePairs.length - 1] && (
                        <Divider style={{ margin: '24px 0', borderColor: '#434343' }} />
                    )}
                </div>
            ))}
        </Space>
    );
};

export default EpisodeContentDisplay; 