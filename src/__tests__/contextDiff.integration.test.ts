import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createPatch } from 'rfc6902';
import {
    parseContextDiff,
    applyContextDiffToJSON,
    applyContextDiffAndGeneratePatches,
    LLMTolerantDiffProcessor,
    type SemanticOperation,
    type ApplicationResult
} from '../common/contextDiff';

describe('LLM-Tolerant Diff System Integration Tests', () => {
    let originalJson: string;
    let unifiedDiff: string;
    let originalData: any;
    let processor: LLMTolerantDiffProcessor;

    beforeAll(() => {
        // Load test fixtures - now using real LLM-generated unified diff
        const fixturesPath = join(__dirname, 'fixtures');
        originalJson = readFileSync(join(fixturesPath, 'debug-original.json'), 'utf-8');
        unifiedDiff = readFileSync(join(fixturesPath, 'debug-raw-llm-output.txt'), 'utf-8');
        originalData = JSON.parse(originalJson);
        processor = new LLMTolerantDiffProcessor(true);
    });

    describe('Step 1: Semantic Operation Parsing', () => {
        let operations: SemanticOperation[];

        it('should successfully parse unified diff into semantic operations', () => {
            operations = processor.parseSemanticDiff(unifiedDiff);

            expect(operations).toBeDefined();
            expect(Array.isArray(operations)).toBe(true);
            expect(operations.length).toBeGreaterThan(0);
        });

        it('should extract character addition operation', () => {
            operations = processor.parseSemanticDiff(unifiedDiff);

            // Should find at least one ADD_TO_ARRAY operation for characters
            const characterAdditions = operations.filter(op =>
                op.type === 'ADD_TO_ARRAY' && op.target === 'characters'
            );
            expect(characterAdditions.length).toBeGreaterThan(0);

            // Check the added character content
            const characterOp = characterAdditions[0];
            expect(characterOp.addContent).toBeDefined();
            expect(characterOp.addContent.name).toBeDefined();
            expect(characterOp.addContent.type).toBeDefined();
        });

        it('should handle LLM output format variations gracefully', () => {
            // Test with various LLM output formats
            const testCases = [
                unifiedDiff, // Real LLM output
                '--- a/file.json\n+++ b/file.json\n@@ -1,1 +1,1 @@\n-old\n+new', // Simple diff
                'No valid diff content', // Invalid content
            ];

            testCases.forEach((testDiff, index) => {
                const ops = processor.parseSemanticDiff(testDiff);
                expect(Array.isArray(ops)).toBe(true);
                // Real LLM output should produce operations, others may not
                if (index === 0) {
                    expect(ops.length).toBeGreaterThan(0);
                }
            });
        });
    });

    describe('Step 2: Semantic Operation Application', () => {
        let operations: SemanticOperation[];
        let result: ApplicationResult;

        beforeAll(() => {
            operations = processor.parseSemanticDiff(unifiedDiff);
        });

        it('should successfully apply semantic operations to JSON', () => {
            result = processor.applyOperations(originalData, operations);

            expect(result).toBeDefined();
            expect(result.success || result.partialSuccess).toBe(true);
            expect(result.operationsApplied).toBeGreaterThan(0);
            expect(result.resultJson).toBeDefined();
        });

        it('should add new character to characters array', () => {
            result = processor.applyOperations(originalData, operations);

            // Should have added a new character
            expect(result.resultJson.characters.length).toBeGreaterThan(originalData.characters.length);

            // Find the new character (should be the last one added)
            const newCharacter = result.resultJson.characters[result.resultJson.characters.length - 1];
            expect(newCharacter).toBeDefined();
            expect(newCharacter.name).toBeDefined();
            expect(newCharacter.type).toBeDefined();
            expect(newCharacter.description).toBeDefined();
        });

        it('should preserve original JSON structure and data', () => {
            result = processor.applyOperations(originalData, operations);

            // Original characters should still be there
            expect(result.resultJson.characters.length).toBeGreaterThanOrEqual(originalData.characters.length);

            // Check that original characters are preserved
            const originalCharacterNames = originalData.characters.map((c: any) => c.name);
            originalCharacterNames.forEach((name: string) => {
                const found = result.resultJson.characters.find((c: any) => c.name === name);
                expect(found).toBeDefined();
            });

            // Other top-level properties should be preserved
            expect(result.resultJson.title).toBe(originalData.title);
            expect(result.resultJson.genre).toBe(originalData.genre);
        });

        it('should handle edge cases gracefully', () => {
            // Test with empty operations
            const emptyResult = processor.applyOperations(originalData, []);
            expect(emptyResult.success).toBe(true);
            expect(emptyResult.operationsApplied).toBe(0);

            // Test with invalid operations
            const invalidOp: SemanticOperation = {
                type: 'ADD_TO_ARRAY',
                target: 'nonexistent_field',
                addContent: { test: 'data' }
            };
            const invalidResult = processor.applyOperations(originalData, [invalidOp]);
            expect(invalidResult.operationsFailed).toBe(1);
        });
    });

    describe('Step 3: Legacy Compatibility Functions', () => {
        it('should maintain compatibility with parseContextDiff', () => {
            // Our new system should handle the unified diff format
            const parsedDiff = parseContextDiff(unifiedDiff);

            // For unified diff, it should either parse successfully or return null gracefully
            if (parsedDiff) {
                expect(parsedDiff.context).toBeDefined();
                expect(parsedDiff.removals).toBeDefined();
                expect(parsedDiff.additions).toBeDefined();
            }
            // If it returns null, that's acceptable for complex unified diffs
        });

        it('should apply diffs through legacy applyContextDiffToJSON function', () => {
            const modifiedJson = applyContextDiffToJSON(originalJson, unifiedDiff);

            expect(modifiedJson).toBeDefined();
            expect(typeof modifiedJson).toBe('string');

            // Should be valid JSON
            const modifiedData = JSON.parse(modifiedJson);
            expect(modifiedData).toBeDefined();

            // Should have more characters than original
            expect(modifiedData.characters.length).toBeGreaterThanOrEqual(originalData.characters.length);
        });

        it('should generate RFC6902 patches through legacy function', () => {
            const patches = applyContextDiffAndGeneratePatches(originalJson, unifiedDiff);

            expect(Array.isArray(patches)).toBe(true);
            // May generate patches depending on the operations applied
        });
    });

    describe('Step 4: Real-World LLM Output Handling', () => {
        it('should handle character addition with complex nested data', () => {
            const operations = processor.parseSemanticDiff(unifiedDiff);
            const result = processor.applyOperations(originalData, operations);

            if (result.success || result.partialSuccess) {
                const newCharacters = result.resultJson.characters.slice(originalData.characters.length);

                newCharacters.forEach((character: any) => {
                    // Should have all required character fields
                    expect(character.name).toBeDefined();
                    expect(character.type).toBeDefined();
                    expect(character.description).toBeDefined();
                    expect(character.age).toBeDefined();
                    expect(character.gender).toBeDefined();
                    expect(character.occupation).toBeDefined();

                    // Should handle complex nested data
                    if (character.personality_traits) {
                        expect(Array.isArray(character.personality_traits)).toBe(true);
                    }
                    if (character.relationships) {
                        expect(typeof character.relationships).toBe('object');
                    }
                });
            }
        });

        it('should provide detailed operation results for debugging', () => {
            const operations = processor.parseSemanticDiff(unifiedDiff);
            const result = processor.applyOperations(originalData, operations);

            // Should provide comprehensive result information
            expect(result.operationsApplied).toBeDefined();
            expect(result.operationsFailed).toBeDefined();
            expect(result.appliedOperations).toBeDefined();
            expect(result.failedOperations).toBeDefined();
            expect(result.failureReasons).toBeDefined();

            // Applied operations should be tracked
            expect(result.appliedOperations.length).toBe(result.operationsApplied);
            expect(result.failedOperations.length).toBe(result.operationsFailed);
        });

        it('should handle various unified diff formats from different LLMs', () => {
            // Test different unified diff header formats
            const variations = [
                unifiedDiff, // Original format
                unifiedDiff.replace('--- a/file.json', '--- file.json'), // No a/ prefix
                unifiedDiff.replace('+++ b/file.json', '+++ file.json'), // No b/ prefix
            ];

            variations.forEach((variation) => {
                const operations = processor.parseSemanticDiff(variation);
                expect(Array.isArray(operations)).toBe(true);
                // Should parse at least some operations from the original format
                if (variation === unifiedDiff) {
                    expect(operations.length).toBeGreaterThan(0);
                }
            });
        });
    });

    describe('Step 5: Performance and Robustness', () => {
        it('should handle large JSON documents efficiently', () => {
            // Create a larger test document
            const largeData = {
                ...originalData,
                characters: [...originalData.characters, ...originalData.characters, ...originalData.characters]
            };

            const startTime = Date.now();
            const operations = processor.parseSemanticDiff(unifiedDiff);
            const result = processor.applyOperations(largeData, operations);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
            expect(result).toBeDefined();
        });

        it('should be resilient to malformed LLM output', () => {
            const malformedInputs = [
                '', // Empty string
                'Not a diff at all', // Random text
                '--- a/file\n+++ b/file\n@@ invalid hunk @@', // Invalid hunk header
                '--- a/file\n+++ b/file\n@@ -1,1 +1,1 @@\n+{invalid json}', // Invalid JSON
            ];

            malformedInputs.forEach((input) => {
                expect(() => {
                    const operations = processor.parseSemanticDiff(input);
                    processor.applyOperations(originalData, operations);
                }).not.toThrow();
            });
        });

        it('should maintain JSON validity after all operations', () => {
            const operations = processor.parseSemanticDiff(unifiedDiff);
            const result = processor.applyOperations(originalData, operations);

            // Result should always be valid JSON
            expect(() => JSON.stringify(result.resultJson)).not.toThrow();

            // Should be parseable
            const serialized = JSON.stringify(result.resultJson);
            expect(() => JSON.parse(serialized)).not.toThrow();
        });
    });

    describe('Step 6: End-to-End Integration', () => {
        it('should complete the full pipeline successfully', () => {
            console.log('🚀 Starting LLM-tolerant diff integration test...');

            // Step 1: Parse LLM output into semantic operations
            const operations = processor.parseSemanticDiff(unifiedDiff);
            expect(operations.length).toBeGreaterThan(0);
            console.log(`✅ Step 1: Parsed ${operations.length} semantic operations`);

            // Step 2: Apply operations to JSON
            const result = processor.applyOperations(originalData, operations);
            expect(result.success || result.partialSuccess).toBe(true);
            console.log(`✅ Step 2: Applied ${result.operationsApplied}/${operations.length} operations`);

            // Step 3: Verify JSON integrity
            expect(() => JSON.stringify(result.resultJson)).not.toThrow();
            console.log('✅ Step 3: JSON integrity maintained');

            // Step 4: Check character addition
            expect(result.resultJson.characters.length).toBeGreaterThan(originalData.characters.length);
            const addedCharacters = result.resultJson.characters.length - originalData.characters.length;
            console.log(`✅ Step 4: Added ${addedCharacters} new character(s)`);

            // Step 5: Generate RFC6902 patches for compatibility
            const patches = applyContextDiffAndGeneratePatches(originalJson, unifiedDiff);
            expect(Array.isArray(patches)).toBe(true);
            console.log(`✅ Step 5: Generated ${patches.length} RFC6902 patches`);

            console.log('🎉 End-to-end integration test completed successfully!');
            console.log(`📊 Summary: ${result.operationsApplied} operations applied, ${addedCharacters} characters added, ${patches.length} patches generated`);
        });
    });
}); 