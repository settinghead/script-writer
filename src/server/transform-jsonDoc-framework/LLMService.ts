import { generateText, streamText, wrapLanguageModel, extractReasoningMiddleware, streamObject } from 'ai';
import { getLLMCredentials, getLLMModel } from './LLMConfig';
import { z } from 'zod';

export interface LLMModelInfo {
    name: string;
    supportsReasoning: boolean;
    provider: string;
}

export interface ReasoningResult {
    reasoning?: string;
    text: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export class LLMService {
    private modelCache = new Map<string, any>();
    private reasoningModelCache = new Map<string, any>();

    /**
     * Detect if a model supports reasoning based on its name
     */
    isReasoningModel(modelName: string): boolean {
        // Known reasoning models
        const reasoningPatterns = [
            /deepseek-r1/i,
            /deepseek-r1-distill/i,
            /.*-r1(-.*)?$/i,  // Any model ending with -r1 or -r1-something
        ];

        return reasoningPatterns.some(pattern => pattern.test(modelName));
    }

    /**
     * Get model information including reasoning capability
     */
    getModelInfo(modelName?: string): LLMModelInfo {
        const { modelName: defaultModelName } = getLLMCredentials();
        const actualModelName = modelName || defaultModelName;

        return {
            name: actualModelName,
            supportsReasoning: this.isReasoningModel(actualModelName),
            provider: 'openai' // For now, assuming OpenAI-compatible
        };
    }



    /**
     * Get or create a reasoning-enhanced model instance
     */
    private async getReasoningModel(modelName?: string) {
        const { modelName: defaultModelName } = getLLMCredentials();
        const actualModelName = modelName || defaultModelName;

        if (!this.reasoningModelCache.has(actualModelName)) {
            const baseModel = await getLLMModel(
                { modelName: actualModelName }
            );
            const enhancedModel = wrapLanguageModel({
                model: baseModel,
                middleware: extractReasoningMiddleware({ tagName: 'think' }),
            });
            this.reasoningModelCache.set(actualModelName, enhancedModel);
        }

        return this.reasoningModelCache.get(actualModelName);
    }

    /**
     * Generate text with automatic reasoning detection
     */
    async generateText(
        prompt: string,
        modelName?: string
    ): Promise<ReasoningResult> {
        const modelInfo = this.getModelInfo(modelName);

        if (modelInfo.supportsReasoning) {
            const reasoningModel = await this.getReasoningModel(modelName);
            const result = await generateText({
                model: reasoningModel,
                messages: [{ role: 'user', content: prompt }]
            });

            return {
                reasoning: (result as any).reasoning,
                text: result.text,
                usage: result.usage ? {
                    promptTokens: result.usage.promptTokens,
                    completionTokens: result.usage.completionTokens,
                    totalTokens: result.usage.totalTokens
                } : undefined
            };
        } else {
            const standardModel = await getLLMModel({ modelName: modelName });
            const result = await generateText({
                model: standardModel,
                messages: [{ role: 'user', content: prompt }]
            });

            return {
                text: result.text,
                usage: result.usage ? {
                    promptTokens: result.usage.promptTokens,
                    completionTokens: result.usage.completionTokens,
                    totalTokens: result.usage.totalTokens
                } : undefined
            };
        }
    }

    /**
     * Stream text with automatic reasoning detection and event callbacks
     */
    async streamText(
        prompt: string,
        onReasoningStart?: (phase: string) => void,
        onReasoningEnd?: (phase: string) => void,
        modelName?: string
    ) {
        const modelInfo = this.getModelInfo(modelName);

        if (modelInfo.supportsReasoning) {
            const reasoningModel = await this.getReasoningModel(modelName);

            // Emit reasoning start event
            onReasoningStart?.('generation');

            const stream = streamText({
                model: reasoningModel,
                messages: [{ role: 'user', content: prompt }]
            });

            // Create a wrapper that emits reasoning end when first content arrives
            let hasEmittedReasoningEnd = false;
            const originalStream = stream.textStream;

            return {
                ...stream,
                textStream: (async function* () {
                    for await (const chunk of originalStream) {
                        if (!hasEmittedReasoningEnd) {
                            onReasoningEnd?.('generation');
                            hasEmittedReasoningEnd = true;
                        }
                        yield chunk;
                    }
                })()
            };
        } else {
            const standardModel = await getLLMModel({ modelName: modelName });
            return streamText({
                model: standardModel,
                messages: [{ role: 'user', content: prompt }]
            });
        }
    }

    /**
     * Clear model caches (useful for testing or when credentials change)
     */
    clearCache(): void {
        this.modelCache.clear();
        this.reasoningModelCache.clear();
    }

    /**
     * Stream a structured object with automatic reasoning detection
     */
    async streamObject<T extends z.ZodSchema<any>>(
        options: {
            prompt: string;
            schema: T;
            modelName?: string;
            onReasoningStart?: (phase: string) => void;
            onReasoningEnd?: (phase: string) => void;
        }
    ) {
        const { prompt, schema, modelName, onReasoningStart, onReasoningEnd } = options;
        const modelInfo = this.getModelInfo(modelName);

        if (modelInfo.supportsReasoning) {
            const reasoningModel = await this.getReasoningModel(modelName);

            // Emit reasoning start event
            onReasoningStart?.('generation');

            const stream = await streamObject({
                model: reasoningModel,
                schema: schema as any,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            });

            // Create a wrapper that emits reasoning end when the first partial object arrives
            let hasEmittedReasoningEnd = false;
            const originalStream = stream.partialObjectStream;

            return (async function* () {
                for await (const partialObject of originalStream) {
                    if (!hasEmittedReasoningEnd) {
                        onReasoningEnd?.('generation');
                        hasEmittedReasoningEnd = true;
                    }
                    yield partialObject;
                }
            })();

        } else {
            const standardModel = await getLLMModel({ modelName: modelName });

            const stream = await streamObject({
                model: standardModel,
                schema: schema as any,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            });

            // Use StreamProxy to solve the ReadableStream locked issue
            const { createStreamObjectProxy } = await import('./StreamProxy.js');
            const proxy = createStreamObjectProxy(stream);

            return proxy.createAsyncIterable();
        }
    }
} 