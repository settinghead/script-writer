import { describe, it, expect } from 'vitest';
import {
    computeDisplayComponents,
    computeWorkflowParameters,
    isLeafNode,
    canBecomeEditable
} from '../actionComputation';
import { ProjectDataContextType, ElectricArtifact } from '../../../common/types';
import { LineageGraph, LineageNodeArtifact } from '../../../common/transform-artifact-framework/lineageResolution';
import { ElectricTransformInput } from '../../../common/types';

// Mock lineage graph structure
const mockLineageGraph: LineageGraph = {
    nodes: new Map([
        ['canonical-outline-1', {
            type: 'artifact' as const,
            artifactId: 'canonical-outline-1',
            isLeaf: true,
            depth: 2,
            artifactType: 'outline_settings',
            sourceTransform: 'none',
            schemaType: 'outline_settings_schema',
            originType: 'user_input',
            artifact: { id: 'canonical-outline-1' } as ElectricArtifact,
            createdAt: '2025-01-01T00:00:00Z'
        } as LineageNodeArtifact],
        ['canonical-outline-2', {
            type: 'artifact' as const,
            artifactId: 'canonical-outline-2',
            isLeaf: false,
            depth: 1,
            artifactType: 'outline_settings',
            sourceTransform: 'none',
            schemaType: 'outline_settings_schema',
            originType: 'ai_generated',
            artifact: { id: 'canonical-outline-2' } as ElectricArtifact,
            createdAt: '2025-01-02T00:00:00Z'
        } as LineageNodeArtifact],
        ['brainstorm-1', {
            type: 'artifact' as const,
            artifactId: 'brainstorm-1',
            isLeaf: true,
            depth: 1,
            artifactType: 'brainstorm_idea',
            sourceTransform: 'none',
            schemaType: 'brainstorm_idea_schema',
            originType: 'user_input',
            artifact: { id: 'brainstorm-1' } as ElectricArtifact,
            createdAt: '2025-01-01T00:00:00Z'
        } as LineageNodeArtifact]
    ]),
    edges: new Map(),
    paths: new Map(),
    rootNodes: new Set(['brainstorm-1', 'canonical-outline-2'])
};

describe('actionComputation - Lineage Graph Integration', () => {
    describe('computeDisplayComponents with lineage filtering', () => {
        it('should only consider canonical outline settings from lineage graph, not all database artifacts', () => {
            const mockProjectData: ProjectDataContextType = {
                artifacts: [
                    // Canonical outline settings (in lineage graph)
                    {
                        id: 'canonical-outline-1',
                        project_id: 'test-project',
                        schema_type: 'outline_settings_schema',
                        schema_version: 'v1',
                        origin_type: 'user_input',
                        created_at: '2025-01-01T00:00:00Z',
                        data: '{"title": "Canonical Outline 1"}'
                    },
                    {
                        id: 'canonical-outline-2',
                        project_id: 'test-project',
                        schema_type: 'outline_settings_schema',
                        schema_version: 'v1',
                        origin_type: 'ai_generated',
                        created_at: '2025-01-02T00:00:00Z',
                        data: '{"title": "Canonical Outline 2"}'
                    },
                    // Dead/orphaned outline settings (NOT in lineage graph)
                    {
                        id: 'dead-outline-1',
                        project_id: 'test-project',
                        schema_type: 'outline_settings_schema',
                        schema_version: 'v1',
                        origin_type: 'user_input',
                        created_at: '2025-01-03T00:00:00Z',
                        data: '{"title": "Dead Outline 1"}'
                    },
                    {
                        id: 'dead-outline-2',
                        project_id: 'test-project',
                        schema_type: 'outline_settings_schema',
                        schema_version: 'v1',
                        origin_type: 'ai_generated',
                        created_at: '2025-01-04T00:00:00Z',
                        data: '{"title": "Dead Outline 2"}'
                    },
                    // Brainstorm idea (in lineage graph)
                    {
                        id: 'brainstorm-1',
                        project_id: 'test-project',
                        schema_type: 'brainstorm_idea_schema',
                        schema_version: 'v1',
                        origin_type: 'user_input',
                        created_at: '2025-01-01T00:00:00Z',
                        data: '{"title": "Test Idea", "body": "Test body"}'
                    }
                ] as ElectricArtifact[],
                transforms: [],
                humanTransforms: [],
                transformInputs: [],
                transformOutputs: [],
                llmPrompts: [],
                llmTransforms: [],
                lineageGraph: mockLineageGraph,
                isLoading: false,
                isError: false,
                error: null,
                getBrainstormCollections: () => [],
                getArtifactAtPath: () => null,
                getLatestVersionForPath: () => null,
                getBrainstormArtifacts: () => [],
                getLineageGraph: () => mockLineageGraph,
                getOutlineArtifacts: () => [],
                getArtifactById: (id: string) => {
                    const artifacts = mockProjectData.artifacts;
                    if (Array.isArray(artifacts)) {
                        const artifact = artifacts.find(a => a.id === id);
                        return artifact ? { ...artifact, sourceTransform: 'none', isEditable: true } : undefined;
                    }
                    return undefined;
                },
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
                clearEntityMutationState: () => { }
            };

            const components = computeDisplayComponents(
                'outline_generation',
                false,
                mockProjectData
            );

            // Should find the outline settings component
            const outlineComponent = components.find(c => c.id === 'outline-settings-display');
            expect(outlineComponent).toBeDefined();

            // Should use the canonical leaf outline (user_input takes priority)
            expect(outlineComponent?.props.outlineSettings?.id).toBe('canonical-outline-1');
            expect(outlineComponent?.props.outlineSettings?.origin_type).toBe('user_input');

            // Should be editable since it's a leaf user_input artifact
            expect(outlineComponent?.props.isEditable).toBe(true);
        });

        it('should prioritize user_input over ai_generated when both are leaf nodes', () => {
            const mockLineageGraphBothLeaf: LineageGraph = {
                nodes: new Map([
                    ['canonical-outline-1', {
                        type: 'artifact' as const,
                        artifactId: 'canonical-outline-1',
                        isLeaf: true, // Both are leaf nodes
                        depth: 2,
                        artifactType: 'outline_settings',
                        sourceTransform: 'none',
                        schemaType: 'outline_settings_schema',
                        originType: 'user_input',
                        artifact: { id: 'canonical-outline-1' } as ElectricArtifact,
                        createdAt: '2025-01-01T00:00:00Z'
                    } as LineageNodeArtifact],
                    ['canonical-outline-2', {
                        type: 'artifact' as const,
                        artifactId: 'canonical-outline-2',
                        isLeaf: true, // Both are leaf nodes
                        depth: 1,
                        artifactType: 'outline_settings',
                        sourceTransform: 'none',
                        schemaType: 'outline_settings_schema',
                        originType: 'ai_generated',
                        artifact: { id: 'canonical-outline-2' } as ElectricArtifact,
                        createdAt: '2025-01-02T00:00:00Z'
                    } as LineageNodeArtifact]
                ]),
                edges: new Map(),
                paths: new Map(),
                rootNodes: new Set(['canonical-outline-1', 'canonical-outline-2'])
            };

            const mockProjectData: ProjectDataContextType = {
                artifacts: [
                    {
                        id: 'canonical-outline-1',
                        project_id: 'test-project',
                        schema_type: 'outline_settings_schema',
                        schema_version: 'v1',
                        origin_type: 'user_input',
                        created_at: '2025-01-01T00:00:00Z',
                        data: '{"title": "User Input Outline"}'
                    },
                    {
                        id: 'canonical-outline-2',
                        project_id: 'test-project',
                        schema_type: 'outline_settings_schema',
                        schema_version: 'v1',
                        origin_type: 'ai_generated',
                        created_at: '2025-01-02T00:00:00Z',
                        data: '{"title": "AI Generated Outline"}'
                    }
                ] as ElectricArtifact[],
                transforms: [],
                humanTransforms: [],
                transformInputs: [],
                transformOutputs: [],
                llmPrompts: [],
                llmTransforms: [],
                lineageGraph: mockLineageGraphBothLeaf,
                isLoading: false,
                isError: false,
                error: null,
                getBrainstormCollections: () => [],
                getArtifactAtPath: () => null,
                getLatestVersionForPath: () => null,
                getBrainstormArtifacts: () => [],
                getLineageGraph: () => mockLineageGraphBothLeaf,
                getOutlineArtifacts: () => [],
                getArtifactById: (id: string) => {
                    const artifacts = mockProjectData.artifacts;
                    if (Array.isArray(artifacts)) {
                        const artifact = artifacts.find(a => a.id === id);
                        return artifact ? { ...artifact, sourceTransform: 'none', isEditable: true } : undefined;
                    }
                    return undefined;
                },
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
                clearEntityMutationState: () => { }
            };

            const components = computeDisplayComponents(
                'outline_generation',
                false,
                mockProjectData
            );

            const outlineComponent = components.find(c => c.id === 'outline-settings-display');
            expect(outlineComponent).toBeDefined();

            // Should prioritize user_input over ai_generated
            expect(outlineComponent?.props.outlineSettings?.id).toBe('canonical-outline-1');
            expect(outlineComponent?.props.outlineSettings?.origin_type).toBe('user_input');
            expect(outlineComponent?.props.isEditable).toBe(true);
        });

        it('should not be editable when outline settings is ai_generated', () => {
            const mockLineageGraphAIOnly: LineageGraph = {
                nodes: new Map([
                    ['canonical-outline-ai', {
                        type: 'artifact' as const,
                        artifactId: 'canonical-outline-ai',
                        isLeaf: true,
                        depth: 2,
                        artifactType: 'outline_settings',
                        sourceTransform: 'none',
                        schemaType: 'outline_settings_schema',
                        originType: 'ai_generated',
                        artifact: { id: 'canonical-outline-ai' } as ElectricArtifact,
                        createdAt: '2025-01-01T00:00:00Z'
                    } as LineageNodeArtifact]
                ]),
                edges: new Map(),
                paths: new Map(),
                rootNodes: new Set(['canonical-outline-ai'])
            };

            const mockProjectData: ProjectDataContextType = {
                artifacts: [
                    {
                        id: 'canonical-outline-ai',
                        project_id: 'test-project',
                        schema_type: 'outline_settings_schema',
                        schema_version: 'v1',
                        origin_type: 'ai_generated',
                        created_at: '2025-01-01T00:00:00Z',
                        data: '{"title": "AI Generated Outline"}'
                    }
                ] as ElectricArtifact[],
                transforms: [],
                humanTransforms: [],
                transformInputs: [],
                transformOutputs: [],
                llmPrompts: [],
                llmTransforms: [],
                lineageGraph: mockLineageGraphAIOnly,
                isLoading: false,
                isError: false,
                error: null,
                getBrainstormCollections: () => [],
                getArtifactAtPath: () => null,
                getLatestVersionForPath: () => null,
                getBrainstormArtifacts: () => [],
                getLineageGraph: () => mockLineageGraphAIOnly,
                getOutlineArtifacts: () => [],
                getArtifactById: (id: string) => {
                    const artifacts = mockProjectData.artifacts;
                    if (Array.isArray(artifacts)) {
                        const artifact = artifacts.find(a => a.id === id);
                        return artifact ? { ...artifact, sourceTransform: 'none', isEditable: true } : undefined;
                    }
                    return undefined;
                },
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
                clearEntityMutationState: () => { }
            };

            const components = computeDisplayComponents(
                'outline_generation',
                false,
                mockProjectData
            );

            const outlineComponent = components.find(c => c.id === 'outline-settings-display');
            expect(outlineComponent).toBeDefined();

            // Should not be editable since it's ai_generated
            expect(outlineComponent?.props.outlineSettings?.id).toBe('canonical-outline-ai');
            expect(outlineComponent?.props.outlineSettings?.origin_type).toBe('ai_generated');
            expect(outlineComponent?.props.isEditable).toBe(false);
        });

        it('should handle missing lineage graph gracefully', () => {
            const mockProjectData: ProjectDataContextType = {
                artifacts: [
                    {
                        id: 'outline-1',
                        project_id: 'test-project',
                        schema_type: 'outline_settings_schema',
                        schema_version: 'v1',
                        origin_type: 'user_input',
                        created_at: '2025-01-01T00:00:00Z',
                        data: '{"title": "Outline 1"}'
                    }
                ] as ElectricArtifact[],
                transforms: [],
                humanTransforms: [],
                transformInputs: [],
                transformOutputs: [],
                llmPrompts: [],
                llmTransforms: [],
                lineageGraph: "pending", // Lineage graph not available
                isLoading: false,
                isError: false,
                error: null,
                getBrainstormCollections: () => [],
                getArtifactAtPath: () => null,
                getLatestVersionForPath: () => null,
                getBrainstormArtifacts: () => [],
                getLineageGraph: () => "pending",
                getOutlineArtifacts: () => [],
                getArtifactById: (id: string) => {
                    const artifacts = mockProjectData.artifacts;
                    if (Array.isArray(artifacts)) {
                        const artifact = artifacts.find(a => a.id === id);
                        return artifact ? { ...artifact, sourceTransform: 'none', isEditable: true } : undefined;
                    }
                    return undefined;
                },
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
                clearEntityMutationState: () => { }
            };

            const components = computeDisplayComponents(
                'outline_generation',
                false,
                mockProjectData
            );

            // Should return empty components when lineage graph is not available
            expect(components).toEqual([]);
        });
    });

    describe('computeWorkflowParameters with lineage filtering', () => {
        it('should use lineage graph to find canonical outline settings', () => {
            const mockProjectData: ProjectDataContextType = {
                artifacts: [
                    // Canonical outline (in lineage graph)
                    {
                        id: 'canonical-outline-1',
                        project_id: 'test-project',
                        schema_type: 'outline_settings_schema',
                        schema_version: 'v1',
                        origin_type: 'user_input',
                        created_at: '2025-01-01T00:00:00Z',
                        data: '{"title": "Canonical Outline"}'
                    },
                    // Dead outline (NOT in lineage graph)
                    {
                        id: 'dead-outline-1',
                        project_id: 'test-project',
                        schema_type: 'outline_settings_schema',
                        schema_version: 'v1',
                        origin_type: 'user_input',
                        created_at: '2025-01-02T00:00:00Z',
                        data: '{"title": "Dead Outline"}'
                    }
                ] as ElectricArtifact[],
                transforms: [],
                humanTransforms: [],
                transformInputs: [],
                transformOutputs: [],
                llmPrompts: [],
                llmTransforms: [],
                lineageGraph: mockLineageGraph,
                isLoading: false,
                isError: false,
                error: null,
                getBrainstormCollections: () => [],
                getArtifactAtPath: () => null,
                getLatestVersionForPath: () => null,
                getBrainstormArtifacts: () => [],
                getLineageGraph: () => mockLineageGraph,
                getOutlineArtifacts: () => [],
                getArtifactById: (id: string) => {
                    const artifacts = mockProjectData.artifacts;
                    if (Array.isArray(artifacts)) {
                        const artifact = artifacts.find(a => a.id === id);
                        return artifact ? { ...artifact, sourceTransform: 'none', isEditable: true } : undefined;
                    }
                    return undefined;
                },
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
                clearEntityMutationState: () => { }
            };

            const params = computeWorkflowParameters(mockProjectData, 'test-project');

            // Should find the canonical outline settings, not the dead one
            expect(params.latestOutlineSettings?.id).toBe('canonical-outline-1');
            expect(params.latestOutlineSettings?.origin_type).toBe('user_input');
        });
    });
});

describe('actionComputation', () => {
    describe('isLeafNode', () => {
        it('should return true for artifact with no descendants', () => {
            const transformInputs = [
                { artifact_id: 'other-artifact', transform_id: 'transform-1' }
            ];
            expect(isLeafNode('test-artifact', transformInputs)).toBe(true);
        });

        it('should return false for artifact with descendants', () => {
            const transformInputs = [
                { artifact_id: 'test-artifact', transform_id: 'transform-1' }
            ];
            expect(isLeafNode('test-artifact', transformInputs)).toBe(false);
        });

        it('should return true for empty transform inputs', () => {
            expect(isLeafNode('test-artifact', [])).toBe(true);
        });
    });

    describe('canBecomeEditable', () => {
        it('should return true for AI-generated leaf node', () => {
            const artifact = { id: 'test', origin_type: 'ai_generated' };
            const transformInputs: any[] = [];
            expect(canBecomeEditable(artifact, transformInputs)).toBe(true);
        });

        it('should return false for user input artifact', () => {
            const artifact = { id: 'test', origin_type: 'user_input' };
            const transformInputs: any[] = [];
            expect(canBecomeEditable(artifact, transformInputs)).toBe(false);
        });

        it('should return false for artifact with descendants', () => {
            const artifact = { id: 'test', origin_type: 'ai_generated' };
            const transformInputs = [{ artifact_id: 'test', transform_id: 'transform-1' }];
            expect(canBecomeEditable(artifact, transformInputs)).toBe(false);
        });
    });

    describe('computeDisplayComponents - outline settings selection', () => {
        it('should select user_input leaf node over ai_generated artifact with descendants', () => {
            // Create lineage graph that shows user artifact as leaf, AI artifact as non-leaf
            const mockLineageGraph: LineageGraph = {
                nodes: new Map([
                    ['ai-outline-artifact', {
                        type: 'artifact' as const,
                        artifactId: 'ai-outline-artifact',
                        isLeaf: false, // Has descendants
                        depth: 1,
                        artifactType: 'outline_settings',
                        sourceTransform: 'none',
                        schemaType: 'outline_settings_schema',
                        originType: 'ai_generated',
                        artifact: { id: 'ai-outline-artifact' } as ElectricArtifact,
                        createdAt: '2025-01-01T10:00:00Z'
                    } as LineageNodeArtifact],
                    ['user-outline-artifact', {
                        type: 'artifact' as const,
                        artifactId: 'user-outline-artifact',
                        isLeaf: true, // Leaf node
                        depth: 2,
                        artifactType: 'outline_settings',
                        sourceTransform: 'none',
                        schemaType: 'outline_settings_schema',
                        originType: 'user_input',
                        artifact: { id: 'user-outline-artifact' } as ElectricArtifact,
                        createdAt: '2025-01-01T11:00:00Z'
                    } as LineageNodeArtifact]
                ]),
                edges: new Map(),
                paths: new Map(),
                rootNodes: new Set(['ai-outline-artifact'])
            };

            // Mock project data with two outline settings artifacts
            const mockProjectData: ProjectDataContextType = {
                artifacts: [
                    // AI-generated artifact (older, has descendants)
                    {
                        id: 'ai-outline-artifact',
                        project_id: 'test-project',
                        schema_type: 'outline_settings_schema',
                        schema_version: 'v1',
                        origin_type: 'ai_generated',
                        created_at: '2025-01-01T10:00:00Z',
                        data: '{"title": "AI Generated Outline"}'
                    },
                    // User input artifact (newer, leaf node)
                    {
                        id: 'user-outline-artifact',
                        project_id: 'test-project',
                        schema_type: 'outline_settings_schema',
                        schema_version: 'v1',
                        origin_type: 'user_input',
                        created_at: '2025-01-01T11:00:00Z',
                        data: '{"title": "User Edited Outline"}'
                    }
                ] as ElectricArtifact[],
                transforms: [],
                humanTransforms: [],
                transformInputs: [
                    // AI-generated artifact has descendants (used as input to another transform)
                    {
                        id: 1,
                        project_id: 'test-project',
                        transform_id: 'some-transform',
                        artifact_id: 'ai-outline-artifact',
                        input_role: 'source'
                    }
                    // User artifact has no descendants (is a leaf node)
                ],
                transformOutputs: [],
                llmPrompts: [],
                llmTransforms: [],
                lineageGraph: mockLineageGraph,
                isLoading: false,
                isError: false,
                error: null,
                getBrainstormCollections: () => [],
                getArtifactAtPath: () => null,
                getLatestVersionForPath: () => null,
                getBrainstormArtifacts: () => [],
                getLineageGraph: () => mockLineageGraph,
                getOutlineArtifacts: () => [],
                getArtifactById: (id: string) => {
                    const artifacts = mockProjectData.artifacts;
                    if (Array.isArray(artifacts)) {
                        const artifact = artifacts.find(a => a.id === id);
                        return artifact ? { ...artifact, sourceTransform: 'none', isEditable: true } : undefined;
                    }
                    return undefined;
                },
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
                clearEntityMutationState: () => { }
            };

            const displayComponents = computeDisplayComponents(
                'outline_generation',
                false, // hasActiveTransforms
                mockProjectData
            );

            // Find the outline settings display component
            const outlineComponent = displayComponents.find(
                component => component.id === 'outline-settings-display'
            );

            expect(outlineComponent).toBeDefined();
            expect(outlineComponent?.props?.outlineSettings?.id).toBe('user-outline-artifact');
            expect(outlineComponent?.props?.outlineSettings?.origin_type).toBe('user_input');
            expect(outlineComponent?.props?.isEditable).toBe(true);
        });

        it('should fallback to most recent artifact when no leaf nodes exist', () => {
            // Create lineage graph where both artifacts are non-leaf
            const mockLineageGraph: LineageGraph = {
                nodes: new Map([
                    ['old-outline-artifact', {
                        type: 'artifact' as const,
                        artifactId: 'old-outline-artifact',
                        isLeaf: false, // Has descendants
                        depth: 1,
                        artifactType: 'outline_settings',
                        sourceTransform: 'none',
                        schemaType: 'outline_settings_schema',
                        originType: 'ai_generated',
                        artifact: { id: 'old-outline-artifact' } as ElectricArtifact,
                        createdAt: '2025-01-01T10:00:00Z'
                    } as LineageNodeArtifact],
                    ['new-outline-artifact', {
                        type: 'artifact' as const,
                        artifactId: 'new-outline-artifact',
                        isLeaf: false, // Has descendants
                        depth: 2,
                        artifactType: 'outline_settings',
                        sourceTransform: 'none',
                        schemaType: 'outline_settings_schema',
                        originType: 'ai_generated',
                        artifact: { id: 'new-outline-artifact' } as ElectricArtifact,
                        createdAt: '2025-01-01T11:00:00Z'
                    } as LineageNodeArtifact]
                ]),
                edges: new Map(),
                paths: new Map(),
                rootNodes: new Set(['old-outline-artifact'])
            };

            // Mock project data where both artifacts have descendants
            const mockProjectData: ProjectDataContextType = {
                artifacts: [
                    // Older AI-generated artifact
                    {
                        id: 'old-outline-artifact',
                        project_id: 'test-project',
                        schema_type: 'outline_settings_schema',
                        schema_version: 'v1',
                        origin_type: 'ai_generated',
                        created_at: '2025-01-01T10:00:00Z',
                        data: '{"title": "Old Outline"}'
                    },
                    // Newer AI-generated artifact
                    {
                        id: 'new-outline-artifact',
                        project_id: 'test-project',
                        schema_type: 'outline_settings_schema',
                        schema_version: 'v1',
                        origin_type: 'ai_generated',
                        created_at: '2025-01-01T11:00:00Z',
                        data: '{"title": "New Outline"}'
                    }
                ] as ElectricArtifact[],
                transforms: [],
                humanTransforms: [],
                transformInputs: [
                    // Both artifacts have descendants
                    {
                        id: 1,
                        project_id: 'test-project',
                        transform_id: 'transform-1',
                        artifact_id: 'old-outline-artifact',
                        input_role: 'source'
                    },
                    {
                        id: 2,
                        project_id: 'test-project',
                        transform_id: 'transform-2',
                        artifact_id: 'new-outline-artifact',
                        input_role: 'source'
                    }
                ],
                transformOutputs: [],
                llmPrompts: [],
                llmTransforms: [],
                lineageGraph: mockLineageGraph,
                isLoading: false,
                isError: false,
                error: null,
                getBrainstormCollections: () => [],
                getArtifactAtPath: () => null,
                getLatestVersionForPath: () => null,
                getBrainstormArtifacts: () => [],
                getLineageGraph: () => mockLineageGraph,
                getOutlineArtifacts: () => [],
                getArtifactById: (id: string) => {
                    const artifacts = mockProjectData.artifacts;
                    if (Array.isArray(artifacts)) {
                        const artifact = artifacts.find(a => a.id === id);
                        return artifact ? { ...artifact, sourceTransform: 'none', isEditable: true } : undefined;
                    }
                    return undefined;
                },
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
                clearEntityMutationState: () => { }
            };

            const displayComponents = computeDisplayComponents(
                'outline_generation',
                false, // hasActiveTransforms
                mockProjectData
            );

            // Find the outline settings display component
            const outlineComponent = displayComponents.find(
                component => component.id === 'outline-settings-display'
            );

            expect(outlineComponent).toBeDefined();
            // Should select the most recent artifact as fallback
            expect(outlineComponent?.props?.outlineSettings?.id).toBe('new-outline-artifact');
            expect(outlineComponent?.props?.isEditable).toBe(false); // Not editable because it has descendants
        });

        it('should prioritize user_input over ai_generated when both are leaf nodes', () => {
            // Create lineage graph where both artifacts are leaf nodes
            const mockLineageGraph: LineageGraph = {
                nodes: new Map([
                    ['ai-leaf-artifact', {
                        type: 'artifact' as const,
                        artifactId: 'ai-leaf-artifact',
                        isLeaf: true, // Leaf node
                        depth: 1,
                        artifactType: 'outline_settings',
                        sourceTransform: 'none',
                        schemaType: 'outline_settings_schema',
                        originType: 'ai_generated',
                        artifact: { id: 'ai-leaf-artifact' } as ElectricArtifact,
                        createdAt: '2025-01-01T10:00:00Z'
                    } as LineageNodeArtifact],
                    ['user-leaf-artifact', {
                        type: 'artifact' as const,
                        artifactId: 'user-leaf-artifact',
                        isLeaf: true, // Leaf node
                        depth: 1,
                        artifactType: 'outline_settings',
                        sourceTransform: 'none',
                        schemaType: 'outline_settings_schema',
                        originType: 'user_input',
                        artifact: { id: 'user-leaf-artifact' } as ElectricArtifact,
                        createdAt: '2025-01-01T11:00:00Z'
                    } as LineageNodeArtifact]
                ]),
                edges: new Map(),
                paths: new Map(),
                rootNodes: new Set(['ai-leaf-artifact', 'user-leaf-artifact'])
            };

            // Mock project data with two leaf node artifacts
            const mockProjectData: ProjectDataContextType = {
                artifacts: [
                    // AI-generated leaf node (older)
                    {
                        id: 'ai-leaf-artifact',
                        project_id: 'test-project',
                        schema_type: 'outline_settings_schema',
                        schema_version: 'v1',
                        origin_type: 'ai_generated',
                        created_at: '2025-01-01T10:00:00Z',
                        data: '{"title": "AI Leaf Outline"}'
                    },
                    // User input leaf node (newer)
                    {
                        id: 'user-leaf-artifact',
                        project_id: 'test-project',
                        schema_type: 'outline_settings_schema',
                        schema_version: 'v1',
                        origin_type: 'user_input',
                        created_at: '2025-01-01T11:00:00Z',
                        data: '{"title": "User Leaf Outline"}'
                    }
                ] as ElectricArtifact[],
                transforms: [],
                humanTransforms: [],
                transformInputs: [
                    // Neither artifact has descendants
                ],
                transformOutputs: [],
                llmPrompts: [],
                llmTransforms: [],
                lineageGraph: mockLineageGraph,
                isLoading: false,
                isError: false,
                error: null,
                getBrainstormCollections: () => [],
                getArtifactAtPath: () => null,
                getLatestVersionForPath: () => null,
                getBrainstormArtifacts: () => [],
                getLineageGraph: () => mockLineageGraph,
                getOutlineArtifacts: () => [],
                getArtifactById: (id: string) => {
                    const artifacts = mockProjectData.artifacts;
                    if (Array.isArray(artifacts)) {
                        const artifact = artifacts.find(a => a.id === id);
                        return artifact ? { ...artifact, sourceTransform: 'none', isEditable: true } : undefined;
                    }
                    return undefined;
                },
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
                clearEntityMutationState: () => { }
            };

            const displayComponents = computeDisplayComponents(
                'outline_generation',
                false, // hasActiveTransforms
                mockProjectData
            );

            // Find the outline settings display component
            const outlineComponent = displayComponents.find(
                component => component.id === 'outline-settings-display'
            );

            expect(outlineComponent).toBeDefined();
            // Should prioritize user_input over ai_generated
            expect(outlineComponent?.props?.outlineSettings?.id).toBe('user-leaf-artifact');
            expect(outlineComponent?.props?.outlineSettings?.origin_type).toBe('user_input');
            expect(outlineComponent?.props?.isEditable).toBe(true);
        });

        it('should handle complex edit chains and correctly identify leaf nodes for editability', () => {
            // Generate a random chain length between 3-8 edits
            const chainLength = Math.floor(Math.random() * 6) + 3;
            console.log(`[Test] Testing outline edit chain with ${chainLength} artifacts`);

            // Build artifacts and transforms for the chain
            const artifacts: ElectricArtifact[] = [];
            const transformInputs: ElectricTransformInput[] = [];
            const transforms: any[] = [];
            const lineageNodes = new Map<string, LineageNodeArtifact>();

            // Start with initial AI-generated outline
            artifacts.push({
                id: 'outline-0',
                project_id: 'test-project',
                schema_type: 'outline_settings_schema',
                schema_version: 'v1',
                origin_type: 'ai_generated',
                created_at: '2025-01-01T10:00:00Z',
                data: '{"title": "Initial AI Outline", "version": 0}'
            });

            // Add to lineage graph
            lineageNodes.set('outline-0', {
                type: 'artifact' as const,
                artifactId: 'outline-0',
                isLeaf: chainLength === 1, // Only leaf if it's the only artifact
                depth: 0,
                artifactType: 'outline_settings',
                sourceTransform: 'none',
                schemaType: 'outline_settings_schema',
                originType: 'ai_generated',
                artifact: { id: 'outline-0' } as ElectricArtifact,
                createdAt: '2025-01-01T10:00:00Z'
            });

            // Build the chain: alternating human and machine edits
            for (let i = 1; i < chainLength; i++) {
                const isHumanEdit = i % 2 === 1; // Odd indices are human edits
                const originType = isHumanEdit ? 'user_input' : 'ai_generated';
                const editType = isHumanEdit ? 'human' : 'llm';

                // Create the artifact
                artifacts.push({
                    id: `outline-${i}`,
                    project_id: 'test-project',
                    schema_type: 'outline_settings_schema',
                    schema_version: 'v1',
                    origin_type: originType,
                    created_at: `2025-01-01T${10 + i}:00:00Z`,
                    data: JSON.stringify({
                        title: `${isHumanEdit ? 'Human' : 'AI'} Edit ${i}`,
                        version: i
                    })
                });

                // Add to lineage graph
                lineageNodes.set(`outline-${i}`, {
                    type: 'artifact' as const,
                    artifactId: `outline-${i}`,
                    isLeaf: i === chainLength - 1, // Only the last artifact is a leaf
                    depth: i,
                    artifactType: 'outline_settings',
                    sourceTransform: 'none',
                    schemaType: 'outline_settings_schema',
                    originType: originType,
                    artifact: { id: `outline-${i}` } as ElectricArtifact,
                    createdAt: `2025-01-01T${10 + i}:00:00Z`
                });

                // Create the transform
                transforms.push({
                    id: `transform-${i}`,
                    type: editType,
                    created_at: `2025-01-01T${10 + i}:00:00Z`
                });

                // Create transform input linking previous artifact to this transform
                transformInputs.push({
                    id: i,
                    project_id: 'test-project',
                    transform_id: `transform-${i}`,
                    artifact_id: `outline-${i - 1}`,
                    input_role: 'source'
                });
            }

            // Create the lineage graph
            const mockLineageGraph: LineageGraph = {
                nodes: lineageNodes,
                edges: new Map(),
                paths: new Map(),
                rootNodes: new Set(['outline-0'])
            };

            const mockProjectData: ProjectDataContextType = {
                artifacts,
                transforms: [],
                humanTransforms: [],
                transformInputs,
                transformOutputs: [],
                llmPrompts: [],
                llmTransforms: [],
                lineageGraph: mockLineageGraph,
                isLoading: false,
                isError: false,
                error: null,
                getBrainstormCollections: () => [],
                getArtifactAtPath: () => null,
                getLatestVersionForPath: () => null,
                getBrainstormArtifacts: () => [],
                getLineageGraph: () => mockLineageGraph,
                getOutlineArtifacts: () => [],
                getArtifactById: (id: string) => {
                    const artifacts = mockProjectData.artifacts;
                    if (Array.isArray(artifacts)) {
                        const artifact = artifacts.find(a => a.id === id);
                        return artifact ? { ...artifact, sourceTransform: 'none', isEditable: true } : undefined;
                    }
                    return undefined;
                },
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
                clearEntityMutationState: () => { }
            };

            console.log(`[Test] Chain structure:`, artifacts.map(a =>
                `${a.id} (${a.origin_type})`
            ).join(' -> '));

            const displayComponents = computeDisplayComponents(
                'outline_generation',
                false, // hasActiveTransforms
                mockProjectData
            );

            // Find the outline settings display component
            const outlineComponent = displayComponents.find(
                component => component.id === 'outline-settings-display'
            );

            expect(outlineComponent).toBeDefined();

            // The leaf node should be the last artifact in the chain
            const leafArtifact = artifacts[artifacts.length - 1];
            const isLeafHumanEdit = leafArtifact.origin_type === 'user_input';

            console.log(`[Test] Leaf artifact: ${leafArtifact.id} (${leafArtifact.origin_type})`);
            console.log(`[Test] Expected isEditable: ${isLeafHumanEdit}`);

            // Verify the correct artifact is selected (should be the leaf)
            expect(outlineComponent?.props?.outlineSettings?.id).toBe(leafArtifact.id);
            expect(outlineComponent?.props?.outlineSettings?.origin_type).toBe(leafArtifact.origin_type);

            // Verify editability based on leaf node type
            if (isLeafHumanEdit) {
                // If leaf is human edit (user_input), it should be directly editable
                expect(outlineComponent?.props?.isEditable).toBe(true);
                console.log(`[Test] ✅ Human leaf node is editable`);
            } else {
                // If leaf is AI edit (ai_generated), it should NOT be directly editable
                // Only user_input artifacts are editable, not ai_generated ones
                expect(outlineComponent?.props?.isEditable).toBe(false);
                console.log(`[Test] ✅ AI leaf node is NOT editable (only user_input artifacts are editable)`);
            }

            // Verify that all non-leaf artifacts would not be editable
            for (let i = 0; i < artifacts.length - 1; i++) {
                const artifact = artifacts[i];
                const hasDescendants = transformInputs.some(input => input.artifact_id === artifact.id);
                expect(hasDescendants).toBe(true);
                console.log(`[Test] ✅ Non-leaf artifact ${artifact.id} has descendants: ${hasDescendants}`);
            }

            // Test with active transforms (should disable editability)
            const displayComponentsWithActiveTransforms = computeDisplayComponents(
                'outline_generation',
                true, // hasActiveTransforms
                mockProjectData
            );

            const outlineComponentWithActiveTransforms = displayComponentsWithActiveTransforms.find(
                component => component.id === 'outline-settings-display'
            );

            expect(outlineComponentWithActiveTransforms?.props?.isEditable).toBe(false);
            console.log(`[Test] ✅ Active transforms disable editability`);

            // Test chronicles generation action availability
            // In outline_generation stage, we should be able to generate chronicles
            // regardless of whether the outline is human or AI edited
            expect(outlineComponent?.props?.outlineSettings).toBeDefined();
            console.log(`[Test] ✅ Chronicles generation should be available with outline settings present`);
        });
    });
}); 