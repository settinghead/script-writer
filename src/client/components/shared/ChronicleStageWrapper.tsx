import React, { useMemo } from 'react';
import { YJSArtifactProvider, useYJSField } from '../../contexts/YJSArtifactContext';
import EditableChronicleStageForm from './EditableChronicleStageForm';
import { ReadOnlyArtifactDisplay } from './ReadOnlyArtifactDisplay';
import { useLineageResolution } from '../../transform-artifact-framework/useLineageResolution';

interface ChronicleStageWrapperProps {
    chroniclesArtifactId: string;
    stageIndex: number;
    overrideArtifactId?: string;
    children?: React.ReactNode;
}

export const ChronicleStageWrapper = React.memo(({
    chroniclesArtifactId,
    stageIndex,
    overrideArtifactId,
    children
}: ChronicleStageWrapperProps) => {
    // Use lineage resolution to determine if this stage has human transforms
    const stagePath = `$.stages[${stageIndex}]`;
    const lineageResult = useLineageResolution({
        sourceArtifactId: chroniclesArtifactId,
        path: stagePath,
        options: { enabled: !!chroniclesArtifactId }
    });

    // Determine if this stage should be editable
    const { isEditable, effectiveArtifactId, basePath } = useMemo(() => {
        // If override is provided, use it
        if (overrideArtifactId) {
            return {
                isEditable: true,
                effectiveArtifactId: overrideArtifactId,
                basePath: undefined
            };
        }

        // If lineage resolution is pending or error, default to read-only
        if (lineageResult === "pending" || lineageResult === "error") {
            return {
                isEditable: false,
                effectiveArtifactId: chroniclesArtifactId,
                basePath: `stages[${stageIndex}]`
            };
        }

        const { latestArtifactId, hasLineage } = lineageResult;

        // If there's lineage (human transforms), it's editable
        if (hasLineage && latestArtifactId) {
            return {
                isEditable: true,
                effectiveArtifactId: latestArtifactId,
                basePath: undefined // Use the derived artifact directly
            };
        }

        // No lineage means read-only
        return {
            isEditable: false,
            effectiveArtifactId: chroniclesArtifactId,
            basePath: `stages[${stageIndex}]`
        };
    }, [overrideArtifactId, lineageResult, chroniclesArtifactId, stageIndex]);

    // If not editable, show read-only display
    if (!isEditable) {
        return (
            <YJSArtifactProvider artifactId={effectiveArtifactId} basePath={basePath}>
                <ReadOnlyChronicleStageDisplay stageIndex={stageIndex} />
            </YJSArtifactProvider>
        );
    }

    // If editable, show editable form
    return (
        <YJSArtifactProvider artifactId={effectiveArtifactId} basePath={basePath}>
            {children || <EditableChronicleStageForm stageIndex={stageIndex} />}
        </YJSArtifactProvider>
    );
});

// Read-only display component for stages without human transforms
const ReadOnlyChronicleStageDisplay = React.memo(({ stageIndex }: { stageIndex: number }) => {
    const { value: stageData } = useYJSField('');

    if (!stageData) {
        return (
            <div style={{
                padding: '16px',
                backgroundColor: '#1f1f1f',
                border: '1px solid #434343',
                borderRadius: '8px',
                marginBottom: '16px'
            }}>
                <div style={{ color: '#666', fontStyle: 'italic' }}>
                    阶段 {stageIndex + 1} - 数据加载中...
                </div>
            </div>
        );
    }

    return (
        <div style={{
            padding: '16px',
            backgroundColor: '#1f1f1f',
            border: '1px solid #434343',
            borderRadius: '8px',
            marginBottom: '16px'
        }}>
            <div style={{
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid #434343',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h4 style={{ margin: 0, color: '#fff' }}>阶段 {stageIndex + 1}</h4>
                <span style={{
                    fontSize: '12px',
                    color: '#666',
                    padding: '2px 8px',
                    backgroundColor: '#333',
                    borderRadius: '4px'
                }}>
                    只读
                </span>
            </div>
            <ReadOnlyArtifactDisplay
                data={stageData}
                schemaType="chronicle_stage_schema"
            />
        </div>
    );
});

ReadOnlyChronicleStageDisplay.displayName = 'ReadOnlyChronicleStageDisplay';
ChronicleStageWrapper.displayName = 'ChronicleStageWrapper';

export default ChronicleStageWrapper; 