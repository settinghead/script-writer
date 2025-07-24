import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createPatch } from 'rfc6902';
import { jsonrepair } from 'jsonrepair';
import {
    extractUnifiedDiffOnly,
    applyContextDiffToJSON,
    applyContextDiffAndGeneratePatches
} from '../common/contextDiff';

/**
 * Integration test for the complete contextDiff pipeline
 * Tests the 5-step process from raw LLM output to RFC6902 patches
 * 
 * Pipeline:
 * 0. original-jsondoc.json (input)
 * 1. raw_llm_diff.txt (input) 
 * 2. patched_raw_text.txt (extracted/cleaned diff)
 * 3. patched_jsondoc.json (applied diff + jsonrepair)
 * 4. rfc6902_patches.json (generated patches)
 */
describe('ContextDiff Pipeline Integration', () => {
    const fixturesPath = join(__dirname, 'fixtures', '00001');

    // Load all canonical files
    const originalJsondoc = JSON.parse(readFileSync(join(fixturesPath, '0_original-jsondoc.json'), 'utf8'));
    const rawLlmDiff = readFileSync(join(fixturesPath, '1_raw_llm_diff.txt'), 'utf8');
    const expectedPatchedRawText = readFileSync(join(fixturesPath, '2_patched_raw_text.txt'), 'utf8');
    const expectedPatchedJsondoc = JSON.parse(readFileSync(join(fixturesPath, '3_patched_jsondoc.json'), 'utf8'));
    const expectedRfc6902Patches = JSON.parse(readFileSync(join(fixturesPath, '4_rfc6902_patches.json'), 'utf8'));

    describe('Step 1→2: Extract and clean unified diff', () => {
        it('should extract clean unified diff from raw LLM output', () => {
            // Step 1→2: Extract unified diff (removing any extra LLM chatter)
            const extractedDiff = extractUnifiedDiffOnly(rawLlmDiff);

            // Compare with canonical result
            expect(extractedDiff.trim()).toBe(expectedPatchedRawText.trim());
        });
    });

    describe('Step 2→3: Apply diff and repair JSON', () => {
        it('should apply unified diff to original JSON and produce valid JSON', () => {
            // Step 2→3: Apply the unified diff to original JSON
            const originalJsonString = JSON.stringify(originalJsondoc, null, 2);
            const modifiedJsonString = applyContextDiffToJSON(originalJsonString, expectedPatchedRawText);

            // Parse the result (should be valid JSON after repair)
            let modifiedJson;
            try {
                modifiedJson = JSON.parse(modifiedJsonString);
            } catch (parseError) {
                // If parsing fails, try jsonrepair
                const repairedJsonString = jsonrepair(modifiedJsonString);
                modifiedJson = JSON.parse(repairedJsonString);
            }

            // Compare with canonical result
            expect(modifiedJson).toEqual(expectedPatchedJsondoc);
        });

        it('should handle jsonrepair if needed for malformed JSON', () => {
            // Test the jsonrepair path explicitly
            const originalJsonString = JSON.stringify(originalJsondoc, null, 2);
            const modifiedJsonString = applyContextDiffToJSON(originalJsonString, rawLlmDiff);

            // Force jsonrepair to test that path
            const repairedJsonString = jsonrepair(modifiedJsonString);
            const repairedJson = JSON.parse(repairedJsonString);

            // Should match expected result
            expect(repairedJson).toEqual(expectedPatchedJsondoc);
        });
    });

    describe('Step 3→4: Generate RFC6902 patches', () => {
        it('should generate correct RFC6902 patches from original to patched JSON', () => {
            // Step 3→4: Generate RFC6902 patches
            const generatedPatches = createPatch(originalJsondoc, expectedPatchedJsondoc);

            // Compare with canonical result
            expect(generatedPatches).toEqual(expectedRfc6902Patches);
        });

        it('should generate patches using contextDiff utility function', () => {
            // Test using the existing utility function
            const originalJsonString = JSON.stringify(originalJsondoc, null, 2);
            const generatedPatches = applyContextDiffAndGeneratePatches(originalJsonString, rawLlmDiff);

            // Compare with canonical result
            expect(generatedPatches).toEqual(expectedRfc6902Patches);
        });
    });

    describe('End-to-End Pipeline', () => {
        it('should process the complete pipeline from raw LLM diff to RFC6902 patches', () => {
            const originalJsonString = JSON.stringify(originalJsondoc, null, 2);

            // Step 1→2: Extract clean diff
            const cleanedDiff = extractUnifiedDiffOnly(rawLlmDiff);
            expect(cleanedDiff.trim()).toBe(expectedPatchedRawText.trim());

            // Step 2→3: Apply diff and get modified JSON
            const modifiedJsonString = applyContextDiffToJSON(originalJsonString, cleanedDiff);
            let modifiedJson;
            try {
                modifiedJson = JSON.parse(modifiedJsonString);
            } catch (parseError) {
                const repairedJsonString = jsonrepair(modifiedJsonString);
                modifiedJson = JSON.parse(repairedJsonString);
            }
            expect(modifiedJson).toEqual(expectedPatchedJsondoc);

            // Step 3→4: Generate RFC6902 patches
            const finalPatches = createPatch(originalJsondoc, modifiedJson);
            expect(finalPatches).toEqual(expectedRfc6902Patches);
        });

        it('should validate all intermediate steps produce expected results', () => {
            // Comprehensive validation of each step
            const results = {
                step0: originalJsondoc,
                step1: rawLlmDiff,
                step2: extractUnifiedDiffOnly(rawLlmDiff),
                step3: null as any,
                step4: null as any[]
            };

            // Step 2 validation
            expect(results.step2.trim()).toBe(expectedPatchedRawText.trim());

            // Step 3: Apply diff
            const originalJsonString = JSON.stringify(results.step0, null, 2);
            const modifiedJsonString = applyContextDiffToJSON(originalJsonString, results.step2);
            try {
                results.step3 = JSON.parse(modifiedJsonString);
            } catch (parseError) {
                const repairedJsonString = jsonrepair(modifiedJsonString);
                results.step3 = JSON.parse(repairedJsonString);
            }
            expect(results.step3).toEqual(expectedPatchedJsondoc);

            // Step 4: Generate patches
            results.step4 = createPatch(results.step0, results.step3);
            expect(results.step4).toEqual(expectedRfc6902Patches);

            // Validate patch structure
            expect(results.step4).toHaveLength(6);
            expect(results.step4[0]).toHaveProperty('op', 'add');
            expect(results.step4[0]).toHaveProperty('path', '/setting/climactic_moment');
            expect(results.step4[5]).toHaveProperty('op', 'add');
            expect(results.step4[5]).toHaveProperty('path', '/characters/5');
            expect(results.step4[5].value).toHaveProperty('name', '弗利沙沙');
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle malformed JSON gracefully', () => {
            const malformedJson = '{ "test": "incomplete';
            expect(() => jsonrepair(malformedJson)).not.toThrow();

            const repaired = jsonrepair(malformedJson);
            expect(() => JSON.parse(repaired)).not.toThrow();
        });

        it('should handle empty diffs gracefully', () => {
            const originalJsonString = JSON.stringify(originalJsondoc, null, 2);
            const emptyDiff = '';

            const result = applyContextDiffToJSON(originalJsonString, emptyDiff);
            expect(result).toBe(originalJsonString);
        });

        it('should handle invalid unified diff format', () => {
            const originalJsonString = JSON.stringify(originalJsondoc, null, 2);
            const invalidDiff = 'This is not a valid unified diff';

            const result = applyContextDiffToJSON(originalJsonString, invalidDiff);
            expect(result).toBe(originalJsonString); // Should return original unchanged
        });
    });

    describe('Performance and Correctness', () => {
        it('should produce patches that can be applied back to original', () => {
            // Verify patches are correct by applying them
            const { applyPatch } = require('rfc6902');
            const originalCopy = JSON.parse(JSON.stringify(originalJsondoc));

            const patchResults = applyPatch(originalCopy, expectedRfc6902Patches);

            // All patches should apply successfully
            patchResults.forEach((result, index) => {
                expect(result.test).toBe(true, `Patch ${index} should apply successfully: ${JSON.stringify(expectedRfc6902Patches[index])}`);
            });

            // Result should match expected patched JSON
            expect(originalCopy).toEqual(expectedPatchedJsondoc);
        });

        it('should handle complex character addition with nested objects', () => {
            // Specifically test the character addition (patch 5)
            const characterPatch = expectedRfc6902Patches[5];
            expect(characterPatch.op).toBe('add');
            expect(characterPatch.path).toBe('/characters/5');
            expect(characterPatch.value).toHaveProperty('name', '弗利沙沙');
            expect(characterPatch.value).toHaveProperty('type', 'final_antagonist');
            expect(characterPatch.value.personality_traits).toBeInstanceOf(Array);
            expect(characterPatch.value.relationships).toBeInstanceOf(Object);
        });

        it('should handle array insertions at specific positions', () => {
            // Test the key_scenes array insertions (patches 1-4)
            const keyScenePatches = expectedRfc6902Patches.slice(1, 5);

            keyScenePatches.forEach((patch, index) => {
                expect(patch.op).toBe('add');
                expect(patch.path).toMatch(/^\/setting\/key_scenes\/\d+$/);
                expect(typeof patch.value).toBe('string');
                expect(patch.value).toContain('弗利沙沙'); // All new scenes relate to the new character
            });
        });
    });
}); 