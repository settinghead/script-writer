import React, { useMemo } from 'react';
import { Card, Typography, Space } from 'antd';
import { ChroniclesOutput } from '../../common/schemas/outlineSchemas';
import { useProjectData } from '../contexts/ProjectDataContext';

const { Text, Paragraph } = Typography;

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
                {chronicles.synopsis_stages && chronicles.synopsis_stages.length > 0 && (
                    <Card
                        size="small"
                        title="时序发展阶段（按时间顺序）"
                        style={{ backgroundColor: '#262626', border: '1px solid #434343' }}
                    >
                        <Space direction="vertical" size="large" style={{ width: '100%' }}>
                            {chronicles.synopsis_stages.map((stage: string, index: number) => (
                                <div key={index} style={{
                                    padding: '16px',
                                    backgroundColor: '#1f1f1f',
                                    border: '1px solid #434343',
                                    borderRadius: '8px'
                                }}>
                                    <div style={{ marginBottom: '8px' }}>
                                        <Text strong style={{ color: '#1890ff', fontSize: '16px' }}>
                                            第 {index + 1} 阶段
                                        </Text>
                                    </div>
                                    <Paragraph style={{ margin: 0, lineHeight: 1.6, color: '#fff' }}>
                                        {stage}
                                    </Paragraph>
                                </div>
                            ))}
                        </Space>
                    </Card>
                )}
            </Card>
        </div>
    );
}; 