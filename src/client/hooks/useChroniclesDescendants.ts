import { useMemo } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';

interface UseChroniclesDescendantsResult {
    hasChroniclesDescendants: boolean;
    latestChronicles: any | null;
    isLoading: boolean;
}

export const useChroniclesDescendants = (outlineSettingsArtifactId: string): UseChroniclesDescendantsResult => {
    const projectData = useProjectData();

    const result = useMemo((): UseChroniclesDescendantsResult => {
        if (!outlineSettingsArtifactId || !projectData.transformInputs || !projectData.artifacts) {
            return {
                hasChroniclesDescendants: false,
                latestChronicles: null,
                isLoading: false
            };
        }

        // Get all outline settings artifacts in the lineage chain
        const allOutlineSettingsArtifacts = projectData.artifacts.filter(artifact =>
            artifact.schema_type === 'outline_settings_schema' && artifact.data
        );

        // Find transforms that use ANY outline settings artifact as input (lineage-aware)
        const relatedTransforms = projectData.transformInputs.filter(input =>
            allOutlineSettingsArtifacts.some(artifact => artifact.id === input.artifact_id)
        );

        if (relatedTransforms.length === 0) {
            return {
                hasChroniclesDescendants: false,
                latestChronicles: null,
                isLoading: false
            };
        }

        // Find chronicles artifacts created by these transforms
        const chroniclesArtifacts = projectData.artifacts.filter(artifact =>
            (artifact.schema_type === 'chronicles_schema' || artifact.type === 'chronicles') &&
            relatedTransforms.some(transform => {
                const outputs = projectData.transformOutputs.filter(output =>
                    output.transform_id === transform.transform_id
                );
                return outputs.some(output => output.artifact_id === artifact.id);
            })
        );

        if (chroniclesArtifacts.length === 0) {
            console.log(`[useChroniclesDescendants] No chronicles found for outline settings artifact: ${outlineSettingsArtifactId}`);
            return {
                hasChroniclesDescendants: false,
                latestChronicles: null,
                isLoading: false
            };
        }

        console.log(`[useChroniclesDescendants] Found ${chroniclesArtifacts.length} chronicles for outline settings artifact: ${outlineSettingsArtifactId}`);

        // Sort by creation time and get the latest
        const sortedChronicles = [...chroniclesArtifacts].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        const latestChronicles = sortedChronicles[0];

        // Try to extract title from chronicles data
        let chroniclesTitle = '时间顺序大纲';
        try {
            if (latestChronicles.data && typeof latestChronicles.data === 'object') {
                const data = latestChronicles.data as any;
                if (data.stages && Array.isArray(data.stages) && data.stages.length > 0) {
                    chroniclesTitle = `时间顺序大纲 (${data.stages.length}个阶段)`;
                }
            }
        } catch (error) {
            console.warn('Failed to extract chronicles title:', error);
        }

        return {
            hasChroniclesDescendants: true,
            latestChronicles: {
                ...latestChronicles,
                title: chroniclesTitle
            },
            isLoading: false
        };
    }, [outlineSettingsArtifactId, projectData.transformInputs, projectData.artifacts, projectData.transformOutputs]);

    return result;
}; 