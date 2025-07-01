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
            // Check for chronicles first - when asking to CREATE a chronological outline
            if (prompt.includes('chronicles') || prompt.includes('template: chronicles') || prompt.includes('templateName: chronicles') || (prompt.includes('Chronological Outline') && prompt.includes('创作一个**时序大纲')) || (prompt.includes('时序大纲') && (prompt.includes('创作一个**时序大纲') || prompt.includes('请创作一个**时序大纲'))) || prompt.includes('时间顺序') || prompt.includes('timeline') || prompt.includes('stages')) {
                console.log('[Mock] Using chronicles fallback');
                return createFallbackChroniclesObject();
            } else if (prompt.includes('outline_settings') || prompt.includes('template: outline_settings') || prompt.includes('templateName: outline_settings') || prompt.includes('剧本框架') || prompt.includes('Story Settings')) {
                console.log('[Mock] Using outline settings fallback');
                return createFallbackOutlineObject();
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
        synopsis_stages: [
            "第1-8集：初遇与误会 - 女主入职遇到男主，因误会开始特殊关系",
            "第9-16集：感情升温 - 在误会中两人感情逐渐升温，互相关注",
            "第17-24集：矛盾冲突 - 真相逐渐浮现，两人产生误解和冲突",
            "第25-32集：真相大白 - 误会解除，两人重新认识彼此",
            "第33-40集：甜蜜恋爱 - 正式确立关系，享受甜蜜恋爱时光",
            "第41-48集：外界阻力 - 面对家庭和事业的挑战和阻力",
            "第49-56集：共同成长 - 携手克服困难，彼此成长和支持",
            "第57-60集：圆满结局 - 最终走向幸福，事业爱情双丰收"
        ]
    };

    console.log('[Mock] Using chronicles fallback with data:', mockChroniclesData);

    return {
        partialObjectStream: createAsyncIterator([
            { synopsis_stages: mockChroniclesData.synopsis_stages.slice(0, 2) },
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
        platform: "抖音",
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