import { describe, it, expect, vi } from 'vitest';
import {
    computeWorkflowSteps,
    computeDisplayComponents,
    computeWorkflowParameters,
    computeParamsAndActionsFromLineage,
    computeUnifiedWorkflowState
} from '../actionComputation';
import { ProjectDataContextType } from '../../../common/types';
import { LineageGraph } from '../../../common/transform-artifact-framework/lineageResolution';
import { WORKFLOW_STEPS } from '../workflowTypes';

// Mock the lineage-based computation
vi.mock('../lineageBasedActionComputation', () => ({
    computeActionsFromLineage: vi.fn((lineageGraph, artifacts) => {
        // Determine current stage based on artifacts and lineage graph
        let currentStage = 'initial';

        if (artifacts && Array.isArray(artifacts)) {
            const hasBrainstormInput = artifacts.some(a =>
                a.type === 'brainstorm_tool_input_schema' ||
                a.schema_type === 'brainstorm_tool_input_schema'
            );
            const hasBrainstormIdeas = artifacts.some(a =>
                a.schema_type === 'brainstorm_item_schema' ||
                a.type === 'brainstorm_item_schema'
            );
            const hasOutlineSettings = artifacts.some(a =>
                a.schema_type === 'outline_settings_schema' ||
                a.type === 'outline_settings_schema' ||
                a.type === 'outline_settings'
            );
            const hasChronicles = artifacts.some(a =>
                a.schema_type === 'chronicles_schema' ||
                a.type === 'chronicles_schema' ||
                a.type === 'chronicles'
            );

            // Determine stage based on most advanced artifact type present
            if (hasChronicles) {
                currentStage = 'chronicles_generation';
            } else if (hasOutlineSettings) {
                currentStage = 'outline_generation';
            } else if (hasBrainstormIdeas) {
                // Check if we have a leaf brainstorm idea (chosen idea) via lineage graph
                if (lineageGraph && lineageGraph.nodes) {
                    const leafBrainstormIdeas = artifacts.filter(a => {
                        if (a.schema_type === 'brainstorm_item_schema' || a.type === 'brainstorm_item_schema') {
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
    artifacts: [],
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
    getBrainstormCollections: () => [],
    getArtifactAtPath: () => null,
    getLatestVersionForPath: () => null,
    getBrainstormArtifacts: () => [],
    getLineageGraph: () => ({
        nodes: new Map(),
        edges: new Map(),
        paths: new Map(),
        rootNodes: new Set()
    }),
    getOutlineArtifacts: () => [],
    getArtifactById: () => undefined,
    getTransformById: () => undefined,
    getHumanTransformsForArtifact: () => [],
    getTransformInputsForTransform: () => [],
    getTransformOutputsForTransform: () => [],
    createTransform: {} as any,
    updateArtifact: {} as any,
    createHumanTransform: {} as any,
    localUpdates: new Map(),
    addLocalUpdate: () => { },
    removeLocalUpdate: () => { },
    hasLocalUpdate: () => false,
    mutationStates: {
        artifacts: new Map(),
        transforms: new Map(),
        humanTransforms: new Map()
    },
    setEntityMutationState: () => { },
    clearEntityMutationState: () => { },
    ...overrides
});

describe('Unified Workflow Computation', () => {
    describe('computeWorkflowSteps', () => {
        it('should compute steps for initial stage', () => {
            const steps = computeWorkflowSteps('initial', false, createMockProjectData());

            // Initial stage returns empty steps array
            expect(steps).toHaveLength(0);
        });

        it('should compute steps for brainstorm_input stage', () => {
            // For brainstorm_input to work, we need to provide artifacts that indicate AI path
            const mockProjectData = createMockProjectData({
                artifacts: [{
                    id: 'brainstorm-input-1',
                    type: 'brainstorm_tool_input_schema',
                    data: '{"platform": "douyin", "requirements": "test"}',
                    created_at: '2024-01-01T00:00:00Z'
                }] as any
            });

            const steps = computeWorkflowSteps('brainstorm_input', false, mockProjectData);

            // Current step is 'finish' when not active, 'process' when active
            expect(steps[0].status).toBe('finish');
            expect(steps[1].status).toBe('wait');
        });

        it('should compute steps for idea_editing stage', () => {
            const steps = computeWorkflowSteps('idea_editing', false, createMockProjectData());

            // Manual path: idea_editing is the first step (index 0)
            expect(steps[0].status).toBe('finish'); // Current step is 'finish' when not active
            expect(steps[1].status).toBe('wait');
            expect(steps[2].status).toBe('wait');
            expect(steps[3].status).toBe('wait');
        });

        it('should handle active transforms', () => {
            // For brainstorm_input to work, we need to provide artifacts that indicate AI path
            const mockProjectData = createMockProjectData({
                artifacts: [{
                    id: 'brainstorm-input-1',
                    type: 'brainstorm_tool_input_schema',
                    data: '{"platform": "douyin", "requirements": "test"}',
                    created_at: '2024-01-01T00:00:00Z'
                }] as any
            });

            const steps = computeWorkflowSteps('brainstorm_input', true, mockProjectData);

            expect(steps[0].status).toBe('process');
        });
    });

    describe('computeDisplayComponents', () => {
        it('should return empty array for pending artifacts', () => {
            const components = computeDisplayComponents('initial', false, createMockProjectData({
                artifacts: "pending"
            }));

            expect(components).toEqual([]);
        });

        it('should compute components for initial stage', () => {
            const components = computeDisplayComponents('initial', false, createMockProjectData());

            expect(components).toHaveLength(1);
            expect(components[0].id).toBe('project-creation-form');
            expect(components[0].mode).toBe('editable');
        });

        it('should compute components for brainstorm_input stage', () => {
            const mockProjectData = createMockProjectData({
                artifacts: [{
                    id: 'brainstorm-input-1',
                    type: 'brainstorm_tool_input_schema',
                    data: '{"platform": "douyin", "requirements": "test"}',
                    created_at: '2024-01-01T00:00:00Z'
                }] as any,
                lineageGraph: {
                    nodes: new Map([
                        ['brainstorm-input-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-input-1',
                            isLeaf: true,
                            depth: 0,
                            artifactType: 'brainstorm_tool_input_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_tool_input_schema',
                            originType: 'user_input',
                            artifact: { id: 'brainstorm-input-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }]
                    ]),
                    edges: new Map(),
                    paths: new Map(),
                    rootNodes: new Set(['brainstorm-input-1'])
                }
            });

            const components = computeDisplayComponents('brainstorm_input', false, mockProjectData);

            expect(components).toHaveLength(1);
            expect(components[0].id).toBe('brainstorm-input-editor');
            expect(components[0].mode).toBe('editable');
            expect(components[0].props.isEditable).toBe(true);
        });

        it('should compute components for brainstorm_selection stage', () => {
            const mockProjectData = createMockProjectData({
                artifacts: [
                    {
                        id: 'brainstorm-input-1',
                        type: 'brainstorm_tool_input_schema',
                        data: '{"platform": "douyin", "requirements": "test"}',
                        created_at: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'brainstorm-ideas-1',
                        type: 'brainstorm_item_schema',
                        data: '{"ideas": [{"title": "Test Idea"}]}',
                        created_at: '2024-01-01T00:01:00Z'
                    }
                ] as any,
                lineageGraph: {
                    nodes: new Map([
                        ['brainstorm-input-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-input-1',
                            isLeaf: false, // Not a leaf node - should be minimized
                            depth: 0,
                            artifactType: 'brainstorm_tool_input_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_tool_input_schema',
                            originType: 'user_input',
                            artifact: { id: 'brainstorm-input-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }],
                        ['brainstorm-ideas-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-ideas-1',
                            isLeaf: true,
                            depth: 1,
                            artifactType: 'brainstorm_item_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_item_schema',
                            originType: 'ai_generated',
                            artifact: { id: 'brainstorm-ideas-1' } as any,
                            createdAt: '2024-01-01T00:01:00Z'
                        }]
                    ]),
                    edges: new Map(),
                    paths: new Map(),
                    rootNodes: new Set(['brainstorm-input-1'])
                }
            });

            const components = computeDisplayComponents('brainstorm_selection', false, mockProjectData);

            expect(components).toHaveLength(2);
            expect(components[0].id).toBe('brainstorm-input-editor');
            expect(components[0].mode).toBe('readonly');
            expect(components[0].props.minimized).toBe(true); // Should be minimized when not leaf
            expect(components[1].id).toBe('project-brainstorm-page');
            expect(components[1].props.selectionMode).toBe(true);
        });

        it('should compute components for brainstorm_input stage with non-minimized mode', () => {
            const mockProjectData = createMockProjectData({
                artifacts: [{
                    id: 'brainstorm-input-1',
                    type: 'brainstorm_tool_input_schema',
                    data: '{"platform": "douyin", "requirements": "test"}',
                    created_at: '2024-01-01T00:00:00Z'
                }] as any,
                lineageGraph: {
                    nodes: new Map([
                        ['brainstorm-input-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-input-1',
                            isLeaf: true, // Is a leaf node - should not be minimized
                            depth: 0,
                            artifactType: 'brainstorm_tool_input_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_tool_input_schema',
                            originType: 'user_input',
                            artifact: { id: 'brainstorm-input-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }]
                    ]),
                    edges: new Map(),
                    paths: new Map(),
                    rootNodes: new Set(['brainstorm-input-1'])
                }
            });

            const components = computeDisplayComponents('brainstorm_input', false, mockProjectData);

            expect(components).toHaveLength(1);
            expect(components[0].id).toBe('brainstorm-input-editor');
            expect(components[0].mode).toBe('editable');
            expect(components[0].props.minimized).toBe(false); // Should not be minimized at brainstorm_input stage
        });

        it('should compute components for idea_editing stage', () => {
            const mockProjectData = createMockProjectData({
                artifacts: [
                    {
                        id: 'brainstorm-input-1',
                        type: 'brainstorm_tool_input_schema',
                        data: '{"platform": "douyin", "requirements": "test"}',
                        created_at: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'brainstorm-ideas-1',
                        schema_type: 'brainstorm_item_schema',
                        data: '{"title": "Test Idea", "body": "Test body"}',
                        created_at: '2024-01-01T00:00:00Z'
                    }
                ] as any,
                transformInputs: [] as any,
                lineageGraph: {
                    nodes: new Map([
                        ['brainstorm-input-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-input-1',
                            isLeaf: false,
                            depth: 0,
                            artifactType: 'brainstorm_tool_input_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_tool_input_schema',
                            originType: 'user_input',
                            artifact: { id: 'brainstorm-input-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }],
                        ['brainstorm-ideas-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-ideas-1',
                            isLeaf: true,
                            depth: 1,
                            artifactType: 'brainstorm_item_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_item_schema',
                            originType: 'ai_generated',
                            artifact: { id: 'brainstorm-ideas-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }]
                    ]),
                    edges: new Map(),
                    paths: new Map(),
                    rootNodes: new Set(['brainstorm-input-1'])
                }
            });

            const components = computeDisplayComponents('idea_editing', false, mockProjectData);

            expect(components).toHaveLength(3); // brainstorm-input-editor + project-brainstorm-page + single-brainstorm-idea-editor
            expect(components[0].id).toBe('brainstorm-input-editor');
            expect(components[0].mode).toBe('readonly');
            expect(components[1].id).toBe('project-brainstorm-page');
            expect(components[1].mode).toBe('readonly');
            expect(components[1].props.readOnly).toBe(true);
            expect(components[2].id).toBe('single-brainstorm-idea-editor');
            expect(components[2].mode).toBe('editable');
        });

        it('should compute components for idea_editing stage with minimized brainstorm input', () => {
            const mockProjectData = createMockProjectData({
                artifacts: [
                    {
                        id: 'brainstorm-input-1',
                        type: 'brainstorm_tool_input_schema',
                        data: '{"platform": "douyin", "requirements": "test"}',
                        created_at: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'brainstorm-ideas-1',
                        type: 'brainstorm_item_schema',
                        data: '{"ideas": [{"title": "Test Idea"}]}',
                        created_at: '2024-01-01T00:00:00Z'
                    }
                ] as any,
                lineageGraph: {
                    nodes: new Map([
                        ['brainstorm-input-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-input-1',
                            isLeaf: false, // Not a leaf node - should be minimized
                            depth: 0,
                            artifactType: 'brainstorm_tool_input_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_tool_input_schema',
                            originType: 'user_input',
                            artifact: { id: 'brainstorm-input-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }],
                        ['brainstorm-ideas-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-ideas-1',
                            isLeaf: true,
                            depth: 1,
                            artifactType: 'brainstorm_item_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_item_schema',
                            originType: 'ai_generated',
                            artifact: { id: 'brainstorm-ideas-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }]
                    ]),
                    edges: new Map(),
                    paths: new Map(),
                    rootNodes: new Set(['brainstorm-input-1'])
                }
            });

            const components = computeDisplayComponents('idea_editing', false, mockProjectData);

            expect(components).toHaveLength(3); // brainstorm-input-editor + project-brainstorm-page + single-brainstorm-idea-editor
            expect(components[0].id).toBe('brainstorm-input-editor');
            expect(components[0].mode).toBe('readonly');
            expect(components[0].props.minimized).toBe(true); // Should be minimized when not leaf
            expect(components[1].id).toBe('project-brainstorm-page');
            expect(components[1].mode).toBe('readonly');
            expect(components[1].props.readOnly).toBe(true);
            expect(components[2].id).toBe('single-brainstorm-idea-editor');
        });

        it('should handle active transforms by setting readonly mode', () => {
            const mockProjectData = createMockProjectData({
                artifacts: [{
                    id: 'brainstorm-input-1',
                    type: 'brainstorm_tool_input_schema',
                    data: '{"platform": "douyin", "requirements": "test"}',
                    created_at: '2024-01-01T00:00:00Z'
                }] as any,
                lineageGraph: {
                    nodes: new Map([
                        ['brainstorm-input-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-input-1',
                            isLeaf: true,
                            depth: 0,
                            artifactType: 'brainstorm_tool_input_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_tool_input_schema',
                            originType: 'user_input',
                            artifact: { id: 'brainstorm-input-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }]
                    ]),
                    edges: new Map(),
                    paths: new Map(),
                    rootNodes: new Set(['brainstorm-input-1'])
                }
            });

            const components = computeDisplayComponents('brainstorm_input', true, mockProjectData);

            expect(components[0].mode).toBe('readonly');
            expect(components[0].props.isEditable).toBe(false);
        });

        it('should sort components by priority', () => {
            const mockProjectData = createMockProjectData({
                artifacts: [
                    {
                        id: 'brainstorm-input-1',
                        type: 'brainstorm_tool_input_schema',
                        data: '{"platform": "douyin", "requirements": "test"}',
                        created_at: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'brainstorm-ideas-1',
                        schema_type: 'brainstorm_item_schema',
                        data: '{"title": "Test Idea", "body": "Test body"}',
                        created_at: '2024-01-01T00:00:00Z'
                    }
                ] as any,
                lineageGraph: {
                    nodes: new Map([
                        ['brainstorm-input-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-input-1',
                            isLeaf: false,
                            depth: 0,
                            artifactType: 'brainstorm_tool_input_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_tool_input_schema',
                            originType: 'user_input',
                            artifact: { id: 'brainstorm-input-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }],
                        ['brainstorm-ideas-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-ideas-1',
                            isLeaf: true,
                            depth: 1,
                            artifactType: 'brainstorm_item_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_item_schema',
                            originType: 'ai_generated',
                            artifact: { id: 'brainstorm-ideas-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }]
                    ]),
                    edges: new Map(),
                    paths: new Map(),
                    rootNodes: new Set(['brainstorm-input-1'])
                }
            });

            const components = computeDisplayComponents('brainstorm_selection', false, mockProjectData);

            // Should be sorted by priority (1, 2, 3...)
            expect(components[0].priority).toBe(1);
            expect(components[1].priority).toBe(2);
        });

        it('should show SingleBrainstormIdeaEditor after human transform creation', () => {
            // Test case: User selects an idea from brainstorm collection and creates human transform
            const mockProjectData = createMockProjectData({
                artifacts: [
                    {
                        id: 'brainstorm-input-1',
                        type: 'brainstorm_tool_input_schema',
                        data: '{"platform": "douyin", "requirements": "test"}',
                        created_at: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'brainstorm-collection-1',
                        type: 'brainstorm_collection_schema',
                        data: '{"ideas": [{"title": "Original Idea", "body": "Original body"}]}',
                        created_at: '2024-01-01T00:01:00Z'
                    },
                    {
                        id: 'human-edited-idea-1',
                        type: 'brainstorm_item_schema',
                        data: '{"title": "Edited Idea", "body": "Edited body"}',
                        origin_type: 'user_input',
                        created_at: '2024-01-01T00:02:00Z'
                    }
                ] as any,
                transforms: [
                    {
                        id: 'transform-1',
                        type: 'human',
                        status: 'completed',
                        created_at: '2024-01-01T00:02:00Z'
                    }
                ] as any,
                humanTransforms: [
                    {
                        id: 'human-transform-1',
                        transform_id: 'transform-1',
                        derivation_path: '$.ideas[0]',
                        created_at: '2024-01-01T00:02:00Z'
                    }
                ] as any,
                transformInputs: [
                    {
                        id: 'input-1',
                        transform_id: 'transform-1',
                        artifact_id: 'brainstorm-collection-1',
                        artifact_path: '$.ideas[0]',
                        created_at: '2024-01-01T00:02:00Z'
                    }
                ] as any,
                transformOutputs: [
                    {
                        id: 'output-1',
                        transform_id: 'transform-1',
                        artifact_id: 'human-edited-idea-1',
                        created_at: '2024-01-01T00:02:00Z'
                    }
                ] as any,
                lineageGraph: {
                    nodes: new Map([
                        ['brainstorm-input-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-input-1',
                            isLeaf: false, // Not leaf because it has descendants
                            depth: 0,
                            artifactType: 'brainstorm_tool_input_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_tool_input_schema',
                            originType: 'user_input',
                            artifact: { id: 'brainstorm-input-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }],
                        ['brainstorm-collection-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-collection-1',
                            isLeaf: false, // Not leaf because human transform uses it as input
                            depth: 1,
                            artifactType: 'brainstorm_collection_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_collection_schema',
                            originType: 'ai_generated',
                            artifact: { id: 'brainstorm-collection-1' } as any,
                            createdAt: '2024-01-01T00:01:00Z'
                        }],
                        ['human-edited-idea-1', {
                            type: 'artifact' as const,
                            artifactId: 'human-edited-idea-1',
                            isLeaf: true, // This is the leaf node - the chosen idea
                            depth: 2,
                            artifactType: 'brainstorm_item_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_item_schema',
                            originType: 'user_input',
                            artifact: { id: 'human-edited-idea-1' } as any,
                            createdAt: '2024-01-01T00:02:00Z'
                        }]
                    ]),
                    edges: new Map([
                        ['brainstorm-collection-1', ['human-edited-idea-1']]
                    ]),
                    paths: new Map(),
                    rootNodes: new Set(['brainstorm-input-1'])
                }
            });

            const components = computeDisplayComponents('idea_editing', false, mockProjectData);

            // Should have brainstorm input (minimized), brainstorm page (readonly), and single brainstorm idea editor
            expect(components).toHaveLength(3);

            // First component should be minimized brainstorm input
            expect(components[0].id).toBe('brainstorm-input-editor');
            expect(components[0].props.minimized).toBe(true);

            // Second component should be readonly brainstorm page
            expect(components[1].id).toBe('project-brainstorm-page');
            expect(components[1].mode).toBe('readonly');
            expect(components[1].props.readOnly).toBe(true);

            // Third component should be SingleBrainstormIdeaEditor with the human-edited idea
            expect(components[2].id).toBe('single-brainstorm-idea-editor');
            expect(components[2].props.brainstormIdea).toBeDefined();
            expect(components[2].props.brainstormIdea.id).toBe('human-edited-idea-1');
            expect(components[2].props.isEditable).toBe(true); // Should be editable since it's user_input leaf node
        });

        it('should show correct actions after human transform creation', () => {
            // Test case: After human transform, user should see outline generation action
            const mockProjectData = createMockProjectData({
                artifacts: [
                    {
                        id: 'brainstorm-input-1',
                        type: 'brainstorm_tool_input_schema',
                        data: '{"platform": "douyin", "requirements": "test"}',
                        created_at: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'brainstorm-collection-1',
                        type: 'brainstorm_collection_schema',
                        data: '{"ideas": [{"title": "Original Idea", "body": "Original body"}]}',
                        created_at: '2024-01-01T00:01:00Z'
                    },
                    {
                        id: 'human-edited-idea-1',
                        type: 'brainstorm_item_schema',
                        data: '{"title": "Edited Idea", "body": "Edited body"}',
                        origin_type: 'user_input',
                        created_at: '2024-01-01T00:02:00Z'
                    }
                ] as any,
                transforms: [
                    {
                        id: 'transform-1',
                        type: 'human',
                        status: 'completed',
                        created_at: '2024-01-01T00:02:00Z'
                    }
                ] as any,
                humanTransforms: [
                    {
                        id: 'human-transform-1',
                        transform_id: 'transform-1',
                        derivation_path: '$.ideas[0]',
                        created_at: '2024-01-01T00:02:00Z'
                    }
                ] as any,
                transformInputs: [
                    {
                        id: 'input-1',
                        transform_id: 'transform-1',
                        artifact_id: 'brainstorm-collection-1',
                        artifact_path: '$.ideas[0]',
                        created_at: '2024-01-01T00:02:00Z'
                    }
                ] as any,
                transformOutputs: [
                    {
                        id: 'output-1',
                        transform_id: 'transform-1',
                        artifact_id: 'human-edited-idea-1',
                        created_at: '2024-01-01T00:02:00Z'
                    }
                ] as any,
                lineageGraph: {
                    nodes: new Map([
                        ['human-edited-idea-1', {
                            type: 'artifact' as const,
                            artifactId: 'human-edited-idea-1',
                            isLeaf: true, // This is the leaf node
                            depth: 2,
                            artifactType: 'brainstorm_item_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_item_schema',
                            originType: 'user_input',
                            artifact: { id: 'human-edited-idea-1' } as any,
                            createdAt: '2024-01-01T00:02:00Z'
                        }]
                    ]),
                    edges: new Map(),
                    paths: new Map(),
                    rootNodes: new Set(['human-edited-idea-1'])
                }
            });

            const result = computeParamsAndActionsFromLineage(mockProjectData);

            // Should be in idea_editing stage
            expect(result.currentStage).toBe('idea_editing');

            // Should have outline generation action
            expect(result.actions).toHaveLength(1);
            expect(result.actions[0].id).toBe('outline_generation');
            expect(result.actions[0].title).toBe('生成大纲');
        });

        it('should handle hard-coded vs dynamic stage detection', () => {
            // Test to check if the computation is too hard-coded for specific scenarios
            // This simulates a more complex chain: Input -> Collection -> Human Edit -> Outline -> Chronicles
            const mockProjectData = createMockProjectData({
                artifacts: [
                    {
                        id: 'brainstorm-input-1',
                        type: 'brainstorm_tool_input_schema',
                        data: '{"platform": "douyin", "requirements": "test"}',
                        created_at: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'brainstorm-collection-1',
                        type: 'brainstorm_collection_schema',
                        data: '{"ideas": [{"title": "Original Idea", "body": "Original body"}]}',
                        created_at: '2024-01-01T00:01:00Z'
                    },
                    {
                        id: 'human-edited-idea-1',
                        type: 'brainstorm_item_schema',
                        data: '{"title": "Edited Idea", "body": "Edited body"}',
                        origin_type: 'user_input',
                        created_at: '2024-01-01T00:02:00Z'
                    },
                    {
                        id: 'outline-1',
                        type: 'outline_settings_schema',
                        data: '{"episodes": 60, "genre": "modern"}',
                        created_at: '2024-01-01T00:03:00Z'
                    },
                    {
                        id: 'chronicles-1',
                        type: 'chronicles_schema',
                        data: '{"episodes": [{"title": "Episode 1"}]}',
                        created_at: '2024-01-01T00:04:00Z'
                    }
                ] as any,
                transforms: [
                    {
                        id: 'transform-1',
                        type: 'human',
                        status: 'completed',
                        created_at: '2024-01-01T00:02:00Z'
                    },
                    {
                        id: 'transform-2',
                        type: 'llm',
                        status: 'completed',
                        created_at: '2024-01-01T00:03:00Z'
                    },
                    {
                        id: 'transform-3',
                        type: 'llm',
                        status: 'completed',
                        created_at: '2024-01-01T00:04:00Z'
                    }
                ] as any,
                humanTransforms: [
                    {
                        id: 'human-transform-1',
                        transform_id: 'transform-1',
                        derivation_path: '$.ideas[0]',
                        created_at: '2024-01-01T00:02:00Z'
                    }
                ] as any,
                transformInputs: [
                    {
                        id: 'input-1',
                        transform_id: 'transform-1',
                        artifact_id: 'brainstorm-collection-1',
                        artifact_path: '$.ideas[0]',
                        created_at: '2024-01-01T00:02:00Z'
                    },
                    {
                        id: 'input-2',
                        transform_id: 'transform-2',
                        artifact_id: 'human-edited-idea-1',
                        created_at: '2024-01-01T00:03:00Z'
                    },
                    {
                        id: 'input-3',
                        transform_id: 'transform-3',
                        artifact_id: 'outline-1',
                        created_at: '2024-01-01T00:04:00Z'
                    }
                ] as any,
                transformOutputs: [
                    {
                        id: 'output-1',
                        transform_id: 'transform-1',
                        artifact_id: 'human-edited-idea-1',
                        created_at: '2024-01-01T00:02:00Z'
                    },
                    {
                        id: 'output-2',
                        transform_id: 'transform-2',
                        artifact_id: 'outline-1',
                        created_at: '2024-01-01T00:03:00Z'
                    },
                    {
                        id: 'output-3',
                        transform_id: 'transform-3',
                        artifact_id: 'chronicles-1',
                        created_at: '2024-01-01T00:04:00Z'
                    }
                ] as any,
                lineageGraph: {
                    nodes: new Map([
                        ['brainstorm-input-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-input-1',
                            isLeaf: false, // Not leaf because it has descendants
                            depth: 0,
                            artifactType: 'brainstorm_tool_input_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_tool_input_schema',
                            originType: 'user_input',
                            artifact: { id: 'brainstorm-input-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }],
                        ['brainstorm-collection-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-collection-1',
                            isLeaf: false, // Not leaf because human transform uses it as input
                            depth: 1,
                            artifactType: 'brainstorm_collection_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_collection_schema',
                            originType: 'ai_generated',
                            artifact: { id: 'brainstorm-collection-1' } as any,
                            createdAt: '2024-01-01T00:01:00Z'
                        }],
                        ['human-edited-idea-1', {
                            type: 'artifact' as const,
                            artifactId: 'human-edited-idea-1',
                            isLeaf: false, // Not leaf because outline uses it as input
                            depth: 2,
                            artifactType: 'brainstorm_item_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_item_schema',
                            originType: 'user_input',
                            artifact: { id: 'human-edited-idea-1' } as any,
                            createdAt: '2024-01-01T00:02:00Z'
                        }],
                        ['outline-1', {
                            type: 'artifact' as const,
                            artifactId: 'outline-1',
                            isLeaf: false, // Not leaf because chronicles uses it as input
                            depth: 3,
                            artifactType: 'outline_settings_schema',
                            sourceTransform: 'none',
                            schemaType: 'outline_settings_schema',
                            originType: 'ai_generated',
                            artifact: { id: 'outline-1' } as any,
                            createdAt: '2024-01-01T00:03:00Z'
                        }],
                        ['chronicles-1', {
                            type: 'artifact' as const,
                            artifactId: 'chronicles-1',
                            isLeaf: true, // Chronicles is the leaf node
                            depth: 4,
                            artifactType: 'chronicles_schema',
                            sourceTransform: 'none',
                            schemaType: 'chronicles_schema',
                            originType: 'ai_generated',
                            artifact: { id: 'chronicles-1' } as any,
                            createdAt: '2024-01-01T00:04:00Z'
                        }]
                    ]),
                    edges: new Map([
                        ['brainstorm-input-1', ['brainstorm-collection-1']],
                        ['brainstorm-collection-1', ['human-edited-idea-1']],
                        ['human-edited-idea-1', ['outline-1']],
                        ['outline-1', ['chronicles-1']]
                    ]),
                    paths: new Map(),
                    rootNodes: new Set(['brainstorm-input-1'])
                }
            });

            const result = computeParamsAndActionsFromLineage(mockProjectData);

            // Should be in chronicles_generation stage (most advanced stage)
            expect(result.currentStage).toBe('chronicles_generation');

            // Should have episode generation action
            expect(result.actions).toHaveLength(1);
            expect(result.actions[0].id).toBe('episode_synopsis_generation');

            // Test display components for this complex scenario
            const components = computeDisplayComponents('chronicles_generation', false, mockProjectData);

            // Should show all previous components in readonly mode
            expect(components.length).toBeGreaterThan(0);

            // Should include brainstorm input (minimized), chosen idea, outline, and chronicles
            const componentIds = components.map(c => c.id);
            expect(componentIds).toContain('brainstorm-input-editor');
            expect(componentIds).toContain('single-brainstorm-idea-editor');
            expect(componentIds).toContain('outline-settings-display');
            expect(componentIds).toContain('chronicles-display');
        });
    });

    describe('computeWorkflowParameters', () => {
        it('should compute parameters for pending artifacts', () => {
            const params = computeWorkflowParameters(createMockProjectData({
                artifacts: "pending"
            }), 'test-project');

            expect(params.projectId).toBe('test-project');
            expect(params.currentStage).toBe('initial');
            expect(params.hasActiveTransforms).toBe(false);
            expect(params.effectiveBrainstormIdeas).toEqual([]);
        });

        it('should compute parameters for active project', () => {
            const mockProjectData = createMockProjectData({
                artifacts: [{
                    id: 'brainstorm-input-1',
                    type: 'brainstorm_tool_input_schema',
                    data: '{"platform": "douyin", "requirements": "test"}',
                    created_at: '2024-01-01T00:00:00Z'
                }] as any,
                transforms: [{
                    id: 'transform-1',
                    status: 'running',
                    type: 'llm',
                    project_id: 'test-project',
                    created_at: '2024-01-01T00:00:00Z'
                }] as any,
                // Provide a proper lineage graph with the brainstorm input artifact
                lineageGraph: {
                    nodes: new Map([
                        ['brainstorm-input-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-input-1',
                            isLeaf: true,
                            depth: 0,
                            artifactType: 'brainstorm_tool_input_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_tool_input_schema',
                            originType: 'user_input',
                            artifact: { id: 'brainstorm-input-1' } as any,
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
                artifacts: [
                    {
                        id: 'brainstorm-input-1',
                        type: 'brainstorm_tool_input_schema',
                        data: '{"platform": "douyin", "requirements": "test"}',
                        created_at: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'brainstorm-ideas-1',
                        schema_type: 'brainstorm_item_schema',
                        data: '{"title": "Test Idea", "body": "Test body"}',
                        created_at: '2024-01-01T00:00:00Z'
                    }
                ] as any,
                transformInputs: [] as any,
                lineageGraph: {
                    nodes: new Map([
                        ['brainstorm-input-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-input-1',
                            isLeaf: false,
                            depth: 0,
                            artifactType: 'brainstorm_tool_input_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_tool_input_schema',
                            originType: 'user_input',
                            artifact: { id: 'brainstorm-input-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }],
                        ['brainstorm-ideas-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-ideas-1',
                            isLeaf: true,
                            depth: 1,
                            artifactType: 'brainstorm_item_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_item_schema',
                            originType: 'ai_generated',
                            artifact: { id: 'brainstorm-ideas-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }]
                    ]),
                    edges: new Map(),
                    paths: new Map(),
                    rootNodes: new Set(['brainstorm-input-1'])
                }
            });

            const state = computeUnifiedWorkflowState(mockProjectData, 'test-project');

            expect(state.steps).toHaveLength(7); // AI path: 创意输入 → 头脑风暴 → 创意编辑 → 剧本框架 → 时间顺序大纲 → 每集大纲 → 分集剧本
            expect(state.displayComponents).toHaveLength(3); // brainstorm-input-editor + project-brainstorm-page + single-brainstorm-idea-editor
            expect(Array.isArray(state.actions)).toBe(true); // Actions are computed
            expect(state.parameters.currentStage).toBe('idea_editing');
            expect(state.parameters.hasActiveTransforms).toBe(false);
        });

        it('should handle different workflow stages', () => {
            const mockProjectData = createMockProjectData({
                artifacts: [
                    {
                        id: 'brainstorm-input-1',
                        type: 'brainstorm_tool_input_schema',
                        data: '{"platform": "douyin", "requirements": "test"}',
                        created_at: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'brainstorm-ideas-1',
                        schema_type: 'brainstorm_item_schema',
                        data: '{"title": "Test Idea", "body": "Test body"}',
                        created_at: '2024-01-01T00:00:00Z'
                    }
                ] as any,
                lineageGraph: {
                    nodes: new Map([
                        ['brainstorm-input-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-input-1',
                            isLeaf: false,
                            depth: 0,
                            artifactType: 'brainstorm_tool_input_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_tool_input_schema',
                            originType: 'user_input',
                            artifact: { id: 'brainstorm-input-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }],
                        ['brainstorm-ideas-1', {
                            type: 'artifact' as const,
                            artifactId: 'brainstorm-ideas-1',
                            isLeaf: true,
                            depth: 1,
                            artifactType: 'brainstorm_item_schema',
                            sourceTransform: 'none',
                            schemaType: 'brainstorm_item_schema',
                            originType: 'ai_generated',
                            artifact: { id: 'brainstorm-ideas-1' } as any,
                            createdAt: '2024-01-01T00:00:00Z'
                        }]
                    ]),
                    edges: new Map(),
                    paths: new Map(),
                    rootNodes: new Set(['brainstorm-input-1'])
                }
            });

            const state = computeUnifiedWorkflowState(mockProjectData, 'test-project');

            expect(state.displayComponents).toHaveLength(3);
            expect(state.parameters.currentStage).toBe('idea_editing');
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

    describe('Dual-Path Workflow Steps', () => {
        it('should show manual path steps for user-input ideas', () => {
            const projectData = createMockProjectData({
                artifacts: [
                    {
                        id: 'brainstorm-idea-1',
                        project_id: 'test-project',
                        schema_type: 'brainstorm_item_schema',
                        schema_version: 1,
                        origin_type: 'user_input',
                        data: '{"title": "Manual Idea", "synopsis": "User entered idea"}',
                        created_at: '2024-01-01T00:00:00Z'
                    }
                ] as any
            });

            const steps = computeWorkflowSteps('idea_editing', false, projectData);

            expect(steps).toHaveLength(5); // Manual path has 5 steps
            expect(steps[0].title).toBe('创意编辑');
            expect(steps[1].title).toBe('剧本框架');
            expect(steps[2].title).toBe('时间顺序大纲');
            expect(steps[3].title).toBe('每集大纲');
            expect(steps[4].title).toBe('分集剧本');

            // Should not include brainstorm input or generation steps
            expect(steps.some(step => step.title === '创意输入')).toBe(false);
            expect(steps.some(step => step.title === '头脑风暴')).toBe(false);
        });

        it('should show AI path steps for projects with brainstorm input', () => {
            const projectData = createMockProjectData({
                artifacts: [
                    {
                        id: 'brainstorm-input-1',
                        project_id: 'test-project',
                        type: 'brainstorm_tool_input_schema',
                        schema_version: 1,
                        origin_type: 'ai_generated',
                        data: '{"platform": "douyin", "genre": "romance"}',
                        created_at: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'brainstorm-idea-1',
                        project_id: 'test-project',
                        schema_type: 'brainstorm_item_schema',
                        schema_version: 1,
                        origin_type: 'ai_generated',
                        data: '{"title": "AI Idea", "synopsis": "AI generated idea"}',
                        created_at: '2024-01-01T00:00:00Z'
                    }
                ] as any
            });

            const steps = computeWorkflowSteps('idea_editing', false, projectData);

            expect(steps).toHaveLength(7); // AI path has 7 steps
            expect(steps[0].title).toBe('创意输入');
            expect(steps[1].title).toBe('头脑风暴');
            expect(steps[2].title).toBe('创意编辑');
            expect(steps[3].title).toBe('剧本框架');
            expect(steps[4].title).toBe('时间顺序大纲');
            expect(steps[5].title).toBe('每集大纲');
            expect(steps[6].title).toBe('分集剧本');
        });

        it('should prefer AI path when both manual and AI ideas exist', () => {
            const projectData = createMockProjectData({
                artifacts: [
                    {
                        id: 'brainstorm-input-1',
                        project_id: 'test-project',
                        type: 'brainstorm_tool_input_schema',
                        schema_version: 1,
                        origin_type: 'ai_generated',
                        data: '{"platform": "douyin", "genre": "romance"}',
                        created_at: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'brainstorm-idea-1',
                        project_id: 'test-project',
                        schema_type: 'brainstorm_item_schema',
                        schema_version: 1,
                        origin_type: 'user_input',
                        data: '{"title": "Manual Idea", "synopsis": "User entered idea"}',
                        created_at: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'brainstorm-idea-2',
                        project_id: 'test-project',
                        schema_type: 'brainstorm_item_schema',
                        schema_version: 1,
                        origin_type: 'ai_generated',
                        data: '{"title": "AI Idea", "synopsis": "AI generated idea"}',
                        created_at: '2024-01-01T00:00:00Z'
                    }
                ] as any
            });

            const steps = computeWorkflowSteps('idea_editing', false, projectData);

            expect(steps).toHaveLength(7); // Should use AI path
            expect(steps[0].title).toBe('创意输入');
            expect(steps[1].title).toBe('头脑风暴');
        });

        it('should set correct step statuses for manual path', () => {
            const projectData = createMockProjectData({
                artifacts: [
                    {
                        id: 'brainstorm-idea-1',
                        project_id: 'test-project',
                        schema_type: 'brainstorm_item_schema',
                        schema_version: 1,
                        origin_type: 'user_input',
                        data: '{"title": "Manual Idea", "synopsis": "User entered idea"}',
                        created_at: '2024-01-01T00:00:00Z'
                    }
                ] as any
            });

            const steps = computeWorkflowSteps('outline_generation', false, projectData);

            expect(steps[0].status).toBe('finish'); // 创意编辑 finished
            expect(steps[1].status).toBe('finish'); // 剧本框架 current but not active, so 'finish'
            expect(steps[2].status).toBe('wait'); // 时间顺序大纲 waiting
            expect(steps[3].status).toBe('wait'); // 每集大纲 waiting
            expect(steps[4].status).toBe('wait'); // 分集剧本 waiting
        });

        it('should set correct step statuses for AI path', () => {
            const projectData = createMockProjectData({
                artifacts: [
                    {
                        id: 'brainstorm-input-1',
                        project_id: 'test-project',
                        type: 'brainstorm_tool_input_schema',
                        schema_version: 1,
                        origin_type: 'ai_generated',
                        data: '{"platform": "douyin", "genre": "romance"}',
                        created_at: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'brainstorm-idea-1',
                        project_id: 'test-project',
                        schema_type: 'brainstorm_item_schema',
                        schema_version: 1,
                        origin_type: 'ai_generated',
                        data: '{"title": "AI Idea", "synopsis": "AI generated idea"}',
                        created_at: '2024-01-01T00:00:00Z'
                    }
                ] as any
            });

            const steps = computeWorkflowSteps('outline_generation', false, projectData);

            expect(steps[0].status).toBe('finish'); // 创意输入 finished
            expect(steps[1].status).toBe('finish'); // 头脑风暴 finished
            expect(steps[2].status).toBe('finish'); // 创意编辑 finished
            expect(steps[3].status).toBe('finish'); // 大纲 current but not active, so 'finish'
            expect(steps[4].status).toBe('wait'); // 分集概要 waiting
            expect(steps[5].status).toBe('wait'); // 剧本生成 waiting
        });
    });
}); 