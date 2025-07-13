import React, { useMemo } from 'react';
import { Card, Typography, Space } from 'antd';
import { ChroniclesOutput } from '../../common/schemas/outlineSchemas';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useLineageResolution } from '../transform-jsondoc-framework/useLineageResolution';
import { SectionWrapper, JsondocDisplayWrapper } from './shared';
import EditableChroniclesForm from './shared/EditableChroniclesForm';

const { Text } = Typography;

interface ChroniclesDisplayProps {
    isEditable?: boolean;
    chroniclesJsondoc?: any;
}

export const ChroniclesDisplay: React.FC<ChroniclesDisplayProps> = ({
    isEditable: propsIsEditable,
    chroniclesJsondoc: propsChroniclesJsondoc
}) => {
    const projectData = useProjectData();

    // If props are provided (from action computation), use them directly
    if (propsChroniclesJsondoc) {
        const isEditable = propsIsEditable ?? false;
        const effectiveJsondoc = propsChroniclesJsondoc;

        return (
            <SectionWrapper
                schemaType={"chronicles"}
                title="时间顺序大纲"
                sectionId="chronicles"
                jsondocId={effectiveJsondoc?.id}
            >
                <div style={{ marginTop: '24px' }}>
                    <JsondocDisplayWrapper
                        jsondoc={effectiveJsondoc}
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

    // Fallback: Find chronicles jsondoc from project data
    const { jsondocs, isLoading, isError, error } = projectData;

    if (jsondocs === "pending" || jsondocs === "error") {
        return null;
    }

    // Find the root chronicles jsondoc using lineage resolution approach
    const rootChroniclesJsondoc = useMemo(() => {
        // First try: Look for chronicles
        const chroniclesJsondocs = jsondocs.filter(jsondoc =>
            jsondoc.schema_type === 'chronicles' &&
            jsondoc.data
        );



        // Third try: Look for any jsondoc that might contain chronicles data
        const possibleChroniclesJsondocs = jsondocs.filter(jsondoc => {
            if (!jsondoc.data) return false;
            try {
                const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
                return data.stages && Array.isArray(data.stages);
            } catch {
                return false;
            }
        });

        // Use the most specific match first
        let candidateJsondocs = chroniclesJsondocs;

        if (candidateJsondocs.length === 0) {
            candidateJsondocs = possibleChroniclesJsondocs;
        }

        if (candidateJsondocs.length === 0) {
            return null;
        }

        // Find the AI-generated jsondoc (should be the root of the lineage chain)
        const aiGenerated = candidateJsondocs.find(jsondoc =>
            jsondoc.origin_type === 'ai_generated'
        );

        if (aiGenerated) {
            return aiGenerated;
        }

        // Fallback: if no AI-generated found, sort by creation time and get the earliest
        const sorted = [...candidateJsondocs].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const fallback = sorted[0];
        return fallback;
    }, [jsondocs, isLoading, isError, error]);

    // Use lineage resolution to get the latest version of the chronicles
    const r = useLineageResolution({
        sourceJsondocId: rootChroniclesJsondoc?.id || null,
        path: '$',
        options: { enabled: !!rootChroniclesJsondoc }
    });

    if (r === "pending" || r === "error") {
        return null;
    }

    const { latestJsondocId, hasLineage, isLoading: lineageLoading, error: lineageError } = r;

    // Get the effective chronicles jsondoc
    const effectiveChroniclesJsondoc = useMemo(() => {
        if (!latestJsondocId) {
            return null;
        }
        const jsondoc = jsondocs.find(a => a.id === latestJsondocId);

        // Use the latest jsondoc directly (no more individual stage handling)
        return jsondoc;
    }, [latestJsondocId, jsondocs]);

    // Determine editability for fallback mode
    const isEditable = useMemo(() => {
        if (!effectiveChroniclesJsondoc) return false;

        // Check if this jsondoc has descendants (is used as input in any transform)
        if (projectData.transformInputs === "pending" || projectData.transformInputs === "error") {
            return false;
        }

        const transformInputs = Array.isArray(projectData.transformInputs) ? projectData.transformInputs : [];
        const hasDescendants = transformInputs.some((input: any) =>
            input.jsondoc_id === effectiveChroniclesJsondoc.id
        );

        // Only editable if it's user_input and has no descendants
        return effectiveChroniclesJsondoc.origin_type === 'user_input' && !hasDescendants;
    }, [effectiveChroniclesJsondoc, projectData.transformInputs]);

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

    if (!effectiveChroniclesJsondoc) {
        return null;
    }

    return (
        <SectionWrapper
            schemaType={"chronicles"}
            title="时间顺序大纲"
            sectionId="chronicles"
            jsondocId={effectiveChroniclesJsondoc?.id}
        >
            <div style={{ marginTop: '24px' }}>
                <JsondocDisplayWrapper
                    jsondoc={effectiveChroniclesJsondoc}
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