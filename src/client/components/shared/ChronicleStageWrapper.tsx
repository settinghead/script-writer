import React, { useMemo, useCallback, useState } from 'react';
import { Button, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { YJSArtifactProvider } from '../../transform-artifact-framework/contexts/YJSArtifactContext';
import { ReadOnlyArtifactDisplay } from './ReadOnlyArtifactDisplay';
import { useLineageResolution } from '../../transform-artifact-framework/useLineageResolution';
import { useProjectData } from '../../contexts/ProjectDataContext';

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

    // If not editable, show read-only display with click-to-edit
    if (!isEditable) {
        return (
            <YJSArtifactProvider artifactId={effectiveArtifactId} basePath={basePath}>
                <ReadOnlyChronicleStageDisplay
                    stageIndex={stageIndex}
                    chroniclesArtifactId={chroniclesArtifactId}
                />
            </YJSArtifactProvider>
        );
    }

    // If editable, show editable form
    return (
        <YJSArtifactProvider artifactId={effectiveArtifactId} basePath={basePath}>
            {children || <div>Editable form placeholder</div>}
        </YJSArtifactProvider>
    );
});

// Read-only display component for stages without human transforms
const ReadOnlyChronicleStageDisplay = React.memo(({
    stageIndex,
    chroniclesArtifactId
}: {
    stageIndex: number;
    chroniclesArtifactId: string;
}) => {
    const projectData = useProjectData();
    const [isCreatingTransform, setIsCreatingTransform] = useState(false);

    // Get stage data directly from artifact instead of using YJS for read-only display
    const stageData = useMemo(() => {
        if (!projectData.artifacts || projectData.artifacts === "pending" || projectData.artifacts === "error") {
            return null;
        }

        const artifact = projectData.artifacts.find(a => a.id === chroniclesArtifactId);
        if (!artifact?.data) {
            return null;
        }

        try {
            let data: any = artifact.data;
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }

            if (data.stages && Array.isArray(data.stages) && data.stages[stageIndex]) {
                return data.stages[stageIndex];
            }

            return null;
        } catch (error) {
            console.error('Failed to parse artifact data:', error);
            return null;
        }
    }, [projectData.artifacts, chroniclesArtifactId, stageIndex]);

    // Handle creating human transform to make stage editable
    const handleCreateEditableVersion = useCallback(async () => {
        if (isCreatingTransform) return;

        setIsCreatingTransform(true);

        const stagePath = `$.stages[${stageIndex}]`;

        projectData.createHumanTransform.mutate({
            transformName: 'edit_chronicles_stage',
            sourceArtifactId: chroniclesArtifactId,
            derivationPath: stagePath,
            fieldUpdates: {}
        }, {
            onSuccess: (response: any) => {
                setIsCreatingTransform(false);
                message.success('阶段已进入编辑模式');
            },
            onError: (error: any) => {
                setIsCreatingTransform(false);
                console.error('Failed to create editable stage:', error);
                message.error('创建编辑版本失败');
            }
        });
    }, [isCreatingTransform, stageIndex, chroniclesArtifactId, projectData.createHumanTransform]);

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
        <div
            style={{
                padding: '16px',
                backgroundColor: '#1f1f1f',
                border: '1px solid #434343',
                borderRadius: '8px',
                marginBottom: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative'
            }}
            onClick={handleCreateEditableVersion}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2a2a2a';
                e.currentTarget.style.borderColor = '#1890ff';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1f1f1f';
                e.currentTarget.style.borderColor = '#434343';
            }}
        >
            <div style={{
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid #434343',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h4 style={{ margin: 0, color: '#fff' }}>阶段 {stageIndex + 1}</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                        fontSize: '12px',
                        color: '#666',
                        padding: '2px 8px',
                        backgroundColor: '#333',
                        borderRadius: '4px'
                    }}>
                        只读
                    </span>
                    <Button
                        type="primary"
                        size="small"
                        icon={<EditOutlined />}
                        loading={isCreatingTransform}
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent card click when button is clicked
                            handleCreateEditableVersion();
                        }}
                        style={{ fontSize: '12px' }}
                    >
                        编辑阶段
                    </Button>
                </div>
            </div>
            <ReadOnlyArtifactDisplay
                data={stageData}
                schemaType="chronicle_stage_schema"
            />

            {/* Hover overlay to indicate clickability */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(24, 144, 255, 0.05)',
                borderRadius: '8px',
                opacity: 0,
                transition: 'opacity 0.2s ease',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                color: '#1890ff',
                fontWeight: 'bold'
            }}
                className="hover-overlay"
            >
                点击编辑阶段
            </div>
        </div>
    );
});

ReadOnlyChronicleStageDisplay.displayName = 'ReadOnlyChronicleStageDisplay';
ChronicleStageWrapper.displayName = 'ChronicleStageWrapper';

export default ChronicleStageWrapper; 