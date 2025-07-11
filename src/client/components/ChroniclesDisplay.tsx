import React, { useMemo } from 'react';
import { Card, Typography, Space } from 'antd';
import { ChroniclesOutput } from '../../common/schemas/outlineSchemas';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useLineageResolution } from '../transform-artifact-framework/useLineageResolution';
import { SectionWrapper, ArtifactSchemaType, ArtifactDisplayWrapper } from './shared';
import EditableChroniclesForm from './shared/EditableChroniclesForm';

const { Text } = Typography;

interface ChroniclesDisplayProps {
    isEditable?: boolean;
    chroniclesArtifact?: any;
}

export const ChroniclesDisplay: React.FC<ChroniclesDisplayProps> = ({
    isEditable: propsIsEditable,
    chroniclesArtifact: propsChroniclesArtifact
}) => {
    const projectData = useProjectData();

    // If props are provided (from action computation), use them directly
    if (propsChroniclesArtifact) {
        const isEditable = propsIsEditable ?? false;
        const effectiveArtifact = propsChroniclesArtifact;

        return (
            <SectionWrapper
                schemaType={ArtifactSchemaType.CHRONICLES}
                title="时间顺序大纲"
                sectionId="chronicles"
                artifactId={effectiveArtifact?.id}
            >
                <div style={{ marginTop: '24px' }}>
                    <ArtifactDisplayWrapper
                        artifact={effectiveArtifact}
                        isEditable={isEditable}
                        title="时间顺序大纲"
                        icon="📅"
                        editableComponent={EditableChroniclesForm}
                        schemaType="chronicles"
                        enableClickToEdit={true}
                    />
                </div>
            </SectionWrapper>
        );
    }

    // Fallback: Find chronicles artifact from project data
    const { artifacts, isLoading, isError, error } = projectData;

    if (artifacts === "pending" || artifacts === "error") {
        return null;
    }

    // Find the root chronicles artifact using lineage resolution approach
    const rootChroniclesArtifact = useMemo(() => {
        // First try: Look for chronicles
        const chroniclesArtifacts = artifacts.filter(artifact =>
            artifact.schema_type === 'chronicles' &&
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

        // Use the latest artifact directly (no more individual stage handling)
        return artifact;
    }, [latestArtifactId, artifacts]);

    // Determine editability for fallback mode
    const isEditable = useMemo(() => {
        if (!effectiveChroniclesArtifact) return false;

        // Check if this artifact has descendants (is used as input in any transform)
        if (projectData.transformInputs === "pending" || projectData.transformInputs === "error") {
            return false;
        }

        const transformInputs = Array.isArray(projectData.transformInputs) ? projectData.transformInputs : [];
        const hasDescendants = transformInputs.some((input: any) =>
            input.artifact_id === effectiveChroniclesArtifact.id
        );

        // Only editable if it's user_input and has no descendants
        return effectiveChroniclesArtifact.origin_type === 'user_input' && !hasDescendants;
    }, [effectiveChroniclesArtifact, projectData.transformInputs]);

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

    if (!effectiveChroniclesArtifact) {
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
                <ArtifactDisplayWrapper
                    artifact={effectiveChroniclesArtifact}
                    isEditable={isEditable}
                    title="时间顺序大纲"
                    icon="📅"
                    editableComponent={EditableChroniclesForm}
                    schemaType="chronicles"
                    enableClickToEdit={true}
                />
            </div>
        </SectionWrapper>
    );
}; 