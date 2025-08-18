import React, { useMemo, useRef } from 'react';
import { Card, Typography, Spin } from 'antd';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useActionItemsStore } from '../stores/actionItemsStore';
import { computeUnifiedWorkflowState } from '../utils/actionComputation';
import ActionItemRenderer from './actions/ActionItemRenderer';
import { AffectedJsondocsPanel } from './AffectedJsondocsPanel';
import { computeStaleJsondocs, DiffChange } from '../../common/staleDetection';
import { findParentJsondocsBySchemaType } from '../../common/transform-jsondoc-framework/lineageResolution';
import type { AffectedJsondoc } from '../../common/staleDetection';
import { PatchApprovalPanel } from './PatchApprovalPanel';
// import { WorkflowSteps } from './WorkflowSteps';

const { Text, Title } = Typography;

interface ActionItemsSectionProps {
    projectId: string;
}

export const ActionItemsSection: React.FC<ActionItemsSectionProps> = ({ projectId }) => {
    const projectData = useProjectData();
    const store = useActionItemsStore(projectId);

    // Use refs to track previous values to prevent unnecessary re-renders
    const prevProjectDataRef = useRef(projectData);
    const prevComputationResultRef = useRef<any>(null);

    // Compute affected jsondocs from recent local updates (async)
    const [affected, setAffected] = React.useState<AffectedJsondoc[]>([]);
    React.useEffect(() => {
        let cancelled = false;
        const handle = setTimeout(async () => {
            try {
                if (!Array.isArray(projectData.jsondocs) || projectData.lineageGraph === 'pending') {
                    if (!cancelled) setAffected([]);
                    return;
                }
                const lineageGraph = projectData.lineageGraph as any;
                const diffs: DiffChange[] = [];
                projectData.localUpdates.forEach((val, key) => {
                    if (key.startsWith('jsondoc-') && val && val.data) {
                        const jsondocId = key.replace('jsondoc-', '');
                        diffs.push({ jsondocId, path: '$', before: null, after: val.data });
                    }
                });
                let results: any[] = [];
                if (diffs.length > 0) {
                    results = await computeStaleJsondocs(diffs, lineageGraph, projectData.jsondocs as any);
                }

                // Heuristic lineage-based detection: if canonical idea exists and outline settings parent idea != canonical idea, mark affected
                try {
                    const canonical = projectData.canonicalContext !== 'pending' && projectData.canonicalContext !== 'error' ? projectData.canonicalContext as any : null;
                    const canonicalIdeaId = canonical?.canonicalBrainstormIdea?.id || null;
                    if (canonicalIdeaId) {
                        const jsondocsArr = projectData.jsondocs as any[];
                        const outlines = jsondocsArr.filter(j => j.schema_type === '剧本设定' && j.origin_type === 'ai_generated');
                        for (const outline of outlines) {
                            const parents = findParentJsondocsBySchemaType(outline.id, '灵感创意', lineageGraph, jsondocsArr);
                            const parentIdeaId = parents && parents.length > 0 ? parents[0].id : null;
                            if (parentIdeaId && parentIdeaId !== canonicalIdeaId) {
                                // Add affected entry if not already
                                const exists = results.some(r => r.jsondocId === outline.id);
                                if (!exists) {
                                    results.push({
                                        jsondocId: outline.id,
                                        schemaType: outline.schema_type,
                                        reason: '上游创意已更新，设定可能需要同步',
                                        affectedPaths: ['$'],
                                        sourceChanges: []
                                    });
                                }
                            }
                        }
                    }
                } catch { }

                if (!cancelled) setAffected(results as any);
            } catch {
                if (!cancelled) setAffected([]);
            }
        }, 500); // debounce 500ms
        return () => { cancelled = true; clearTimeout(handle); };
    }, [projectData.localUpdates, projectData.jsondocs, projectData.lineageGraph, projectData.canonicalContext]);

    // Stable computation with minimal dependencies
    const computationResult = useMemo(() => {
        if (projectData.isLoading) {
            return null;
        }

        if (!Array.isArray(projectData.jsondocs) || !Array.isArray(projectData.transforms)) {
            return null;
        }

        // Check if data has actually changed
        const currentData = {
            jsondocs: projectData.jsondocs,
            transforms: projectData.transforms,
            transformInputs: projectData.transformInputs,
            transformOutputs: projectData.transformOutputs,
            humanTransforms: projectData.humanTransforms
        };

        // Simple deep equality check for arrays
        const dataChanged =
            JSON.stringify(currentData.jsondocs) !== JSON.stringify(prevProjectDataRef.current.jsondocs) ||
            JSON.stringify(currentData.transforms) !== JSON.stringify(prevProjectDataRef.current.transforms) ||
            JSON.stringify(currentData.transformInputs) !== JSON.stringify(prevProjectDataRef.current.transformInputs) ||
            JSON.stringify(currentData.transformOutputs) !== JSON.stringify(prevProjectDataRef.current.transformOutputs) ||
            JSON.stringify(currentData.humanTransforms) !== JSON.stringify(prevProjectDataRef.current.humanTransforms);

        if (!dataChanged && prevComputationResultRef.current) {
            return prevComputationResultRef.current;
        }

        const result = computeUnifiedWorkflowState(projectData, projectId);

        prevProjectDataRef.current = projectData;
        prevComputationResultRef.current = result;

        return result;
    }, [
        projectData.isLoading,
        projectData.jsondocs?.length,
        projectData.transforms?.length,
        projectData.transformInputs?.length,
        projectData.transformOutputs?.length,
        projectData.humanTransforms?.length,
        // Add transform statuses to trigger recomputation when status changes
        Array.isArray(projectData.transforms) ? projectData.transforms.map(t => t.status).join(',') : ''
    ]);

    if (projectData.isLoading || !computationResult) {
        return (
            <Card
                style={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #434343',
                    marginTop: '24px'
                }}
            >
                <div style={{ textAlign: 'center', padding: '24px' }}>
                    <Spin size="large" />
                    <div style={{ marginTop: '16px' }}>
                        <Text type="secondary">分析项目状态...</Text>
                    </div>
                </div>
            </Card>
        );
    }

    const { steps, displayComponents, actions, parameters } = computationResult;

    // Check for active transforms
    const hasActiveTransforms = Array.isArray(projectData.transforms) &&
        projectData.transforms.some((t: any) => t.status === 'running' || t.status === 'pending');



    return (



        <div
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '24px',
                width: '100%',
                padding: '36px 32px',
                background: 'linear-gradient(145deg, #232323 60%, #181818 100%)',
                borderRadius: '12px',
                boxShadow:
                    '0 12px 36px 0 rgba(0,0,0,0.60), 0 4px 16px 0 rgba(80,80,80,0.22), 0 2px 8px 0 rgba(255,255,255,0.06) inset',
                border: '2.5px solid #232323',
                transition: 'box-shadow 0.2s cubic-bezier(.4,2,.6,1)'
            }}
        >
            {/* Actions on the right */}
            {actions.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", width: "100%", justifyContent: "center", gap: 12 }}>
                    {/* Compact affected tile placed alongside actions */}
                    <div style={{ alignSelf: 'flex-start' }}>
                        <AffectedJsondocsPanel projectId={projectId} affected={affected as any} compact />
                    </div>
                    {actions.map((action: any, index: number) => (
                        <div key={`${action.type}-${index}`}>
                            <ActionItemRenderer
                                action={action}
                                projectId={projectId}
                                hasActiveTransforms={hasActiveTransforms}
                                onSuccess={() => {}}
                                onError={(error: Error) => {
                                    console.error('❌ Action failed:', action.type, error);
                                }}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ display: "flex", flexWrap: "wrap", width: "100%", justifyContent: "center", padding: '24px', color: '#666', gap: 8 }}>
                    {hasActiveTransforms ? (
                        <>
                            <Spin size="small" />
                            <Text type="secondary">生成中(完成后可编辑)...</Text>
                        </>
                    ) : (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <AffectedJsondocsPanel projectId={projectId} affected={affected as any} compact />
                            <PatchApprovalPanel projectId={projectId} />
                            <Text type="secondary">已生成，暂无可执行操作</Text>
                        </div>
                    )}
                </div>
            )}
        </div>


    );
}; 