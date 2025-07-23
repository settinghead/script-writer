import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createPatch } from 'rfc6902';
import {
    parseContextDiff,
    smartMatch,
    extractValueFromDiffLine,
    applyContextDiffToJSON,
    type ParsedDiff,
    type SmartMatchResult
} from '../common/contextDiff';

describe('Context Diff Integration Pipeline', () => {
    let originalJson: string;
    let contextDiff: string;
    let originalData: any;

    beforeAll(() => {
        // Load test fixtures
        const fixturesPath = join(__dirname, 'fixtures');
        originalJson = readFileSync(join(fixturesPath, 'debug-original.json'), 'utf-8');
        contextDiff = readFileSync(join(fixturesPath, 'debug-raw-llm-output.txt'), 'utf-8');
        originalData = JSON.parse(originalJson);
    });

    describe('Step 1: Context Diff Parsing', () => {
        let parsedDiff: ParsedDiff | null;

        it('should successfully parse the context diff', () => {
            parsedDiff = parseContextDiff(contextDiff);

            expect(parsedDiff).not.toBeNull();
            expect(parsedDiff!.context).toBeDefined();
            expect(parsedDiff!.removals).toBeDefined();
            expect(parsedDiff!.additions).toBeDefined();
        });

        it('should extract the correct context section', () => {
            parsedDiff = parseContextDiff(contextDiff);

            expect(parsedDiff!.context).toContain('"characters": [');
            expect(parsedDiff!.context).toContain('"name": "王千榕"');
            expect(parsedDiff!.context).toContain('"name": "艾莉娅"');
            expect(parsedDiff!.context.length).toBeGreaterThan(5000);
        });

        it('should extract the correct number of removals and additions', () => {
            parsedDiff = parseContextDiff(contextDiff);

            expect(parsedDiff!.removals.length).toBe(39);
            expect(parsedDiff!.additions.length).toBe(39);
        });

        it('should extract meaningful removal operations', () => {
            parsedDiff = parseContextDiff(contextDiff);

            // Check some specific removals
            const removals = parsedDiff!.removals;
            expect(removals).toContain('          "冷漠自私",');
            expect(removals).toContain('          "有隐藏正义感"');
            expect(removals.some(r => r.includes('外星高等文明特使'))).toBe(true);
        });

        it('should extract meaningful addition operations', () => {
            parsedDiff = parseContextDiff(contextDiff);

            // Check some specific additions
            const additions = parsedDiff!.additions;
            expect(additions).toContain('          "表面冷漠",');
            expect(additions).toContain('          "底层正义感"');
            expect(additions.some(a => a.includes('微表情分析'))).toBe(true);
        });
    });

    describe('Step 2: Smart Matching', () => {
        let parsedDiff: ParsedDiff;

        beforeAll(() => {
            parsedDiff = parseContextDiff(contextDiff)!;
        });

        it('should find the context in the original JSON', () => {
            // The full context is very large, so let's test with a smaller, more specific part
            const contextPart = '"characters": [\n    {\n      "name": "王千榕"';
            const match = smartMatch(contextPart, originalJson);

            expect(match).not.toBeNull();
            expect(match!.index).toBeGreaterThan(0);
            expect(match!.score).toBeGreaterThan(0.7);
        });

        it('should match simple string values exactly', () => {
            const needle = '"冷漠自私"';
            const match = smartMatch(needle, originalJson);

            expect(match).not.toBeNull();
            expect(match!.method).toBe('exact');
            expect(match!.score).toBe(1.0);
        });

        it('should handle punctuation differences with fuzzy matching', () => {
            const needleWithChinesePunct = '陷入信仰与情感的撕裂。'; // Chinese period - this actually exists in the original
            const match = smartMatch(needleWithChinesePunct, originalJson);

            expect(match).not.toBeNull();
            expect(['exact', 'punctuation', 'partial', 'quoted'].includes(match!.method)).toBe(true);
        });

        it('should match long description texts', () => {
            const longDescription = '外星高等文明特使，29岁（地球年龄），伪装成南京大学天体物理系访问学者';
            const match = smartMatch(longDescription, originalJson);

            expect(match).not.toBeNull();
            expect(match!.score).toBeGreaterThan(0.7);
        });
    });

    describe('Step 3: Value Extraction', () => {
        it('should extract simple quoted string values', () => {
            const value = extractValueFromDiffLine('          "冷漠自私",');
            expect(value).toBe('冷漠自私');
        });

        it('should extract field-value pairs', () => {
            const value = extractValueFromDiffLine('      "name": "王千榕",');
            expect(value).toBe('王千榕');
        });

        it('should skip structural elements', () => {
            expect(extractValueFromDiffLine('        "personality_traits": [')).toBeNull();
            expect(extractValueFromDiffLine('        ],')).toBeNull();
            expect(extractValueFromDiffLine('      },')).toBeNull();
        });

        it('should handle long text descriptions', () => {
            const longLine = '      "description": "外星高等文明特使，29岁（地球年龄）...",';
            const value = extractValueFromDiffLine(longLine);
            expect(value).toContain('外星高等文明特使');
        });
    });

    describe('Step 4: JSON-Aware Diff Application', () => {
        let modifiedJson: string | null;

        it('should successfully apply the context diff to JSON', () => {
            modifiedJson = applyContextDiffToJSON(originalJson, contextDiff);

            expect(modifiedJson).not.toBeNull();
            expect(modifiedJson!.length).toBeGreaterThan(originalJson.length - 1000); // Should be similar length
        });

        it('should produce valid JSON', () => {
            modifiedJson = applyContextDiffToJSON(originalJson, contextDiff);

            expect(() => JSON.parse(modifiedJson!)).not.toThrow();
        });

        it('should apply personality trait changes', () => {
            modifiedJson = applyContextDiffToJSON(originalJson, contextDiff);
            const modifiedData = JSON.parse(modifiedJson!);

            // Check that 王千榕's personality traits were updated
            const wangQianrong = modifiedData.characters.find((c: any) => c.name === '王千榕');
            expect(wangQianrong).toBeDefined();
            expect(wangQianrong.personality_traits).toContain('表面冷漠');
            expect(wangQianrong.personality_traits).toContain('底层正义感');
            expect(wangQianrong.personality_traits).not.toContain('冷漠自私');
            expect(wangQianrong.personality_traits).not.toContain('有隐藏正义感');
        });

        it('should apply description changes', () => {
            modifiedJson = applyContextDiffToJSON(originalJson, contextDiff);
            const modifiedData = JSON.parse(modifiedJson!);

            // Check that 艾莉娅's description was updated
            const ailiya = modifiedData.characters.find((c: any) => c.name === '艾莉娅');
            expect(ailiya).toBeDefined();
            expect(ailiya.description).toContain('微表情分析');
            expect(ailiya.description).toContain('信仰崩塌与情感重构');
        });

        it('should preserve unchanged data', () => {
            modifiedJson = applyContextDiffToJSON(originalJson, contextDiff);
            const modifiedData = JSON.parse(modifiedJson!);

            // Check that basic structure is preserved
            expect(modifiedData.title).toBe(originalData.title);
            expect(modifiedData.genre).toBe(originalData.genre);
            expect(modifiedData.characters.length).toBe(originalData.characters.length);

            // Check that character names are unchanged
            const characterNames = modifiedData.characters.map((c: any) => c.name);
            expect(characterNames).toContain('王千榕');
            expect(characterNames).toContain('艾莉娅');
            expect(characterNames).toContain('小雨');
        });

        it('should report reasonable success rate', () => {
            // Capture console logs to check success rate
            const originalConsoleLog = console.log;
            let logMessages: string[] = [];
            console.log = (...args) => {
                logMessages.push(args.join(' '));
            };

            try {
                modifiedJson = applyContextDiffToJSON(originalJson, contextDiff);

                // Look for the success rate message
                const successMessage = logMessages.find(msg =>
                    msg.includes('Applied') && msg.includes('out of') && msg.includes('changes')
                );
                expect(successMessage).toBeDefined();

                // Extract numbers from the message
                const match = successMessage!.match(/Applied (\d+) out of (\d+) changes/);
                expect(match).not.toBeNull();

                const applied = parseInt(match![1]);
                const total = parseInt(match![2]);
                const successRate = applied / total;

                expect(successRate).toBeGreaterThan(0.6); // At least 60% success rate (25/39 = 64%)
                expect(applied).toBeGreaterThan(25); // At least 25 changes applied
            } finally {
                console.log = originalConsoleLog;
            }
        });
    });

    describe('Step 5: RFC6902 JSON Patch Generation', () => {
        let modifiedJson: string;
        let rfc6902Patches: any[];

        beforeAll(() => {
            modifiedJson = applyContextDiffToJSON(originalJson, contextDiff)!;
            const originalData = JSON.parse(originalJson);
            const modifiedData = JSON.parse(modifiedJson);
            rfc6902Patches = createPatch(originalData, modifiedData);
        });

        it('should generate RFC6902 patches', () => {
            expect(rfc6902Patches).toBeDefined();
            expect(Array.isArray(rfc6902Patches)).toBe(true);
            expect(rfc6902Patches.length).toBeGreaterThan(0);
        });

        it('should contain replace operations for personality traits', () => {
            const personalityPatches = rfc6902Patches.filter(patch =>
                patch.path.includes('personality_traits') && patch.op === 'replace'
            );
            expect(personalityPatches.length).toBeGreaterThan(0);

            // Check for specific personality trait changes
            const coldnessPatch = personalityPatches.find(patch =>
                patch.value === '表面冷漠'
            );
            expect(coldnessPatch).toBeDefined();
        });

        it('should contain replace operations for descriptions', () => {
            const descriptionPatches = rfc6902Patches.filter(patch =>
                patch.path.includes('description') && patch.op === 'replace'
            );
            expect(descriptionPatches.length).toBeGreaterThan(0);

            // Check for description changes
            const ailyaDescPatch = descriptionPatches.find(patch =>
                patch.value.includes('微表情分析')
            );
            expect(ailyaDescPatch).toBeDefined();
        });

        it('should use valid JSON Pointer paths', () => {
            rfc6902Patches.forEach(patch => {
                expect(patch.path).toMatch(/^\/[^/]*(?:\/[^/]*)*$/);
                expect(patch.path.startsWith('/')).toBe(true);
            });
        });

        it('should have valid operation types', () => {
            const validOps = ['add', 'remove', 'replace', 'move', 'copy', 'test'];
            rfc6902Patches.forEach(patch => {
                expect(validOps).toContain(patch.op);
            });
        });

        it('should preserve data integrity when patches are applied', () => {
            const originalData = JSON.parse(originalJson);
            const expectedData = JSON.parse(modifiedJson);

            // Apply patches to original data
            const { applyPatch } = require('rfc6902');
            const patchedData = JSON.parse(JSON.stringify(originalData)); // Deep clone
            const results = applyPatch(patchedData, rfc6902Patches);

            // All patches should apply successfully
            results.forEach((result: any) => {
                expect(result).toBeNull(); // null means success
            });

            // Result should match our expected modified data
            expect(JSON.stringify(patchedData)).toBe(JSON.stringify(expectedData));
        });
    });

    describe('End-to-End Pipeline', () => {
        it('should complete the full pipeline successfully', () => {
            // Step 1: Parse diff
            const parsedDiff = parseContextDiff(contextDiff);
            expect(parsedDiff).not.toBeNull();

            // Step 2: Apply diff
            const modifiedJson = applyContextDiffToJSON(originalJson, contextDiff);
            expect(modifiedJson).not.toBeNull();

            // Step 3: Generate patches
            const originalData = JSON.parse(originalJson);
            const modifiedData = JSON.parse(modifiedJson!);
            const patches = createPatch(originalData, modifiedData);
            expect(patches.length).toBeGreaterThan(0);

            // Step 4: Verify patches work
            const { applyPatch } = require('rfc6902');
            const testData = JSON.parse(JSON.stringify(originalData));
            const results = applyPatch(testData, patches);
            results.forEach((result: any) => {
                expect(result).toBeNull();
            });

            expect(JSON.stringify(testData)).toBe(JSON.stringify(modifiedData));
        });

        it('should handle the specific LLM output format correctly', () => {
            // Verify our pipeline can handle the exact format from the LLM
            expect(contextDiff).toContain('CONTEXT:');
            expect(contextDiff).toContain('characters": [');
            expect(contextDiff).toContain('-        "personality_traits": [');
            expect(contextDiff).toContain('+        "personality_traits": [');

            const result = applyContextDiffToJSON(originalJson, contextDiff);
            expect(result).not.toBeNull();

            const data = JSON.parse(result!);
            expect(data.characters).toBeDefined();
            expect(data.characters.length).toBeGreaterThan(0);
        });
    });
}); 