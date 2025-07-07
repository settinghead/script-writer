import React, { useMemo } from 'react';
import { Card, Typography, Space } from 'antd';
import { ChroniclesOutput } from '../../common/schemas/outlineSchemas';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useLineageResolution } from '../transform-artifact-framework/useLineageResolution';
import { SectionWrapper, ArtifactSchemaType } from './shared';
import { ChronicleStageCard } from './ChronicleStageCard';

const { Text } = Typography;

interface ChroniclesDisplayProps {
}

export const ChroniclesDisplay: React.FC<ChroniclesDisplayProps> = ({
}) => {
    const projectData = useProjectData();

    const { artifacts, isLoading, isError, error } = projectData;
    if (artifacts === "pending" || artifacts === "error") {
        return null;
    }

    // Find the root chronicles artifact using lineage resolution approach
    const rootChroniclesArtifact = useMemo(() => {
        // First try: Look for chronicles_schema
        const chroniclesArtifacts = artifacts.filter(artifact =>
            artifact.schema_type === 'chronicles_schema' &&
            artifact.data
        );

        // Second try: Look for legacy type 'chronicles'
        const legacyChroniclesArtifacts = artifacts.filter(artifact =>
            artifact.type === 'chronicles' &&
            artifact.data
        );

        // Third try: Look for any artifact that might contain chronicles data
        const possibleChroniclesArtifacts = artifacts.filter(artifact => {
            if (!artifact.data) return false;
            try {
                const data = typeof artifact.data === 'string' ? JSON.parse(artifact.data) : artifact.data;
                return data.stages && Array.isArray(data.stages);
            } catch {
                return false;
            }
        });

        // Use the most specific match first
        let candidateArtifacts = chroniclesArtifacts;
        if (candidateArtifacts.length === 0) {
            candidateArtifacts = legacyChroniclesArtifacts;
        }
        if (candidateArtifacts.length === 0) {
            candidateArtifacts = possibleChroniclesArtifacts;
        }

        if (candidateArtifacts.length === 0) {
            return null;
        }

        // Find the AI-generated artifact (should be the root of the lineage chain)
        const aiGenerated = candidateArtifacts.find(artifact =>
            artifact.origin_type === 'ai_generated'
        );

        if (aiGenerated) {
            return aiGenerated;
        }

        // Fallback: if no AI-generated found, sort by creation time and get the earliest
        const sorted = [...candidateArtifacts].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const fallback = sorted[0];
        return fallback;
    }, [artifacts, isLoading, isError, error]);

    // Use lineage resolution to get the latest version of the chronicles
    const r = useLineageResolution({
        sourceArtifactId: rootChroniclesArtifact?.id || null,
        path: '$',
        options: { enabled: !!rootChroniclesArtifact }
    });

    if (r === "pending" || r === "error") {
        return null;
    }

    const { latestArtifactId, hasLineage, isLoading: lineageLoading, error: lineageError } = r;


    // Get the effective chronicles artifact
    const effectiveChroniclesArtifact = useMemo(() => {
        if (!latestArtifactId) {
            return null;
        }
        const artifact = artifacts.find(a => a.id === latestArtifactId);

        // If the latest artifact is a chronicle stage (individual stage), we need to use the root chronicles instead
        if (artifact?.schema_type === 'chronicle_stage_schema') {
            return rootChroniclesArtifact;
        }

        // If the latest artifact is a chronicles collection, use it
        if (artifact?.schema_type === 'chronicles_schema') {
            return artifact;
        }

        // Fallback to root chronicles
        return rootChroniclesArtifact;
    }, [latestArtifactId, artifacts, rootChroniclesArtifact]);

    // Parse chronicles data from the effective artifact
    const chroniclesData = useMemo(() => {
        if (!effectiveChroniclesArtifact?.data) {
            return null;
        }

        try {
            let data: any = effectiveChroniclesArtifact.data;
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            return data as ChroniclesOutput;
        } catch (error) {
            return null;
        }
    }, [effectiveChroniclesArtifact]);

    if (projectData.isLoading || lineageLoading) {
        return null;
    }

    if (lineageError) {
        return (
            <Card style={{ backgroundColor: '#1f1f1f', border: '1px solid #434343' }}>
                <Text type="danger">加载时间顺序大纲时出错: {lineageError.message}</Text>
            </Card>
        );
    }

    if (!chroniclesData || !chroniclesData.stages || chroniclesData.stages.length === 0) {
        return null;
    }

    return (
        <SectionWrapper
            schemaType={ArtifactSchemaType.CHRONICLES}
            title="时间顺序大纲"
            sectionId="chronicles"
            artifactId={effectiveChroniclesArtifact?.id}
        >
            <div style={{ marginTop: '24px' }}>
                <Card
                    style={{
                        backgroundColor: '#1f1f1f',
                        border: '1px solid #434343',
                        borderRadius: '8px',
                    }}
                    styles={{ body: { padding: '24px' } }}
                >
                    {/* Header */}
                    <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                        <Space direction="vertical" size="small">
                            <Text type="secondary">
                                按时间顺序梳理的完整故事发展阶段（共 {chroniclesData.stages.length} 个阶段）
                            </Text>
                        </Space>
                    </div>

                    {/* Stages Timeline */}
                    <div>
                        {chroniclesData.stages.map((stage, index) => {
                            const stagePath = `$.stages[${index}]`;
                            const chroniclesArtifactId = rootChroniclesArtifact?.id || '';

                            return (
                                <ChronicleStageCard
                                    key={`stage-${index}`}
                                    chroniclesArtifactId={chroniclesArtifactId}
                                    stagePath={stagePath}
                                    stageIndex={index}
                                />
                            );
                        })}
                    </div>
                </Card>
            </div>
        </SectionWrapper>
    );
}; 