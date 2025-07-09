import React, { useMemo, useCallback, useState } from 'react';
import { message } from 'antd';
import { ArtifactDisplayWrapper } from './ArtifactDisplayWrapper';
import { EditableChronicleStageForm } from './EditableChronicleStageForm';
import { useCharactersFromLineage, useStageOverride } from '../../transform-artifact-framework/useLineageResolution';
import { useProjectData } from '../../contexts/ProjectDataContext';

interface ChronicleStageWrapperProps {
    artifact?: any;
    isEditable?: boolean;
    canBecomeEditable?: boolean;
    chroniclesArtifactId: string;
    stagePath?: string;
    stageIndex: number;
}

/**
 * Wrapper component that provides character resolution for chronicle stages
 * and uses the generic ArtifactDisplayWrapper
 */
export const ChronicleStageWrapper: React.FC<ChronicleStageWrapperProps> = React.memo(({
    artifact,
    isEditable = false,
    canBecomeEditable = false,
    chroniclesArtifactId,
    stagePath,
    stageIndex
}) => {

    const projectData = useProjectData();
    const [isCreatingTransform, setIsCreatingTransform] = useState(false);

    // Extract available characters from lineage graph
    const { characters: availableCharacters } = useCharactersFromLineage(chroniclesArtifactId);

    // Check if this stage has a human transform override
    const { hasOverride, overrideArtifactId } = useStageOverride(chroniclesArtifactId, stagePath || null);

    // Determine which artifact to use:
    // - If there's an override, use the override artifact
    // - Otherwise, use the chronicles artifact (parent context)
    const effectiveArtifactId = hasOverride && overrideArtifactId ? overrideArtifactId : chroniclesArtifactId;
    const effectiveArtifact = projectData.getArtifactById(effectiveArtifactId);



    // Handle click-to-edit functionality
    const handleClickToEdit = useCallback(async () => {
        if (!canBecomeEditable || !stagePath) {
            return;
        }

        setIsCreatingTransform(true);

        try {
            // Create a human transform for this specific stage path
            await projectData.createHumanTransform.mutateAsync({
                transformName: 'edit_chronicles_stage',
                sourceArtifactId: chroniclesArtifactId,
                derivationPath: stagePath,
                fieldUpdates: {}
            });

            message.success('阶段已开始编辑');
        } catch (error: any) {
            message.error(`创建编辑失败: ${error.message}`);
        } finally {
            setIsCreatingTransform(false);
        }
    }, [canBecomeEditable, stagePath, chroniclesArtifactId, projectData.createHumanTransform]);

    // Create a wrapper component that passes the characters to the editable form
    const EditableFormWithCharacters = useMemo(() => {
        return () => (
            <EditableChronicleStageForm
                availableCharacters={availableCharacters}
            />
        );
    }, [availableCharacters]);

    return (
        <ArtifactDisplayWrapper
            artifact={effectiveArtifact || artifact}
            isEditable={hasOverride ? true : isEditable}
            title={`第 ${stageIndex + 1} 阶段`}
            icon="⏰"
            editableComponent={EditableFormWithCharacters}
            schemaType="chronicle_stage_schema"
            enableClickToEdit={canBecomeEditable && !hasOverride}
            onClickToEdit={handleClickToEdit}
            clickToEditLoading={isCreatingTransform}
            // NEW: Hierarchical context support
            parentArtifactId={hasOverride ? undefined : chroniclesArtifactId}
            artifactPath={hasOverride ? undefined : stagePath}
        />
    );
}); 