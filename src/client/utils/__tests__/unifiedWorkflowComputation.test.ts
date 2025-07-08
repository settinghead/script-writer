import { describe, it, expect, vi } from 'vitest';
import {
    computeUnifiedWorkflowState,
    computeWorkflowSteps,
    computeDisplayComponents,
    computeWorkflowParameters
} from '../actionComputation';
import { ProjectDataContextType } from '../../../common/types';
import { WORKFLOW_STEPS } from '../workflowTypes';

// Mock the lineage-based computation
vi.mock('../lineageBasedActionComputation', () => ({
    computeActionsFromLineage: vi.fn(() => ({
        actions: [],
        actionContext: {
            currentStage: 'initial',
            hasActiveTransforms: false
        },
        stageDescription: '开始创建项目'
    }))
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
    lineageGraph: "pending",
    getBrainstormCollections: () => [],
    getArtifactAtPath: () => null,
    getLatestVersionForPath: () => null,
    getBrainstormArtifacts: () => [],
    getLineageGraph: () => "pending",
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
            const steps = computeWorkflowSteps('brainstorm_input', false, createMockProjectData());

            // Current step is 'finish' when not active, 'process' when active
            expect(steps[0].status).toBe('finish');
            expect(steps[1].status).toBe('wait');
        });

        it('should compute steps for idea_editing stage', () => {
            const steps = computeWorkflowSteps('idea_editing', false, createMockProjectData());

            expect(steps[0].status).toBe('finish');
            expect(steps[1].status).toBe('finish');
            expect(steps[2].status).toBe('finish'); // Current step is 'finish' when not active
            expect(steps[3].status).toBe('wait');
        });

        it('should handle active transforms', () => {
            const steps = computeWorkflowSteps('brainstorm_input', true, createMockProjectData());

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
                }] as any
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
                        schema_type: 'brainstorm_item_schema',
                        data: '{"title": "Test Idea", "body": "Test body"}',
                        created_at: '2024-01-01T00:00:00Z'
                    }
                ] as any
            });

            const components = computeDisplayComponents('brainstorm_selection', false, mockProjectData);

            expect(components).toHaveLength(2);
            expect(components[0].id).toBe('brainstorm-input-editor');
            expect(components[0].mode).toBe('readonly');
            expect(components[1].id).toBe('project-brainstorm-page');
            expect(components[1].props.selectionMode).toBe(true);
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
                transformInputs: [] as any
            });

            const components = computeDisplayComponents('idea_editing', false, mockProjectData);

            expect(components).toHaveLength(2); // brainstorm-input-editor + single-brainstorm-idea-editor
            expect(components[0].id).toBe('brainstorm-input-editor');
            expect(components[0].mode).toBe('readonly');
            expect(components[1].id).toBe('single-brainstorm-idea-editor');
            expect(components[1].mode).toBe('editable');
        });

        it('should handle active transforms by setting readonly mode', () => {
            const mockProjectData = createMockProjectData({
                artifacts: [{
                    id: 'brainstorm-input-1',
                    type: 'brainstorm_tool_input_schema',
                    data: '{"platform": "douyin", "requirements": "test"}',
                    created_at: '2024-01-01T00:00:00Z'
                }] as any
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
                ] as any
            });

            const components = computeDisplayComponents('brainstorm_selection', false, mockProjectData);

            // Should be sorted by priority (1, 2, 3...)
            expect(components[0].priority).toBe(1);
            expect(components[1].priority).toBe(2);
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
                    status: 'running'
                }] as any
            });

            const params = computeWorkflowParameters(mockProjectData, 'test-project');

            expect(params.projectId).toBe('test-project');
            expect(params.hasActiveTransforms).toBe(true);
            expect(params.brainstormInput).toBeTruthy();
        });
    });

    describe('computeUnifiedWorkflowState', () => {
        it('should compute complete unified state', () => {
            const mockProjectData = createMockProjectData({
                artifacts: [{
                    id: 'brainstorm-input-1',
                    type: 'brainstorm_tool_input_schema',
                    data: '{"platform": "douyin", "requirements": "test"}',
                    created_at: '2024-01-01T00:00:00Z'
                }] as any
            });

            const state = computeUnifiedWorkflowState(mockProjectData, 'test-project');

            expect(state.steps).toHaveLength(6);
            expect(state.displayComponents).toHaveLength(1);
            expect(Array.isArray(state.actions)).toBe(true); // Actions are computed by existing system
            expect(state.parameters.projectId).toBe('test-project');
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
                transformInputs: [] as any
            });

            const state = computeUnifiedWorkflowState(mockProjectData, 'test-project');

            expect(state.displayComponents).toHaveLength(2);
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

            expect(steps).toHaveLength(4); // Manual path has 4 steps
            expect(steps[0].title).toBe('创意编辑');
            expect(steps[1].title).toBe('大纲');
            expect(steps[2].title).toBe('分集概要');
            expect(steps[3].title).toBe('剧本生成');

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

            expect(steps).toHaveLength(6); // AI path has 6 steps
            expect(steps[0].title).toBe('创意输入');
            expect(steps[1].title).toBe('头脑风暴');
            expect(steps[2].title).toBe('创意编辑');
            expect(steps[3].title).toBe('大纲');
            expect(steps[4].title).toBe('分集概要');
            expect(steps[5].title).toBe('剧本生成');
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

            expect(steps).toHaveLength(6); // Should use AI path
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
            expect(steps[1].status).toBe('finish'); // 大纲 current but not active, so 'finish'
            expect(steps[2].status).toBe('wait'); // 分集概要 waiting
            expect(steps[3].status).toBe('wait'); // 剧本生成 waiting
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