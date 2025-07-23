#!/usr/bin/env node

/**
 * Debug script to capture raw LLM output and original JSON for context diff debugging
 * Saves files for isolated testing
 * 
 * Usage:
 *   ./run-ts src/server/scripts/debug-context-diff.ts
 *   ./run-ts src/server/scripts/debug-context-diff.ts "增加一个新角色，小明，是王千榕的好朋友"
 *   ./run-ts src/server/scripts/debug-context-diff.ts "修改艾莉娅的职业为心理学家"
 *   ./run-ts src/server/scripts/debug-context-diff.ts "删除所有配角，只保留主角"
 */

import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository.js';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository.js';
import { StreamingTransformExecutor } from '../transform-jsondoc-framework/StreamingTransformExecutor.js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import {
    parseContextDiff,
    applyContextDiffToJSON,
    applyContextDiffAndGeneratePatches
} from '../../common/contextDiff.js';

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
 * Main debug function
 */
async function debugContextDiff(): Promise<void> {
    try {
        const editRequirement = parseArguments();

        console.log('================================================================================');
        console.log('🐛 CAPTURE RAW LLM OUTPUT & ORIGINAL JSON');
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

        // Create streaming executor to use existing infrastructure
        const executor = new StreamingTransformExecutor();

        console.log('[Debug] Executor initialized');

        // Prepare input data  
        const input = {
            jsondocs: [{
                jsondocId: JSONDOC_ID,
                description: '剧本设定',
                schemaType: '剧本设定'
            }],
            editRequirements: editRequirement
        };

        console.log('[Debug] Input prepared:', input);

        // Import schemas
        const { OutlineSettingsEditInputSchema, JsonPatchOperationsSchema } = await import('../../common/schemas/transforms.js');

        // Execute transform in patch-approval mode to capture raw LLM output
        const result = await executor.executeStreamingTransform({
            config: {
                templateName: '剧本设定_edit_diff',
                inputSchema: OutlineSettingsEditInputSchema,
                outputSchema: JsonPatchOperationsSchema // Expect JSON patch operations as final output
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
                // DEBUG: Log every chunk type for debugging
                console.log(`[DEBUG-CHUNK] Received chunk ${chunkCount}: type=${chunk?.type}, source=${chunk?.source}, patches=${chunk?.patches?.length || 'N/A'}`);

                // Capture raw text for debugging - handle different streaming formats
                if (chunk?.type === 'rawText') {
                    // New format with rawText chunks
                    if (chunk.textDelta) {
                        rawLLMOutput += chunk.textDelta;
                    }
                    if (chunk.accumulatedText) {
                        // Use accumulated text as backup
                        rawLLMOutput = chunk.accumulatedText;
                    }
                } else if (chunk?.type === 'text' && chunk?.textDelta) {
                    // Legacy text format
                    rawLLMOutput += chunk.textDelta;
                } else if (chunk?.content) {
                    // Direct content format
                    rawLLMOutput += chunk.content;
                } else if (typeof chunk === 'string') {
                    // Direct string format
                    rawLLMOutput += chunk;
                }

                // Capture ONLY final patches, ignore intermediate broken patches
                if (chunk?.type === 'finalPatches' && chunk?.patches) {
                    finalPatches = chunk.patches;
                    console.log(`[Debug] Captured finalPatches: ${finalPatches.length} patches from source: ${chunk.source}`);
                    console.log(`[Debug] FinalPatches preview:`, JSON.stringify(finalPatches.slice(0, 1), null, 2));
                } else if (Array.isArray(chunk) && !chunk.some(p => p?.type)) {
                    // Direct patches array (only if it doesn't contain streaming metadata)
                    finalPatches = chunk;
                    console.log(`[Debug] Captured direct patches array: ${finalPatches.length} patches`);
                } else if (chunk?.type === 'finalPatches') {
                    console.log(`[Debug] FinalPatches chunk received but no patches:`, {
                        type: chunk.type,
                        hasPatches: !!chunk.patches,
                        patchesType: typeof chunk.patches,
                        patchesLength: chunk.patches?.length,
                        source: chunk.source
                    });
                }
                // IGNORE intermediate 'patches' type - these are from broken eager parsing!

                // Log progress every 10 chunks to see what's happening
                if (chunkCount % 10 === 1) {
                    console.log(`[Debug] Chunk ${chunkCount}: type=${chunk?.type}, raw length=${rawLLMOutput.length}, patches=${finalPatches.length}`);
                }
            }
        });

        console.log(`[Debug] Transform execution completed, total output: ${rawLLMOutput.length} chars\n`);

        console.log('💾 Step 4: Saving captured data...');

        // Always save raw LLM output (even if empty for debugging)
        const rawOutputPath = join(process.cwd(), 'debug-raw-llm-output.txt');
        writeFileSync(rawOutputPath, rawLLMOutput || '(No raw output captured)', 'utf8');
        if (rawLLMOutput) {
            console.log(`✅ Saved raw LLM output to: ${rawOutputPath}`);
            console.log(`[Debug] Raw LLM output length: ${rawLLMOutput.length} chars`);
            console.log(`[Debug] Raw LLM output preview: ${rawLLMOutput.substring(0, 300)}...\n`);
        } else {
            console.log(`❌ No raw LLM output captured (saved empty file to: ${rawOutputPath})\n`);
        }

        // Always save final patches (even if empty for debugging)
        const patchesPath = join(process.cwd(), 'debug-final-patches.json');
        writeFileSync(patchesPath, JSON.stringify(finalPatches || [], null, 2), 'utf8');
        if (finalPatches && finalPatches.length > 0) {
            console.log(`✅ Saved final patches to: ${patchesPath}`);
            console.log(`[Debug] Final patches count: ${finalPatches.length}`);
        } else {
            console.log(`❌ No final patches captured (saved empty array to: ${patchesPath})`);
        }

        console.log('\n🧪 Step 5: Testing our new context diff functions...');

        // Always test our context diff functions, even with empty/placeholder data
        const testDiffText = rawLLMOutput || `CONTEXT: "title": "测试标题"
- "title": "测试标题"
+ "title": "新测试标题"`;

        console.log(`[Debug] Testing with diff text: ${testDiffText.length} chars`);

        if (rawLLMOutput || true) { // Always run the test
            console.log('[Debug] Testing context diff parsing...');

            // Test JSON application directly (this handles multiple diffs internally)
            console.log('[Debug] Testing JSON-aware diff application...');
            const modifiedJson = applyContextDiffToJSON(originalJsonString, testDiffText);

            if (modifiedJson) {
                console.log(`✅ JSON diff applied successfully:`);
                console.log(`   - Original length: ${originalJsonString.length} chars`);
                console.log(`   - Modified length: ${modifiedJson.length} chars`);
                console.log(`   - Difference: ${modifiedJson.length - originalJsonString.length} chars`);

                // Save modified JSON
                const modifiedJsonPath = join(process.cwd(), 'debug-modified-via-contextdiff.json');
                writeFileSync(modifiedJsonPath, modifiedJson, 'utf8');
                console.log(`✅ Saved modified JSON to: ${modifiedJsonPath}`);

                // Also save the raw diff-applied text for debugging
                const rawModifiedPath = join(process.cwd(), 'debug-raw-modified.txt');
                writeFileSync(rawModifiedPath, modifiedJson, 'utf8');
                console.log(`✅ Saved raw modified text to: ${rawModifiedPath}`);

                // Test RFC6902 patch generation
                console.log('[Debug] Testing RFC6902 patch generation...');
                const patchResult = applyContextDiffAndGeneratePatches(originalJsonString, testDiffText);

                // Type guard to handle the return type properly
                if (Array.isArray(patchResult)) {
                    // Direct array of patches
                    console.log(`✅ RFC6902 patches generated successfully:`);
                    console.log(`   - Number of patches: ${patchResult.length}`);

                    // Save RFC6902 patches
                    const rfc6902PatchesPath = join(process.cwd(), 'debug-rfc6902-patches.json');
                    writeFileSync(rfc6902PatchesPath, JSON.stringify(patchResult, null, 2), 'utf8');
                    console.log(`✅ Saved RFC6902 patches to: ${rfc6902PatchesPath}`);

                    // Show sample patches
                    console.log('\n📋 Sample patches:');
                    patchResult.slice(0, 3).forEach((patch: any, i: number) => {
                        console.log(`   ${i + 1}. ${patch.op} at "${patch.path}" → "${patch.value?.toString().substring(0, 50)}..."`);
                    });
                } else if (patchResult && typeof patchResult === 'object' && 'rfc6902Patches' in patchResult) {
                    // Object with rfc6902Patches property
                    const patches = (patchResult as any).rfc6902Patches;
                    console.log(`✅ RFC6902 patches generated successfully:`);
                    console.log(`   - Number of patches: ${patches.length}`);
                    console.log(`   - Changes applied: ${(patchResult as any).appliedChanges || 0}`);
                    if ((patchResult as any).totalChanges) {
                        console.log(`   - Success rate: ${(((patchResult as any).appliedChanges || 0) / (patchResult as any).totalChanges * 100).toFixed(1)}%`);
                    }

                    // Save RFC6902 patches
                    const rfc6902PatchesPath = join(process.cwd(), 'debug-rfc6902-patches.json');
                    writeFileSync(rfc6902PatchesPath, JSON.stringify(patches, null, 2), 'utf8');
                    console.log(`✅ Saved RFC6902 patches to: ${rfc6902PatchesPath}`);

                    // Show sample patches
                    console.log('\n📋 Sample patches:');
                    patches.slice(0, 3).forEach((patch: any, i: number) => {
                        console.log(`   ${i + 1}. ${patch.op} at "${patch.path}" → "${patch.value?.toString().substring(0, 50)}..."`);
                    });
                } else {
                    console.log('❌ RFC6902 patch generation failed');
                }
            } else {
                console.log('❌ JSON diff application failed');

                // Still save a placeholder file for debugging
                const modifiedJsonPath = join(process.cwd(), 'debug-modified-via-contextdiff.json');
                writeFileSync(modifiedJsonPath, '{"error": "diff_application_failed"}', 'utf8');
                console.log(`❌ Saved error placeholder to: ${modifiedJsonPath}`);
            }
        } else {
            console.log('❌ Context diff parsing failed');

            // Still save a placeholder file for debugging
            const modifiedJsonPath = join(process.cwd(), 'debug-modified-via-contextdiff.json');
            writeFileSync(modifiedJsonPath, '{"error": "diff_parsing_failed"}', 'utf8');
            console.log(`❌ Saved error placeholder to: ${modifiedJsonPath}`);
        }

        // Always create RFC6902 patches file (even if empty)
        const rfc6902PatchesPath = join(process.cwd(), 'debug-rfc6902-patches.json');
        try {
            const patchResult = applyContextDiffAndGeneratePatches(originalJsonString, testDiffText);
            if (Array.isArray(patchResult)) {
                writeFileSync(rfc6902PatchesPath, JSON.stringify(patchResult, null, 2), 'utf8');
                console.log(`✅ Saved RFC6902 patches to: ${rfc6902PatchesPath} (${patchResult.length} patches)`);
            } else if (patchResult && typeof patchResult === 'object' && 'rfc6902Patches' in patchResult) {
                const patches = (patchResult as any).rfc6902Patches;
                writeFileSync(rfc6902PatchesPath, JSON.stringify(patches, null, 2), 'utf8');
                console.log(`✅ Saved RFC6902 patches to: ${rfc6902PatchesPath} (${patches.length} patches)`);
            } else {
                writeFileSync(rfc6902PatchesPath, '[]', 'utf8');
                console.log(`❌ Saved empty RFC6902 patches to: ${rfc6902PatchesPath}`);
            }
        } catch (error) {
            writeFileSync(rfc6902PatchesPath, '[]', 'utf8');
            console.log(`❌ RFC6902 patch generation error, saved empty file: ${error}`);
        }

        console.log('\n================================================================================');
        console.log('📊 SUMMARY');
        console.log('================================================================================');
        console.log(`[DEBUG-SUMMARY] finalPatches type: ${typeof finalPatches}, length: ${finalPatches?.length}, value:`, finalPatches);
        console.log(`✅ Original JSON saved: ${originalJsonString.length} chars`);
        console.log(`${rawLLMOutput ? '✅' : '❌'} Raw LLM output saved: ${rawLLMOutput.length} chars`);
        console.log(`${finalPatches.length > 0 ? '✅' : '❌'} Final patches saved: ${finalPatches.length} patches`);
        console.log(`📝 Edit requirement: "${editRequirement}"`);
        console.log('\n🎯 FILES CREATED:');
        console.log('- debug-original.json (original jsondoc data)');
        console.log('- debug-raw-llm-output.txt (raw LLM diff output)');
        console.log('- debug-final-patches.json (StreamingTransformExecutor patches)');
        console.log('- debug-modified-via-contextdiff.json (our context diff result)');
        console.log('- debug-rfc6902-patches.json (our RFC6902 patches)');
        console.log('\n📝 ANALYSIS:');
        console.log('1. Compare debug-final-patches.json vs debug-rfc6902-patches.json');
        console.log('2. Check success rates and patch accuracy');
        console.log('3. Validate JSON structure preservation');
        console.log('4. Test patch application with rfc6902 library');

    } catch (error) {
        console.error('\n❌ ERROR:', error);
        throw error;
    } finally {
        process.exit(0);
    }
}

// Run the debug function
debugContextDiff().catch(console.error); 