import { describe, it, expect } from 'vitest';
import {
    EpisodePlanningInputSchema,
    EpisodePlanningOutputSchema,
    EpisodeGroupSchema,
    EpisodePlanningInput,
    EpisodePlanningOutput,
    EpisodeGroup
} from '../outlineSchemas';
import { JsondocReferenceSchema } from '../common';
import { MIN_EPISODES, MAX_EPISODES } from '../../config/constants';

describe('Episode Planning Schemas', () => {
    describe('EpisodeGroupSchema', () => {
        const validEpisodeGroup: EpisodeGroup = {
            groupTitle: '开篇阶段',
            episodes: '第1-5集',
            keyEvents: ['角色登场', '冲突建立', '世界观展示'],
            hooks: ['悬疑开场', '身份谜团', '意外转折'],
            emotionalBeats: ['好奇', '紧张', '期待']
        };

        it('validates correct episode group data', () => {
            expect(() => EpisodeGroupSchema.parse(validEpisodeGroup)).not.toThrow();
        });

        it('requires all fields to be present', () => {
            const missingFields = {
                groupTitle: '测试组',
                // Missing other required fields
            };

            expect(() => EpisodeGroupSchema.parse(missingFields)).toThrow();
        });

        it('validates groupTitle as non-empty string', () => {
            const invalidGroupTitle = {
                ...validEpisodeGroup,
                groupTitle: ''
            };

            expect(() => EpisodeGroupSchema.parse(invalidGroupTitle)).toThrow();
        });

        it('validates episodes as non-empty string', () => {
            const invalidEpisodes = {
                ...validEpisodeGroup,
                episodes: ''
            };

            expect(() => EpisodeGroupSchema.parse(invalidEpisodes)).toThrow();
        });

        it('validates keyEvents as array of strings', () => {
            const validWithEmptyEvents = {
                ...validEpisodeGroup,
                keyEvents: []
            };

            expect(() => EpisodeGroupSchema.parse(validWithEmptyEvents)).not.toThrow();
        });

        it('validates hooks as array of strings', () => {
            const validWithEmptyHooks = {
                ...validEpisodeGroup,
                hooks: []
            };

            expect(() => EpisodeGroupSchema.parse(validWithEmptyHooks)).not.toThrow();
        });

        it('validates emotionalBeats as array of strings', () => {
            const validWithEmptyBeats = {
                ...validEpisodeGroup,
                emotionalBeats: []
            };

            expect(() => EpisodeGroupSchema.parse(validWithEmptyBeats)).not.toThrow();
        });

        it('rejects non-string values in arrays', () => {
            const invalidKeyEvents = {
                ...validEpisodeGroup,
                keyEvents: ['valid', 123, 'also valid'] // Number in array
            };

            expect(() => EpisodeGroupSchema.parse(invalidKeyEvents)).toThrow();
        });
    });

    describe('EpisodePlanningInputSchema', () => {
        const validInput: EpisodePlanningInput = {
            jsondocs: [
                {
                    jsondocId: 'chronicles-123',
                    description: 'Chronicles data for episode planning',
                    schemaType: 'chronicles'
                }
            ],
            numberOfEpisodes: 20,
            requirements: 'TikTok优化的短剧，注重情感节拍'
        };

        it('validates correct input data', () => {
            expect(() => EpisodePlanningInputSchema.parse(validInput)).not.toThrow();
        });

        it('validates jsondocs array structure', () => {
            const validJsondoc = {
                jsondocId: 'test-123',
                description: 'Test jsondoc',
                schemaType: 'chronicles'
            };

            expect(() => JsondocReferenceSchema.parse(validJsondoc)).not.toThrow();
        });

        it('requires at least one jsondoc', () => {
            const emptyJsondocs = {
                ...validInput,
                jsondocs: []
            };

            expect(() => EpisodePlanningInputSchema.parse(emptyJsondocs)).toThrow();
        });

        it('validates numberOfEpisodes minimum constraint', () => {
            const belowMinimum = {
                ...validInput,
                numberOfEpisodes: MIN_EPISODES - 1
            };

            expect(() => EpisodePlanningInputSchema.parse(belowMinimum)).toThrow();
        });

        it('validates numberOfEpisodes maximum constraint', () => {
            const aboveMaximum = {
                ...validInput,
                numberOfEpisodes: MAX_EPISODES + 1
            };

            expect(() => EpisodePlanningInputSchema.parse(aboveMaximum)).toThrow();
        });

        it('accepts minimum valid numberOfEpisodes', () => {
            const minValid = {
                ...validInput,
                numberOfEpisodes: MIN_EPISODES
            };

            expect(() => EpisodePlanningInputSchema.parse(minValid)).not.toThrow();
        });

        it('accepts maximum valid numberOfEpisodes', () => {
            const maxValid = {
                ...validInput,
                numberOfEpisodes: MAX_EPISODES
            };

            expect(() => EpisodePlanningInputSchema.parse(maxValid)).not.toThrow();
        });

        it('makes requirements field optional', () => {
            const withoutRequirements = {
                jsondocs: validInput.jsondocs,
                numberOfEpisodes: validInput.numberOfEpisodes
            };

            expect(() => EpisodePlanningInputSchema.parse(withoutRequirements)).not.toThrow();
        });

        it('accepts empty string for optional requirements', () => {
            const emptyRequirements = {
                ...validInput,
                requirements: ''
            };

            expect(() => EpisodePlanningInputSchema.parse(emptyRequirements)).not.toThrow();
        });

        it('validates multiple jsondocs', () => {
            const multipleJsondocs = {
                ...validInput,
                jsondocs: [
                    {
                        jsondocId: 'chronicles-123',
                        description: 'Chronicles data',
                        schemaType: 'chronicles'
                    },
                    {
                        jsondocId: 'outline-456',
                        description: 'Outline settings',
                        schemaType: '剧本设定'
                    }
                ]
            };

            expect(() => EpisodePlanningInputSchema.parse(multipleJsondocs)).not.toThrow();
        });

        it('rejects invalid jsondoc structure', () => {
            const invalidJsondoc = {
                ...validInput,
                jsondocs: [
                    {
                        jsondocId: '', // Empty ID
                        description: 'Test',
                        schemaType: 'chronicles'
                    }
                ]
            };

            expect(() => EpisodePlanningInputSchema.parse(invalidJsondoc)).toThrow();
        });
    });

    describe('EpisodePlanningOutputSchema', () => {
        const validOutput: EpisodePlanningOutput = {
            totalEpisodes: 20,
            overallStrategy: '非线性叙事结构，通过情感节拍的起伏来保持观众注意力，每2分钟一个小高潮',
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

        it('requires totalEpisodes field', () => {
            const missingTotal = {
                overallStrategy: validOutput.overallStrategy,
                episodeGroups: validOutput.episodeGroups
            };

            expect(() => EpisodePlanningOutputSchema.parse(missingTotal)).toThrow();
        });

        it('requires overallStrategy field', () => {
            const missingStrategy = {
                totalEpisodes: validOutput.totalEpisodes,
                episodeGroups: validOutput.episodeGroups
            };

            expect(() => EpisodePlanningOutputSchema.parse(missingStrategy)).toThrow();
        });

        it('requires episodeGroups field', () => {
            const missingGroups = {
                totalEpisodes: validOutput.totalEpisodes,
                overallStrategy: validOutput.overallStrategy
            };

            expect(() => EpisodePlanningOutputSchema.parse(missingGroups)).toThrow();
        });

        it('validates totalEpisodes as number', () => {
            const invalidTotal = {
                ...validOutput,
                totalEpisodes: '20' // String instead of number
            };

            expect(() => EpisodePlanningOutputSchema.parse(invalidTotal)).toThrow();
        });

        it('validates overallStrategy as string', () => {
            const invalidStrategy = {
                ...validOutput,
                overallStrategy: 123 // Number instead of string
            };

            expect(() => EpisodePlanningOutputSchema.parse(invalidStrategy)).toThrow();
        });

        it('accepts empty episodeGroups array', () => {
            const emptyGroups = {
                ...validOutput,
                episodeGroups: []
            };

            expect(() => EpisodePlanningOutputSchema.parse(emptyGroups)).not.toThrow();
        });

        it('validates episodeGroups array structure', () => {
            const invalidGroupStructure = {
                ...validOutput,
                episodeGroups: [
                    {
                        groupTitle: 'Valid Group',
                        episodes: '1-5',
                        keyEvents: ['Event'],
                        hooks: ['Hook'],
                        emotionalBeats: ['Beat']
                    },
                    {
                        groupTitle: 'Invalid Group',
                        // Missing required fields
                    }
                ]
            };

            expect(() => EpisodePlanningOutputSchema.parse(invalidGroupStructure)).toThrow();
        });

        it('handles zero totalEpisodes', () => {
            const zeroEpisodes = {
                ...validOutput,
                totalEpisodes: 0,
                episodeGroups: []
            };

            expect(() => EpisodePlanningOutputSchema.parse(zeroEpisodes)).not.toThrow();
        });

        it('handles large number of episodes', () => {
            const manyEpisodes = {
                ...validOutput,
                totalEpisodes: 100
            };

            expect(() => EpisodePlanningOutputSchema.parse(manyEpisodes)).not.toThrow();
        });

        it('validates single episode group', () => {
            const singleGroup = {
                ...validOutput,
                totalEpisodes: 5,
                episodeGroups: [
                    {
                        groupTitle: '完整故事',
                        episodes: '第1-5集',
                        keyEvents: ['开始', '发展', '高潮', '结局'],
                        hooks: ['开场钩子', '中间转折', '结尾钩子'],
                        emotionalBeats: ['起', '承', '转', '合']
                    }
                ]
            };

            expect(() => EpisodePlanningOutputSchema.parse(singleGroup)).not.toThrow();
        });

        it('validates complex episode groups structure', () => {
            const complexGroups = {
                ...validOutput,
                totalEpisodes: 50,
                episodeGroups: [
                    {
                        groupTitle: '第一阶段：相遇',
                        episodes: '第1-6集',
                        keyEvents: ['初次见面', '误会产生', '逐渐了解'],
                        hooks: ['意外相遇', '身份隐瞒', '巧合重逢'],
                        emotionalBeats: ['好奇', '紧张', '温馨']
                    },
                    {
                        groupTitle: '第二阶段：了解',
                        episodes: '第7-12集',
                        keyEvents: ['产生好感', '感情升温', '外界阻力'],
                        hooks: ['心动瞬间', '家族反对', '事业冲突'],
                        emotionalBeats: ['甜蜜', '幸福', '焦虑']
                    },
                    {
                        groupTitle: '第三阶段：纠葛',
                        episodes: '第13-18集',
                        keyEvents: ['内心挣扎', '第三者出现', '误会加深'],
                        hooks: ['情感冲突', '意外发现', '关系危机'],
                        emotionalBeats: ['痛苦', '绝望', '挣扎']
                    },
                    {
                        groupTitle: '第四阶段：分离',
                        episodes: '第19-24集',
                        keyEvents: ['暂时分离', '各自成长', '内心反思'],
                        hooks: ['痛苦分别', '成长契机', '内心独白'],
                        emotionalBeats: ['痛苦', '孤独', '思考']
                    },
                    {
                        groupTitle: '第五阶段：转机',
                        episodes: '第25-30集',
                        keyEvents: ['真相大白', '重新相遇', '化解误会'],
                        hooks: ['意外重逢', '真相揭露', '深情告白'],
                        emotionalBeats: ['惊喜', '感动', '释然']
                    },
                    {
                        groupTitle: '第六阶段：重逢',
                        episodes: '第31-36集',
                        keyEvents: ['重新开始', '克服障碍', '家人支持'],
                        hooks: ['重新追求', '家庭和解', '朋友助力'],
                        emotionalBeats: ['希望', '勇气', '温暖']
                    },
                    {
                        groupTitle: '第七阶段：团圆',
                        episodes: '第37-42集',
                        keyEvents: ['正式复合', '婚礼筹备', '未来规划'],
                        hooks: ['浪漫求婚', '婚礼准备', '甜蜜日常'],
                        emotionalBeats: ['兴奋', '甜蜜', '憧憬']
                    },
                    {
                        groupTitle: '第八阶段：圆满',
                        episodes: '第43-48集',
                        keyEvents: ['完美婚礼', '蜜月旅行', '新生活'],
                        hooks: ['梦幻婚礼', '浪漫蜜月', '幸福生活'],
                        emotionalBeats: ['完美', '幸福', '满足']
                    },
                    {
                        groupTitle: '第九阶段：结局',
                        episodes: '第49-50集',
                        keyEvents: ['终成眷属', '圆满结局'],
                        hooks: ['完美结局', '幸福永远'],
                        emotionalBeats: ['满足', '完美']
                    }
                ]
            };

            expect(() => EpisodePlanningOutputSchema.parse(complexGroups)).not.toThrow();
        });
    });

    describe('Schema Integration', () => {
        it('validates complete episode planning workflow', () => {
            // Test that input can be transformed to output structure
            const input: EpisodePlanningInput = {
                jsondocs: [
                    {
                        jsondocId: 'chronicles-789',
                        description: 'Complete chronicles for 20-episode drama',
                        schemaType: 'chronicles'
                    }
                ],
                numberOfEpisodes: 20,
                requirements: '现代都市甜宠剧，适合TikTok平台，每集2分钟'
            };

            const output: EpisodePlanningOutput = {
                totalEpisodes: input.numberOfEpisodes,
                overallStrategy: '基于输入要求生成的策略',
                episodeGroups: [
                    {
                        groupTitle: '相遇阶段',
                        episodes: '第1-6集',
                        keyEvents: ['初遇', '了解'],
                        hooks: ['意外', '误会'],
                        emotionalBeats: ['好奇', '紧张']
                    },
                    {
                        groupTitle: '发展阶段',
                        episodes: '第7-12集',
                        keyEvents: ['深入', '感情升温'],
                        hooks: ['转折', '心动'],
                        emotionalBeats: ['甜蜜', '幸福']
                    },
                    {
                        groupTitle: '高潮阶段',
                        episodes: '第13-18集',
                        keyEvents: ['冲突', '危机'],
                        hooks: ['误会', '分离'],
                        emotionalBeats: ['紧张', '痛苦']
                    },
                    {
                        groupTitle: '结局阶段',
                        episodes: '第19-20集',
                        keyEvents: ['和解', '结局'],
                        hooks: ['真相', '团圆'],
                        emotionalBeats: ['感动', '满足']
                    }
                ]
            };

            expect(() => EpisodePlanningInputSchema.parse(input)).not.toThrow();
            expect(() => EpisodePlanningOutputSchema.parse(output)).not.toThrow();
            expect(output.totalEpisodes).toBe(input.numberOfEpisodes);
        });
    });
}); 