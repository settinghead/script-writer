import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createPatch } from 'rfc6902';
import { jsonrepair } from 'jsonrepair';
import {
    extractUnifiedDiffOnly,
    applyContextDiffAndGeneratePatches,
    parseUnifiedDiff,
    applyHunksToText,
    UnifiedDiffHunk
} from '../common/contextDiff';
import { repairJsonSync } from '../server/utils/jsonRepair';

/**
 * Integration test for the complete contextDiff pipeline
 * Tests the 6-step process from raw LLM output to RFC6902 patches
 * 
 * Pipeline:
 * 0. original-jsondoc.json (input)
 * 1. raw_llm_diff.txt (input - unified diff) 
 * 1.5. parsed_hunks.json (structured representation of unified diff)
 * 2. patched_raw_text.txt (result after applying diff - JSON string)
 * 3. patched_jsondoc.json (parsed and validated JSON object)
 * 4. rfc6902_patches.json (generated RFC6902 patches)
 */
describe('ContextDiff Pipeline Integration', () => {
    const fixturesPath = join(__dirname, 'fixtures', '00001');

    // Load all canonical files
    const originalJsondoc = JSON.parse(readFileSync(join(fixturesPath, '0_original-jsondoc.json'), 'utf8'));
    const rawLlmDiff = readFileSync(join(fixturesPath, '1_raw_llm_diff.txt'), 'utf8');
    const expectedParsedHunks = JSON.parse(readFileSync(join(fixturesPath, '1.5_parsed_hunks.json'), 'utf8'));
    const expectedPatchedRawText = readFileSync(join(fixturesPath, '2_patched_raw_text.txt'), 'utf8');
    const expectedPatchedJsondoc = JSON.parse(readFileSync(join(fixturesPath, '3_patched_jsondoc.json'), 'utf8'));
    const expectedRfc6902Patches = JSON.parse(readFileSync(join(fixturesPath, '4_rfc6902_patches.json'), 'utf8'));

    describe('Step 1→1.5: Parse unified diff into structured hunks', () => {
        it('should parse unified diff into structured hunks with correct metadata', () => {
            // Step 1→1.5: Parse raw unified diff into structured hunks
            const parsedHunks = parseUnifiedDiff(rawLlmDiff);

            // Compare with canonical result
            expect(parsedHunks).toEqual(expectedParsedHunks);
        });

        it('should identify correct number of hunks with expected content types', () => {
            const parsedHunks = parseUnifiedDiff(rawLlmDiff);

            // Should have exactly 3 hunks
            expect(parsedHunks).toHaveLength(3);

            // Hunk 1: Character addition (large addition)
            expect(parsedHunks[0].oldStart).toBe(134);
            expect(parsedHunks[0].newCount).toBe(47); // Large addition
            const hunk1Additions = parsedHunks[0].lines.filter(l => l.type === 'addition');
            expect(hunk1Additions).toHaveLength(21); // Character object lines

            // Hunk 2: Characters array closing (small addition)
            expect(parsedHunks[1].oldStart).toBe(234);
            expect(parsedHunks[1].newCount).toBe(7); // Small addition
            const hunk2Additions = parsedHunks[1].lines.filter(l => l.type === 'addition');
            expect(hunk2Additions).toHaveLength(1); // Just closing bracket

            // Hunk 3: Setting fields (medium addition)
            expect(parsedHunks[2].oldStart).toBe(237);
            expect(parsedHunks[2].newCount).toBe(25); // Medium addition
            const hunk3Additions = parsedHunks[2].lines.filter(l => l.type === 'addition');
            expect(hunk3Additions).toHaveLength(6); // key_scenes + climactic_moment
        });

        it('should correctly identify addition content for each hunk', () => {
            const parsedHunks = parseUnifiedDiff(rawLlmDiff);

            // Hunk 1 should contain character "弗利沙沙"
            const hunk1Content = parsedHunks[0].lines
                .filter(l => l.type === 'addition')
                .map(l => l.content)
                .join('\n');
            expect(hunk1Content).toContain('"name": "弗利沙沙"');
            expect(hunk1Content).toContain('"type": "final_antagonist"');

            // Hunk 3 should contain key_scenes and climactic_moment
            const hunk3Content = parsedHunks[2].lines
                .filter(l => l.type === 'addition')
                .map(l => l.content)
                .join('\n');
            expect(hunk3Content).toContain('南京眼摩天轮顶层密室（弗利沙沙降临地球的登陆点）');
            expect(hunk3Content).toContain('"climactic_moment":');
        });
    });

    describe('Step 1.5→2: Apply parsed hunks to original JSON', () => {
        it('should apply unified diff to original JSON and produce modified JSON string', () => {
            // Step 1.5→2: Apply unified diff to original JSON to get modified JSON string
            const originalJsonString = JSON.stringify(originalJsondoc, null, 2);
            const hunks = parseUnifiedDiff(rawLlmDiff);
            const modifiedJsonString = applyHunksToText(originalJsonString, hunks);

            // Compare with canonical result
            expect(modifiedJsonString.trim()).toBe(expectedPatchedRawText.trim());
        });
    });

    describe('Step 2→3: Parse and validate JSON', () => {
        it('should parse the modified JSON string into a valid JSON object', () => {
            // Step 2→3: Parse the JSON string (should be valid after repair if needed)
            let modifiedJson;
            try {
                modifiedJson = JSON.parse(expectedPatchedRawText);
            } catch (parseError) {
                // If parsing fails, try robust JSON repair
                const repairedJsonString = repairJsonSync(expectedPatchedRawText, {
                    ensureAscii: false,
                    indent: 2
                });
                modifiedJson = JSON.parse(repairedJsonString);
            }

            // Compare with canonical result
            expect(modifiedJson).toEqual(expectedPatchedJsondoc);
        });

        it('should handle jsonrepair if needed for malformed JSON', () => {
            // Test the jsonrepair path explicitly
            const originalJsonString = JSON.stringify(originalJsondoc, null, 2);
            const hunks = parseUnifiedDiff(rawLlmDiff);
            const modifiedJsonString = applyHunksToText(originalJsonString, hunks);

            // Force robust JSON repair to test that path
            const repairedJsonString = repairJsonSync(modifiedJsonString, {
                ensureAscii: false,
                indent: 2
            });
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

            // Step 1→2: Parse diff to hunks, then apply hunks to get modified JSON string
            const hunks = parseUnifiedDiff(rawLlmDiff);
            const modifiedJsonString = applyHunksToText(originalJsonString, hunks);
            expect(modifiedJsonString.trim()).toBe(expectedPatchedRawText.trim());

            // Step 2→3: Parse JSON string to get JSON object
            let modifiedJson;
            try {
                modifiedJson = JSON.parse(modifiedJsonString);
            } catch (parseError) {
                const repairedJsonString = repairJsonSync(modifiedJsonString, {
                    ensureAscii: false,
                    indent: 2
                });
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
                step2: '',
                step3: null as any,
                step4: [] as any[]
            };

            // Step 1→2: Parse diff to hunks, then apply hunks
            const originalJsonString = JSON.stringify(results.step0, null, 2);
            const hunks = parseUnifiedDiff(results.step1);
            results.step2 = applyHunksToText(originalJsonString, hunks);
            expect(results.step2.trim()).toBe(expectedPatchedRawText.trim());

            // Step 2→3: Parse JSON
            try {
                results.step3 = JSON.parse(results.step2);
            } catch (parseError) {
                const repairedJsonString = repairJsonSync(results.step2, {
                    ensureAscii: false,
                    indent: 2
                });
                results.step3 = JSON.parse(repairedJsonString);
            }
            expect(results.step3).toEqual(expectedPatchedJsondoc);

            // Step 3→4: Generate patches
            results.step4 = createPatch(results.step0, results.step3);
            expect(results.step4).toEqual(expectedRfc6902Patches);

            // All validation is done by comparing to expected fixture above
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle malformed JSON gracefully', () => {
            const malformedJson = '{ "test": "incomplete';
            expect(() => repairJsonSync(malformedJson, { ensureAscii: false, indent: 2 })).not.toThrow();

            const repaired = repairJsonSync(malformedJson, { ensureAscii: false, indent: 2 });
            expect(() => JSON.parse(repaired)).not.toThrow();
        });

        it('should handle empty diffs gracefully', () => {
            const originalJsonString = JSON.stringify(originalJsondoc, null, 2);
            const emptyDiff = '';

            const hunks = parseUnifiedDiff(emptyDiff);
            const result = applyHunksToText(originalJsonString, hunks);
            expect(result).toBe(originalJsonString);
        });

        it('should handle invalid unified diff format', () => {
            const originalJsonString = JSON.stringify(originalJsondoc, null, 2);
            const invalidDiff = 'This is not a valid unified diff';

            const hunks = parseUnifiedDiff(invalidDiff);
            const result = applyHunksToText(originalJsonString, hunks);
            expect(result).toBe(originalJsonString); // Should return original unchanged
        });
    });

    describe('Performance and Correctness', () => {
        it('should produce patches that can be applied back to original', () => {
            // Verify patches are correct by applying them
            const { applyPatch } = require('rfc6902');
            const originalCopy = JSON.parse(JSON.stringify(originalJsondoc));

            const patchResults = applyPatch(originalCopy, expectedRfc6902Patches);

            // All patches should apply successfully (null means success in rfc6902)
            patchResults.forEach((result: any, index: number) => {
                expect(result).toBeNull();
            });

            // Result should match expected patched JSON
            expect(originalCopy).toEqual(expectedPatchedJsondoc);
        });

        it('should handle complex character addition with nested objects', () => {
            // Test that the generated patches match the expected fixture
            // Use the original formatted JSON string, not JSON.stringify() which loses formatting
            const originalJsonString = readFileSync(join(fixturesPath, '0_original-jsondoc.json'), 'utf8');
            const generatedPatches = applyContextDiffAndGeneratePatches(originalJsonString, rawLlmDiff);
            expect(generatedPatches).toEqual(expectedRfc6902Patches);
        });


    });
}); 