import React, { useMemo } from 'react';
import { ChronicleStageWrapper } from './shared';
import { canBecomeEditable } from '../utils/actionComputation';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useLineageResolution } from '../transform-artifact-framework/useLineageResolution';

interface ChronicleStageCardProps {
    chroniclesArtifactId: string;
    stagePath: string; // JSONPath like "$.stages[0]"
    stageIndex: number; // For display purposes only
}

/**
 * Chronicle Stage Card component using the new atomic component architecture
 * This component now uses the generic ChronicleStageWrapper instead of custom logic
 */
export const ChronicleStageCard: React.FC<ChronicleStageCardProps> = ({
    chroniclesArtifactId,
    stagePath,
    stageIndex
}) => {
    const { transformInputs, getArtifactById } = useProjectData();

    // Use lineage resolution to find the latest artifact for this specific stage path
    const resolutionResult = useLineageResolution({
        sourceArtifactId: chroniclesArtifactId,
        path: stagePath,
        options: { enabled: !!chroniclesArtifactId }
    });

    if (resolutionResult === "pending" || resolutionResult === "error") {
        return null;
    }

    const { latestArtifactId, hasLineage } = resolutionResult;

    // Get the effective artifact (either original or edited version)
    const effectiveArtifact = useMemo(() => {
        if (!latestArtifactId) return null;

        if (hasLineage) {
            // If we have lineage, use the resolved artifact (individual stage)
            const resolvedArtifact = getArtifactById(latestArtifactId);
            return resolvedArtifact;
        } else {
            // If no lineage, extract the stage data from the parent chronicles artifact
            const parentArtifact = getArtifactById(chroniclesArtifactId);
            if (!parentArtifact?.data) return null;

            try {
                const chroniclesData = typeof parentArtifact.data === 'string'
                    ? JSON.parse(parentArtifact.data)
                    : parentArtifact.data;

                if (!chroniclesData?.stages || !Array.isArray(chroniclesData.stages)) {
                    return null;
                }

                const stageData = chroniclesData.stages[stageIndex];
                if (!stageData) return null;

                // Create a virtual artifact for the stage data
                return {
                    id: `${chroniclesArtifactId}-stage-${stageIndex}`,
                    data: JSON.stringify(stageData),
                    schema_type: 'chronicle_stage_schema',
                    origin_type: 'ai_generated',
                    project_id: parentArtifact.project_id,
                    created_at: parentArtifact.created_at,
                    updated_at: parentArtifact.updated_at
                };
            } catch (error) {
                console.error('Error extracting stage data:', error);
                return null;
            }
        }
    }, [latestArtifactId, hasLineage, chroniclesArtifactId, stageIndex, getArtifactById]);

    if (!effectiveArtifact) {
        return null;
    }

    // Determine if this stage is editable
    const isEditable = useMemo(() => {
        if (transformInputs === "pending" || transformInputs === "error") {
            return false;
        }

        // If we have lineage (hasLineage = true), it means this stage has been edited
        // and we should check if the derived artifact is editable
        if (hasLineage) {
            // For user_input artifacts that are individual stages, check if they're leaf nodes
            const isUserInput = effectiveArtifact.origin_type === 'user_input';
            const isStageArtifact = effectiveArtifact.schema_type === 'chronicle_stage_schema';
            const hasDescendants = transformInputs.some(input =>
                input.artifact_id === effectiveArtifact.id
            );

            return isUserInput && isStageArtifact && !hasDescendants;
        }

        return false;
    }, [effectiveArtifact, transformInputs, hasLineage]);

    // Check if this stage can become editable (for click-to-edit)
    const canBecomeEditableStage = useMemo(() => {
        if (transformInputs === "pending" || transformInputs === "error") {
            return false;
        }

        // If we don't have lineage, this stage path hasn't been edited yet
        // and can potentially become editable
        if (!hasLineage) {
            return true;
        }

        // If we have lineage but it's not editable, it might be because
        // the derived artifact has descendants
        return false;
    }, [transformInputs, hasLineage]);

    return (
        <ChronicleStageWrapper
            artifact={effectiveArtifact}
            isEditable={isEditable}
            canBecomeEditable={canBecomeEditableStage}
            chroniclesArtifactId={chroniclesArtifactId}
            stagePath={stagePath}
            stageIndex={stageIndex}
        />
    );
}; 