import { describe, it, expect } from 'vitest';
import {
    EpisodePlanningInput,
    EpisodePlanningOutput,
    EpisodePlanningInputSchema,
    EpisodePlanningOutputSchema
} from '@/common/schemas/outlineSchemas';

describe('EpisodePlanningTool Schemas', () => {
    describe('EpisodePlanningInputSchema', () => {
        it('validates correct input data', () => {
            const validInput: EpisodePlanningInput = {
                jsondocs: [{
                    jsondocId: 'chronicles-123',
                    description: 'Chronicles data',
                    schemaType: 'chronicles'
                }],
                numberOfEpisodes: 20,
                requirements: 'TikTok优化的短剧'
            };

            expect(() => EpisodePlanningInputSchema.parse(validInput)).not.toThrow();
        });

        it('validates minimum episode count', () => {
            const validInput: EpisodePlanningInput = {
                jsondocs: [{
                    jsondocId: 'chronicles-123',
                    description: 'Chronicles data',
                    schemaType: 'chronicles'
                }],
                numberOfEpisodes: 1,
            };

            expect(() => EpisodePlanningInputSchema.parse(validInput)).not.toThrow();
        });

        it('validates maximum episode count', () => {
            const validInput: EpisodePlanningInput = {
                jsondocs: [{
                    jsondocId: 'chronicles-123',
                    description: 'Chronicles data',
                    schemaType: 'chronicles'
                }],
                numberOfEpisodes: 50,
            };

            expect(() => EpisodePlanningInputSchema.parse(validInput)).not.toThrow();
        });

        it('rejects episode count below minimum', () => {
            const invalidInput = {
                jsondocs: [{
                    jsondocId: 'chronicles-123',
                    description: 'Chronicles data',
                    schemaType: 'chronicles'
                }],
                numberOfEpisodes: 0,
            };

            expect(() => EpisodePlanningInputSchema.parse(invalidInput)).toThrow();
        });

        it('rejects episode count above maximum', () => {
            const invalidInput = {
                jsondocs: [{
                    jsondocId: 'chronicles-123',
                    description: 'Chronicles data',
                    schemaType: 'chronicles'
                }],
                numberOfEpisodes: 51,
            };

            expect(() => EpisodePlanningInputSchema.parse(invalidInput)).toThrow();
        });

        it('rejects empty jsondocs array', () => {
            const invalidInput = {
                jsondocs: [],
                numberOfEpisodes: 20,
            };

            expect(() => EpisodePlanningInputSchema.parse(invalidInput)).toThrow();
        });

        it('accepts optional requirements field', () => {
            const inputWithoutRequirements = {
                jsondocs: [{
                    jsondocId: 'chronicles-123',
                    description: 'Chronicles data',
                    schemaType: 'chronicles'
                }],
                numberOfEpisodes: 20,
            };

            expect(() => EpisodePlanningInputSchema.parse(inputWithoutRequirements)).not.toThrow();
        });
    });

    describe('EpisodePlanningOutputSchema', () => {
        const validOutput: EpisodePlanningOutput = {
            totalEpisodes: 20,
            overallStrategy: '非线性叙事结构，注重情感节拍的起伏',
            episodeGroups: [
                {
                    groupTitle: '开篇引入',
                    episodes: '第1-3集',
                    keyEvents: ['角色登场', '冲突建立'],
                    hooks: ['悬疑开场', '身份谜团'],
                    emotionalBeats: ['好奇', '紧张']
                },
                {
                    groupTitle: '情感发展',
                    episodes: '第4-12集',
                    keyEvents: ['感情升温', '障碍出现'],
                    hooks: ['回忆杀', '误会产生'],
                    emotionalBeats: ['甜蜜', '纠结']
                }
            ]
        };

        it('validates correct output data', () => {
            expect(() => EpisodePlanningOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('validates episode groups structure', () => {
            const outputWithGroups: EpisodePlanningOutput = {
                totalEpisodes: 10,
                overallStrategy: '测试策略',
                episodeGroups: [
                    {
                        groupTitle: '测试组',
                        episodes: '1-5',
                        keyEvents: ['事件1', '事件2'],
                        hooks: ['钩子1'],
                        emotionalBeats: ['情感1', '情感2']
                    }
                ]
            };

            expect(() => EpisodePlanningOutputSchema.parse(outputWithGroups)).not.toThrow();
        });

        it('rejects output with missing required fields', () => {
            const invalidOutput = {
                totalEpisodes: 20,
                // Missing overallStrategy and episodeGroups
            };

            expect(() => EpisodePlanningOutputSchema.parse(invalidOutput)).toThrow();
        });

        it('rejects output with invalid episode group structure', () => {
            const invalidOutput = {
                totalEpisodes: 20,
                overallStrategy: '测试策略',
                episodeGroups: [
                    {
                        groupTitle: '测试组',
                        // Missing required fields
                    }
                ]
            };

            expect(() => EpisodePlanningOutputSchema.parse(invalidOutput)).toThrow();
        });

        it('validates empty episode groups array', () => {
            const outputWithEmptyGroups: EpisodePlanningOutput = {
                totalEpisodes: 0,
                overallStrategy: '无集数策略',
                episodeGroups: []
            };

            expect(() => EpisodePlanningOutputSchema.parse(outputWithEmptyGroups)).not.toThrow();
        });
    });
}); 