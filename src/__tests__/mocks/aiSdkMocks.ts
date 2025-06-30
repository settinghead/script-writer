import { vi } from 'vitest';
import { CacheReader, CachedResponse } from '../utils/cacheReader';
import { generateCacheKey, generateSchemaHash, CacheKeyParams } from '../../common/utils/cacheKeyGenerator';
import { z } from 'zod';

const cacheReader = new CacheReader();

/**
 * Create mock for streamObject that uses cached responses
 */
export function createCachedStreamObjectMock() {
    return vi.fn().mockImplementation(async (options: {
        model: any;
        schema: z.ZodSchema;
        messages: Array<{ role: string; content: string }>;
        seed?: number;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    }) => {
        // Generate cache key from parameters
        const prompt = options.messages.map(m => m.content).join('\n');
        const cacheKey = generateCacheKey({
            prompt,
            seed: options.seed,
            schemaHash: generateSchemaHash(options.schema),
            modelName: options.model.modelId || 'test-model',
            provider: options.model.provider || 'test-provider',
            temperature: options.temperature,
            topP: options.topP,
            maxTokens: options.maxTokens,
            mode: 'object'
        });

        // Try to get cached response
        const cachedResponse = await cacheReader.getCachedResponse(cacheKey);

        if (cachedResponse) {
            // Use cached response
            return createStreamObjectFromCache(cachedResponse);
        } else {
            // Fallback to mock data based on schema
            console.warn(`No cached response found for key: ${cacheKey.substring(0, 8)}...`);
            const prompt = options.messages.map(m => m.content).join('\n');
            if (prompt.includes('outline') || prompt.includes('Outline') || prompt.includes('大纲')) {
                return createFallbackOutlineObject();
            } else {
                return createFallbackStreamObject();
            }
        }
    });
}

/**
 * Create mock for streamText that uses cached responses
 */
export function createCachedStreamTextMock() {
    return vi.fn().mockImplementation(async (options: {
        model: any;
        messages: Array<{ role: string; content: string }>;
        seed?: number;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    }) => {
        // Generate cache key from parameters
        const prompt = options.messages.map(m => m.content).join('\n');
        const cacheKey = generateCacheKey({
            prompt,
            modelName: options.model.modelId || 'test-model',
            provider: options.model.provider || 'test-provider',
            seed: options.seed,
            temperature: options.temperature,
            topP: options.topP,
            maxTokens: options.maxTokens,
            mode: 'text'
        });

        // Try to get cached response
        const cachedResponse = await cacheReader.getCachedResponse(cacheKey);

        if (cachedResponse) {
            return createStreamTextFromCache(cachedResponse);
        } else {
            console.warn(`No cached response found for key: ${cacheKey.substring(0, 8)}...`);
            return createFallbackStreamText();
        }
    });
}

/**
 * Create streamObject result from cached data
 */
function createStreamObjectFromCache(cachedResponse: CachedResponse) {
    const chunks = cachedResponse.chunks.filter(c => c.type === 'object');

    return {
        partialObjectStream: createAsyncIteratorFromChunks(chunks),
        object: Promise.resolve(cachedResponse.metadata.finalResult)
    };
}

/**
 * Create streamText result from cached data  
 */
function createStreamTextFromCache(cachedResponse: CachedResponse) {
    const chunks = cachedResponse.chunks.filter(c => c.type === 'text-delta');

    return {
        textStream: createAsyncIteratorFromChunks(chunks),
        finishReason: Promise.resolve('stop'),
        usage: Promise.resolve({ promptTokens: 100, completionTokens: 50, totalTokens: 150 })
    };
}

/**
 * Create async iterator from cached chunks
 */
async function* createAsyncIteratorFromChunks(chunks: any[]) {
    for (const chunk of chunks) {
        yield chunk.data;
    }
}

/**
 * Fallback mock for when no cache is available
 */
function createFallbackStreamObject() {
    // Create mock data that matches brainstorm schema (array of ideas)
    const mockBrainstormData = [
        {
            title: "误爱成宠",
            body: "林氏集团总裁林慕琛因一场误会将普通职员夏栀认作富家千金，开启了一段错综复杂的爱恋..."
        },
        {
            title: "暗恋心动",
            body: "校园女神苏晚晚与学霸男神陆景行之间的青春暗恋故事，甜蜜与心动并存..."
        }
    ];

    return {
        partialObjectStream: createAsyncIterator([
            [{ title: "误爱成宠" }],
            mockBrainstormData
        ]),
        object: Promise.resolve(mockBrainstormData)
    };
}

function createFallbackStreamText() {
    return {
        textStream: createAsyncIterator(["Hello", " World", "!"]),
        finishReason: Promise.resolve('stop'),
        usage: Promise.resolve({ promptTokens: 10, completionTokens: 5, totalTokens: 15 })
    };
}

/**
 * Fallback mock for outline generation
 */
function createFallbackOutlineObject() {
    const mockOutlineData = {
        title: "误爱成宠",
        genre: "现代甜宠",
        target_audience: {
            demographic: "18-35岁都市女性",
            core_themes: ["甜宠", "霸总", "误会"]
        },
        selling_points: ["霸总甜宠", "误会重重", "高颜值演员"],
        satisfaction_points: ["甜蜜互动", "霸道总裁", "逆袭成长"],
        setting: {
            core_setting_summary: "现代都市商业环境，主要场景为高端写字楼和豪华住宅",
            key_scenes: ["总裁办公室", "员工餐厅", "豪华酒店", "家庭聚会"]
        },
        characters: [
            {
                name: "林慕琛",
                type: "male_lead",
                description: "集团总裁，霸道深情",
                age: "30岁",
                gender: "男",
                occupation: "集团总裁",
                personality_traits: ["霸道", "深情", "专业"],
                character_arc: "从误解到理解，从冷漠到深情",
                relationships: { "夏栀": "恋人关系" },
                key_scenes: ["初次见面", "误会产生", "真相大白", "表白场景"]
            },
            {
                name: "夏栀",
                type: "female_lead",
                description: "普通职员，坚强善良",
                age: "25岁",
                gender: "女",
                occupation: "公司职员",
                personality_traits: ["善良", "坚强", "聪明"],
                character_arc: "从被误解到证明自己，获得真爱",
                relationships: { "林慕琛": "恋人关系" },
                key_scenes: ["入职场景", "被误解", "澄清真相", "接受告白"]
            }
        ],
        stages: [
            {
                title: "误会相遇",
                stageSynopsis: "女主入职遇到男主，因误会开始特殊关系",
                timeframe: "第1-2集",
                keyPoints: [
                    {
                        event: "初次相遇",
                        timeSpan: "第1集",
                        emotionArcs: [
                            {
                                characters: ["林慕琛", "夏栀"],
                                content: "第一印象的形成和误会的开始"
                            }
                        ],
                        relationshipDevelopments: [
                            {
                                characters: ["林慕琛", "夏栀"],
                                content: "从陌生到产生特殊关注"
                            }
                        ]
                    }
                ]
            },
            {
                title: "情感升温",
                stageSynopsis: "在误会中两人感情逐渐升温",
                timeframe: "第3-4集",
                keyPoints: [
                    {
                        event: "感情发展",
                        timeSpan: "第3-4集",
                        emotionArcs: [
                            {
                                characters: ["林慕琛", "夏栀"],
                                content: "感情在误会中悄然生长"
                            }
                        ],
                        relationshipDevelopments: [
                            {
                                characters: ["林慕琛", "夏栀"],
                                content: "从关注到产生爱意"
                            }
                        ]
                    }
                ]
            }
        ]
    };

    return {
        partialObjectStream: createAsyncIterator([
            { title: "误爱成宠" },
            mockOutlineData
        ]),
        object: Promise.resolve(mockOutlineData)
    };
}

async function* createAsyncIterator<T>(items: T[]) {
    for (const item of items) {
        yield item;
    }
} 