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

    // Determine per-episode generating state based on running transforms and their inputs/outputs
    const generatingEpisodes = React.useMemo(() => {
        const set = new Set<number>();
        const transforms = projectData.transforms;
        const transformOutputs = projectData.transformOutputs;
        const transformInputs = projectData.transformInputs;
        const getJsondocById = projectData.getJsondocById;

        if (transforms === 'pending' || transforms === 'error') {
            return set;
        }

        const running = transforms.filter(t => t.status === 'running' || t.status === 'pending');
        if (running.length === 0) return set;

        // Check outputs for episode numbers
        if (transformOutputs !== 'pending' && transformOutputs !== 'error') {
            for (const t of running) {
                const outs = transformOutputs.filter(o => o.transform_id === t.id);
                for (const o of outs) {
                    const jd = getJsondocById(o.jsondoc_id);
                    if (jd && (jd.schema_type === '单集大纲' || jd.schema_type === '单集剧本')) {
                        try {
                            const data = typeof jd.data === 'string' ? JSON.parse(jd.data) : jd.data;
                            const ep = data?.episodeNumber;
                            if (typeof ep === 'number') set.add(ep);
                        } catch { }
                    }
                }
            }
        }

        // Also check inputs when outputs are not yet materialized
        if (transformInputs !== 'pending' && transformInputs !== 'error') {
            for (const t of running) {
                const ins = transformInputs.filter(i => i.transform_id === t.id);
                for (const i of ins) {
                    const jd = getJsondocById(i.jsondoc_id);
                    if (jd && (jd.schema_type === '单集大纲' || jd.schema_type === '单集剧本')) {
                        try {
                            const data = typeof jd.data === 'string' ? JSON.parse(jd.data) : jd.data;
                            const ep = data?.episodeNumber;
                            if (typeof ep === 'number') set.add(ep);
                        } catch { }
                    }
                }
            }
        }

        return set;
    }, [projectData.transforms, projectData.transformOutputs, projectData.transformInputs, projectData.getJsondocById]);

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
                <SectionWrapper
                    key={pair.episodeNumber}
                    schemaType={"单集剧本"}
                    title={`第${pair.episodeNumber}集`}
                    sectionId={`episode-${pair.episodeNumber}`}
                    mode={generatingEpisodes.has(pair.episodeNumber) ? 'loading' : 'normal'}
                >
                    <Card
                        style={{
                            border: '2px solid #434343',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            backgroundColor: 'transparent'
                        }}
                    >
                        <div style={{ marginBottom: '8px' }}>
                            {pair.synopsis && <Tag color="blue">大纲</Tag>}
                            {pair.script && <Tag color="green" style={{ marginLeft: 8 }}>剧本</Tag>}
                        </div>
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
                </SectionWrapper>
            ))}

            {/* Remove the divider since we now have card separation */}
        </Space>
    );
};

export default EpisodeContentDisplay; 