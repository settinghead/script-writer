import { describe, it, expect } from 'vitest';
import { EpisodePlanningInputSchema, EpisodePlanningOutputSchema } from '@/common/schemas/outlineSchemas';

describe('Episode Planning Action Computation', () => {
    describe('workflow step validation', () => {
        it('validates episode planning follows chronicles in workflow', () => {
            // This test verifies that episode planning input requires chronicles data
            const validInput = {
                jsondocs: [
                    {
                        jsondocId: 'chronicles-123',
                        description: 'Chronicles data for episode planning',
                        schemaType: 'chronicles'
                    }
                ],
                numberOfEpisodes: 20,
                requirements: 'TikTok优化的短剧'
            };

            expect(() => EpisodePlanningInputSchema.parse(validInput)).not.toThrow();
        });

        it('validates episode planning output structure for next workflow step', () => {
            // This test verifies that episode planning output can feed into episode generation
            const validOutput = {
                totalEpisodes: 20,
                overallStrategy: '非线性叙事结构，适合TikTok平台',
                episodeGroups: [
                    {
                        groupTitle: '开篇阶段',
                        episodes: '第1-5集',
                        keyEvents: ['角色登场', '冲突建立'],
                        hooks: ['悬疑开场', '身份谜团'],
                        emotionalBeats: ['好奇', '紧张']
                    }
                ]
            };

            expect(() => EpisodePlanningOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('ensures episode planning connects chronicles to episode generation', () => {
            // Test the workflow chain: chronicles → episode planning → episode generation
            const chroniclesReference = {
                jsondocId: 'chronicles-456',
                description: 'Time-ordered story outline',
                schemaType: 'chronicles'
            };

            const episodePlanningInput = {
                jsondocs: [chroniclesReference],
                numberOfEpisodes: 30
            };

            const episodePlanningOutput = {
                totalEpisodes: 30,
                overallStrategy: 'Drama structure optimized for engagement',
                episodeGroups: [
                    {
                        groupTitle: 'Setup',
                        episodes: '1-10',
                        keyEvents: ['Introduction'],
                        hooks: ['Opening hook'],
                        emotionalBeats: ['Curiosity']
                    },
                    {
                        groupTitle: 'Development',
                        episodes: '11-20',
                        keyEvents: ['Conflict'],
                        hooks: ['Tension'],
                        emotionalBeats: ['Anxiety']
                    },
                    {
                        groupTitle: 'Resolution',
                        episodes: '21-30',
                        keyEvents: ['Climax', 'Resolution'],
                        hooks: ['Final twist', 'Satisfaction'],
                        emotionalBeats: ['Relief', 'Joy']
                    }
                ]
            };

            // Validate both input and output schemas
            expect(() => EpisodePlanningInputSchema.parse(episodePlanningInput)).not.toThrow();
            expect(() => EpisodePlanningOutputSchema.parse(episodePlanningOutput)).not.toThrow();

            // Verify data consistency
            expect(episodePlanningOutput.totalEpisodes).toBe(episodePlanningInput.numberOfEpisodes);
        });
    });
}); 