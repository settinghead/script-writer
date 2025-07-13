import { useMemo } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';
import { TypedJsonDoc } from '@/common/types';

interface UseChroniclesDescendantsResult {
    hasChroniclesDescendants: boolean;
    latestChronicles: any | null;
    isLoading: boolean;
}

export const useChroniclesDescendants = (outlineSettingsJsonDocId: string): UseChroniclesDescendantsResult => {
    const projectData = useProjectData();

    const result = useMemo((): UseChroniclesDescendantsResult => {
        if (!outlineSettingsJsonDocId || !projectData.transformInputs || !projectData.jsonDocs) {
            return {
                hasChroniclesDescendants: false,
                latestChronicles: null,
                isLoading: false
            };
        }

        // Get all outline settings jsonDocs in the lineage chain
        if (!Array.isArray(projectData.jsonDocs)) return { hasChroniclesDescendants: false, latestChronicles: null, isLoading: false };
        const allOutlineSettingsJsonDocs = projectData.jsonDocs.filter((jsonDoc) =>
            jsonDoc.schema_type === 'outline_settings' && jsonDoc.data
        );

        // Find transforms that use ANY outline settings jsonDoc as input (lineage-aware)
        if (!Array.isArray(projectData.transformInputs)) return { hasChroniclesDescendants: false, latestChronicles: null, isLoading: false };
        const relatedTransforms = projectData.transformInputs.filter((input) =>
            allOutlineSettingsJsonDocs.some((jsonDoc) => jsonDoc.id === input.jsonDoc_id)
        );

        if (relatedTransforms.length === 0) {
            return {
                hasChroniclesDescendants: false,
                latestChronicles: null,
                isLoading: false
            };
        }

        // Find chronicles jsonDocs created by these transforms
        if (!Array.isArray(projectData.transformOutputs)) return { hasChroniclesDescendants: false, latestChronicles: null, isLoading: false };
        const chroniclesJsonDocs = projectData.jsonDocs.filter((jsonDoc) =>
            (jsonDoc.schema_type === 'chronicles') &&
            relatedTransforms.some((transform) => {
                if (!Array.isArray(projectData.transformOutputs)) return false;
                const outputs = projectData.transformOutputs.filter((output) =>
                    output.transform_id === transform.transform_id
                );
                return outputs.some((output) => output.jsonDoc_id === jsonDoc.id);
            })
        );

        if (chroniclesJsonDocs.length === 0) {
            // console.log(`[useChroniclesDescendants] No chronicles found for outline settings jsonDoc: ${outlineSettingsJsonDocId}`);
            return {
                hasChroniclesDescendants: false,
                latestChronicles: null,
                isLoading: false
            };
        }

        // console.log(`[useChroniclesDescendants] Found ${chroniclesJsonDocs.length} chronicles for outline settings jsonDoc: ${outlineSettingsJsonDocId}`);

        // Sort by creation time and get the latest
        const sortedChronicles = [...chroniclesJsonDocs].sort((a, b) =>
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
    }, [outlineSettingsJsonDocId, projectData.transformInputs, projectData.jsonDocs, projectData.transformOutputs]);

    return result;
}; 