#!/usr/bin/env node

/**
 * Fixture Generator Script - Based on StreamingTransformExecutor
 * Generates new test fixtures under src/__tests__/fixtures/ with auto-incrementing numbers
 * 
 * Usage:
 *   ./run-ts src/server/scripts/debug-context-diff.ts
 *   ./run-ts src/server/scripts/debug-context-diff.ts "增加一个新角色，小明，是王千榕的好朋友"
 */

import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository.js';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository.js';
import { StreamingTransformExecutor } from '../transform-jsondoc-framework/StreamingTransformExecutor.js';
import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { parseUnifiedDiff } from '../../common/contextDiff.js';

// Project and jsondoc IDs
const PROJECT_ID = '559e05ad-cd3d-459f-85b6-12d6e3496b65';
const JSONDOC_ID = '2f812a07-019a-40a4-8d4c-5a867e7a427b';
const TOOL_NAME = 'improve_剧本设定';
const USER_ID = 'test-user-1';

// Default edit requirement
const DEFAULT_EDIT_REQUIREMENT = '增加一个角色，弗利沙沙，是大boss，王千榕最终决斗的对象，王和弗对决时第一次变成超级赛亚人。';

/**
 * Find the next available fixture number
 */
function getNextFixtureNumber(): string {
    const fixturesDir = join(process.cwd(), 'src', '__tests__', 'fixtures');

    if (!existsSync(fixturesDir)) {
        mkdirSync(fixturesDir, { recursive: true });
        return '00001';
    }

    const existingDirs = readdirSync(fixturesDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => /^\d{5}$/.test(name))
        .sort();

    if (existingDirs.length === 0) {
        return '00001';
    }

    const lastNumber = parseInt(existingDirs[existingDirs.length - 1], 10);
    const nextNumber = lastNumber + 1;
    return nextNumber.toString().padStart(5, '0');
}

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
 * Main fixture generation function
 */
async function generateFixture(): Promise<void> {
    try {
        const editRequirement = parseArguments();
        const fixtureNumber = getNextFixtureNumber();
        const fixtureDir = join(process.cwd(), 'src', '__tests__', 'fixtures', fixtureNumber);

        console.log('================================================================================');
        console.log('🧪 FIXTURE GENERATOR - Creating New Test Case');
        console.log('================================================================================');
        console.log(`Fixture Number: ${fixtureNumber}`);
        console.log(`Fixture Directory: ${fixtureDir}`);
        console.log(`Project ID: ${PROJECT_ID}`);
        console.log(`Jsondoc ID: ${JSONDOC_ID}`);
        console.log(`Tool: ${TOOL_NAME}`);
        console.log(`User ID: ${USER_ID}`);
        console.log(`Edit Requirement: "${editRequirement}"`);
        console.log();

        // Create fixture directory
        mkdirSync(fixtureDir, { recursive: true });
        console.log(`✅ Created fixture directory: ${fixtureDir}`);

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

        // Step 0: Save original JSON (formatted)
        const originalJson = targetJsondoc.data || targetJsondoc;
        const originalJsonString = JSON.stringify(originalJson, null, 2);
        const originalJsonPath = join(fixtureDir, '0_original-jsondoc.json');
        writeFileSync(originalJsonPath, originalJsonString, 'utf8');
        console.log(`✅ Step 0: Saved original JSON to: 0_original-jsondoc.json (${originalJsonString.length} chars)`);

        console.log('🛠️  Step 3: Executing StreamingTransformExecutor...');

        // State tracking for fixture generation
        let rawLLMOutput = '';
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

        // Execute transform
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
                console.log(`[CHUNK ${chunkCount}] type=${chunk?.type}, status=${chunk?.pipelineResults?.status}, patches=${chunk?.pipelineResults?.patchCount || 'N/A'}`);

                // Extract data from pipeline results
                if (chunk?.pipelineResults) {
                    const pipeline = chunk.pipelineResults;

                    if (pipeline.rawLLMOutput) {
                        rawLLMOutput = pipeline.rawLLMOutput;
                    }
                    if (pipeline.modifiedJson) {
                        modifiedJson = pipeline.modifiedJson;
                    }
                    if (pipeline.patches && pipeline.patches.length > 0) {
                        rfc6902Patches = pipeline.patches;
                    }
                }
            },
            onStreamEnd: async (finalResult: any) => {
                console.log('\n🎯 Step 4: Generating fixture files...');

                try {
                    // Step 1: Raw LLM diff
                    if (rawLLMOutput) {
                        const rawDiffPath = join(fixtureDir, '1_raw_llm_diff.txt');
                        writeFileSync(rawDiffPath, rawLLMOutput, 'utf8');
                        console.log(`✅ Step 1: Saved raw LLM diff to: 1_raw_llm_diff.txt (${rawLLMOutput.length} chars)`);

                        // Step 1.5: Parse hunks
                        try {
                            const hunks = parseUnifiedDiff(rawLLMOutput);
                            const hunksPath = join(fixtureDir, '1.5_parsed_hunks.json');
                            writeFileSync(hunksPath, JSON.stringify(hunks, null, 2), 'utf8');
                            console.log(`✅ Step 1.5: Saved parsed hunks to: 1.5_parsed_hunks.json (${hunks.length} hunks)`);
                        } catch (parseError) {
                            console.warn(`⚠️  Step 1.5: Failed to parse hunks:`, parseError);
                        }
                    } else {
                        console.warn(`⚠️  Step 1: No raw LLM output captured`);
                    }

                    // Step 2: Modified JSON (patched raw text)
                    if (modifiedJson) {
                        const modifiedJsonPath = join(fixtureDir, '2_patched_raw_text.txt');
                        writeFileSync(modifiedJsonPath, modifiedJson, 'utf8');
                        console.log(`✅ Step 2: Saved patched raw text to: 2_patched_raw_text.txt (${modifiedJson.length} chars)`);

                        // Step 3: Parse and repair the modified JSON
                        try {
                            const { repairJsonSync } = await import('../../server/utils/jsonRepair.js');
                            let parsedJson;

                            try {
                                parsedJson = JSON.parse(modifiedJson);
                            } catch (parseError) {
                                console.log('Step 3: JSON parsing failed, using robust repair...');
                                const repairedJson = repairJsonSync(modifiedJson, {
                                    ensureAscii: false,
                                    indent: 2
                                });
                                parsedJson = JSON.parse(repairedJson);
                            }

                            const parsedJsonPath = join(fixtureDir, '3_patched_jsondoc.json');
                            writeFileSync(parsedJsonPath, JSON.stringify(parsedJson, null, 2), 'utf8');
                            console.log(`✅ Step 3: Saved parsed JSON to: 3_patched_jsondoc.json`);
                        } catch (repairError) {
                            console.warn(`⚠️  Step 3: Failed to parse/repair JSON:`, repairError);
                        }
                    } else {
                        console.warn(`⚠️  Step 2: No modified JSON captured`);
                    }

                    // Step 4: RFC6902 patches
                    if (rfc6902Patches.length > 0) {
                        const rfc6902PatchesPath = join(fixtureDir, '4_rfc6902_patches.json');
                        writeFileSync(rfc6902PatchesPath, JSON.stringify(rfc6902Patches, null, 2), 'utf8');
                        console.log(`✅ Step 4: Saved RFC6902 patches to: 4_rfc6902_patches.json (${rfc6902Patches.length} patches)`);
                    } else {
                        console.warn(`⚠️  Step 4: No RFC6902 patches captured`);
                    }

                    console.log('\n================================================================================');
                    console.log('📊 FIXTURE GENERATION SUMMARY');
                    console.log('================================================================================');
                    console.log(`🗂️  Fixture Directory: ${fixtureNumber}/`);
                    console.log(`✅ 0_original-jsondoc.json: ${originalJsonString.length} chars`);
                    console.log(`${rawLLMOutput ? '✅' : '❌'} 1_raw_llm_diff.txt: ${rawLLMOutput.length} chars`);
                    console.log(`${rawLLMOutput ? '✅' : '❌'} 1.5_parsed_hunks.json: Generated from diff`);
                    console.log(`${modifiedJson ? '✅' : '❌'} 2_patched_raw_text.txt: ${modifiedJson?.length || 0} chars`);
                    console.log(`${modifiedJson ? '✅' : '❌'} 3_patched_jsondoc.json: Parsed and repaired`);
                    console.log(`${rfc6902Patches.length > 0 ? '✅' : '❌'} 4_rfc6902_patches.json: ${rfc6902Patches.length} patches`);
                    console.log(`📝 Edit requirement: "${editRequirement}"`);

                    console.log('\n🎯 NEW FIXTURE CREATED:');
                    console.log(`📁 Location: src/__tests__/fixtures/${fixtureNumber}/`);
                    console.log('📄 Files:');
                    console.log('  - 0_original-jsondoc.json (original jsondoc data)');
                    console.log('  - 1_raw_llm_diff.txt (raw LLM unified diff)');
                    console.log('  - 1.5_parsed_hunks.json (structured diff hunks)');
                    console.log('  - 2_patched_raw_text.txt (text after applying diff)');
                    console.log('  - 3_patched_jsondoc.json (parsed and repaired JSON)');
                    console.log('  - 4_rfc6902_patches.json (RFC6902 patches)');

                    console.log('\n🧪 READY FOR TESTING:');
                    console.log(`You can now add test cases using fixture ${fixtureNumber}!`);
                    console.log(`Example: expect(result).toEqual(readFileSync('fixtures/${fixtureNumber}/4_rfc6902_patches.json'))`);

                } catch (error) {
                    console.error('\n❌ ERROR during fixture generation:', error);
                    throw error;
                }
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

// Run the fixture generation function
generateFixture().catch(console.error); 