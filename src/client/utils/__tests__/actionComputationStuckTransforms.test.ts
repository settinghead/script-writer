import { describe, it, expect } from 'vitest';
import { computeUnifiedWorkflowState } from '../actionComputation';
import { ProjectDataContextType } from '../../../common/types';

// Mock data for testing
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

describe('Action Computation - Stuck Transform Handling', () => {
    it('should not be blocked by completed ai_patch transforms', () => {
        // Test data: ai_patch transform that's completed
        const mockProjectData = createMockProjectData({
            jsondocs: [
                {
                    id: 'idea-1',
                    project_id: 'test-project',
                    schema_type: 'brainstorm_idea',
                    schema_version: 'v1',
                    data: JSON.stringify({ title: '测试创意', body: '测试内容' }),
                    metadata: undefined,
                    created_at: '2024-01-01T00:00:00Z',
                    streaming_status: 'completed',
                    origin_type: 'user_input'
                }
            ],
            transforms: [
                {
                    id: 'transform-1',
                    project_id: 'test-project',
                    type: 'ai_patch',
                    type_version: 'v1',
                    status: 'completed', // This should NOT block actions
                    retry_count: 0,
                    max_retries: 3,
                    execution_context: '',
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z',
                    streaming_status: 'completed',
                    progress_percentage: 100,
                    error_message: undefined
                }
            ]
        });

        const result = computeUnifiedWorkflowState(mockProjectData, 'test-project');

        // Should have actions available since the ai_patch transform is completed
        expect(result.actions.length).toBeGreaterThan(0);
        expect(result.parameters.hasActiveTransforms).toBe(false);
    });

    it('should be blocked by running ai_patch transforms', () => {
        // Test data: ai_patch transform that's still running
        const mockProjectData = createMockProjectData({
            jsondocs: [
                {
                    id: 'idea-1',
                    project_id: 'test-project',
                    schema_type: 'brainstorm_idea',
                    schema_version: 'v1',
                    data: JSON.stringify({ title: '测试创意', body: '测试内容' }),
                    metadata: undefined,
                    created_at: '2024-01-01T00:00:00Z',
                    streaming_status: 'completed',
                    origin_type: 'user_input'
                }
            ],
            transforms: [
                {
                    id: 'transform-1',
                    project_id: 'test-project',
                    type: 'ai_patch',
                    type_version: 'v1',
                    status: 'running', // This SHOULD block actions
                    retry_count: 0,
                    max_retries: 3,
                    execution_context: '',
                    created_at: new Date().toISOString(), // Recent transform
                    updated_at: new Date().toISOString(),
                    streaming_status: 'running',
                    progress_percentage: 50,
                    error_message: undefined
                }
            ]
        });

        const result = computeUnifiedWorkflowState(mockProjectData, 'test-project');

        // Should have no actions available since the ai_patch transform is running
        expect(result.actions.length).toBe(0);
        expect(result.parameters.hasActiveTransforms).toBe(true);
    });

    it('should have actions when no transforms are active', () => {
        // Test data: no active transforms
        const mockProjectData = createMockProjectData({
            jsondocs: [
                {
                    id: 'idea-1',
                    project_id: 'test-project',
                    schema_type: 'brainstorm_idea',
                    schema_version: 'v1',
                    data: JSON.stringify({ title: '测试创意', body: '测试内容' }),
                    metadata: undefined,
                    created_at: '2024-01-01T00:00:00Z',
                    streaming_status: 'completed',
                    origin_type: 'user_input'
                }
            ],
            transforms: [] // No transforms at all
        });

        const result = computeUnifiedWorkflowState(mockProjectData, 'test-project');

        // Should have actions available (like "生成大纲设定")
        expect(result.actions.length).toBeGreaterThan(0);
        expect(result.parameters.hasActiveTransforms).toBe(false);
    });
}); 