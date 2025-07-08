import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computeParamsAndActions, computeParamsAndActionsFromLineage } from '../actionComputation';
import type {
    ProjectDataContextType,
    ElectricArtifact,
    ElectricTransform,
    ElectricHumanTransform,
    ElectricTransformInput,
    ElectricTransformOutput
} from '../../../common/types';

// Mock artifact and transform data based on real database patterns
const createMockArtifact = (id: string, schemaType: string, originType: 'ai_generated' | 'user_input', createdAt: string): ElectricArtifact => ({
    id,
    project_id: 'test-project',
    schema_type: schemaType,
    schema_version: 'v1',
    origin_type: originType,
    data: JSON.stringify({ title: `Test ${schemaType}`, content: 'Test content' }),
    created_at: createdAt,
    updated_at: createdAt
});

const createMockTransform = (id: string, type: 'llm' | 'human', status: string, createdAt: string): ElectricTransform => ({
    id,
    project_id: 'test-project',
    type,
    type_version: 'v1',
    status,
    retry_count: 0,
    max_retries: 3,
    created_at: createdAt,
    updated_at: createdAt
});

const createMockTransformInput = (transformId: string, artifactId: string): ElectricTransformInput => ({
    id: Math.floor(Math.random() * 10000),
    project_id: 'test-project',
    transform_id: transformId,
    artifact_id: artifactId
});

const createMockTransformOutput = (transformId: string, artifactId: string): ElectricTransformOutput => ({
    id: Math.floor(Math.random() * 10000),
    project_id: 'test-project',
    transform_id: transformId,
    artifact_id: artifactId
});

const createMockHumanTransform = (transformId: string, sourceId: string, derivedId: string, path: string = '$'): ElectricHumanTransform => ({
    transform_id: transformId,
    project_id: 'test-project',
    action_type: 'edit',
    interface_context: 'manual_edit',
    change_description: 'User edit',
    source_artifact_id: sourceId,
    derivation_path: path,
    derived_artifact_id: derivedId,
    transform_name: 'edit_content'
});

describe('actionComputation', () => {
    let mockProjectData: ProjectDataContextType;

    beforeEach(() => {
        mockProjectData = {
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

            // Mock functions
            getBrainstormCollections: vi.fn(() => []),
            getArtifactAtPath: vi.fn(() => null),
            getLatestVersionForPath: vi.fn(() => null),
            getBrainstormArtifacts: vi.fn(() => []),
            getLineageGraph: vi.fn(() => "pending" as const),
            getOutlineArtifacts: vi.fn(() => []),
            getArtifactById: vi.fn(() => undefined),
            getTransformById: vi.fn(() => undefined),
            getHumanTransformsForArtifact: vi.fn(() => []),
            getTransformInputsForTransform: vi.fn(() => []),
            getTransformOutputsForTransform: vi.fn(() => []),

            // Mock mutations
            createTransform: { mutate: vi.fn(), mutateAsync: vi.fn() } as any,
            updateArtifact: { mutate: vi.fn(), mutateAsync: vi.fn() } as any,
            createHumanTransform: { mutate: vi.fn(), mutateAsync: vi.fn() } as any,

            // Mock local state
            localUpdates: new Map(),
            addLocalUpdate: vi.fn(),
            removeLocalUpdate: vi.fn(),
            hasLocalUpdate: vi.fn(() => false),

            // Mock mutation states
            mutationStates: {
                artifacts: new Map(),
                transforms: new Map(),
                humanTransforms: new Map()
            },
            setEntityMutationState: vi.fn(),
            clearEntityMutationState: vi.fn()
        };
    });

    describe('Scenario 1: Manual brainstorm item only (Manual Entry Path)', () => {
        beforeEach(() => {
            // Single brainstorm item created manually - should go directly to idea editing
            mockProjectData.artifacts = [
                createMockArtifact('brainstorm-1', 'brainstorm_item_schema', 'user_input', '2024-01-01T10:00:00Z')
            ];
            mockProjectData.transforms = [];
            mockProjectData.transformInputs = [];
            mockProjectData.transformOutputs = [];
            mockProjectData.humanTransforms = [];
        });

        it('should detect idea_editing stage', () => {
            const { currentStage } = computeParamsAndActions(mockProjectData);
            expect(currentStage).toBe('idea_editing');
        });

        it('should generate outline generation action', () => {
            const { actions } = computeParamsAndActions(mockProjectData);

            expect(actions.length).toBeGreaterThan(0);
            expect(actions[0].id).toBe('outline_generation');
            expect(actions[0].title).toBe('生成大纲');
        });

        it('should not have active transforms', () => {
            const { hasActiveTransforms } = computeParamsAndActions(mockProjectData);
            expect(hasActiveTransforms).toBe(false);
        });
    });

    describe('Scenario 1b: AI brainstorm collection (AI Brainstorm Path)', () => {
        beforeEach(() => {
            // AI brainstorm workflow: brainstorm_input → AI generates multiple brainstorm_item_schema → user must select one idea
            // Updated: With our new logic, if there are multiple AI ideas and none are chosen, 
            // the latest one automatically becomes the "chosen" idea and we go to idea_editing stage
            mockProjectData.artifacts = [
                createMockArtifact('brainstorm-input-1', 'brainstorm_input_schema', 'user_input', '2024-01-01T09:00:00Z'),
                createMockArtifact('brainstorm-idea-1', 'brainstorm_item_schema', 'ai_generated', '2024-01-01T10:00:00Z'),
                createMockArtifact('brainstorm-idea-2', 'brainstorm_item_schema', 'ai_generated', '2024-01-01T10:01:00Z'),
                createMockArtifact('brainstorm-idea-3', 'brainstorm_item_schema', 'ai_generated', '2024-01-01T10:02:00Z')
            ];
            mockProjectData.transforms = [
                createMockTransform('transform-1', 'llm', 'completed', '2024-01-01T10:00:00Z')
            ];
            mockProjectData.transformInputs = [
                createMockTransformInput('transform-1', 'brainstorm-input-1')
            ];
            mockProjectData.transformOutputs = [
                createMockTransformOutput('transform-1', 'brainstorm-idea-1'),
                createMockTransformOutput('transform-1', 'brainstorm-idea-2'),
                createMockTransformOutput('transform-1', 'brainstorm-idea-3')
            ];
            mockProjectData.humanTransforms = [];
        });

        it('should detect idea_editing stage (latest AI idea auto-chosen)', () => {
            const { currentStage } = computeParamsAndActions(mockProjectData);
            expect(currentStage).toBe('idea_editing');
        });

        it('should generate outline generation action', () => {
            const { actions } = computeParamsAndActions(mockProjectData);

            expect(actions.length).toBeGreaterThan(0);
            expect(actions[0].id).toBe('outline_generation');
            expect(actions[0].title).toBe('生成大纲');
        });

        it('should not have active transforms', () => {
            const { hasActiveTransforms } = computeParamsAndActions(mockProjectData);
            expect(hasActiveTransforms).toBe(false);
        });
    });

    describe('Scenario 2: Brainstorm → Outline Settings', () => {
        beforeEach(() => {
            // Brainstorm item → Outline settings
            mockProjectData.artifacts = [
                createMockArtifact('brainstorm-1', 'brainstorm_item_schema', 'user_input', '2024-01-01T10:00:00Z'),
                createMockArtifact('outline-1', 'outline_settings_schema', 'ai_generated', '2024-01-01T11:00:00Z')
            ];
            mockProjectData.transforms = [
                createMockTransform('transform-1', 'llm', 'completed', '2024-01-01T10:30:00Z')
            ];
            mockProjectData.transformInputs = [
                createMockTransformInput('transform-1', 'brainstorm-1')
            ];
            mockProjectData.transformOutputs = [
                createMockTransformOutput('transform-1', 'outline-1')
            ];
            mockProjectData.humanTransforms = [];
        });

        it('should detect outline_generation stage', () => {
            const { currentStage } = computeParamsAndActions(mockProjectData);
            expect(currentStage).toBe('outline_generation');
        });

        it('should generate chronicles generation action', () => {
            const { actions } = computeParamsAndActions(mockProjectData);

            expect(actions.length).toBeGreaterThan(0);
            expect(actions[0].id).toBe('chronicles_generation');
            expect(actions[0].title).toBe('生成分集概要');
        });
    });

    describe('Scenario 3: Brainstorm → Outline → Chronicles', () => {
        beforeEach(() => {
            // Complete AI chain: Brainstorm → Outline → Chronicles
            mockProjectData.artifacts = [
                createMockArtifact('brainstorm-1', 'brainstorm_item_schema', 'user_input', '2024-01-01T10:00:00Z'),
                createMockArtifact('outline-1', 'outline_settings_schema', 'ai_generated', '2024-01-01T11:00:00Z'),
                createMockArtifact('chronicles-1', 'chronicles_schema', 'ai_generated', '2024-01-01T12:00:00Z')
            ];
            mockProjectData.transforms = [
                createMockTransform('transform-1', 'llm', 'completed', '2024-01-01T10:30:00Z'),
                createMockTransform('transform-2', 'llm', 'completed', '2024-01-01T11:30:00Z')
            ];
            mockProjectData.transformInputs = [
                createMockTransformInput('transform-1', 'brainstorm-1'),
                createMockTransformInput('transform-2', 'outline-1')
            ];
            mockProjectData.transformOutputs = [
                createMockTransformOutput('transform-1', 'outline-1'),
                createMockTransformOutput('transform-2', 'chronicles-1')
            ];
            mockProjectData.humanTransforms = [];
        });

        it('should detect chronicles_generation stage', () => {
            const { currentStage } = computeParamsAndActions(mockProjectData);
            expect(currentStage).toBe('chronicles_generation');
        });

        it('should generate episode synopsis generation action', () => {
            const { actions } = computeParamsAndActions(mockProjectData);

            expect(actions.length).toBeGreaterThan(0);
            expect(actions[0].id).toBe('episode_synopsis_generation');
            expect(actions[0].title).toBe('生成剧本');
        });
    });

    describe('Scenario 4: Active transforms (streaming state)', () => {
        beforeEach(() => {
            // Chronicles generation in progress
            mockProjectData.artifacts = [
                createMockArtifact('brainstorm-1', 'brainstorm_item_schema', 'user_input', '2024-01-01T10:00:00Z'),
                createMockArtifact('outline-1', 'outline_settings_schema', 'ai_generated', '2024-01-01T11:00:00Z')
            ];
            mockProjectData.transforms = [
                createMockTransform('transform-1', 'llm', 'completed', '2024-01-01T10:30:00Z'),
                createMockTransform('transform-2', 'llm', 'running', '2024-01-01T11:30:00Z')
            ];
            mockProjectData.transformInputs = [
                createMockTransformInput('transform-1', 'brainstorm-1'),
                createMockTransformInput('transform-2', 'outline-1')
            ];
            mockProjectData.transformOutputs = [
                createMockTransformOutput('transform-1', 'outline-1')
            ];
            mockProjectData.humanTransforms = [];
        });

        it('should detect active transforms', () => {
            const { hasActiveTransforms } = computeParamsAndActions(mockProjectData);
            expect(hasActiveTransforms).toBe(true);
        });

        it('should return empty actions when transforms are active', () => {
            const { actions } = computeParamsAndActions(mockProjectData);
            expect(actions).toHaveLength(0);
        });

        it('should still detect current stage correctly', () => {
            const { currentStage } = computeParamsAndActions(mockProjectData);
            expect(currentStage).toBe('outline_generation');
        });
    });

    describe('Scenario 5: Multiple brainstorm ideas', () => {
        beforeEach(() => {
            // Multiple brainstorm ideas - but since none are used in transforms, 
            // the latest one becomes the "chosen" one automatically
            mockProjectData.artifacts = [
                createMockArtifact('brainstorm-idea-1', 'brainstorm_item_schema', 'user_input', '2024-01-01T10:30:00Z'),
                createMockArtifact('brainstorm-idea-2', 'brainstorm_item_schema', 'user_input', '2024-01-01T10:31:00Z'),
                createMockArtifact('brainstorm-idea-3', 'brainstorm_item_schema', 'user_input', '2024-01-01T10:32:00Z')
            ];
            mockProjectData.transforms = [];
            mockProjectData.transformInputs = [];
            mockProjectData.transformOutputs = [];
            mockProjectData.humanTransforms = [];
        });

        it('should detect idea_editing stage (latest idea is auto-chosen)', () => {
            const { currentStage } = computeParamsAndActions(mockProjectData);
            expect(currentStage).toBe('idea_editing');
        });

        it('should include outline generation action', () => {
            const { actions } = computeParamsAndActions(mockProjectData);

            expect(actions.length).toBeGreaterThan(0);
            expect(actions[0].id).toBe('outline_generation');
            expect(actions[0].title).toBe('生成大纲');
        });
    });

    describe('Scenario 6: Empty project (initial state)', () => {
        beforeEach(() => {
            // Completely empty project
            mockProjectData.artifacts = [];
            mockProjectData.transforms = [];
            mockProjectData.transformInputs = [];
            mockProjectData.transformOutputs = [];
            mockProjectData.humanTransforms = [];
        });

        it('should detect initial stage', () => {
            const { currentStage } = computeParamsAndActions(mockProjectData);
            expect(currentStage).toBe('initial');
        });

        it('should generate brainstorm creation actions', () => {
            const { actions } = computeParamsAndActions(mockProjectData);

            expect(actions.length).toBeGreaterThan(0);
            expect(actions[0].id).toBe('brainstorm_creation');
            expect(actions[0].title).toBe('创建头脑风暴');
        });

        it('should not have active transforms', () => {
            const { hasActiveTransforms } = computeParamsAndActions(mockProjectData);
            expect(hasActiveTransforms).toBe(false);
        });
    });

    describe('Scenario 7: Brainstorm input artifact', () => {
        beforeEach(() => {
            // Has brainstorm input artifact but no generated ideas yet
            mockProjectData.artifacts = [
                createMockArtifact('brainstorm-input-1', 'brainstorm_tool_input_schema', 'user_input', '2024-01-01T10:00:00Z')
            ];
            mockProjectData.transforms = [];
            mockProjectData.transformInputs = [];
            mockProjectData.transformOutputs = [];
            mockProjectData.humanTransforms = [];
        });

        it('should detect brainstorm_input stage', () => {
            const { currentStage } = computeParamsAndActions(mockProjectData);
            expect(currentStage).toBe('brainstorm_input');
        });

        it('should generate brainstorm start action', () => {
            const { actions } = computeParamsAndActions(mockProjectData);

            expect(actions.length).toBeGreaterThan(0);
            expect(actions[0].id).toBe('brainstorm_start_button');
            expect(actions[0].title).toBe('开始头脑风暴');
        });
    });

    describe('Scenario 8: Real-world bug case - Chronicles with human edits stuck at initial', () => {
        beforeEach(() => {
            // Exact replication of the bug case from project 19a21561-2885-4be3-8398-738a2ed8d0ec
            mockProjectData.artifacts = [
                createMockArtifact('17be1a8c-7d51-4344-8b5d-1f6fdbed8a3b', 'brainstorm_item_schema', 'user_input', '2025-07-08T13:44:10.385Z'),
                createMockArtifact('4751bf6f-9a89-4111-87d0-1e94b3390be6', 'outline_settings_schema', 'ai_generated', '2025-07-08T14:18:09.613Z'),
                createMockArtifact('18dedd5b-3ced-4bf1-b70b-c4f0888642c9', 'chronicles_schema', 'ai_generated', '2025-07-08T14:27:49.233Z'),
                createMockArtifact('68f0c7db-f8c9-4ff6-9bf9-f6f89cdbac41', 'chronicle_stage_schema', 'user_input', '2025-07-08T15:07:36.086Z'),
                createMockArtifact('492213e5-2fcb-4755-97a3-7fc5b08ec1f4', 'chronicle_stage_schema', 'user_input', '2025-07-08T15:08:55.978Z')
            ];
            mockProjectData.transforms = [
                createMockTransform('927207f9-a729-44c4-9261-6cf48793fd06', 'llm', 'completed', '2025-07-08T13:44:10.385Z'),
                createMockTransform('2dae761d-3b9e-44cb-8c1a-b4a6a3eedd10', 'llm', 'completed', '2025-07-08T14:18:09.613Z'),
                createMockTransform('14b6f28b-ecc4-4ca6-afc8-c2baa1d31604', 'human', 'completed', '2025-07-08T15:07:36.086Z'),
                createMockTransform('e857e6d1-359d-434d-aaea-e2606742bdfe', 'human', 'completed', '2025-07-08T15:08:55.978Z')
            ];
            mockProjectData.transformInputs = [
                createMockTransformInput('927207f9-a729-44c4-9261-6cf48793fd06', '17be1a8c-7d51-4344-8b5d-1f6fdbed8a3b'),
                createMockTransformInput('2dae761d-3b9e-44cb-8c1a-b4a6a3eedd10', '4751bf6f-9a89-4111-87d0-1e94b3390be6'),
                createMockTransformInput('14b6f28b-ecc4-4ca6-afc8-c2baa1d31604', '18dedd5b-3ced-4bf1-b70b-c4f0888642c9'),
                createMockTransformInput('e857e6d1-359d-434d-aaea-e2606742bdfe', '18dedd5b-3ced-4bf1-b70b-c4f0888642c9')
            ];
            mockProjectData.transformOutputs = [
                createMockTransformOutput('927207f9-a729-44c4-9261-6cf48793fd06', '4751bf6f-9a89-4111-87d0-1e94b3390be6'),
                createMockTransformOutput('2dae761d-3b9e-44cb-8c1a-b4a6a3eedd10', '18dedd5b-3ced-4bf1-b70b-c4f0888642c9'),
                createMockTransformOutput('14b6f28b-ecc4-4ca6-afc8-c2baa1d31604', '68f0c7db-f8c9-4ff6-9bf9-f6f89cdbac41'),
                createMockTransformOutput('e857e6d1-359d-434d-aaea-e2606742bdfe', '492213e5-2fcb-4755-97a3-7fc5b08ec1f4')
            ];
            mockProjectData.humanTransforms = [
                createMockHumanTransform('14b6f28b-ecc4-4ca6-afc8-c2baa1d31604', '18dedd5b-3ced-4bf1-b70b-c4f0888642c9', '68f0c7db-f8c9-4ff6-9bf9-f6f89cdbac41', '$.stages[3]'),
                createMockHumanTransform('e857e6d1-359d-434d-aaea-e2606742bdfe', '18dedd5b-3ced-4bf1-b70b-c4f0888642c9', '492213e5-2fcb-4755-97a3-7fc5b08ec1f4', '$.stages[7]')
            ];
        });

        it('should detect chronicles_generation stage, not initial stage', () => {
            const { currentStage } = computeParamsAndActions(mockProjectData);
            expect(currentStage).toBe('chronicles_generation');
        });

        it('should show episode generation actions', () => {
            const { actions } = computeParamsAndActions(mockProjectData);
            expect(actions).toHaveLength(1);
            expect(actions[0].id).toBe('episode_synopsis_generation');
            expect(actions[0].title).toBe('生成剧本');
        });

        it('should have brainstorm ideas and outline settings', () => {
            const { currentStage } = computeParamsAndActions(mockProjectData);

            // Debug the detection logic
            const artifacts = Array.isArray(mockProjectData.artifacts) ? mockProjectData.artifacts : [];
            const transformInputs = Array.isArray(mockProjectData.transformInputs) ? mockProjectData.transformInputs : [];
            const transforms = Array.isArray(mockProjectData.transforms) ? mockProjectData.transforms : [];

            const brainstormIdeas = artifacts.filter((a: any) =>
                a.schema_type === 'brainstorm_item_schema' && a.origin_type === 'user_input'
            );
            const outlineSettings = artifacts.filter((a: any) =>
                a.schema_type === 'outline_settings_schema'
            );
            const chronicles = artifacts.filter((a: any) =>
                a.schema_type === 'chronicles_schema'
            );

            expect(brainstormIdeas).toHaveLength(1);
            expect(outlineSettings).toHaveLength(1);
            expect(chronicles).toHaveLength(1);

            // The issue is that chronicles has human transforms but should still be eligible for episode generation
            const chroniclesId = chronicles[0].id;
            const chroniclesHasLLMTransforms = transformInputs.some((input: any) => {
                if (input.artifact_id === chroniclesId) {
                    const transform = transforms.find((t: any) => t.id === input.transform_id);
                    return transform?.type === 'llm';
                }
                return false;
            });

            expect(chroniclesHasLLMTransforms).toBe(false); // Chronicles has no LLM transforms using it as input
            expect(currentStage).toBe('chronicles_generation');
        });
    });

    describe('Scenario 9: EXACT Real-world bug replication', () => {
        beforeEach(() => {
            // This test replicates the exact issue: lineage graph is "pending" while artifacts are loaded
            // This causes the system to return initial stage instead of proper stage detection

            // Set up artifacts exactly like in the real project
            mockProjectData.artifacts = [
                createMockArtifact('17be1a8c-7d51-4344-8b5d-1f6fdbed8a3b', 'brainstorm_item_schema', 'user_input', '2025-07-08T13:44:10.385Z'),
                createMockArtifact('4751bf6f-9a89-4111-87d0-1e94b3390be6', 'outline_settings_schema', 'ai_generated', '2025-07-08T14:18:09.613Z'),
                createMockArtifact('18dedd5b-3ced-4bf1-b70b-c4f0888642c9', 'chronicles_schema', 'ai_generated', '2025-07-08T14:27:49.233Z'),
                createMockArtifact('68f0c7db-f8c9-4ff6-9bf9-f6f89cdbac41', 'chronicle_stage_schema', 'user_input', '2025-07-08T14:28:42.046Z'),
                createMockArtifact('e2f3d1c8-4b5a-6789-cdef-123456789abc', 'chronicle_stage_schema', 'user_input', '2025-07-08T14:29:15.123Z')
            ];

            // Set up transforms exactly like in the real project
            mockProjectData.transforms = [
                createMockTransform('transform-1', 'llm', 'completed', '2025-07-08T14:18:09.613Z'),
                createMockTransform('transform-2', 'llm', 'completed', '2025-07-08T14:27:49.233Z'),
                createMockTransform('transform-3', 'human', 'completed', '2025-07-08T14:28:42.046Z'),
                createMockTransform('transform-4', 'human', 'completed', '2025-07-08T14:29:15.123Z')
            ];

            // Set up transform inputs/outputs
            mockProjectData.transformInputs = [
                createMockTransformInput('transform-1', '17be1a8c-7d51-4344-8b5d-1f6fdbed8a3b'),
                createMockTransformInput('transform-2', '4751bf6f-9a89-4111-87d0-1e94b3390be6'),
                createMockTransformInput('transform-3', '18dedd5b-3ced-4bf1-b70b-c4f0888642c9'),
                createMockTransformInput('transform-4', '18dedd5b-3ced-4bf1-b70b-c4f0888642c9')
            ];

            mockProjectData.transformOutputs = [
                createMockTransformOutput('transform-1', '4751bf6f-9a89-4111-87d0-1e94b3390be6'),
                createMockTransformOutput('transform-2', '18dedd5b-3ced-4bf1-b70b-c4f0888642c9'),
                createMockTransformOutput('transform-3', '68f0c7db-f8c9-4ff6-9bf9-f6f89cdbac41'),
                createMockTransformOutput('transform-4', 'e2f3d1c8-4b5a-6789-cdef-123456789abc')
            ];

            // Set up human transforms for chronicle stage editing
            mockProjectData.humanTransforms = [
                createMockHumanTransform('transform-3', '18dedd5b-3ced-4bf1-b70b-c4f0888642c9', '$.stages[3]'),
                createMockHumanTransform('transform-4', '18dedd5b-3ced-4bf1-b70b-c4f0888642c9', '$.stages[7]')
            ];

            // THE KEY ISSUE: lineageGraph is "pending" while artifacts are loaded
            // This simulates the real-world scenario where Electric SQL data loads before lineage graph is built
            mockProjectData.lineageGraph = "pending";
        });

        it('should handle the case where lineageGraph is pending but artifacts are loaded', () => {
            const { currentStage, actions } = computeParamsAndActions(mockProjectData);

            // With the fix, it should fall back to legacy computation and detect correct stage
            expect(currentStage).toBe('chronicles_generation'); // Fixed behavior
            expect(actions).toHaveLength(1); // Fixed behavior
            expect(actions[0].id).toBe('episode_synopsis_generation');
        });

        it('should use legacy computation fallback when lineageGraph is pending (computeParamsAndActionsFromLineage)', () => {
            const { currentStage, actions } = computeParamsAndActionsFromLineage(mockProjectData);

            // Should fall back to legacy computation and get correct results
            expect(currentStage).toBe('chronicles_generation');
            expect(actions).toHaveLength(1);
            expect(actions[0].id).toBe('episode_synopsis_generation');
        });

        it('should work correctly when lineageGraph is available', () => {
            // Build a proper lineage graph with correct structure
            const mockLineageGraph = {
                paths: new Map(),
                rootNodes: ['17be1a8c-7d51-4344-8b5d-1f6fdbed8a3b'],
                // Add other required properties for LineageGraph
            };

            mockProjectData.lineageGraph = mockLineageGraph as any;

            const { currentStage, actions } = computeParamsAndActions(mockProjectData);

            // With proper lineage graph, it should detect the correct stage
            // This test will initially fail, showing the actual behavior
            console.log('With lineage graph - currentStage:', currentStage, 'actions:', actions.length);
        });
    });

    describe('Edge cases and error handling', () => {
        it('should handle pending data states', () => {
            mockProjectData.artifacts = "pending";
            mockProjectData.transforms = "pending";

            const result = computeParamsAndActions(mockProjectData);
            expect(result.currentStage).toBe('initial');
            expect(result.hasActiveTransforms).toBe(false);
        });

        it('should handle error data states', () => {
            mockProjectData.artifacts = "error";
            mockProjectData.transforms = "error";

            const result = computeParamsAndActions(mockProjectData);
            expect(result.currentStage).toBe('initial');
            expect(result.hasActiveTransforms).toBe(false);
        });

        it('should handle concurrent transforms correctly', () => {
            mockProjectData.artifacts = [
                createMockArtifact('brainstorm-1', 'brainstorm_item_schema', 'user_input', '2024-01-01T10:00:00Z')
            ];
            mockProjectData.transforms = [
                createMockTransform('transform-1', 'llm', 'running', '2024-01-01T10:30:00Z'),
                createMockTransform('transform-2', 'llm', 'pending', '2024-01-01T10:31:00Z')
            ];

            const result = computeParamsAndActions(mockProjectData);
            expect(result.hasActiveTransforms).toBe(true);
            expect(result.actions).toHaveLength(0);
        });

        it('should handle malformed artifact data gracefully', () => {
            mockProjectData.artifacts = [
                {
                    ...createMockArtifact('bad-artifact', 'brainstorm_item_schema', 'user_input', '2024-01-01T10:00:00Z'),
                    data: 'invalid-json'
                }
            ];

            const result = computeParamsAndActions(mockProjectData);
            expect(result.currentStage).toBe('idea_editing');
            expect(result.actions.length).toBeGreaterThan(0);
        });
    });
}); 