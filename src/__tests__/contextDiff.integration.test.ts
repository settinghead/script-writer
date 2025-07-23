import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createPatch } from 'rfc6902';
import {
    applyContextDiffToJSON,
    applyContextDiffAndGeneratePatches
} from '../common/contextDiff';

describe('LLM-Tolerant Diff System Integration Tests', () => {
    let originalJson: string;
    let unifiedDiff: string;
    let originalData: any;

    beforeAll(() => {
        // Load test fixtures - using real LLM-generated unified diff
        const fixturesPath = join(__dirname, 'fixtures');
        originalJson = readFileSync(join(fixturesPath, 'debug-original.json'), 'utf-8');
        unifiedDiff = readFileSync(join(fixturesPath, 'debug-raw-llm-output.txt'), 'utf-8');
        originalData = JSON.parse(originalJson);

        console.log('Test Setup:');
        console.log(`- Original JSON length: ${originalJson.length} chars`);
        console.log(`- Unified diff length: ${unifiedDiff.length} chars`);
        console.log(`- Original character count: ${originalData.characters?.length || 0}`);
    });

    describe('Unified Diff Processing (Production System)', () => {
        it('should apply unified diff to JSON correctly', () => {
            const modifiedJson = applyContextDiffToJSON(originalJson, unifiedDiff);
            const modifiedData = JSON.parse(modifiedJson);

            // Verify the modification was applied
            expect(modifiedJson).not.toBe(originalJson);
            expect(modifiedData.characters).toBeDefined();
            expect(modifiedData.characters.length).toBeGreaterThan(originalData.characters.length);

            // Find the added character
            const addedCharacter = modifiedData.characters.find((char: any) => char.name === '小蓝');
            expect(addedCharacter).toBeDefined();
            expect(addedCharacter.name).toBe('小蓝');
            expect(addedCharacter.type).toBe('female_supporting');
        });

        it('should generate correct RFC6902 patches from unified diff', () => {
            const patches = applyContextDiffAndGeneratePatches(originalJson, unifiedDiff);

            // Should generate at least one patch
            expect(patches.length).toBeGreaterThan(0);
            console.log(`Generated ${patches.length} RFC6902 patches`);

            // Find the character addition patch
            const addPatch = patches.find(p => p.op === 'add' && p.path.includes('/characters/'));
            expect(addPatch).toBeDefined();
            expect(addPatch.value).toBeDefined();
            expect(addPatch.value.name).toBe('小蓝');
            expect(addPatch.value.type).toBe('female_supporting');
            expect(addPatch.value.occupation).toContain('医学院学生');
        });

        it('should handle complex character objects correctly', () => {
            const patches = applyContextDiffAndGeneratePatches(originalJson, unifiedDiff);
            const addPatch = patches.find(p => p.op === 'add' && p.path.includes('/characters/'));

            expect(addPatch.value).toHaveProperty('name');
            expect(addPatch.value).toHaveProperty('type');
            expect(addPatch.value).toHaveProperty('description');
            expect(addPatch.value).toHaveProperty('age');
            expect(addPatch.value).toHaveProperty('gender');
            expect(addPatch.value).toHaveProperty('occupation');
            expect(addPatch.value).toHaveProperty('personality_traits');
            expect(addPatch.value).toHaveProperty('character_arc');
            expect(addPatch.value).toHaveProperty('relationships');

            // Verify the character has healing abilities as requested
            expect(addPatch.value.description).toContain('治疗');
        });

        it('should maintain JSON structure integrity', () => {
            const modifiedJson = applyContextDiffToJSON(originalJson, unifiedDiff);
            const modifiedData = JSON.parse(modifiedJson);

            // Verify all original characters are still present
            const originalCharacterNames = originalData.characters.map((char: any) => char.name);
            const modifiedCharacterNames = modifiedData.characters.map((char: any) => char.name);

            for (const originalName of originalCharacterNames) {
                expect(modifiedCharacterNames).toContain(originalName);
            }

            // Verify the new character was added
            expect(modifiedCharacterNames).toContain('小蓝');
            expect(modifiedData.characters.length).toBe(originalData.characters.length + 1);
        });

        it('should generate valid JSON after applying unified diff', () => {
            const modifiedJson = applyContextDiffToJSON(originalJson, unifiedDiff);

            // Should be valid JSON
            expect(() => JSON.parse(modifiedJson)).not.toThrow();

            // Should be properly formatted
            expect(modifiedJson).toContain('\n');
            expect(modifiedJson).toContain('  '); // Proper indentation
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid JSON gracefully', () => {
            const invalidJson = '{ invalid json }';
            expect(() => applyContextDiffToJSON(invalidJson, unifiedDiff)).not.toThrow();
        });

        it('should handle empty diff gracefully', () => {
            const result = applyContextDiffToJSON(originalJson, '');
            expect(result).toBe(originalJson);
        });

        it('should handle malformed diff gracefully', () => {
            const malformedDiff = 'this is not a valid diff';
            expect(() => applyContextDiffToJSON(originalJson, malformedDiff)).not.toThrow();
        });
    });
}); 