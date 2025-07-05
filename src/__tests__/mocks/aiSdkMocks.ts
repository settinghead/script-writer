import { vi } from 'vitest';
import { CacheReader, CachedResponse } from '../utils/cacheReader';
import { generateCacheKey, generateSchemaHash, CacheKeyParams } from '../../common/transform-artifact-framework/cacheKeyGenerator';
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
            console.log(`[Mock] Checking prompt for fallback detection: ${prompt.substring(0, 200)}...`);
            console.log(`[Mock] Contains 'Chronological Outline'?`, prompt.includes('Chronological Outline'));
            console.log(`[Mock] Contains '剧本框架'?`, prompt.includes('剧本框架'));
            console.log(`[Mock] Contains 'Story Settings'?`, prompt.includes('Story Settings'));
            // Check for outline settings first - when asking to CREATE a story settings/framework
            if (prompt.includes('outline_settings') || prompt.includes('template: outline_settings') || prompt.includes('templateName: outline_settings') || (prompt.includes('剧本框架') && prompt.includes('Story Settings')) || (prompt.includes('Story Settings') && !prompt.includes('Chronological Outline'))) {
                console.log('[Mock] Using outline settings fallback');
                return createFallbackOutlineObject();
            } else if (prompt.includes('chronicles') || prompt.includes('template: chronicles') || prompt.includes('templateName: chronicles') || (prompt.includes('Chronological Outline') && prompt.includes('创作一个**时间顺序大纲')) || (prompt.includes('时间顺序大纲') && (prompt.includes('创作一个**时间顺序大纲') || prompt.includes('请创作一个**时间顺序大纲'))) || prompt.includes('时间顺序') || prompt.includes('timeline') || prompt.includes('stages')) {
                console.log('[Mock] Using chronicles fallback');
                return createFallbackChroniclesObject();
            } else if (prompt.includes('outline') || prompt.includes('Outline') || prompt.includes('大纲')) {
                console.log('[Mock] Using generic outline fallback');
                return createFallbackOutlineObject();
            } else if (prompt.includes('edit') || prompt.includes('改进') || prompt.includes('修改')) {
                console.log('[Mock] Using edit fallback');
                return createFallbackBrainstormEditObject();
            } else {
                console.log('[Mock] Using default brainstorm fallback');
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

    console.log('[Mock] Using cached response with finalResult:', cachedResponse.metadata.finalResult);

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
 * Fallback mock for chronicles generation (matches ChroniclesOutputSchema)
 */
function createFallbackChroniclesObject() {
    const mockChroniclesData = {
        stages: [
            {
                title: "初遇与误会阶段（第1-8集）",
                stageSynopsis: "女主入职遇到男主，因误会开始特殊关系。双方在职场环境中频繁接触，但由于误解而产生复杂的情感纠葛。",
                event: "女主入职新公司，意外与男主发生误会，被迫开始特殊的合作关系",
                emotionArcs: [
                    {
                        characters: ["女主"],
                        content: "从紧张不安到逐渐适应，对男主的态度从抗拒到好奇"
                    },
                    {
                        characters: ["男主"],
                        content: "从冷漠到关注，开始对女主产生特殊的兴趣"
                    }
                ],
                relationshipDevelopments: [
                    {
                        characters: ["女主", "男主"],
                        content: "从陌生人到被迫合作的搭档，关系在误会中逐渐建立"
                    }
                ],
                insights: [
                    "女主的真实身份尚未暴露",
                    "男主对女主的误会是推动剧情的关键",
                    "职场环境为两人关系发展提供了特殊背景"
                ]
            },
            {
                title: "感情升温阶段（第9-16集）",
                stageSynopsis: "在误会中两人感情逐渐升温，互相关注。工作中的配合让他们更加了解彼此，情感开始微妙变化。",
                event: "通过工作合作，两人开始互相了解，感情在不知不觉中升温",
                emotionArcs: [
                    {
                        characters: ["女主"],
                        content: "开始欣赏男主的能力和人格魅力，内心产生动摇"
                    },
                    {
                        characters: ["男主"],
                        content: "被女主的坚强和聪明吸引，开始主动关心"
                    }
                ],
                relationshipDevelopments: [
                    {
                        characters: ["女主", "男主"],
                        content: "从合作伙伴发展为互相关心的朋友，情感边界开始模糊"
                    }
                ],
                insights: [
                    "两人的性格互补成为感情发展的基础",
                    "工作中的默契预示着更深层的感情连接",
                    "周围同事开始注意到两人的特殊关系"
                ]
            }
        ]
    };

    console.log('[Mock] Using chronicles fallback with data:', mockChroniclesData);

    return {
        partialObjectStream: createAsyncIterator([
            { stages: mockChroniclesData.stages.slice(0, 1) },
            mockChroniclesData
        ]),
        object: Promise.resolve(mockChroniclesData)
    };
}

/**
 * Fallback mock for outline settings generation (matches OutlineSettingsOutputSchema)
 */
function createFallbackOutlineObject() {
    const mockOutlineSettingsData = {
        title: "误爱成宠",
        genre: "现代甜宠",
        target_audience: {
            demographic: "18-35岁都市女性",
            core_themes: ["甜宠恋爱", "误会重重", "职场成长"]
        },
        selling_points: ["霸总甜宠", "误会重重", "高颜值演员"],
        satisfaction_points: ["甜蜜互动", "霸道总裁", "逆袭成长"],
        setting: {
            core_setting_summary: "现代都市职场背景，上海繁华商业区",
            key_scenes: ["总裁办公室", "高端餐厅", "公司大厅"]
        },
        characters: [
            {
                name: "林慕琛",
                type: "male_lead",
                description: "霸道深情的集团总裁，外表冷酷内心温暖",
                age: "30岁",
                gender: "男",
                occupation: "集团总裁",
                personality_traits: ["霸道", "深情", "责任感强"],
                character_arc: "从冷酷总裁到暖心恋人的成长转变",
                relationships: {
                    "夏栀": "误会中产生的爱情关系",
                    "母亲": "传统家庭压力来源"
                },
                key_scenes: ["总裁办公室初遇", "误会澄清", "深情告白"]
            },
            {
                name: "夏栀",
                type: "female_lead",
                description: "善良坚强的普通职员，在误会中展现真实自我",
                age: "25岁",
                gender: "女",
                occupation: "公司职员",
                personality_traits: ["善良", "坚强", "聪慧"],
                character_arc: "从自卑职员到自信女性的成长历程",
                relationships: {
                    "林慕琛": "误会中发展的真挚感情",
                    "同事": "职场友谊支撑"
                },
                key_scenes: ["职场挫折", "身份误会", "勇敢表白"]
            }
        ]
    };

    return {
        partialObjectStream: createAsyncIterator([
            { title: "误爱成宠" },
            mockOutlineSettingsData
        ]),
        object: Promise.resolve(mockOutlineSettingsData)
    };
}

async function* createAsyncIterator<T>(items: T[]) {
    for (const item of items) {
        yield item;
    }
} 