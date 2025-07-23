#!/usr/bin/env node

/**
 * Debug script to capture raw LLM output and original JSON for context diff debugging
 * Saves files for isolated testing
 */

import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository.js';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository.js';
import { StreamingTransformExecutor } from '../transform-jsondoc-framework/StreamingTransformExecutor.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

// Project and jsondoc IDs
const PROJECT_ID = '559e05ad-cd3d-459f-85b6-12d6e3496b65';
const JSONDOC_ID = '2f812a07-019a-40a4-8d4c-5a867e7a427b';
const TOOL_NAME = 'edit_剧本设定';
const USER_ID = 'test-user-1';

/**
 * Main debug function
 */
async function debugContextDiff(): Promise<void> {
    try {
        console.log('================================================================================');
        console.log('🐛 CAPTURE RAW LLM OUTPUT & ORIGINAL JSON');
        console.log('================================================================================');
        console.log(`Project ID: ${PROJECT_ID}`);
        console.log(`Jsondoc ID: ${JSONDOC_ID}`);
        console.log(`Tool: ${TOOL_NAME}`);
        console.log(`User ID: ${USER_ID}\n`);

        console.log('🔧 Step 1: Setting up repositories...');
        const { db } = await import('../database/connection.js');
        const jsondocRepo = new JsondocRepository(db);
        const transformRepo = new TransformRepository(db);
        console.log('[Debug] Repositories initialized\n');

        console.log('📋 Step 2: Fetching original jsondoc data...');
        const targetJsondoc = await jsondocRepo.getJsondoc(JSONDOC_ID);
        if (!targetJsondoc) {
            throw new Error(`Target jsondoc not found: ${JSONDOC_ID}`);
        }

        console.log('[Debug] Jsondoc fetched successfully:', {
            id: targetJsondoc.id,
            schema_type: targetJsondoc.schema_type,
            origin_type: targetJsondoc.origin_type
        });

        // Extract and save original JSON
        const originalJson = targetJsondoc.data || targetJsondoc;
        const originalJsonString = JSON.stringify(originalJson, null, 2);

        const originalJsonPath = join(process.cwd(), 'debug-original.json');
        writeFileSync(originalJsonPath, originalJsonString, 'utf8');
        console.log(`✅ Saved original JSON to: ${originalJsonPath}`);
        console.log(`[Debug] Original JSON length: ${originalJsonString.length} chars\n`);

        console.log('🛠️  Step 3: Calling edit tool and capturing raw LLM output...');

        // Track raw LLM output
        let rawLLMOutput = '';
        let finalPatches: any[] = [];

        // Import the schemas
        const { OutlineSettingsEditInputSchema } = await import('../../common/schemas/transforms.js');
        const { JsonPatchOperationsSchema } = await import('../../common/schemas/transforms.js');

        // Prepare input
        const input = {
            jsondocs: [{
                jsondocId: JSONDOC_ID,
                description: '剧本设定',
                schemaType: '剧本设定'
            }],
            editRequirements: '调整剧本设定，优化角色设定和故事背景'
        };

        // Create streaming executor
        const executor = new StreamingTransformExecutor();

        // Get the template (simplified version for testing)
        const outlineSettingsEditTemplate = {
            system: "You are editing script settings. Make the requested changes.",
            user: "Edit the script settings based on: {{editRequirements}}\n\nCurrent settings: {{jsondocs}}"
        };

        // Execute the tool with streaming callback to capture raw output
        const result = await executor.executeStreamingTransform({
            config: {
                templateName: '剧本设定_edit_diff',
                inputSchema: OutlineSettingsEditInputSchema,
                outputSchema: JsonPatchOperationsSchema
            },
            input,
            projectId: PROJECT_ID,
            userId: USER_ID,
            transformRepo,
            jsondocRepo,
            outputJsondocType: '剧本设定' as const,
            transformMetadata: {
                toolName: TOOL_NAME,
                editRequirements: input.editRequirements
            },
            executionMode: {
                mode: 'patch-approval',
                originalJsondoc: targetJsondoc
            },
            dryRun: true, // Don't save to database
            onStreamChunk: async (chunk: any, chunkCount: number) => {
                // Capture raw text for debugging
                if (chunk?.type === 'rawText' && chunk?.textDelta) {
                    rawLLMOutput += chunk.textDelta;
                }

                // Capture final patches
                if (chunk?.type === 'finalPatches' && chunk?.patches) {
                    finalPatches = chunk.patches;
                }

                // Log progress
                if (chunkCount % 100 === 0) {
                    console.log(`[Debug] Processed ${chunkCount} chunks, raw text: ${rawLLMOutput.length} chars`);
                }
            }
        });

        console.log(`[Debug] Tool execution completed\n`);

        console.log('💾 Step 4: Saving captured data...');

        // Save raw LLM output
        if (rawLLMOutput) {
            const rawOutputPath = join(process.cwd(), 'debug-raw-llm-output.txt');
            writeFileSync(rawOutputPath, rawLLMOutput, 'utf8');
            console.log(`✅ Saved raw LLM output to: ${rawOutputPath}`);
            console.log(`[Debug] Raw LLM output length: ${rawLLMOutput.length} chars`);
            console.log(`[Debug] Raw LLM output preview: ${rawLLMOutput.substring(0, 300)}...\n`);
        } else {
            console.log('❌ No raw LLM output captured\n');
        }

        // Save final patches for comparison
        if (finalPatches && finalPatches.length > 0) {
            const patchesPath = join(process.cwd(), 'debug-final-patches.json');
            writeFileSync(patchesPath, JSON.stringify(finalPatches, null, 2), 'utf8');
            console.log(`✅ Saved final patches to: ${patchesPath}`);
            console.log(`[Debug] Final patches count: ${finalPatches.length}`);
        } else {
            console.log('❌ No final patches captured');
        }

        console.log('\n================================================================================');
        console.log('📊 SUMMARY');
        console.log('================================================================================');
        console.log(`✅ Original JSON saved: ${originalJsonString.length} chars`);
        console.log(`${rawLLMOutput ? '✅' : '❌'} Raw LLM output saved: ${rawLLMOutput.length} chars`);
        console.log(`${finalPatches.length > 0 ? '✅' : '❌'} Final patches saved: ${finalPatches.length} patches`);
        console.log('\n🎯 FILES CREATED:');
        console.log('- debug-original.json (original jsondoc data)');
        console.log('- debug-raw-llm-output.txt (raw LLM diff output)');
        console.log('- debug-final-patches.json (StreamingTransformExecutor patches)');
        console.log('\n📝 NEXT STEPS:');
        console.log('1. Inspect the raw LLM output format');
        console.log('2. Test context diff parsing on the raw output');
        console.log('3. Compare with original JSON to understand the diff');
        console.log('4. Debug why patches have wrong paths');

    } catch (error) {
        console.error('\n❌ ERROR:', error);
        throw error;
    } finally {
        process.exit(0);
    }
}

// Run the debug function
debugContextDiff().catch(console.error); 