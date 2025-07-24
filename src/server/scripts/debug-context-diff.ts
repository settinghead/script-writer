#!/usr/bin/env node

/**
 * Debug script - Simple wrapper around StreamingTransformExecutor
 * Writes callback data to files and exits when streaming ends
 * 
 * Usage:
 *   ./run-ts src/server/scripts/debug-context-diff.ts
 *   ./run-ts src/server/scripts/debug-context-diff.ts "增加一个新角色，小明，是王千榕的好朋友"
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

// Default edit requirement
const DEFAULT_EDIT_REQUIREMENT = '增加一个角色，弗利沙沙，是大boss，王千榕最终决斗的对象，王和弗对决时第一次变成超级赛亚人。';

/**
 * Parse command line arguments
 */
function parseArguments(): string {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('📝 Using default edit requirement');
        return DEFAULT_EDIT_REQUIREMENT;
    }

    const customRequirement = args[0];
    console.log('📝 Using custom edit requirement:', customRequirement);
    return customRequirement;
}

/**
 * Main debug function - now just a wrapper around StreamingTransformExecutor
 */
async function debugContextDiff(): Promise<void> {
    try {
        const editRequirement = parseArguments();

        console.log('================================================================================');
        console.log('🐛 SIMPLIFIED DEBUG WRAPPER - StreamingTransformExecutor');
        console.log('================================================================================');
        console.log(`Project ID: ${PROJECT_ID}`);
        console.log(`Jsondoc ID: ${JSONDOC_ID}`);
        console.log(`Tool: ${TOOL_NAME}`);
        console.log(`User ID: ${USER_ID}`);
        console.log(`Edit Requirement: "${editRequirement}"`);
        console.log();

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

        // Save original JSON for comparison
        const originalJson = targetJsondoc.data || targetJsondoc;
        const originalJsonString = JSON.stringify(originalJson, null, 2);
        const originalJsonPath = join(process.cwd(), 'debug-original.json');
        writeFileSync(originalJsonPath, originalJsonString, 'utf8');
        console.log(`✅ Saved original JSON to: ${originalJsonPath}`);
        console.log(`[Debug] Original JSON length: ${originalJsonString.length} chars\n`);

        console.log('🛠️  Step 3: Executing StreamingTransformExecutor with callbacks...');

        // File writing state
        let rawLLMOutput = '';
        let finalPatches: any[] = [];
        let modifiedJson: string | null = null;
        let rfc6902Patches: any[] = [];

        // Create streaming executor
        const executor = new StreamingTransformExecutor();

        // Prepare input data  
        const input = {
            jsondocs: [{
                jsondocId: JSONDOC_ID,
                description: '剧本设定',
                schemaType: '剧本设定'
            }],
            editRequirements: editRequirement
        };

        // Import schemas
        const { OutlineSettingsEditInputSchema, JsonPatchOperationsSchema } = await import('../../common/schemas/transforms.js');

        // Execute transform with our simplified callbacks
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
                console.log(`[DEBUG-CHUNK] Chunk ${chunkCount}: type=${chunk?.type}, status=${chunk?.pipelineResults?.status}, patches=${chunk?.pipelineResults?.patchCount || 'N/A'}`);

                // Extract data from the internalized pipeline results
                if (chunk?.pipelineResults) {
                    const pipeline = chunk.pipelineResults;

                    // Update our state with the latest successful results
                    if (pipeline.rawLLMOutput) {
                        rawLLMOutput = pipeline.rawLLMOutput;
                    }
                    if (pipeline.modifiedJson) {
                        modifiedJson = pipeline.modifiedJson;
                    }
                    if (pipeline.patches && pipeline.patches.length > 0) {
                        rfc6902Patches = pipeline.patches;
                    }

                    console.log(`[DEBUG-PIPELINE] Status: ${pipeline.status}, Raw: ${pipeline.rawLLMOutput?.length || 0} chars, Modified: ${pipeline.modifiedJsonLength || 0} chars, Patches: ${pipeline.patchCount || 0}`);

                    // WRITE TO FILES IMMEDIATELY as chunks come in (overwrite same files)
                    try {
                        // Write raw LLM output
                        const rawOutputPath = join(process.cwd(), 'debug-raw-llm-output.txt');
                        writeFileSync(rawOutputPath, rawLLMOutput || '(No raw output captured)', 'utf8');

                        // Write modified JSON if available
                        if (modifiedJson) {
                            const modifiedJsonPath = join(process.cwd(), 'debug-modified-via-contextdiff.json');
                            writeFileSync(modifiedJsonPath, modifiedJson, 'utf8');
                        }

                        // Write RFC6902 patches if available
                        if (rfc6902Patches.length > 0) {
                            const rfc6902PatchesPath = join(process.cwd(), 'debug-rfc6902-patches.json');
                            writeFileSync(rfc6902PatchesPath, JSON.stringify(rfc6902Patches, null, 2), 'utf8');
                        }
                    } catch (writeError) {
                        console.warn(`[DEBUG-WRITE] Failed to write files at chunk ${chunkCount}:`, writeError);
                    }
                }

                // Also capture final patches from the streaming executor
                if (chunk?.type === 'finalPatches' && chunk?.patches) {
                    finalPatches = chunk.patches;
                    console.log(`[DEBUG-FINAL] Captured ${finalPatches.length} final patches from StreamingTransformExecutor`);

                    // Write final patches immediately
                    try {
                        const patchesPath = join(process.cwd(), 'debug-final-patches.json');
                        writeFileSync(patchesPath, JSON.stringify(finalPatches, null, 2), 'utf8');
                    } catch (writeError) {
                        console.warn(`[DEBUG-WRITE] Failed to write final patches:`, writeError);
                    }
                }
            },
            onStreamEnd: async (finalResult: any) => {
                console.log('\n🎯 Step 4: Streaming completed - Writing files...');
                console.log(`[DEBUG-END] Final result:`, {
                    outputJsondocId: finalResult.outputJsondocId,
                    finishReason: finalResult.finishReason,
                    totalChunks: finalResult.totalChunks,
                    executionMode: finalResult.executionMode
                });

                // Write all captured data to files
                const rawOutputPath = join(process.cwd(), 'debug-raw-llm-output.txt');
                writeFileSync(rawOutputPath, rawLLMOutput || '(No raw output captured)', 'utf8');
                console.log(`✅ Saved raw LLM output to: ${rawOutputPath} (${rawLLMOutput.length} chars)`);

                const patchesPath = join(process.cwd(), 'debug-final-patches.json');
                writeFileSync(patchesPath, JSON.stringify(finalPatches || [], null, 2), 'utf8');
                console.log(`✅ Saved final patches to: ${patchesPath} (${finalPatches.length} patches)`);

                if (modifiedJson) {
                    const modifiedJsonPath = join(process.cwd(), 'debug-modified-via-contextdiff.json');
                    writeFileSync(modifiedJsonPath, modifiedJson, 'utf8');
                    console.log(`✅ Saved modified JSON to: ${modifiedJsonPath} (${modifiedJson.length} chars)`);
                } else {
                    console.log(`❌ No modified JSON captured`);
                }

                const rfc6902PatchesPath = join(process.cwd(), 'debug-rfc6902-patches.json');
                writeFileSync(rfc6902PatchesPath, JSON.stringify(rfc6902Patches || [], null, 2), 'utf8');
                console.log(`✅ Saved RFC6902 patches to: ${rfc6902PatchesPath} (${rfc6902Patches.length} patches)`);

                console.log('\n================================================================================');
                console.log('📊 SUMMARY');
                console.log('================================================================================');
                console.log(`✅ Original JSON saved: ${originalJsonString.length} chars`);
                console.log(`${rawLLMOutput ? '✅' : '❌'} Raw LLM output saved: ${rawLLMOutput.length} chars`);
                console.log(`${finalPatches.length > 0 ? '✅' : '❌'} Final patches saved: ${finalPatches.length} patches`);
                console.log(`${rfc6902Patches.length > 0 ? '✅' : '❌'} RFC6902 patches saved: ${rfc6902Patches.length} patches`);
                console.log(`${modifiedJson ? '✅' : '❌'} Modified JSON saved: ${modifiedJson?.length || 0} chars`);
                console.log(`📝 Edit requirement: "${editRequirement}"`);
                console.log('\n🎯 FILES CREATED:');
                console.log('- debug-original.json (original jsondoc data)');
                console.log('- debug-raw-llm-output.txt (raw LLM diff output)');
                console.log('- debug-final-patches.json (StreamingTransformExecutor patches)');
                console.log('- debug-modified-via-contextdiff.json (modified JSON from pipeline)');
                console.log('- debug-rfc6902-patches.json (RFC6902 patches from pipeline)');
                console.log('\n✅ SUCCESS: StreamingTransformExecutor pipeline internalized and working!');
            }
        });

        console.log(`\n[Debug] Transform execution completed with result: ${result.outputJsondocId}`);

    } catch (error) {
        console.error('\n❌ ERROR:', error);
        throw error;
    } finally {
        process.exit(0);
    }
}

// Run the debug function
debugContextDiff().catch(console.error); 