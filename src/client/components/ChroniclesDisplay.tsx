import React, { useMemo } from 'react';
import { Card, Typography, Tag, Space, Collapse } from 'antd';
import { ChroniclesOutput } from '../../common/schemas/outlineSchemas';
import { useProjectData } from '../contexts/ProjectDataContext';

const { Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface ChroniclesDisplayProps {
}

export const ChroniclesDisplay: React.FC<ChroniclesDisplayProps> = ({
}) => {
    const projectData = useProjectData()

    // Get chronicles artifacts
    const chroniclesArtifacts = useMemo(() => {
        return projectData.artifacts.filter(artifact =>
            artifact.schema_type === 'chronicles_schema' &&
            artifact.data
        );
    }, [projectData.artifacts]);

    // Parse chronicles data
    const chroniclesData = useMemo(() => {
        return chroniclesArtifacts.map(artifact => {
            try {
                return JSON.parse(artifact.data) as ChroniclesOutput;
            } catch (error) {
                console.warn('Failed to parse chronicles data:', error);
                return null;
            }
        }).filter(chronicles => chronicles !== null) as ChroniclesOutput[];
    }, [chroniclesArtifacts]);

    const chronicles = useMemo(() => {
        if (chroniclesData?.length > 1) {
            return "multiple-chronicles-error" as const;
        }
        return chroniclesData?.[0] ?? null;
    }, [chroniclesData]);

    if (chronicles === "multiple-chronicles-error") {
        return <div>Error: multiple chronicles found</div>
    }

    if (!chronicles) {
        return null;
    }

    return (
        <div id="chronicles" style={{ marginTop: '24px' }}>
            <Card
                style={{
                    backgroundColor: '#1f1f1f',
                    border: '1px solid #434343',
                    borderRadius: '8px',
                }}
                styles={{ body: { padding: '24px' } }}
            >
                {/* Chronological Timeline Stages - only show if available */}
                {chronicles.stages && chronicles.stages.length > 0 && (
                    <Card
                        size="small"
                        title="时序发展阶段（按时间顺序）"
                        style={{ backgroundColor: '#262626', border: '1px solid #434343' }}
                    >
                        <Collapse ghost activeKey={chronicles.stages.map((stage: any, index: number) => index.toString())}>
                            {chronicles.stages.map((stage: any, index: number) => (
                                <Panel
                                    header={stage.title || `第${index + 1}阶段`}
                                    key={index}
                                    style={{ backgroundColor: '#1f1f1f', border: '1px solid #434343', marginBottom: '8px' }}
                                >
                                    <Space direction="vertical" size="small" style={{ width: '100%' }}>

                                        {stage.stageSynopsis && (
                                            <Paragraph style={{ margin: 0, lineHeight: 1.6 }}>
                                                {stage.stageSynopsis}
                                            </Paragraph>
                                        )}

                                        {stage.event && (
                                            <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#262626', borderRadius: '4px' }}>
                                                <Text strong>核心事件：</Text>
                                                <div style={{ marginTop: '4px' }}>
                                                    <Text>{stage.event}</Text>
                                                </div>
                                            </div>
                                        )}

                                        {stage.emotionArcs && stage.emotionArcs.length > 0 && (
                                            <div style={{ marginTop: '8px' }}>
                                                <Text strong>情感变化：</Text>
                                                <div style={{ marginTop: '4px' }}>
                                                    {stage.emotionArcs.map((arc: any, arcIndex: number) => (
                                                        <div key={arcIndex} style={{ marginBottom: '4px', fontSize: '12px' }}>
                                                            <Text type="secondary">
                                                                {(arc.characters && Array.isArray(arc.characters) ? arc.characters.join(', ') : '未知角色')}:
                                                            </Text>
                                                            <Text style={{ marginLeft: '4px' }}>{arc.content || ''}</Text>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {stage.relationshipDevelopments && stage.relationshipDevelopments.length > 0 && (
                                            <div style={{ marginTop: '8px' }}>
                                                <Text strong>关系发展：</Text>
                                                <div style={{ marginTop: '4px' }}>
                                                    {stage.relationshipDevelopments.map((dev: any, devIndex: number) => (
                                                        <div key={devIndex} style={{ marginBottom: '4px', fontSize: '12px' }}>
                                                            <Text type="secondary">
                                                                {(dev.characters && Array.isArray(dev.characters) ? dev.characters.join(' & ') : '未知角色')}:
                                                            </Text>
                                                            <Text style={{ marginLeft: '4px' }}>{dev.content || ''}</Text>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {stage.insights && stage.insights.length > 0 && (
                                            <div style={{ marginTop: '8px' }}>
                                                <Text strong>观众洞察：</Text>
                                                <div style={{ marginTop: '4px' }}>
                                                    {stage.insights.map((insight: string, insightIndex: number) => (
                                                        <div key={insightIndex} style={{ marginBottom: '4px' }}>
                                                            <Tag color="cyan" style={{ fontSize: '11px' }}>
                                                                {insight}
                                                            </Tag>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </Space>
                                </Panel>
                            ))}
                        </Collapse>
                    </Card>
                )}
            </Card>
        </div>
    );
}; 