import React from 'react';
import { Card, Typography, Space, Tag, Collapse } from 'antd';
import { ElectricJsondoc } from '@/common/transform-jsondoc-types';
import { JsondocDisplayWrapper } from '../../transform-jsondoc-framework/components/JsondocDisplayWrapper';
import EditableEpisodeScriptForm from './EditableEpisodeScriptForm';
import EditableEpisodeSynopsisForm from './EditableEpisodeSynopsisForm';
import { useScrollSync } from '../../contexts/ScrollSyncContext';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { SectionWrapper } from './SectionWrapper';

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
    const projectData = useProjectData();

    // Determine if any relevant transforms (单集大纲/单集剧本) are currently running
    const isEpisodeGenerating = React.useMemo(() => {
        const transforms = projectData.transforms;
        const transformOutputs = projectData.transformOutputs;
        const getJsondocById = projectData.getJsondocById;

        if (transforms === 'pending' || transforms === 'error') {
            return false;
        }

        const runningTransforms = transforms.filter(t => t.status === 'running' || t.status === 'pending');
        if (runningTransforms.length === 0) {
            return false;
        }

        // Check outputs for schema types
        if (transformOutputs !== 'pending' && transformOutputs !== 'error') {
            for (const t of runningTransforms) {
                const outputs = transformOutputs.filter(o => o.transform_id === t.id);
                for (const o of outputs) {
                    const out = getJsondocById(o.jsondoc_id);
                    if (out && (out.schema_type === '单集大纲' || out.schema_type === '单集剧本')) {
                        return true;
                    }
                }
            }
        }

        // Heuristic by transform name when outputs are not available yet
        return runningTransforms.some(t => {
            const name = t.transform_name;
            return typeof name === 'string' && (
                name.includes('单集大纲') ||
                name.includes('单集剧本') ||
                name.toLowerCase().includes('episode') ||
                name.includes('剧本') ||
                name.toLowerCase().includes('synopsis')
            );
        });
    }, [projectData.transforms, projectData.transformOutputs, projectData.getJsondocById]);

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
        <SectionWrapper schemaType={"单集剧本"} title="分集内容" sectionId="episode-content-section" mode={isEpisodeGenerating ? 'loading' : 'normal'}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">

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
                            border: '2px solid #434343',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            backgroundColor: 'transparent'
                        }}

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
                                                    border: 'none'
                                                }}
                                            >
                                                <JsondocDisplayWrapper
                                                    jsondoc={pair.synopsis.jsondoc}
                                                    isEditable={pair.synopsis.isEditable}
                                                    title="大纲详情"
                                                    icon="🗒️"
                                                    editableComponent={EditableEpisodeSynopsisForm}
                                                    schemaType="单集大纲"
                                                    enableClickToEdit={pair.synopsis.isClickToEditable}
                                                />
                                            </Panel>
                                        </Collapse>
                                    ) : (
                                        <div id={`episode-${pair.episodeNumber}-synopsis`}>
                                            <JsondocDisplayWrapper
                                                jsondoc={pair.synopsis.jsondoc}
                                                isEditable={pair.synopsis.isEditable}
                                                title="大纲详情"
                                                icon="🗒️"
                                                editableComponent={EditableEpisodeSynopsisForm}
                                                schemaType="单集大纲"
                                                enableClickToEdit={pair.synopsis.isClickToEditable}
                                            />
                                        </div>
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
        </SectionWrapper>
    );
};

export default EpisodeContentDisplay; 