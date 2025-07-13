import React, { useMemo } from 'react';
import { Card, Typography, Space } from 'antd';
import { ChroniclesOutput } from '../../common/schemas/outlineSchemas';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useLineageResolution } from '../transform-jsonDoc-framework/useLineageResolution';
import { SectionWrapper, JsonDocDisplayWrapper } from './shared';
import EditableChroniclesForm from './shared/EditableChroniclesForm';

const { Text } = Typography;

interface ChroniclesDisplayProps {
    isEditable?: boolean;
    chroniclesJsonDoc?: any;
}

export const ChroniclesDisplay: React.FC<ChroniclesDisplayProps> = ({
    isEditable: propsIsEditable,
    chroniclesJsonDoc: propsChroniclesJsonDoc
}) => {
    const projectData = useProjectData();

    // If props are provided (from action computation), use them directly
    if (propsChroniclesJsonDoc) {
        const isEditable = propsIsEditable ?? false;
        const effectiveJsonDoc = propsChroniclesJsonDoc;

        return (
            <SectionWrapper
                schemaType={"chronicles"}
                title="时间顺序大纲"
                sectionId="chronicles"
                jsonDocId={effectiveJsonDoc?.id}
            >
                <div style={{ marginTop: '24px' }}>
                    <JsonDocDisplayWrapper
                        jsonDoc={effectiveJsonDoc}
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

    // Fallback: Find chronicles jsonDoc from project data
    const { jsonDocs, isLoading, isError, error } = projectData;

    if (jsonDocs === "pending" || jsonDocs === "error") {
        return null;
    }

    // Find the root chronicles jsonDoc using lineage resolution approach
    const rootChroniclesJsonDoc = useMemo(() => {
        // First try: Look for chronicles
        const chroniclesJsonDocs = jsonDocs.filter(jsonDoc =>
            jsonDoc.schema_type === 'chronicles' &&
            jsonDoc.data
        );



        // Third try: Look for any jsonDoc that might contain chronicles data
        const possibleChroniclesJsonDocs = jsonDocs.filter(jsonDoc => {
            if (!jsonDoc.data) return false;
            try {
                const data = typeof jsonDoc.data === 'string' ? JSON.parse(jsonDoc.data) : jsonDoc.data;
                return data.stages && Array.isArray(data.stages);
            } catch {
                return false;
            }
        });

        // Use the most specific match first
        let candidateJsonDocs = chroniclesJsonDocs;

        if (candidateJsonDocs.length === 0) {
            candidateJsonDocs = possibleChroniclesJsonDocs;
        }

        if (candidateJsonDocs.length === 0) {
            return null;
        }

        // Find the AI-generated jsonDoc (should be the root of the lineage chain)
        const aiGenerated = candidateJsonDocs.find(jsonDoc =>
            jsonDoc.origin_type === 'ai_generated'
        );

        if (aiGenerated) {
            return aiGenerated;
        }

        // Fallback: if no AI-generated found, sort by creation time and get the earliest
        const sorted = [...candidateJsonDocs].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const fallback = sorted[0];
        return fallback;
    }, [jsonDocs, isLoading, isError, error]);

    // Use lineage resolution to get the latest version of the chronicles
    const r = useLineageResolution({
        sourceJsonDocId: rootChroniclesJsonDoc?.id || null,
        path: '$',
        options: { enabled: !!rootChroniclesJsonDoc }
    });

    if (r === "pending" || r === "error") {
        return null;
    }

    const { latestJsonDocId, hasLineage, isLoading: lineageLoading, error: lineageError } = r;

    // Get the effective chronicles jsonDoc
    const effectiveChroniclesJsonDoc = useMemo(() => {
        if (!latestJsonDocId) {
            return null;
        }
        const jsonDoc = jsonDocs.find(a => a.id === latestJsonDocId);

        // Use the latest jsonDoc directly (no more individual stage handling)
        return jsonDoc;
    }, [latestJsonDocId, jsonDocs]);

    // Determine editability for fallback mode
    const isEditable = useMemo(() => {
        if (!effectiveChroniclesJsonDoc) return false;

        // Check if this jsonDoc has descendants (is used as input in any transform)
        if (projectData.transformInputs === "pending" || projectData.transformInputs === "error") {
            return false;
        }

        const transformInputs = Array.isArray(projectData.transformInputs) ? projectData.transformInputs : [];
        const hasDescendants = transformInputs.some((input: any) =>
            input.jsonDoc_id === effectiveChroniclesJsonDoc.id
        );

        // Only editable if it's user_input and has no descendants
        return effectiveChroniclesJsonDoc.origin_type === 'user_input' && !hasDescendants;
    }, [effectiveChroniclesJsonDoc, projectData.transformInputs]);

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

    if (!effectiveChroniclesJsonDoc) {
        return null;
    }

    return (
        <SectionWrapper
            schemaType={"chronicles"}
            title="时间顺序大纲"
            sectionId="chronicles"
            jsonDocId={effectiveChroniclesJsonDoc?.id}
        >
            <div style={{ marginTop: '24px' }}>
                <JsonDocDisplayWrapper
                    jsonDoc={effectiveChroniclesJsonDoc}
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