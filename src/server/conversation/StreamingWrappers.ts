import { streamText, streamObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type {
    LanguageModelV1,
    CoreMessage,
    StreamTextResult,
    StreamObjectResult
} from 'ai';
import { z } from 'zod';
import {
    createMessageWithDisplay,
    updateMessageWithDisplay,
    addMessage,
    updateMessage,
    type ConversationMessage,
    type MessageId,
    type ConversationId
} from './ConversationManager.js';
import {
    calculateContentHash,
    generateCacheKey,
    type LLMParameters,
    type MessageForHashing
} from './ContentHasher.js';

export interface ConversationContext {
    conversationId: ConversationId;
    projectId: string;

    // Bound streaming functions that automatically track messages
    streamText: (params: StreamTextParams) => Promise<ConversationStreamTextResult>;
    streamObject: <T>(params: StreamObjectParams<T>) => Promise<ConversationStreamObjectResult<T>>;

    // Message management
    addMessage: (role: string, content: string, metadata?: Record<string, any>) => Promise<MessageId>;
    updateLastMessage: (content: string, status?: string) => Promise<void>;
}

export interface StreamTextParams {
    model?: LanguageModelV1;
    messages: CoreMessage[];
    system?: string;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    seed?: number;
    tools?: Record<string, any>;
}

export interface StreamObjectParams<T> {
    model?: LanguageModelV1;
    messages: CoreMessage[];
    schema: z.ZodSchema<T>;
    system?: string;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    seed?: number;
}

export interface ConversationStreamTextResult {
    textStream: AsyncIterable<string>;
    text: Promise<string>;
    usage: Promise<any>;
    finishReason: Promise<any>;
    fullStream: AsyncIterable<any>;
    cacheHit: boolean;
    cachedTokens: number;
    conversationId: ConversationId;
    messageId: MessageId;
}

export interface ConversationStreamObjectResult<T> {
    partialObjectStream: AsyncIterable<Partial<T>>;
    object: Promise<T>;
    usage: Promise<any>;
    fullStream: AsyncIterable<any>;
    cacheHit: boolean;
    cachedTokens: number;
    conversationId: ConversationId;
    messageId: MessageId;
}

// Get default model (could be configured elsewhere)
async function getDefaultModel(): Promise<LanguageModelV1> {
    const openai = createOpenAI({
        baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        apiKey: process.env.LLM_API_KEY || process.env.DASHSCOPE_API_KEY
    });
    return openai('qwen-plus');
}

// Check for cache hit by looking up existing messages with same content hash
async function checkCacheHit(contentHash: string, projectId: string): Promise<{ hit: boolean; cachedTokens: number; cachedContent?: string }> {
    try {
        const { db } = await import('../database/connection.js');

        // Look for existing messages with the same content hash in the same project
        const cachedMessage = await db
            .selectFrom('conversation_messages')
            .innerJoin('conversations', 'conversations.id', 'conversation_messages.conversation_id')
            .select(['conversation_messages.cached_tokens', 'conversation_messages.cache_hit', 'conversation_messages.content'])
            .where('conversations.project_id', '=', projectId)
            .where('conversation_messages.content_hash', '=', contentHash)
            .where('conversation_messages.role', '=', 'assistant') // Only check assistant responses
            .where('conversation_messages.status', '=', 'completed') // Only successful completions
            .orderBy('conversation_messages.created_at', 'desc')
            .executeTakeFirst();

        if (cachedMessage && cachedMessage.content) {
            console.log(`[Cache] Cache HIT found for hash ${contentHash.substring(0, 8)}... with ${cachedMessage.cached_tokens || 0} tokens`);
            console.log(`[Cache] Cached content length: ${cachedMessage.content.length} chars`);
            return {
                hit: true,
                cachedTokens: Number(cachedMessage.cached_tokens) || 0,
                cachedContent: cachedMessage.content
            };
        }

        console.log(`[Cache] Cache MISS for hash ${contentHash.substring(0, 8)}...`);
        return { hit: false, cachedTokens: 0 };
    } catch (error) {
        console.error(`[Cache] Error checking cache for hash ${contentHash}:`, error);
        return { hit: false, cachedTokens: 0 };
    }
}

// Add context cache headers for Alibaba Cloud
function addContextCacheHeaders(params: any, contentHash: string, cacheHit: boolean): any {
    // Add experimental context cache parameters for Alibaba Cloud
    const enhanced = {
        ...params,
        // Add context caching hint (this may vary based on actual Alibaba Cloud API)
        experimental_contextCache: {
            enabled: true,
            contentHash,
            cacheKey: contentHash.substring(0, 16) // Shortened cache key
        }
    };

    // If we detected a cache hit, add cache preference headers
    if (cacheHit) {
        enhanced.headers = {
            ...enhanced.headers,
            'X-Context-Cache-Preference': 'required',
            'X-Context-Cache-Key': contentHash.substring(0, 16)
        };
    }

    return enhanced;
}

export function createConversationContext(
    conversationId: ConversationId,
    projectId: string,
    existingMessages: ConversationMessage[]
): ConversationContext {

    // Bound addMessage function
    const addMessageBound = async (role: string, content: string, metadata?: Record<string, any>): Promise<MessageId> => {
        return await addMessage(conversationId, role as any, content, metadata);
    };

    // Bound updateMessage function  
    const updateLastMessage = async (content: string, status?: string): Promise<void> => {
        // Find the last assistant message in this conversation
        const { db } = await import('../database/connection.js');
        const lastMessage = await db
            .selectFrom('conversation_messages')
            .selectAll()
            .where('conversation_id', '=', conversationId)
            .where('role', '=', 'assistant')
            .orderBy('created_at', 'desc')
            .executeTakeFirst();

        if (lastMessage) {
            await updateMessage(lastMessage.id, { content, status: status as any });
        }
    };

    // Bound streamText function with conversation tracking
    const streamTextBound = async (params: StreamTextParams): Promise<ConversationStreamTextResult> => {
        console.log(`[StreamingWrappers] Starting streamText for conversation ${conversationId}`);

        // Extract LLM parameters for hashing
        const llmParams: LLMParameters = {
            modelName: params.model?.modelId || 'qwen-plus',
            temperature: params.temperature,
            topP: params.topP,
            maxTokens: params.maxTokens,
            seed: params.seed,
            tools: params.tools,
            systemPrompt: params.system
        };

        // Convert messages for hashing
        const newMessages: MessageForHashing[] = params.messages.map(msg => ({
            role: msg.role,
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        }));

        const contentHash = calculateContentHash(existingMessages, llmParams, newMessages);
        const cacheKey = generateCacheKey(projectId, contentHash);

        // Check for cache hit
        const { hit: cacheHit, cachedTokens, cachedContent } = await checkCacheHit(contentHash, projectId);

        // Create assistant message placeholder for streaming with display message
        const { rawMessageId: assistantMessageId } = await createMessageWithDisplay(
            conversationId,
            'assistant' as any,
            '', // Empty content initially
            {
                modelName: params.model?.modelId,
                temperature: params.temperature,
                topP: params.topP,
                maxTokens: params.maxTokens,
                seed: params.seed,
                contentHash,
                cacheHit,
                cachedTokens,
                status: 'streaming'
            }
        );

        try {
            // Handle cache hit: return cached content immediately
            if (cacheHit && cachedContent) {
                console.log(`[StreamingWrappers] Using cached response for conversation ${conversationId}`);

                // Update message with cached content
                await updateMessageWithDisplay(assistantMessageId, {
                    content: cachedContent,
                    status: 'completed' as any
                });

                // Create a stream that yields the cached content
                const textStream = async function* () {
                    yield cachedContent;
                };

                return {
                    textStream: textStream(),
                    text: Promise.resolve(cachedContent),
                    usage: Promise.resolve({
                        completionTokens: cachedTokens,
                        promptTokens: 0,
                        totalTokens: cachedTokens
                    }),
                    finishReason: Promise.resolve('stop'),
                    fullStream: textStream(),
                    cacheHit,
                    cachedTokens,
                    conversationId,
                    messageId: assistantMessageId
                };
            }

            // No cache hit: proceed with LLM API call
            const model = params.model || await getDefaultModel();

            // Add context cache headers
            const enhancedParams = addContextCacheHeaders({
                model,
                messages: params.messages,
                system: params.system,
                temperature: params.temperature,
                topP: params.topP,
                maxTokens: params.maxTokens,
                seed: params.seed,
                tools: params.tools
            }, contentHash, cacheHit);

            console.log('[StreamingWrappers] Calling LLM API with enhanced params:', JSON.stringify({
                modelId: enhancedParams.model?.modelId,
                messagesCount: enhancedParams.messages?.length,
                system: enhancedParams.system?.substring(0, 100) + '...',
                temperature: enhancedParams.temperature,
                maxTokens: enhancedParams.maxTokens,
                toolsCount: enhancedParams.tools ? Object.keys(enhancedParams.tools).length : 0
            }, null, 2));

            const result = await streamText(enhancedParams);
            console.log('[StreamingWrappers] LLM API call completed, starting to process stream...');

            // Track streaming updates
            let accumulatedContent = '';
            let chunkCount = 0;
            const originalTextStream = result.textStream;
            const enhancedTextStream = new ReadableStream({
                async start(controller) {
                    try {
                        console.log('[StreamingWrappers] Starting to iterate over text stream...');
                        for await (const chunk of originalTextStream) {
                            chunkCount++;
                            accumulatedContent += chunk;
                            console.log(`[StreamingWrappers] Chunk ${chunkCount}: "${chunk}" (accumulated: ${accumulatedContent.length} chars)`);

                            // Update message in database with accumulated content and display message
                            await updateMessageWithDisplay(assistantMessageId, {
                                content: accumulatedContent,
                                status: 'streaming' as any
                            });

                            controller.enqueue(chunk);
                        }

                        console.log(`[StreamingWrappers] Stream completed. Total chunks: ${chunkCount}, final content: "${accumulatedContent}"`);

                        // Mark as completed when streaming ends
                        await updateMessageWithDisplay(assistantMessageId, {
                            content: accumulatedContent,
                            status: 'completed' as any
                        });

                        controller.close();
                    } catch (error) {
                        console.error('[StreamingWrappers] Error during streaming:', error);

                        await updateMessage(assistantMessageId, {
                            status: 'failed' as any,
                            errorMessage: error instanceof Error ? error.message : 'Unknown streaming error'
                        });

                        controller.error(error);
                    }
                }
            });

            const textStream = async function* () {
                const reader = enhancedTextStream.getReader();
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        yield value;
                    }
                } finally {
                    reader.releaseLock();
                }
            };

            console.log(`[StreamingWrappers] streamText completed for conversation ${conversationId}, cache hit: ${cacheHit}`);

            return {
                textStream: textStream(),
                text: result.text,
                usage: result.usage,
                finishReason: result.finishReason,
                fullStream: result.fullStream,
                cacheHit,
                cachedTokens,
                conversationId,
                messageId: assistantMessageId
            };

        } catch (error) {
            console.error('[StreamingWrappers] Error in streamText:', error);

            await updateMessageWithDisplay(assistantMessageId, {
                status: 'failed' as any,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });

            throw error;
        }
    };

    // Bound streamObject function with conversation tracking
    const streamObjectBound = async <T>(params: StreamObjectParams<T>): Promise<ConversationStreamObjectResult<T>> => {
        console.log(`[StreamingWrappers] Starting streamObject for conversation ${conversationId}`);

        // Extract LLM parameters for hashing
        const llmParams: LLMParameters = {
            modelName: params.model?.modelId || 'qwen-plus',
            temperature: params.temperature,
            topP: params.topP,
            maxTokens: params.maxTokens,
            seed: params.seed,
            systemPrompt: params.system
        };

        // Convert messages for hashing
        const newMessages: MessageForHashing[] = params.messages.map(msg => ({
            role: msg.role,
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        }));

        const contentHash = calculateContentHash(existingMessages, llmParams, newMessages);
        const cacheKey = generateCacheKey(projectId, contentHash);

        // Check for cache hit
        const { hit: cacheHit, cachedTokens } = await checkCacheHit(contentHash, projectId);

        // Create assistant message placeholder for streaming with display message
        const { rawMessageId: assistantMessageId } = await createMessageWithDisplay(
            conversationId,
            'assistant' as any,
            '', // Empty content initially
            {
                modelName: params.model?.modelId,
                temperature: params.temperature,
                topP: params.topP,
                maxTokens: params.maxTokens,
                seed: params.seed,
                contentHash,
                cacheHit,
                cachedTokens,
                status: 'streaming'
            }
        );

        // Stream with AI SDK
        const model = params.model || await getDefaultModel();

        try {
            // Add context cache headers
            const enhancedParams = addContextCacheHeaders({
                model,
                messages: params.messages,
                schema: params.schema,
                system: params.system,
                temperature: params.temperature,
                topP: params.topP,
                maxTokens: params.maxTokens,
                seed: params.seed
            }, contentHash, cacheHit);

            const result = await streamObject<T>(enhancedParams);

            // Track streaming updates
            let accumulatedContent = '';
            const originalPartialObjectStream = result.partialObjectStream;
            const enhancedPartialObjectStream = new ReadableStream({
                async start(controller) {
                    try {
                        for await (const partialObject of originalPartialObjectStream) {
                            const contentStr = JSON.stringify(partialObject, null, 2);
                            accumulatedContent = contentStr;

                            // Update message in database with accumulated content and display message
                            await updateMessageWithDisplay(assistantMessageId, {
                                content: accumulatedContent,
                                status: 'streaming' as any
                            });

                            controller.enqueue(partialObject);
                        }

                        // Mark as completed when streaming ends
                        await updateMessageWithDisplay(assistantMessageId, {
                            content: accumulatedContent,
                            status: 'completed' as any
                        });

                        controller.close();
                    } catch (error) {
                        console.error('[StreamingWrappers] Error during object streaming:', error);

                        await updateMessage(assistantMessageId, {
                            status: 'failed' as any,
                            errorMessage: error instanceof Error ? error.message : 'Unknown streaming error'
                        });

                        controller.error(error);
                    }
                }
            });

            const partialObjectStream = async function* () {
                const reader = enhancedPartialObjectStream.getReader();
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        yield value;
                    }
                } finally {
                    reader.releaseLock();
                }
            };

            console.log(`[StreamingWrappers] streamObject completed for conversation ${conversationId}, cache hit: ${cacheHit}`);

            return {
                partialObjectStream: partialObjectStream(),
                object: result.object,
                usage: result.usage,
                fullStream: result.fullStream,
                cacheHit,
                cachedTokens,
                conversationId,
                messageId: assistantMessageId
            };

        } catch (error) {
            console.error('[StreamingWrappers] Error in streamObject:', error);

            await updateMessageWithDisplay(assistantMessageId, {
                status: 'failed' as any,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });

            throw error;
        }
    };

    return {
        conversationId,
        projectId,
        streamText: streamTextBound,
        streamObject: streamObjectBound,
        addMessage: addMessageBound,
        updateLastMessage
    };
}