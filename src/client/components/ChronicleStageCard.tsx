import React from 'react';
import ChronicleStageWrapper from './shared/ChronicleStageWrapper';

interface ChronicleStageCardProps {
    chroniclesArtifactId: string;
    stagePath: string; // JSONPath like "$.stages[0]"
    stageIndex: number; // For display purposes only
    overrideArtifactId?: string; // Optional override artifact ID
}

/**
 * Chronicle Stage Card component using the new subscription-based YJS approach
 */
export const ChronicleStageCard: React.FC<ChronicleStageCardProps> = ({
    chroniclesArtifactId,
    stagePath,
    stageIndex,
    overrideArtifactId
}) => {
    return (
        <ChronicleStageWrapper
            chroniclesArtifactId={chroniclesArtifactId}
            stageIndex={stageIndex}
            overrideArtifactId={overrideArtifactId}
        />
    );
}; 