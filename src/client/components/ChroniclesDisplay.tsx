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

    // Find the root chronicles artifact using lineage resolution approach
    const rootChroniclesArtifact = useMemo(() => {
        console.log('[ChroniclesDisplay] Starting artifact search...');
        console.log('[ChroniclesDisplay] Total artifacts:', projectData.artifacts.length);

        // Debug: Log all artifacts to see what we have
        console.log('[ChroniclesDisplay] All artifacts:');
        projectData.artifacts.forEach((artifact, index) => {
            console.log(`  ${index}: ${artifact.id} - type: ${artifact.type}, schema_type: ${artifact.schema_type}, origin: ${artifact.origin_type}`);
        });

        // First try: Look for chronicles_schema
        const chroniclesArtifacts = projectData.artifacts.filter(artifact =>
            artifact.schema_type === 'chronicles_schema' &&
            artifact.data
        );

        console.log('[ChroniclesDisplay] Chronicles artifacts (schema_type=chronicles_schema):', chroniclesArtifacts.length);

        // Second try: Look for legacy type 'chronicles'
        const legacyChroniclesArtifacts = projectData.artifacts.filter(artifact =>
            artifact.type === 'chronicles' &&
            artifact.data
        );

        console.log('[ChroniclesDisplay] Legacy chronicles artifacts (type=chronicles):', legacyChroniclesArtifacts.length);

        // Third try: Look for any artifact that might contain chronicles data
        const possibleChroniclesArtifacts = projectData.artifacts.filter(artifact => {
            if (!artifact.data) return false;
            try {
                const data = typeof artifact.data === 'string' ? JSON.parse(artifact.data) : artifact.data;
                return data.stages && Array.isArray(data.stages);
            } catch {
                return false;
            }
        });

        console.log('[ChroniclesDisplay] Possible chronicles artifacts (has stages array):', possibleChroniclesArtifacts.length);
        possibleChroniclesArtifacts.forEach((artifact, index) => {
            console.log(`  Possible ${index}:`, {
                id: artifact.id,
                type: artifact.type,
                schema_type: artifact.schema_type,
                origin_type: artifact.origin_type,
                created_at: artifact.created_at
            });
        });

        // Use the most specific match first
        let candidateArtifacts = chroniclesArtifacts;
        if (candidateArtifacts.length === 0) {
            candidateArtifacts = legacyChroniclesArtifacts;
        }
        if (candidateArtifacts.length === 0) {
            candidateArtifacts = possibleChroniclesArtifacts;
        }

        console.log('[ChroniclesDisplay] Using candidate artifacts:', candidateArtifacts.length);
        candidateArtifacts.forEach((artifact, index) => {
            console.log(`[ChroniclesDisplay] Candidate ${index}:`, {
                id: artifact.id,
                schema_type: artifact.schema_type,
                type: artifact.type,
                origin_type: artifact.origin_type,
                created_at: artifact.created_at,
                hasData: !!artifact.data
            });
        });

        if (candidateArtifacts.length === 0) {
            console.log('[ChroniclesDisplay] No chronicles artifacts found, returning null');
            return null;
        }

        // Find the AI-generated artifact (should be the root of the lineage chain)
        const aiGenerated = candidateArtifacts.find(artifact =>
            artifact.origin_type === 'ai_generated'
        );

        if (aiGenerated) {
            console.log('[ChroniclesDisplay] Found AI-generated chronicles artifact:', aiGenerated.id);
            return aiGenerated;
        }

        // Fallback: if no AI-generated found, sort by creation time and get the earliest
        const sorted = [...candidateArtifacts].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const fallback = sorted[0];
        console.log('[ChroniclesDisplay] No AI-generated found, using fallback:', fallback?.id);
        return fallback;
    }, [projectData.artifacts]);

    // Use lineage resolution to get the latest version of the chronicles
    const {
        latestArtifactId,
        hasLineage,
        isLoading: lineageLoading,
        error: lineageError
    } = useLineageResolution({
        sourceArtifactId: rootChroniclesArtifact?.id || null,
        path: '$',
        options: { enabled: !!rootChroniclesArtifact }
    });

    console.log('[ChroniclesDisplay] Lineage resolution result:', {
        rootArtifactId: rootChroniclesArtifact?.id,
        latestArtifactId,
        hasLineage,
        lineageLoading,
        lineageError: lineageError?.message
    });

    // Get the effective chronicles artifact
    const effectiveChroniclesArtifact = useMemo(() => {
        if (!latestArtifactId) {
            console.log('[ChroniclesDisplay] No latest artifact ID, returning null');
            return null;
        }
        const artifact = projectData.artifacts.find(a => a.id === latestArtifactId);
        console.log('[ChroniclesDisplay] Latest artifact from lineage:', {
            id: artifact?.id,
            type: artifact?.type,
            schema_type: artifact?.schema_type,
            found: !!artifact,
            hasData: !!artifact?.data
        });

        // If the latest artifact is a chronicle stage (individual stage), we need to use the root chronicles instead
        if (artifact?.schema_type === 'chronicle_stage_schema') {
            console.log('[ChroniclesDisplay] Latest artifact is a chronicle stage, using root chronicles instead');
            return rootChroniclesArtifact;
        }

        // If the latest artifact is a chronicles collection, use it
        if (artifact?.schema_type === 'chronicles_schema') {
            console.log('[ChroniclesDisplay] Latest artifact is chronicles collection, using it');
            return artifact;
        }

        // Fallback to root chronicles
        console.log('[ChroniclesDisplay] Unexpected artifact type, falling back to root chronicles');
        return rootChroniclesArtifact;
    }, [latestArtifactId, projectData.artifacts, rootChroniclesArtifact]);

    // Parse chronicles data from the effective artifact
    const chroniclesData = useMemo(() => {
        console.log('[ChroniclesDisplay] Parsing chronicles data...');
        if (!effectiveChroniclesArtifact?.data) {
            console.log('[ChroniclesDisplay] No effective artifact data, returning null');
            return null;
        }

        console.log('[ChroniclesDisplay] Effective artifact details:', {
            id: effectiveChroniclesArtifact.id,
            type: effectiveChroniclesArtifact.type,
            schema_type: effectiveChroniclesArtifact.schema_type,
            dataType: typeof effectiveChroniclesArtifact.data,
            dataLength: effectiveChroniclesArtifact.data?.toString().length
        });

        try {
            let data: any = effectiveChroniclesArtifact.data;
            if (typeof data === 'string') {
                console.log('[ChroniclesDisplay] Data is string, parsing JSON...');
                data = JSON.parse(data);
            }
            console.log('[ChroniclesDisplay] Parsed chronicles data:', {
                hasStages: !!data.stages,
                stagesLength: data.stages?.length || 0,
                dataKeys: Object.keys(data),
                firstStageTitle: data.stages?.[0]?.title || 'N/A'
            });
            return data as ChroniclesOutput;
        } catch (error) {
            console.warn('[ChroniclesDisplay] Failed to parse chronicles data:', error);
            return null;
        }
    }, [effectiveChroniclesArtifact]);

    console.log('[ChroniclesDisplay] Render decision factors:', {
        projectDataLoading: projectData.isLoading,
        lineageLoading,
        lineageError: !!lineageError,
        hasChroniclesData: !!chroniclesData,
        hasStages: !!chroniclesData?.stages,
        stagesLength: chroniclesData?.stages?.length || 0
    });

    if (projectData.isLoading || lineageLoading) {
        console.log('[ChroniclesDisplay] Still loading, returning null');
        return null;
    }

    if (lineageError) {
        console.log('[ChroniclesDisplay] Lineage error, showing error card');
        return (
            <Card style={{ backgroundColor: '#1f1f1f', border: '1px solid #434343' }}>
                <Text type="danger">加载时间顺序大纲时出错: {lineageError.message}</Text>
            </Card>
        );
    }

    if (!chroniclesData || !chroniclesData.stages || chroniclesData.stages.length === 0) {
        console.log('[ChroniclesDisplay] No chronicles data or stages, returning null');
        return null;
    }

    console.log('[ChroniclesDisplay] Rendering chronicles with', chroniclesData.stages.length, 'stages');

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
                        {chroniclesData.stages.map((stage, index) => (
                            <ChronicleStageCard
                                key={`stage-${index}`}
                                chroniclesArtifactId={rootChroniclesArtifact?.id || ''}
                                stagePath={`$.stages[${index}]`}
                                stageIndex={index}
                            />
                        ))}
                    </div>
                </Card>
            </div>
        </SectionWrapper>
    );
}; 