import { describe, it, expect, vi } from 'vitest';
import {
    computeWorkflowParameters,
    computeUnifiedWorkflowState
} from '../actionComputation';
import { ProjectDataContextType, TypedJsondoc } from '../../../common/types';
import { LineageGraph } from '../../../common/transform-jsondoc-framework/lineageResolution';

// Mock the lineage-based computation
vi.mock('../lineageBasedActionComputation', () => ({
    computeActionsFromLineage: vi.fn((lineageGraph, jsondocs: TypedJsondoc[]) => {
        // Determine current stage based on jsondocs and lineage graph
        let currentStage = 'initial';

        if (jsondocs && Array.isArray(jsondocs)) {
            const hasBrainstormInput = jsondocs.some(a =>
                a.schema_type === 'brainstorm_input_params'
            );
            const hasBrainstormIdeas = jsondocs.some(a =>
                a.schema_type === 'brainstorm_idea'
            );
            const hasOutlineSettings = jsondocs.some(a =>
                a.schema_type === 'outline_settings'
            );
            const hasChronicles = jsondocs.some(a =>
                a.schema_type === 'chronicles'
            );

            // Determine stage based on most advanced jsondoc type present
            if (hasChronicles) {
                currentStage = 'chronicles_generation';
            } else if (hasOutlineSettings) {
                currentStage = 'outline_generation';
            } else if (hasBrainstormIdeas) {
                // Check if we have a leaf brainstorm idea (chosen idea) via lineage graph
                if (lineageGraph && lineageGraph.nodes) {
                    const leafBrainstormIdeas = jsondocs.filter(a => {
                        if (a.schema_type === 'brainstorm_idea') {
                            const node = lineageGraph.nodes.get(a.id);
                            return node && node.isLeaf;
                        }
                        return false;
                    });

                    if (leafBrainstormIdeas.length > 0) {
                        currentStage = 'idea_editing';
                    } else {
                        currentStage = 'brainstorm_selection';
                    }
                } else {
                    currentStage = 'idea_editing';
                }
            } else if (hasBrainstormInput) {
                currentStage = 'brainstorm_input';
            }

            // Generate mock actions based on stage
            const actions = [];
            switch (currentStage) {
                case 'idea_editing':
                    actions.push({
                        id: 'outline_generation',
                        type: 'form',
                        title: '生成大纲',
                        description: '基于选中的创意生成详细大纲',
                        component: null,
                        props: {},
                        enabled: true,
                        priority: 1
                    });
                    break;
                case 'chronicles_generation':
                    actions.push({
                        id: 'episode_synopsis_generation',
                        type: 'button',
                        title: '生成剧本',
                        description: '基于分集概要生成具体剧本',
                        component: null,
                        props: {},
                        enabled: true,
                        priority: 1
                    });
                    break;
            }

            return {
                actionContext: {
                    currentStage,
                    hasActiveTransforms: false,
                    effectiveBrainstormIdeas: [],
                    chosenBrainstormIdea: null,
                    latestOutlineSettings: null,
                    latestChronicles: null,
                    brainstormInput: null,
                    workflowNodes: [],
                    activeTransforms: [],
                    lineageGraph,
                    rootNodes: [],
                    leafNodes: []
                },
                actions,
                stageDescription: `Stage: ${currentStage}`
            };
        }

        return {
            actionContext: {
                currentStage: 'initial',
                hasActiveTransforms: false,
                effectiveBrainstormIdeas: [],
                chosenBrainstormIdea: null,
                latestOutlineSettings: null,
                latestChronicles: null,
                brainstormInput: null,
                workflowNodes: [],
                activeTransforms: [],
                lineageGraph,
                rootNodes: [],
                leafNodes: []
            },
            actions: [],
            stageDescription: 'Initial stage'
        };
    })
}));

// Mock project data helper
const createMockProjectData = (overrides: Partial<ProjectDataContextType> = {}): ProjectDataContextType => ({
    jsondocs: [],
    transforms: [],
    humanTransforms: [],
    transformInputs: [],
    transformOutputs: [],
    llmPrompts: [],
    llmTransforms: [],
    isLoading: false,
    isError: false,
    error: null,
    lineageGraph: {
        nodes: new Map(),
        edges: new Map(),
        paths: new Map(),
        rootNodes: new Set()
    },
    getIdeaCollections: () => [],
    getJsondocAtPath: () => null,
    getLatestVersionForPath: () => null,
    getLineageGraph: () => ({
        nodes: new Map(),
        edges: new Map(),
        paths: new Map(),
        rootNodes: new Set()
    }),
    getJsondocById: () => undefined,
    getTransformById: () => undefined,
    getHumanTransformsForJsondoc: () => [],
    getTransformInputsForTransform: () => [],
    getTransformOutputsForTransform: () => [],
    createTransform: {} as any,
    updateJsondoc: {} as any,
    createHumanTransform: {} as any,
    localUpdates: new Map(),
    addLocalUpdate: () => { },
    removeLocalUpdate: () => { },
    hasLocalUpdate: () => false,
    mutationStates: {
        jsondocs: new Map(),
        transforms: new Map(),
        humanTransforms: new Map()
    },
    setEntityMutationState: () => { },
    clearEntityMutationState: () => { },
    ...overrides
});

describe('Unified Workflow Computation', () => {
    describe('computeWorkflowParameters', () => {
        it('should compute parameters for active project', () => {
            const mockProjectData = createMockProjectData({
                jsondocs: [{
                    id: 'brainstorm-input-1',
                    schema_type: 'brainstorm_input_params',
                    data: '{"platform": "douyin", "requirements": "test"}',
                    created_at: '2024-01-01T00:00:00Z'
                }] as any,
                transforms: [{
                    id: 'transform-1',
                    status: 'completed',
                    type: 'llm',
                    project_id: 'test-project',
                    created_at: '2024-01-01T00:00:00Z'
                }] as any,
                // Provide a proper lineage graph with the brainstorm input jsondoc
                lineageGraph: {
                    nodes: new Map([
                        ['brainstorm-input-1', {
                            type: 'jsondoc' as const,
                            jsondocId: 'brainstorm-input-1',
                            isLeaf: true,
                            depth: 0,
                            jsondocType: 'brainstorm_input_params',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_input_params',
                            originType: 'user_input',
                            jsondoc: { id: 'brainstorm-input-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }]
                    ]),
                    edges: new Map(),
                    paths: new Map(),
                    rootNodes: new Set(['brainstorm-input-1'])
                }
            });

            const params = computeWorkflowParameters(mockProjectData, 'test-project');

            expect(params.projectId).toBe('test-project');
            expect(params.hasActiveTransforms).toBe(false);
            expect(params.brainstormInput).toBeTruthy();
            expect(params.brainstormInput.id).toBe('brainstorm-input-1');
        });
    });

    describe('computeUnifiedWorkflowState', () => {
        it('should compute complete unified state', () => {
            const mockProjectData = createMockProjectData({
                jsondocs: [
                    {
                        id: 'brainstorm-input-1',
                        schema_type: 'brainstorm_input_params',
                        data: '{"platform": "douyin", "requirements": "test"}',
                        created_at: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'ideas-1',
                        schema_type: 'brainstorm_idea',
                        data: '{"title": "Test Idea", "body": "Test body"}',
                        created_at: '2024-01-01T00:00:00Z'
                    }
                ] as any,
                transformInputs: [] as any,
                lineageGraph: {
                    nodes: new Map([
                        ['brainstorm-input-1', {
                            type: 'jsondoc' as const,
                            jsondocId: 'brainstorm-input-1',
                            isLeaf: false,
                            depth: 0,
                            jsondocType: 'brainstorm_input_params',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_input_params',
                            originType: 'user_input',
                            jsondoc: { id: 'brainstorm-input-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }],
                        ['ideas-1', {
                            type: 'jsondoc' as const,
                            jsondocId: 'ideas-1',
                            isLeaf: true,
                            depth: 1,
                            jsondocType: 'brainstorm_idea',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_idea',
                            originType: 'ai_generated',
                            jsondoc: { id: 'ideas-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }]
                    ]),
                    edges: new Map(),
                    paths: new Map(),
                    rootNodes: new Set(['brainstorm-input-1'])
                }
            });

            const state = computeUnifiedWorkflowState(mockProjectData, 'test-project');

            expect(state.displayComponents.length).toBeGreaterThanOrEqual(1); // Should have at least 1 display component
            expect(Array.isArray(state.actions)).toBe(true); // Actions are computed
            expect(state.parameters.hasActiveTransforms).toBe(false);
        });

        it('should handle different workflow stages', () => {
            const mockProjectData = createMockProjectData({
                jsondocs: [
                    {
                        id: 'brainstorm-input-1',
                        schema_type: 'brainstorm_input_params',
                        data: '{"platform": "douyin", "requirements": "test"}',
                        created_at: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'ideas-1',
                        schema_type: 'brainstorm_idea',
                        data: '{"title": "Test Idea", "body": "Test body"}',
                        created_at: '2024-01-01T00:00:00Z'
                    }
                ] as any,
                lineageGraph: {
                    nodes: new Map([
                        ['brainstorm-input-1', {
                            type: 'jsondoc' as const,
                            jsondocId: 'brainstorm-input-1',
                            isLeaf: false,
                            depth: 0,
                            jsondocType: 'brainstorm_input_params',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_input_params',
                            originType: 'user_input',
                            jsondoc: { id: 'brainstorm-input-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }],
                        ['ideas-1', {
                            type: 'jsondoc' as const,
                            jsondocId: 'ideas-1',
                            isLeaf: true,
                            depth: 1,
                            jsondocType: 'brainstorm_idea',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_idea',
                            originType: 'ai_generated',
                            jsondoc: { id: 'ideas-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }]
                    ]),
                    edges: new Map(),
                    paths: new Map(),
                    rootNodes: new Set(['brainstorm-input-1'])
                }
            });

            const state = computeUnifiedWorkflowState(mockProjectData, 'test-project');

            expect(state.displayComponents.length).toBeGreaterThanOrEqual(1);
            expect(state.parameters.hasActiveTransforms).toBe(false);
        });
    });

    describe('Integration with existing action computation', () => {
        it('should maintain backward compatibility with existing action computation', () => {
            const mockProjectData = createMockProjectData();

            const state = computeUnifiedWorkflowState(mockProjectData, 'test-project');

            // Should still have actions computed by the existing system
            expect(state.actions).toBeDefined();
            expect(Array.isArray(state.actions)).toBe(true);
        });
    });
}); 