/**
 * Test script for lineage resolution algorithm
 * Run with: ./run-ts src/server/scripts/test-lineage-resolution.ts
 */

import {
    buildLineageGraph,
    findLatestArtifact,
    getLineagePath,
    validateLineageIntegrity,
    extractBrainstormLineages,
    describeLineage,
    type LineageGraph
} from '../../common/utils/lineageResolution';
import {
    ElectricArtifact,
    ElectricTransform,
    ElectricHumanTransform,
    ElectricTransformInput,
    ElectricTransformOutput
} from '../../common/types';

// ============================================================================
// Test Data Helpers
// ============================================================================

function createArtifact(
    id: string,
    type: string,
    data: any = {},
    projectId: string = 'test-project'
): ElectricArtifact {
    return {
        id,
        project_id: projectId,
        type,
        type_version: 'v1',
        data: JSON.stringify(data),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}

function createTransform(
    id: string,
    type: 'human' | 'llm',
    projectId: string = 'test-project'
): ElectricTransform {
    return {
        id,
        project_id: projectId,
        type,
        type_version: 'v1',
        status: 'completed',
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}

function createHumanTransform(
    transformId: string,
    sourceArtifactId: string,
    derivedArtifactId: string,
    path: string,
    projectId: string = 'test-project'
): ElectricHumanTransform {
    return {
        transform_id: transformId,
        project_id: projectId,
        action_type: 'edit',
        source_artifact_id: sourceArtifactId,
        derivation_path: path,
        derived_artifact_id: derivedArtifactId
    };
}

function createTransformInput(
    transformId: string,
    artifactId: string,
    projectId: string = 'test-project'
): ElectricTransformInput {
    return {
        id: Math.floor(Math.random() * 10000),
        project_id: projectId,
        transform_id: transformId,
        artifact_id: artifactId,
        input_role: 'source'
    };
}

function createTransformOutput(
    transformId: string,
    artifactId: string,
    projectId: string = 'test-project'
): ElectricTransformOutput {
    return {
        id: Math.floor(Math.random() * 10000),
        project_id: projectId,
        transform_id: transformId,
        artifact_id: artifactId,
        output_role: 'result'
    };
}

// ============================================================================
// Test Utilities
// ============================================================================

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
    if (actual !== expected) {
        throw new Error(`Assertion failed: ${message}. Expected: ${expected}, Got: ${actual}`);
    }
}

function assertArrayLength<T>(array: T[], expectedLength: number, message: string) {
    if (array.length !== expectedLength) {
        throw new Error(`Assertion failed: ${message}. Expected length: ${expectedLength}, Got: ${array.length}`);
    }
}

function runTest(testName: string, testFn: () => void) {
    try {
        testFn();
        console.log(`✅ ${testName}`);
    } catch (error) {
        console.error(`❌ ${testName}: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}

// ============================================================================
// Test Cases
// ============================================================================

function testSimpleBrainstormCollection() {
    const artifacts = [
        createArtifact('collection-1', 'brainstorm_idea_collection', [
            { title: 'Idea 1', body: 'Body 1' },
            { title: 'Idea 2', body: 'Body 2' }
        ])
    ];

    const graph = buildLineageGraph(artifacts, [], [], [], []);

    assertEqual(graph.nodes.size, 1, 'Should have 1 node');
    assert(graph.rootNodes.has('collection-1'), 'Collection should be root node');
    assertEqual(graph.edges.size, 0, 'Should have no edges');
    assertEqual(graph.paths.size, 0, 'Should have no paths');
}

function testHumanTransformChain() {
    const artifacts = [
        createArtifact('collection-1', 'brainstorm_idea_collection', [
            { title: 'Original Idea', body: 'Original Body' }
        ]),
        createArtifact('user-input-1', 'user_input', { text: 'Edited content' })
    ];

    const transforms = [
        createTransform('transform-1', 'human')
    ];

    const humanTransforms = [
        createHumanTransform('transform-1', 'collection-1', 'user-input-1', '[0]')
    ];

    const transformInputs = [
        createTransformInput('transform-1', 'collection-1')
    ];

    const transformOutputs = [
        createTransformOutput('transform-1', 'user-input-1')
    ];

    const graph = buildLineageGraph(
        artifacts,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    assertEqual(graph.nodes.size, 2, 'Should have 2 nodes');
    assert(graph.rootNodes.has('collection-1'), 'Collection should be root node');
    assert(!graph.rootNodes.has('user-input-1'), 'User input should not be root node');

    const edges = graph.edges.get('collection-1');
    assert(edges !== undefined && edges.includes('user-input-1'), 'Should have edge from collection to user input');

    const userInputNode = graph.nodes.get('user-input-1');
    assertEqual(userInputNode?.transformType, 'human', 'Should be human transform');
    assertEqual(userInputNode?.path, '[0]', 'Should have correct path');
    assertEqual(userInputNode?.depth, 1, 'Should have depth 1');
}

function testLLMTransformChain() {
    const artifacts = [
        createArtifact('collection-1', 'brainstorm_idea_collection', [
            { title: 'Original Idea', body: 'Original Body' }
        ]),
        createArtifact('brainstorm-idea-1', 'brainstorm_idea', {
            title: 'AI Enhanced Idea',
            body: 'AI Enhanced Body'
        })
    ];

    const transforms = [
        createTransform('llm-transform-1', 'llm')
    ];

    const transformInputs = [
        createTransformInput('llm-transform-1', 'collection-1')
    ];

    const transformOutputs = [
        createTransformOutput('llm-transform-1', 'brainstorm-idea-1')
    ];

    const graph = buildLineageGraph(
        artifacts,
        transforms,
        [],
        transformInputs,
        transformOutputs
    );

    assertEqual(graph.nodes.size, 2, 'Should have 2 nodes');
    assert(graph.rootNodes.has('collection-1'), 'Collection should be root node');
    assert(!graph.rootNodes.has('brainstorm-idea-1'), 'Brainstorm idea should not be root node');

    const edges = graph.edges.get('collection-1');
    assert(edges !== undefined && edges.includes('brainstorm-idea-1'), 'Should have edge from collection to brainstorm idea');

    const llmNode = graph.nodes.get('brainstorm-idea-1');
    assertEqual(llmNode?.transformType, 'llm', 'Should be LLM transform');
    assertEqual(llmNode?.depth, 1, 'Should have depth 1');
}

function testComplexMultiStepLineage() {
    const artifacts = [
        createArtifact('collection-1', 'brainstorm_idea_collection', [
            { title: 'Original', body: 'Original Body' }
        ]),
        createArtifact('user-input-1', 'user_input', { text: 'User edited' }),
        createArtifact('brainstorm-idea-1', 'brainstorm_idea', {
            title: 'AI Enhanced', body: 'AI Enhanced Body'
        }),
        createArtifact('user-input-2', 'user_input', { text: 'Final edit' })
    ];

    const transforms = [
        createTransform('human-1', 'human'),
        createTransform('llm-1', 'llm'),
        createTransform('human-2', 'human')
    ];

    const humanTransforms = [
        createHumanTransform('human-1', 'collection-1', 'user-input-1', '[0]'),
        createHumanTransform('human-2', 'brainstorm-idea-1', 'user-input-2', '')
    ];

    const transformInputs = [
        createTransformInput('human-1', 'collection-1'),
        createTransformInput('llm-1', 'user-input-1'),
        createTransformInput('human-2', 'brainstorm-idea-1')
    ];

    const transformOutputs = [
        createTransformOutput('human-1', 'user-input-1'),
        createTransformOutput('llm-1', 'brainstorm-idea-1'),
        createTransformOutput('human-2', 'user-input-2')
    ];

    const graph = buildLineageGraph(
        artifacts,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    assertEqual(graph.nodes.size, 4, 'Should have 4 nodes');
    assertEqual(graph.rootNodes.size, 1, 'Should have 1 root node');
    assert(graph.rootNodes.has('collection-1'), 'Collection should be root node');

    // Verify the chain: collection-1 → user-input-1 → brainstorm-idea-1 → user-input-2
    const edge1 = graph.edges.get('collection-1');
    assert(edge1 !== undefined && edge1.includes('user-input-1'), 'Should have edge collection-1 → user-input-1');

    const edge2 = graph.edges.get('user-input-1');
    assert(edge2 !== undefined && edge2.includes('brainstorm-idea-1'), 'Should have edge user-input-1 → brainstorm-idea-1');

    const edge3 = graph.edges.get('brainstorm-idea-1');
    assert(edge3 !== undefined && edge3.includes('user-input-2'), 'Should have edge brainstorm-idea-1 → user-input-2');

    // Verify depths
    assertEqual(graph.nodes.get('collection-1')?.depth, 0, 'Collection should have depth 0');
    assertEqual(graph.nodes.get('user-input-1')?.depth, 1, 'User input 1 should have depth 1');
    assertEqual(graph.nodes.get('brainstorm-idea-1')?.depth, 2, 'Brainstorm idea should have depth 2');
    assertEqual(graph.nodes.get('user-input-2')?.depth, 3, 'User input 2 should have depth 3');
}

function testFindLatestArtifact() {
    // Create complex graph for testing
    const artifacts = [
        createArtifact('collection-1', 'brainstorm_idea_collection', [
            { title: 'Idea 1', body: 'Body 1' },
            { title: 'Idea 2', body: 'Body 2' }
        ]),
        createArtifact('user-input-1', 'user_input', { text: 'Edited idea 1' }),
        createArtifact('brainstorm-idea-1', 'brainstorm_idea', {
            title: 'Enhanced Idea 1', body: 'Enhanced Body 1'
        }),
        createArtifact('user-input-2', 'user_input', { text: 'Edited idea 2' })
    ];

    const transforms = [
        createTransform('human-1', 'human'),
        createTransform('llm-1', 'llm'),
        createTransform('human-2', 'human')
    ];

    const humanTransforms = [
        createHumanTransform('human-1', 'collection-1', 'user-input-1', '[0]'),
        createHumanTransform('human-2', 'collection-1', 'user-input-2', '[1]')
    ];

    const transformInputs = [
        createTransformInput('human-1', 'collection-1'),
        createTransformInput('llm-1', 'user-input-1'),
        createTransformInput('human-2', 'collection-1')
    ];

    const transformOutputs = [
        createTransformOutput('human-1', 'user-input-1'),
        createTransformOutput('llm-1', 'brainstorm-idea-1'),
        createTransformOutput('human-2', 'user-input-2')
    ];

    const graph = buildLineageGraph(
        artifacts,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    // Test path [0] - should find brainstorm-idea-1 (complex lineage)
    const result1 = findLatestArtifact('collection-1', '[0]', graph);
    assertEqual(result1.artifactId, 'brainstorm-idea-1', 'Should find brainstorm-idea-1 for path [0]');
    assertEqual(result1.path, '[0]', 'Should preserve path [0]');
    assertEqual(result1.depth, 2, 'Should have depth 2');
    assertArrayLength(result1.lineagePath, 3, 'Should have 3 nodes in lineage path');

    // Test path [1] - should find user-input-2 (simple lineage)
    const result2 = findLatestArtifact('collection-1', '[1]', graph);
    assertEqual(result2.artifactId, 'user-input-2', 'Should find user-input-2 for path [1]');
    assertEqual(result2.path, '[1]', 'Should preserve path [1]');
    assertEqual(result2.depth, 1, 'Should have depth 1');
    assertArrayLength(result2.lineagePath, 2, 'Should have 2 nodes in lineage path');

    // Test non-existent path [2] - should return original
    const result3 = findLatestArtifact('collection-1', '[2]', graph);
    assertEqual(result3.artifactId, 'collection-1', 'Should return original for non-existent path');
    assertEqual(result3.path, '[2]', 'Should preserve path [2]');
    assertEqual(result3.depth, 0, 'Should have depth 0');
    assertArrayLength(result3.lineagePath, 1, 'Should have 1 node in lineage path');

    // Test non-existent artifact
    const result4 = findLatestArtifact('non-existent', '[0]', graph);
    assertEqual(result4.artifactId, null, 'Should return null for non-existent artifact');
    assertEqual(result4.depth, 0, 'Should have depth 0');
    assertArrayLength(result4.lineagePath, 0, 'Should have empty lineage path');
}

function testValidateLineageIntegrity() {
    // Test clean graph
    const artifacts = [
        createArtifact('collection-1', 'brainstorm_idea_collection'),
        createArtifact('user-input-1', 'user_input')
    ];

    const transforms = [createTransform('human-1', 'human')];
    const humanTransforms = [
        createHumanTransform('human-1', 'collection-1', 'user-input-1', '[0]')
    ];
    const transformInputs = [createTransformInput('human-1', 'collection-1')];
    const transformOutputs = [createTransformOutput('human-1', 'user-input-1')];

    const graph = buildLineageGraph(
        artifacts,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    const validation = validateLineageIntegrity(graph);
    assert(validation.isValid, 'Clean graph should be valid');
    assertEqual(validation.errors.length, 0, 'Should have no errors');
}

function testExtractBrainstormLineages() {
    const artifacts = [
        createArtifact('collection-1', 'brainstorm_idea_collection', [
            { title: 'Idea 1', body: 'Body 1' },
            { title: 'Idea 2', body: 'Body 2' },
            { title: 'Idea 3', body: 'Body 3' }
        ]),
        createArtifact('user-input-1', 'user_input', { text: 'Edited idea 1' })
    ];

    const transforms = [createTransform('human-1', 'human')];
    const humanTransforms = [
        createHumanTransform('human-1', 'collection-1', 'user-input-1', '[0]')
    ];
    const transformInputs = [createTransformInput('human-1', 'collection-1')];
    const transformOutputs = [createTransformOutput('human-1', 'user-input-1')];

    const graph = buildLineageGraph(
        artifacts,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    const lineages = extractBrainstormLineages(graph, artifacts);

    assert(lineages.has('collection-1'), 'Should have lineages for collection-1');
    const collectionLineages = lineages.get('collection-1')!;
    assertArrayLength(collectionLineages, 3, 'Should have 3 lineages');

    // First idea should resolve to user-input-1
    assertEqual(collectionLineages[0].artifactId, 'user-input-1', 'First idea should resolve to user-input-1');
    assertEqual(collectionLineages[0].path, '[0]', 'First idea should have path [0]');

    // Other ideas should resolve to original collection
    assertEqual(collectionLineages[1].artifactId, 'collection-1', 'Second idea should resolve to collection-1');
    assertEqual(collectionLineages[1].path, '[1]', 'Second idea should have path [1]');
    assertEqual(collectionLineages[2].artifactId, 'collection-1', 'Third idea should resolve to collection-1');
    assertEqual(collectionLineages[2].path, '[2]', 'Third idea should have path [2]');
}

function testDescribeLineage() {
    // Test simple lineage chain
    const lineagePath = [
        { artifactId: 'original', depth: 0, isLeaf: false },
        { artifactId: 'edited', depth: 1, isLeaf: false, transformType: 'human' as const },
        { artifactId: 'enhanced', depth: 2, isLeaf: true, transformType: 'llm' as const }
    ];

    const description = describeLineage(lineagePath);
    assertEqual(description, 'Original → User edited → AI enhanced', 'Should describe complex lineage');

    // Test single node
    const singleNode = [{ artifactId: 'original', depth: 0, isLeaf: true }];
    const singleDescription = describeLineage(singleNode);
    assertEqual(singleDescription, 'Original', 'Should describe single node as original');

    // Test empty lineage
    const emptyDescription = describeLineage([]);
    assertEqual(emptyDescription, 'No lineage', 'Should describe empty lineage');
}

function testPerformanceWithLargeChain() {
    console.log('🔄 Testing performance with large lineage chain...');

    // Create a long chain: artifact-0 → artifact-1 → ... → artifact-99
    const artifacts: ElectricArtifact[] = [];
    const transforms: ElectricTransform[] = [];
    const humanTransforms: ElectricHumanTransform[] = [];
    const transformInputs: ElectricTransformInput[] = [];
    const transformOutputs: ElectricTransformOutput[] = [];

    for (let i = 0; i < 100; i++) {
        artifacts.push(createArtifact(`artifact-${i}`, 'user_input'));

        if (i > 0) {
            const transformId = `transform-${i}`;
            transforms.push(createTransform(transformId, 'human'));
            humanTransforms.push(
                createHumanTransform(transformId, `artifact-${i - 1}`, `artifact-${i}`, '')
            );
            transformInputs.push(createTransformInput(transformId, `artifact-${i - 1}`));
            transformOutputs.push(createTransformOutput(transformId, `artifact-${i}`));
        }
    }

    const startTime = Date.now();
    const graph = buildLineageGraph(
        artifacts,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );
    const buildTime = Date.now() - startTime;

    const resolveStart = Date.now();
    const result = findLatestArtifact('artifact-0', undefined, graph);
    const resolveTime = Date.now() - resolveStart;

    console.log(`   Build time: ${buildTime}ms`);
    console.log(`   Resolve time: ${resolveTime}ms`);

    // Performance should be reasonable (under 100ms for 100 nodes)
    assert(buildTime < 100, 'Build time should be under 100ms');
    assert(resolveTime < 50, 'Resolve time should be under 50ms');

    // Should find the last artifact in the chain
    assertEqual(result.artifactId, 'artifact-99', 'Should find last artifact in chain');
    assertEqual(result.depth, 99, 'Should have correct depth');
    assertArrayLength(result.lineagePath, 100, 'Should have complete lineage path');
}

// ============================================================================
// Main Test Runner
// ============================================================================

function main() {
    console.log('🧪 Running Lineage Resolution Algorithm Tests\n');

    runTest('Simple brainstorm collection', testSimpleBrainstormCollection);
    runTest('Human transform chain', testHumanTransformChain);
    runTest('LLM transform chain', testLLMTransformChain);
    runTest('Complex multi-step lineage', testComplexMultiStepLineage);
    runTest('Find latest artifact', testFindLatestArtifact);
    runTest('Validate lineage integrity', testValidateLineageIntegrity);
    runTest('Extract brainstorm lineages', testExtractBrainstormLineages);
    runTest('Describe lineage', testDescribeLineage);
    runTest('Performance with large chain', testPerformanceWithLargeChain);

    console.log('\n✅ All tests passed! Lineage resolution algorithm is working correctly.');
}

main(); 