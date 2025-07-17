import React, { useMemo } from 'react';
import { Card, Typography, Space, Spin, Alert } from 'antd';
import { EpisodePlanningOutput } from '../../common/schemas/outlineSchemas';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useLineageResolution } from '../transform-jsondoc-framework/useLineageResolution';
import { SectionWrapper, JsondocDisplayWrapper } from './shared';
import { EditableEpisodePlanningForm } from './shared';

const { Text } = Typography;

interface EpisodePlanningDisplayProps {
    isEditable?: boolean;
    episodePlanningJsondoc?: any;
}

export const EpisodePlanningDisplay: React.FC<EpisodePlanningDisplayProps> = ({
    isEditable: propsIsEditable,
    episodePlanningJsondoc: propsEpisodePlanningJsondoc
}) => {
    const projectData = useProjectData();

    // If props are provided (from action computation), use them directly
    if (propsEpisodePlanningJsondoc) {
        const isEditable = propsIsEditable ?? false;
        const effectiveJsondoc = propsEpisodePlanningJsondoc;

        return (
            <SectionWrapper
                schemaType={"episode_planning"}
                title="剧集框架"
                sectionId="episode-planning"
                jsondocId={effectiveJsondoc?.id}
            >
                <div style={{ marginTop: '24px' }}>
                    <JsondocDisplayWrapper
                        jsondoc={effectiveJsondoc}
                        isEditable={isEditable}
                        title="剧集框架"
                        icon="🎬"
                        editableComponent={EditableEpisodePlanningForm}
                        schemaType="episode_planning"
                        enableClickToEdit={true}
                    />
                </div>
            </SectionWrapper>
        );
    }

    // Fallback: Find episode planning jsondoc from project data
    const { jsondocs, isLoading, isError, error } = projectData;

    if (jsondocs === "pending" || jsondocs === "error") {
        return null;
    }

    // Find the root episode planning jsondoc using lineage resolution approach
    const rootEpisodePlanningJsondoc = useMemo(() => {
        // First try: Look for episode_planning
        const episodePlanningJsondocs = jsondocs.filter(jsondoc =>
            jsondoc.schema_type === 'episode_planning' &&
            jsondoc.data
        );

        // Third try: Look for any jsondoc that might contain episode planning data
        const possibleEpisodePlanningJsondocs = jsondocs.filter(jsondoc => {
            if (!jsondoc.data) return false;
            try {
                const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
                return data.totalEpisodes && Array.isArray(data.episodeGroups);
            } catch {
                return false;
            }
        });

        // Use the most specific match first
        let candidateJsondocs = episodePlanningJsondocs;

        if (candidateJsondocs.length === 0) {
            candidateJsondocs = possibleEpisodePlanningJsondocs;
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

    // Use lineage resolution to get the latest version of the episode planning
    const r = useLineageResolution({
        sourceJsondocId: rootEpisodePlanningJsondoc?.id || null,
        path: '$',
        options: { enabled: !!rootEpisodePlanningJsondoc }
    });

    const effectiveJsondoc = useMemo(() => {
        if (typeof r !== 'string' && r && 'latestJsondocId' in r && r.latestJsondocId && jsondocs && Array.isArray(jsondocs)) {
            const resolved = jsondocs.find(jsondoc => jsondoc.id === r.latestJsondocId);
            if (resolved) {
                return resolved;
            }
        }
        return rootEpisodePlanningJsondoc;
    }, [r, jsondocs, rootEpisodePlanningJsondoc]);

    // Determine if editable
    const isEditable = useMemo(() => {
        if (!effectiveJsondoc) return false;

        // Only user_input jsondocs can be edited
        return effectiveJsondoc.origin_type === 'user_input';
    }, [effectiveJsondoc]);

    if (isLoading || (typeof r !== 'string' && r && 'isLoading' in r && r.isLoading)) {
        return (
            <Spin spinning={true}>
                <div style={{ minHeight: '200px' }}>Loading episode planning...</div>
            </Spin>
        );
    }

    if (isError || error || (typeof r !== 'string' && r && 'error' in r && r.error)) {
        const errorMessage = error?.message || (typeof r !== 'string' && r && 'error' in r && r.error ? r.error.message : 'Unknown error');
        console.error('Error loading episode planning:', error || (typeof r !== 'string' && r && 'error' in r ? r.error : null));
        return (
            <Alert
                type="error"
                message={errorMessage}
                showIcon
            />
        );
    }

    if (!effectiveJsondoc) {
        return (
            <Alert
                type="info"
                message="暂无剧集框架数据"
                showIcon
            />
        );
    }

    return (
        <SectionWrapper
            schemaType={"episode_planning"}
            title="剧集框架"
            sectionId="episode-planning"
            jsondocId={effectiveJsondoc?.id}
        >
            <div style={{ marginTop: '24px' }}>
                <JsondocDisplayWrapper
                    jsondoc={effectiveJsondoc}
                    isEditable={isEditable}
                    title="剧集框架"
                    icon="🎬"
                    editableComponent={EditableEpisodePlanningForm}
                    schemaType="episode_planning"
                    enableClickToEdit={true}
                />
            </div>
        </SectionWrapper>
    );
}; 