#!/usr/bin/env node

import { db } from '../database/connection';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';

async function debugOrphanedNodes() {
    console.log('🔍 Analyzing orphaned nodes in raw graph...\n');

    const artifactRepo = new ArtifactRepository(db);
    const transformRepo = new TransformRepository(db);

    // Analyze the specific project from the URL
    const projectId = '5d1cae30-1c84-4c4e-a68a-a6af3d3b1ac1';
    console.log(`📁 Analyzing project: ${projectId}\n`);

    // Get all artifacts and transforms for this project
    const artifacts = await artifactRepo.getProjectArtifacts(projectId, 100);
    const transforms = await transformRepo.getProjectTransforms(projectId, 100);

    console.log(`📊 Found ${artifacts.length} artifacts and ${transforms.length} transforms\n`);

    // Show all artifacts first
    console.log('🎯 All Artifacts in Project:\n');
    for (const artifact of artifacts) {
        console.log(`📄 ${artifact.id}`);
        console.log(`   Type: ${artifact.type}`);
        console.log(`   Created: ${artifact.created_at}`);
        if (artifact.data) {
            const preview = typeof artifact.data === 'object'
                ? JSON.stringify(artifact.data).substring(0, 100)
                : String(artifact.data).substring(0, 100);
            console.log(`   Data: ${preview}...`);
        }
        console.log('');
    }

    // Show all transforms
    console.log('🔗 All Transforms in Project:\n');
    for (const transform of transforms) {
        console.log(`⚙️  ${transform.id}`);
        console.log(`   Type: ${transform.type}`);
        console.log(`   Status: ${transform.status}`);
        console.log(`   Created: ${transform.created_at}`);

        if (transform.execution_context) {
            const context = typeof transform.execution_context === 'string'
                ? JSON.parse(transform.execution_context)
                : transform.execution_context;
            console.log(`   Context: ${JSON.stringify(context, null, 2)}`);
        }

        // Get inputs and outputs
        const inputs = await transformRepo.getTransformInputs(transform.id);
        const outputs = await transformRepo.getTransformOutputs(transform.id);

        console.log(`   Inputs: ${inputs.length} | Outputs: ${outputs.length}`);

        if (inputs.length > 0) {
            inputs.forEach(input => {
                console.log(`     → Input: ${input.artifact_id} (${input.input_role || 'no role'})`);
            });
        }

        if (outputs.length > 0) {
            outputs.forEach(output => {
                console.log(`     ← Output: ${output.artifact_id} (${output.output_role || 'no role'})`);
            });
        }

        console.log('');
    }

    // Analyze which transforms are conceptually unrelated to brainstorm lineage
    console.log('🚨 Conceptual Analysis - Transforms That Shouldn\'t Be in Brainstorm Graph:\n');

    for (const transform of transforms) {
        const context = transform.execution_context;
        let shouldBeInGraph = true;
        let reason = '';

        // Check for agent session transforms
        if (context?.transform_name === 'general_agent_session' ||
            context?.transform_name === 'agent_brainstorm_session') {
            shouldBeInGraph = false;
            reason = 'Agent session orchestration - not part of data lineage';
        }

        // Check for standalone tool transforms that don't contribute to lineage
        if (context?.toolName && !context?.source_artifact_id) {
            shouldBeInGraph = false;
            reason = 'Tool execution without clear lineage connection';
        }

        // Check for transforms with no inputs (possible orphaned orchestration)
        const inputs = await transformRepo.getTransformInputs(transform.id);
        if (inputs.length === 0 && transform.type === 'llm') {
            shouldBeInGraph = false;
            reason = 'LLM transform with no inputs - likely orchestration layer';
        }

        if (!shouldBeInGraph) {
            console.log(`❌ ${transform.id}`);
            console.log(`   Type: ${transform.type}`);
            console.log(`   Reason: ${reason}`);
            console.log(`   Context: ${JSON.stringify(context, null, 2)}`);
            console.log('');
        }
    }

    // Show the actual lineage chain for brainstorm artifacts
    console.log('✅ Valid Brainstorm Lineage Chain:\n');

    const brainstormArtifacts = artifacts.filter(a =>
        a.type === 'brainstorm_idea' ||
        a.type === 'brainstorm_params' ||
        a.type === 'brainstorm_tool_input' ||
        a.type === 'user_input'
    );

    for (const artifact of brainstormArtifacts) {
        console.log(`📄 ${artifact.id} (${artifact.type})`);

        // Find transforms that produced this artifact
        const producingTransforms = await transformRepo.getTransformsByOutput(artifact.id);
        if (producingTransforms.length > 0) {
            console.log(`   ← Produced by: ${producingTransforms[0].id}`);
        }

        // Find transforms that consume this artifact
        const consumingTransforms = await transformRepo.getTransformsByInput(artifact.id);
        if (consumingTransforms.length > 0) {
            console.log(`   → Consumed by: ${consumingTransforms.map(t => t.id).join(', ')}`);
        }

        console.log('');
    }

    console.log('\n✅ Analysis complete!');
    process.exit(0);
}

debugOrphanedNodes().catch(error => {
    console.error('Error during analysis:', error);
    process.exit(1);
}); 