import { describe, it, expect, beforeEach } from 'vitest';
import { computeCanonicalJsondocsFromLineage } from '../canonicalJsondocLogic';
import { buildLineageGraph } from '../transform-jsondoc-framework/lineageResolution';
import type {
    ElectricJsondoc,
    ElectricTransform,
    ElectricHumanTransform,
    ElectricTransformInput,
    ElectricTransformOutput
} from '../transform-jsondoc-types';

// Helper function to create a random UUID-like string
function randomId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Helper function to create test jsondocs
function createJsondoc(
    schemaType: string,
    originType: 'user_input' | 'ai_generated' = 'ai_generated',
    data: any = {}
): ElectricJsondoc {
    const id = randomId();
    return {
        id,
        schema_type: schemaType,
        schema_version: 'v1',
        origin_type: originType,
        project_id: 'test-project',
        data: JSON.stringify(data),
        metadata: JSON.stringify({}),
        streaming_status: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}

// Helper function to create human transforms
function createHumanTransform(
    sourceJsondocId: string,
    derivedJsondocId: string,
    derivationPath: string = '$',
    transformName: string = 'edit_brainstorm_idea'
): ElectricHumanTransform {
    return {
        id: randomId(),
        transform_name: transformName,
        source_jsondoc_id: sourceJsondocId,
        derived_jsondoc_id: derivedJsondocId,
        derivation_path: derivationPath,
        project_id: 'test-project',
        user_id: 'test-user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}

// Helper function to create transform inputs/outputs
function createTransformIO(transformId: string, jsondocId: string) {
    return {
        input: {
            id: randomId(),
            transform_id: transformId,
            jsondoc_id: jsondocId,
            role: 'source' as const,
            created_at: new Date().toISOString()
        },
        output: {
            id: randomId(),
            transform_id: transformId,
            jsondoc_id: jsondocId,
            created_at: new Date().toISOString()
        }
    };
}

// Test scenario generators
interface TestScenario {
    name: string;
    generateLineage: () => {
        jsondocs: ElectricJsondoc[];
        humanTransforms: ElectricHumanTransform[];
        transformInputs: ElectricTransformInput[];
        transformOutputs: ElectricTransformOutput[];
        expectedBrainstormCollectionVisible: boolean;
        expectedCanonicalIdeaExists: boolean;
    };
}

const testScenarios: TestScenario[] = [
    {
        name: 'Only brainstorm collection exists (no idea selected)',
        generateLineage: () => {
            const collection = createJsondoc('brainstorm_collection', 'ai_generated', {
                ideas: [
                    { title: '创意1', body: '内容1' },
                    { title: '创意2', body: '内容2' }
                ]
            });

            return {
                jsondocs: [collection],
                humanTransforms: [],
                transformInputs: [],
                transformOutputs: [],
                expectedBrainstormCollectionVisible: true,
                expectedCanonicalIdeaExists: false
            };
        }
    },
    {
        name: 'Direct selection from collection via human transform',
        generateLineage: () => {
            const collection = createJsondoc('brainstorm_collection', 'ai_generated', {
                ideas: [
                    { title: '创意1', body: '内容1' },
                    { title: '创意2', body: '内容2' }
                ]
            });

            const selectedIdea = createJsondoc('灵感创意', 'user_input', {
                title: '创意1',
                body: '内容1'
            });

            const humanTransform = createHumanTransform(
                collection.id,
                selectedIdea.id,
                '$.ideas[0]',
                'select_brainstorm_idea'
            );

            return {
                jsondocs: [collection, selectedIdea],
                humanTransforms: [humanTransform],
                transformInputs: [],
                transformOutputs: [],
                expectedBrainstormCollectionVisible: false,
                expectedCanonicalIdeaExists: true
            };
        }
    },
    {
        name: 'Selected idea with subsequent patch approvals',
        generateLineage: () => {
            const collection = createJsondoc('brainstorm_collection', 'ai_generated', {
                ideas: [
                    { title: '原创意', body: '原内容' },
                    { title: '创意2', body: '内容2' }
                ]
            });

            const originalIdea = createJsondoc('灵感创意', 'user_input', {
                title: '原创意',
                body: '原内容'
            });

            // Create a derived idea through patch approval
            const editedIdea = createJsondoc('灵感创意', 'user_input', {
                title: '改进创意',
                body: '改进内容'
            });
            editedIdea.metadata = JSON.stringify({
                applied_patches: [randomId()],
                approval_timestamp: new Date().toISOString()
            });

            // Human transform for original selection
            const selectionTransform = createHumanTransform(
                collection.id,
                originalIdea.id,
                '$.ideas[0]',
                'select_brainstorm_idea'
            );

            // Human transform for patch approval
            const patchTransform = createHumanTransform(
                originalIdea.id,
                editedIdea.id,
                '$',
                'patch_approval'
            );

            return {
                jsondocs: [collection, originalIdea, editedIdea],
                humanTransforms: [selectionTransform, patchTransform],
                transformInputs: [],
                transformOutputs: [],
                expectedBrainstormCollectionVisible: false,
                expectedCanonicalIdeaExists: true
            };
        }
    },
    {
        name: 'Complex chain: selection → edits → more edits',
        generateLineage: () => {
            const collection = createJsondoc('brainstorm_collection', 'ai_generated', {
                ideas: [
                    { title: '起点创意', body: '起点内容' }
                ]
            });

            const idea1 = createJsondoc('灵感创意', 'user_input', {
                title: '起点创意',
                body: '起点内容'
            });

            const idea2 = createJsondoc('灵感创意', 'ai_generated', {
                title: '改进创意',
                body: '改进内容'
            });

            const idea3 = createJsondoc('灵感创意', 'user_input', {
                title: '最终创意',
                body: '最终内容'
            });

            const transforms = [
                createHumanTransform(collection.id, idea1.id, '$.ideas[0]', 'select_brainstorm_idea'),
                createHumanTransform(idea1.id, idea2.id, '$', 'improve_brainstorm_idea'),
                createHumanTransform(idea2.id, idea3.id, '$', 'edit_brainstorm_idea')
            ];

            return {
                jsondocs: [collection, idea1, idea2, idea3],
                humanTransforms: transforms,
                transformInputs: [],
                transformOutputs: [],
                expectedBrainstormCollectionVisible: false,
                expectedCanonicalIdeaExists: true
            };
        }
    },
    {
        name: 'Standalone brainstorm idea (not from collection)',
        generateLineage: () => {
            const collection = createJsondoc('brainstorm_collection', 'ai_generated', {
                ideas: [
                    { title: '集合创意', body: '集合内容' }
                ]
            });

            // Completely separate idea not derived from collection
            const standaloneIdea = createJsondoc('灵感创意', 'user_input', {
                title: '独立创意',
                body: '独立内容'
            });

            return {
                jsondocs: [collection, standaloneIdea],
                humanTransforms: [],
                transformInputs: [],
                transformOutputs: [],
                expectedBrainstormCollectionVisible: false, // Still hidden because canonical idea exists
                expectedCanonicalIdeaExists: true
            };
        }
    }
];

describe('Canonical Jsondoc Logic - Brainstorm Collection Hiding', () => {
    describe('Core Business Rule: Hide collection when idea exists', () => {
        it('should hide brainstorm_collection when any canonical 灵感创意 exists', () => {
            // Simple test: if canonical idea exists, collection should be hidden
            const collection = createJsondoc('brainstorm_collection');
            const idea = createJsondoc('灵感创意');

            const lineageGraph = buildLineageGraph(
                [collection, idea],
                [],
                [],
                [],
                []
            );

            const context = computeCanonicalJsondocsFromLineage(
                lineageGraph,
                [collection, idea],
                [],
                [],
                [],
                []
            );

            expect(context.canonicalBrainstormIdea).toBeTruthy();
            expect(context.canonicalBrainstormCollection).toBeNull();
        });

        it('should show brainstorm_collection when no canonical 灵感创意 exists', () => {
            const collection = createJsondoc('brainstorm_collection');

            const lineageGraph = buildLineageGraph(
                [collection],
                [],
                [],
                [],
                []
            );

            const context = computeCanonicalJsondocsFromLineage(
                lineageGraph,
                [collection],
                [],
                [],
                [],
                []
            );

            expect(context.canonicalBrainstormIdea).toBeNull();
            expect(context.canonicalBrainstormCollection).toBeTruthy();
        });

        it('should hide brainstorm_input_params when any canonical 灵感创意 exists', () => {
            // Test: if canonical idea exists, brainstorm input params should be hidden
            const inputParams = createJsondoc('brainstorm_input_params');
            const idea = createJsondoc('灵感创意');

            const lineageGraph = buildLineageGraph(
                [inputParams, idea],
                [],
                [],
                [],
                []
            );

            const context = computeCanonicalJsondocsFromLineage(
                lineageGraph,
                [inputParams, idea],
                [],
                [],
                [],
                []
            );

            expect(context.canonicalBrainstormIdea).toBeTruthy();
            expect(context.canonicalBrainstormInput).toBeNull();
        });

        it('should show brainstorm_input_params when no canonical 灵感创意 exists', () => {
            const inputParams = createJsondoc('brainstorm_input_params');

            const lineageGraph = buildLineageGraph(
                [inputParams],
                [],
                [],
                [],
                []
            );

            const context = computeCanonicalJsondocsFromLineage(
                lineageGraph,
                [inputParams],
                [],
                [],
                [],
                []
            );

            expect(context.canonicalBrainstormIdea).toBeNull();
            expect(context.canonicalBrainstormInput).toBeTruthy();
        });

        it('should hide both brainstorm_collection and brainstorm_input_params when canonical 灵感创意 exists', () => {
            // Test: if canonical idea exists, both collection and input params should be hidden
            const collection = createJsondoc('brainstorm_collection');
            const inputParams = createJsondoc('brainstorm_input_params');
            const idea = createJsondoc('灵感创意');

            const lineageGraph = buildLineageGraph(
                [collection, inputParams, idea],
                [],
                [],
                [],
                []
            );

            const context = computeCanonicalJsondocsFromLineage(
                lineageGraph,
                [collection, inputParams, idea],
                [],
                [],
                [],
                []
            );

            expect(context.canonicalBrainstormIdea).toBeTruthy();
            expect(context.canonicalBrainstormCollection).toBeNull();
            expect(context.canonicalBrainstormInput).toBeNull();
        });
    });

    describe('Random Lineage Tree Scenarios', () => {
        testScenarios.forEach((scenario) => {
            it(`should handle scenario: ${scenario.name}`, () => {
                // Generate random lineage for this scenario
                const {
                    jsondocs,
                    humanTransforms,
                    transformInputs,
                    transformOutputs,
                    expectedBrainstormCollectionVisible,
                    expectedCanonicalIdeaExists
                } = scenario.generateLineage();

                const lineageGraph = buildLineageGraph(
                    jsondocs,
                    [],
                    humanTransforms,
                    transformInputs,
                    transformOutputs
                );

                const context = computeCanonicalJsondocsFromLineage(
                    lineageGraph,
                    jsondocs,
                    [],
                    humanTransforms,
                    transformInputs,
                    transformOutputs
                );

                // Verify expectations
                if (expectedCanonicalIdeaExists) {
                    expect(context.canonicalBrainstormIdea).toBeTruthy();
                    expect(context.canonicalBrainstormIdea?.schema_type).toBe('灵感创意');
                } else {
                    expect(context.canonicalBrainstormIdea).toBeNull();
                }

                if (expectedBrainstormCollectionVisible) {
                    expect(context.canonicalBrainstormCollection).toBeTruthy();
                    expect(context.canonicalBrainstormCollection?.schema_type).toBe('brainstorm_collection');
                } else {
                    expect(context.canonicalBrainstormCollection).toBeNull();
                }

                // CORE BUSINESS RULE: Collection should be hidden whenever idea exists
                if (context.canonicalBrainstormIdea) {
                    expect(context.canonicalBrainstormCollection).toBeNull();
                }
            });
        });
    });

    describe('Stress Test: Random Complex Lineage Trees', () => {
        it('should consistently apply business rule across 50 random lineage trees', () => {
            for (let i = 0; i < 50; i++) {
                // Generate a random complex lineage tree
                const complexity = Math.floor(Math.random() * 5) + 1; // 1-5 complexity levels
                const hasCollection = Math.random() > 0.3; // 70% chance of having collection
                const hasIdea = Math.random() > 0.2; // 80% chance of having idea

                const jsondocs: ElectricJsondoc[] = [];
                const humanTransforms: ElectricHumanTransform[] = [];

                let collection: ElectricJsondoc | null = null;
                let latestIdea: ElectricJsondoc | null = null;

                // Add collection if needed
                if (hasCollection) {
                    collection = createJsondoc('brainstorm_collection', 'ai_generated', {
                        ideas: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, idx) => ({
                            title: `随机创意${idx + 1}`,
                            body: `随机内容${idx + 1}`
                        }))
                    });
                    jsondocs.push(collection);
                }

                // Add ideas with random complexity
                if (hasIdea) {
                    for (let j = 0; j < complexity; j++) {
                        const originType = Math.random() > 0.5 ? 'user_input' : 'ai_generated';
                        const idea = createJsondoc('灵感创意', originType, {
                            title: `复杂创意${i}-${j}`,
                            body: `复杂内容${i}-${j}`
                        });

                        // Sometimes add patch approval metadata
                        if (Math.random() > 0.6 && j > 0) {
                            idea.metadata = JSON.stringify({
                                applied_patches: [randomId()],
                                approval_timestamp: new Date().toISOString()
                            });
                        }

                        jsondocs.push(idea);

                        // Create transform chain
                        if (j === 0 && collection && Math.random() > 0.4) {
                            // First idea from collection
                            const transform = createHumanTransform(
                                collection.id,
                                idea.id,
                                `$.ideas[${Math.floor(Math.random() * 2)}]`,
                                'select_brainstorm_idea'
                            );
                            humanTransforms.push(transform);
                        } else if (j > 0 && latestIdea) {
                            // Chain from previous idea
                            const transform = createHumanTransform(
                                latestIdea.id,
                                idea.id,
                                '$',
                                Math.random() > 0.5 ? 'improve_brainstorm_idea' : 'edit_brainstorm_idea'
                            );
                            humanTransforms.push(transform);
                        }

                        latestIdea = idea;
                    }
                }

                // Build lineage and compute context
                const lineageGraph = buildLineageGraph(
                    jsondocs,
                    [],
                    humanTransforms,
                    [],
                    []
                );

                const context = computeCanonicalJsondocsFromLineage(
                    lineageGraph,
                    jsondocs,
                    [],
                    humanTransforms,
                    [],
                    []
                );

                // CORE BUSINESS RULE TEST: If canonical idea exists, collection must be null
                if (context.canonicalBrainstormIdea) {
                    expect(context.canonicalBrainstormCollection).toBeNull();
                } else if (hasCollection) {
                    // If no canonical idea exists but collection exists, collection should be visible
                    expect(context.canonicalBrainstormCollection).toBeTruthy();
                }
            }
        });
    });
}); 