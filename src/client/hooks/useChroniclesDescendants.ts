import { useMemo } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';

interface UseChroniclesDescendantsResult {
    hasChroniclesDescendants: boolean;
    latestChronicles: any | null;
    isLoading: boolean;
}

export const useChroniclesDescendants = (outlineSettingsJsondocId: string): UseChroniclesDescendantsResult => {
    const projectData = useProjectData();

    const result = useMemo((): UseChroniclesDescendantsResult => {
        if (!outlineSettingsJsondocId || !projectData.transformInputs || !projectData.jsondocs) {
            return {
                hasChroniclesDescendants: false,
                latestChronicles: null,
                isLoading: false
            };
        }

        // Get all 故事设定 jsondocs in the lineage chain
        if (!Array.isArray(projectData.jsondocs)) return { hasChroniclesDescendants: false, latestChronicles: null, isLoading: false };
        const allOutlineSettingsJsondocs = projectData.jsondocs.filter((jsondoc) =>
            jsondoc.schema_type === '故事设定' && jsondoc.data
        );

        // Find transforms that use ANY 故事设定 jsondoc as input (lineage-aware)
        if (!Array.isArray(projectData.transformInputs)) return { hasChroniclesDescendants: false, latestChronicles: null, isLoading: false };
        const relatedTransforms = projectData.transformInputs.filter((input) =>
            allOutlineSettingsJsondocs.some((jsondoc) => jsondoc.id === input.jsondoc_id)
        );

        if (relatedTransforms.length === 0) {
            return {
                hasChroniclesDescendants: false,
                latestChronicles: null,
                isLoading: false
            };
        }

        // Find chronicles jsondocs created by these transforms
        if (!Array.isArray(projectData.transformOutputs)) return { hasChroniclesDescendants: false, latestChronicles: null, isLoading: false };
        const chroniclesJsondocs = projectData.jsondocs.filter((jsondoc) =>
            (jsondoc.schema_type === 'chronicles') &&
            relatedTransforms.some((transform) => {
                if (!Array.isArray(projectData.transformOutputs)) return false;
                const outputs = projectData.transformOutputs.filter((output) =>
                    output.transform_id === transform.transform_id
                );
                return outputs.some((output) => output.jsondoc_id === jsondoc.id);
            })
        );

        if (chroniclesJsondocs.length === 0) {
            // console.log(`[useChroniclesDescendants] No chronicles found for 故事设定 jsondoc: ${outlineSettingsJsondocId}`);
            return {
                hasChroniclesDescendants: false,
                latestChronicles: null,
                isLoading: false
            };
        }

        // console.log(`[useChroniclesDescendants] Found ${chroniclesJsondocs.length} chronicles for 故事设定 jsondoc: ${outlineSettingsJsondocId}`);

        // Sort by creation time and get the latest
        const sortedChronicles = [...chroniclesJsondocs].sort((a, b) =>
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
                } else if (data.synopsis_stages && Array.isArray(data.synopsis_stages) && data.synopsis_stages.length > 0) {
                    // Legacy support for old format
                    chroniclesTitle = `时间顺序大纲 (${data.synopsis_stages.length}个阶段)`;
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
    }, [outlineSettingsJsondocId, projectData.transformInputs, projectData.jsondocs, projectData.transformOutputs]);

    return result;
}; 