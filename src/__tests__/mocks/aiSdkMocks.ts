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
        const prompt = options.messages?.map(m => m.content).join('\n') || 'default-prompt';
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
            const prompt = options.messages?.map(m => m.content).join('\n') || 'default-prompt';
            if (prompt.includes('outline') || prompt.includes('Outline') || prompt.includes('大纲')) {
                return createFallbackOutlineObject();
            } else if (prompt.includes('edit') || prompt.includes('改进') || prompt.includes('修改')) {
                return createFallbackBrainstormEditObject();
            } else {
                return createFallbackStreamObject();
            }
        }
    });
}

/**
 * Create mock for streamText that uses cached responses
 */
export function createCachedStreamTextMock(mockOptions?: { onToolCall?: (toolName: string, args: any) => void }) {
    return vi.fn().mockImplementation(async (options: {
        model: any;
        messages: Array<{ role: string; content: string }>;
        seed?: number;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    }) => {
        // Generate cache key from parameters
        const prompt = options.messages?.map(m => m.content).join('\n') || 'default-prompt';
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
            return createFallbackStreamText(mockOptions);
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
    // Convert chunks to the format expected by AI SDK fullStream
    const streamEvents = [
        { type: 'tool-call', toolName: 'brainstorm', toolCallId: 'tool-call-1', args: { platform: 'tv', requirements: '现代都市甜宠剧' } },
        { type: 'tool-result', toolCallId: 'tool-call-1', result: { outputArtifactId: 'test-brainstorm-output' } },
        ...chunks.map(chunk => ({
            type: 'text-delta',
            textDelta: chunk.data
        }))
    ];

    return {
        fullStream: createAsyncIterator(streamEvents),
        finishReason: Promise.resolve('stop'),
        usage: Promise.resolve({ promptTokens: 100, completionTokens: 50, totalTokens: 150 }),
        toolCalls: Promise.resolve([
            { toolName: 'brainstorm', args: { platform: 'tv', requirements: '现代都市甜宠剧' } }
        ]),
        toolResults: Promise.resolve([
            { toolCallId: 'tool-call-1', result: { outputArtifactId: 'test-brainstorm-output' } }
        ])
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

function createFallbackStreamText(options?: { onToolCall?: (toolName: string, args: any) => void }) {
    // For agent tests, simulate tool calls based on the prompt
    const toolName = 'brainstorm';
    const args = { platform: 'tv', requirements: '现代都市甜宠剧' };

    // Trigger repository calls if callback is provided
    if (options?.onToolCall) {
        // Execute the callback asynchronously to simulate tool execution
        setTimeout(() => options.onToolCall!(toolName, args), 0);
    }

    return {
        fullStream: createAsyncIterator([
            { type: 'tool-call', toolName, toolCallId: 'tool-call-1', args },
            { type: 'tool-result', toolCallId: 'tool-call-1', result: { outputArtifactId: 'test-brainstorm-output' } },
            { type: 'text-delta', textDelta: 'I have generated some brainstorm ideas for you.' }
        ]),
        finishReason: Promise.resolve('stop'),
        usage: Promise.resolve({ promptTokens: 10, completionTokens: 5, totalTokens: 15 }),
        toolCalls: Promise.resolve([
            { toolName, args }
        ]),
        toolResults: Promise.resolve([
            { toolCallId: 'tool-call-1', result: { outputArtifactId: 'test-brainstorm-output' } }
        ])
    };
}

/**
 * Fallback mock for brainstorm edit (returns single idea object)
 */
function createFallbackBrainstormEditObject() {
    const mockEditedIdea = {
        title: "误爱成宠（升级版）",
        body: "现代都市背景下，林氏科技集团总裁林慕琛利用先进的AI系统误将普通程序员夏栀识别为富家千金。这个技术错误引发了一段充满现代科技色彩的爱恋故事，保持原有的情感核心，但融入了现代科技背景。"
    };

    return {
        partialObjectStream: createAsyncIterator([
            { title: "误爱成宠（升级版）" },
            mockEditedIdea
        ]),
        object: Promise.resolve(mockEditedIdea)
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
                event: "初次相遇",
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
                ],
                insights: ["观众了解到女主的身份误会", "男主的第一印象形成过程"]
            },
            {
                title: "情感升温",
                stageSynopsis: "在误会中两人感情逐渐升温",
                event: "感情发展",
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
                ],
                insights: ["感情在误会中发展的复杂性", "两人内心世界的变化"]
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