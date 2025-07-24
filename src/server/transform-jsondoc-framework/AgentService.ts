import { z } from 'zod';
import { streamText, wrapLanguageModel } from 'ai';
import { TransformRepository } from './TransformRepository';
import { JsondocRepository } from './JsondocRepository';
import { createAgentTool } from './StreamingAgentFramework';
import { buildAgentConfiguration, buildPromptForRequestType } from '../services/AgentRequestBuilder';
import { getLLMModel } from './LLMConfig';
import { createUserContextMiddleware } from '../middleware/UserContextMiddleware';
import { getParticleSystem } from '../services/ParticleSystemInitializer';

// Schema for general agent requests
export const GeneralAgentRequestSchema = z.object({
    userRequest: z.string(),
    projectId: z.string(),
    contextType: z.enum(['brainstorm', 'general']).optional(),
    contextData: z.any().optional() // Additional context data
});

export type GeneralAgentRequest = z.infer<typeof GeneralAgentRequestSchema>;

export class AgentService {
    private chatMessageRepo?: any; // Injected later to avoid circular dependency

    constructor(
        private transformRepo: TransformRepository,
        private jsondocRepo: JsondocRepository,
    ) { }

    // Method to inject chat repository after initialization
    public setChatMessageRepository(chatMessageRepo: any) {
        this.chatMessageRepo = chatMessageRepo;
    }

    // Helper function to generate computation state indicators
    private generateComputationIndicator(phase: string, content?: string): string {
        const icons = ['🔄', '⚡', '🎯', '✨', '🔍', '💡', '🚀', '⭐'];
        const hash = this.simpleHash(content || phase);
        const icon = icons[hash % icons.length];

        const phases = {
            'thinking': '编剧大脑启动中',
            'analyzing': '剧情分析器运转中',
            'processing': '角色们正在排练',
            'generating': '创意火花四溅中',
            'completing': '最后润色，马上完工',
            'error': '❌ 剧本卡壳了'
        };

        return `${icon} ${phases[phase as keyof typeof phases] || '正在进行相关计算'}...`;
    }

    // Simple hash function for consistent but varied indicators
    private simpleHash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    // Helper function to parse JSON with fallback
    private async tryParseAgentJSON(text: string): Promise<{ humanReadableMessage?: string; parsed: boolean }> {
        try {
            // Remove markdown code blocks if present
            let cleanText = text.trim();
            if (cleanText.startsWith('```json')) {
                cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            }

            // Try regular JSON.parse first
            let parsed;
            try {
                parsed = JSON.parse(cleanText);
            } catch (jsonError) {
                // Fallback to jsonrepair
                const { jsonrepair } = await import('jsonrepair');
                const repairedJson = jsonrepair(cleanText);
                parsed = JSON.parse(repairedJson);
            }

            return {
                humanReadableMessage: parsed.humanReadableMessage,
                parsed: true
            };
        } catch (error) {
            return { parsed: false };
        }
    }

    /**
     * Build minimal context that provides only workflow state overview for particle-based search
     * This is used when particle search tools are available to reduce context size
     */
    private async buildMinimalContextForParticleSearch(
        projectId: string,
        jsondocRepo: JsondocRepository
    ): Promise<string> {
        const contextLines: string[] = [];
        contextLines.push('=== 项目状态概览 ===');

        try {
            // Get basic project state without loading full content
            const allJsondocs = await jsondocRepo.getProjectJsondocs(projectId);

            const hasInput = allJsondocs.some((j: any) => j.schema_type === 'user_input');
            const hasBrainstorm = allJsondocs.some((j: any) => j.schema_type === '灵感创意');
            const hasOutline = allJsondocs.some((j: any) => j.schema_type === '剧本设定');
            const hasChronicles = allJsondocs.some((j: any) => j.schema_type === 'chronicles');
            const hasEpisodePlanning = allJsondocs.some((j: any) => j.schema_type === 'episode_planning');
            const episodeSynopses = allJsondocs.filter((j: any) => j.schema_type === 'episode_synopsis');

            if (hasInput) contextLines.push('✓ 用户输入已创建');
            if (hasBrainstorm) contextLines.push('✓ 故事创意已生成');
            if (hasOutline) contextLines.push('✓ 剧本设定已生成');
            if (hasChronicles) contextLines.push('✓ 时间顺序大纲已生成');
            if (hasEpisodePlanning) contextLines.push('✓ 剧集框架已生成');
            if (episodeSynopses.length > 0) {
                contextLines.push(`✓ 已生成 ${episodeSynopses.length} 个分集大纲`);
            }

            if (contextLines.length === 1) {
                contextLines.push('项目尚未开始，可以从创建故事创意开始');
            }

        } catch (error) {
            console.warn('[AgentService] Failed to load project state for minimal context:', error);
            contextLines.push('无法加载项目状态，请使用查询工具获取信息');
        }

        contextLines.push('');
        contextLines.push('使用 query 工具搜索具体内容，使用 getJsondocContent 工具查看完整文档。');

        return contextLines.join('\n');
    }

    /**
     * Enhanced prompt with query guidance for particle-based search
     */
    private buildQueryGuidedPrompt(userRequest: string, minimalContext: string): string {
        return `你是一个专业的短剧剧本创作和编辑助手。你拥有智能查询工具来按需获取项目信息。

**用户请求：** "${userRequest}"

${minimalContext}

**你的工作流程：**

1. **分析用户请求** - 理解用户的真实意图和需要什么信息
2. **智能信息收集** - 使用 query 工具搜索相关信息
   - 例如：query("角色设定") 来查找人物信息
   - 例如：query("故事背景") 来了解设定信息
   - 例如：query("剧集结构") 来查看分集安排
3. **深入内容获取** - 使用 getJsondocContent 工具获取完整文档
4. **决策和执行** - 基于收集的信息选择合适的工具执行任务

**查询策略指导：**
- 对于编辑任务：先查询相关的现有内容
- 对于生成任务：查询所需的上游依赖信息
- 对于问答任务：查询用户询问的具体内容
- 可以进行多次查询来全面了解情况

**重要原则：**
- 根据查询结果中的 similarity 分数判断信息相关性
- similarity > 0.7: 高度相关，可直接使用
- similarity 0.4-0.7: 中等相关，需要进一步确认
- similarity < 0.4: 低相关，可能需要重新查询

**可用工具说明：**
- query: 语义搜索项目中的相关信息
- getJsondocContent: 获取指定文档的完整内容
- 其他创作工具会根据项目状态自动提供

开始分析用户请求，进行必要的信息查询，然后执行相应的工具。`;
    }

    /**
     * Generate user-friendly error messages based on error type and content
     */
    private generateUserFriendlyErrorMessage(error: any): string {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorString = String(error);

        // Content filtering errors
        if (errorMessage.includes('inappropriate content') ||
            errorMessage.includes('data_inspection_failed') ||
            errorString.includes('data_inspection_failed')) {
            return '抱歉，您的内容可能包含了不适宜的信息，无法处理。请尝试修改您的创意内容，避免使用可能被误判的词汇（如"街头霸王"等可能与暴力相关的词汇），然后重新提交。';
        }

        // API rate limiting
        if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
            return '请求过于频繁，请稍后再试。我们正在努力为您处理请求。';
        }

        // Network/connection errors
        if (errorMessage.includes('network') || errorMessage.includes('connection') ||
            errorMessage.includes('timeout') || errorMessage.includes('ECONNRESET')) {
            return '网络连接出现问题，请检查您的网络连接后重试。如果问题持续存在，请稍后再试。';
        }

        // Authentication errors
        if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized') ||
            errorMessage.includes('invalid token')) {
            return '身份验证失败，请刷新页面后重试。如果问题持续存在，请联系支持。';
        }

        // Model/API service errors
        if (errorMessage.includes('model') || errorMessage.includes('service unavailable') ||
            errorMessage.includes('internal server error')) {
            return 'AI服务暂时不可用，请稍后重试。我们正在努力恢复服务。';
        }

        // Quota/billing errors
        if (errorMessage.includes('quota') || errorMessage.includes('billing') ||
            errorMessage.includes('insufficient funds')) {
            return '服务配额已用完，请联系管理员或稍后重试。';
        }

        // Streaming/data processing errors
        if (errorMessage.includes('No data received from streaming') ||
            errorMessage.includes('stream') || errorMessage.includes('ReadableStream')) {
            return '数据流处理出现问题，请重试。如果问题持续存在，可能是服务器正在维护。';
        }

        // Schema validation errors
        if (errorMessage.includes('schema') || errorMessage.includes('validation') ||
            errorMessage.includes('parse')) {
            return '数据格式验证失败，请重试。如果问题持续存在，请联系技术支持。';
        }

        // Default fallback message
        return '抱歉，处理您的请求时遇到了问题。请重试，如果问题持续存在，请联系支持。';
    }

    /**
     * Check if request is a continuation and reconstruct conversation history
     */
    private async checkForContinuation(
        request: GeneralAgentRequest,
        projectId: string
    ): Promise<{ isContinuation: boolean; conversationHistory: Array<{ role: string; content: string }> }> {
        // Check if this is a continuation request (contains keywords like "continue", "next", or specific episode ranges)
        const userRequest = request.userRequest.toLowerCase();
        const isContinuation = userRequest.includes('continue') ||
            userRequest.includes('next') ||
            userRequest.includes('接下来') ||
            userRequest.includes('继续') ||
            /第\s*\d+\s*-\s*\d+\s*集/.test(userRequest); // Pattern like "第7-12集"

        if (!isContinuation || !this.chatMessageRepo) {
            return { isContinuation: false, conversationHistory: [] };
        }

        // For episode synopsis generation, try to reconstruct history
        const toolName = 'generate_episode_synopsis';
        const hasExisting = await this.chatMessageRepo.hasExistingConversation(projectId, toolName);

        if (!hasExisting) {
            return { isContinuation: false, conversationHistory: [] };
        }

        // Reconstruct conversation history with continuation parameters
        const continuationParams = {
            userRequest: request.userRequest,
            contextType: request.contextType,
            contextData: request.contextData
        };

        const conversationHistory = await this.chatMessageRepo.reconstructHistoryForAction(
            projectId,
            toolName,
            continuationParams
        );

        return { isContinuation: true, conversationHistory };
    }

    /**
     * Build multi-message prompt from conversation history
     */
    private buildMultiMessagePrompt(conversationHistory: Array<{ role: string; content: string }>): string {
        // Convert conversation history to a single prompt that preserves the conversation structure
        // This maintains compatibility with the existing streamText interface while enabling caching

        console.log(`[AgentService] Building continuation prompt from ${conversationHistory.length} previous messages`);

        const conversationText = conversationHistory.map((msg, index) => {
            const roleLabel = msg.role === 'user' ? '用户' :
                msg.role === 'assistant' ? '助手' :
                    msg.role === 'system' ? '系统' : '未知';

            // For system messages, add a marker to indicate it was the previous system prompt
            const prefix = msg.role === 'system' ? '[之前的系统提示]' : `[${roleLabel}]`;

            // Truncate very long messages for logging
            const contentPreview = msg.content.length > 200 ?
                msg.content.substring(0, 200) + '...' : msg.content;
            console.log(`[AgentService] Conversation history ${index + 1}: ${prefix} (${msg.content.length} chars): ${contentPreview}`);

            return `${prefix}: ${msg.content}`;
        }).join('\n\n');

        const continuationPrompt = `以下是之前的对话历史，请基于此上下文继续处理用户的新请求：

${conversationText}

请根据上述对话历史和最新的用户请求，继续执行相应的工具调用。`;

        console.log(`[AgentService] Final continuation prompt length: ${continuationPrompt.length} characters`);

        return continuationPrompt;
    }

    /**
     * Save conversation history after successful tool execution
     */
    private async saveConversationHistory(
        projectId: string,
        toolName: string,
        toolCallId: string,
        systemPromptSentToLLM: string,
        toolResult: any,
        assistantResponse: string
    ): Promise<void> {
        if (!this.chatMessageRepo) return;

        // Save the complete conversation that was sent to/from the LLM
        // This represents the actual conversation format: system prompt -> assistant response
        const messages = [
            { role: 'system', content: systemPromptSentToLLM }, // The complete system prompt sent to LLM
            { role: 'assistant', content: assistantResponse }   // The assistant's response
        ];

        await this.chatMessageRepo.saveConversation(projectId, toolName, toolCallId, messages);
    }

    /**
     * General agent method that can handle various types of requests including brainstorm editing
     */
    public async runGeneralAgent(
        projectId: string,
        userId: string,
        request: GeneralAgentRequest,
        options: {
            createChatMessages?: boolean;
            existingThinkingMessageId?: string;
            existingThinkingStartTime?: string;
            // Caching options for reproducible testing
            enableCaching?: boolean;
            seed?: number;
            temperature?: number;
            topP?: number;
            maxTokens?: number;
        } = { createChatMessages: true }
    ) {
        let computationMessageId: string | undefined;
        let responseMessageId: string | undefined;
        let accumulatedResponse = '';

        // Generate unique execution ID to correlate all messages in this agent run
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`[AgentService] Starting agent execution with ID: ${executionId}`);

        try {
            // Handle chat messages based on options
            if (options.createChatMessages && this.chatMessageRepo) {
                // Create user message event (only if not called from ChatService)
                await this.chatMessageRepo.createUserMessage(projectId, request.userRequest);

                // Create computation message for internal processing
                const computationMessage = await this.chatMessageRepo.createComputationMessage(
                    projectId,
                    this.generateComputationIndicator('thinking')
                );
                computationMessageId = computationMessage.id;

                // Note: Response message will be created when we have actual content
                responseMessageId = undefined;
            }

            // 1. Check for conversation continuation
            const { isContinuation, conversationHistory } = await this.checkForContinuation(request, projectId);

            // 2. Check if particle search is available for optimized context approach
            let useParticleSearchApproach = false;
            try {
                const particleSystem = getParticleSystem();
                if (particleSystem && particleSystem.unifiedSearch) {
                    // Check if particle system is healthy
                    const healthCheck = await particleSystem.unifiedSearch.healthCheck();
                    useParticleSearchApproach = healthCheck.particleCount > 0;
                    console.log(`[AgentService] Particle search approach ${useParticleSearchApproach ? 'enabled' : 'disabled'} (particles: ${healthCheck.particleCount})`);
                }
            } catch (error) {
                console.warn('[AgentService] Particle system health check failed:', error);
            }

            let agentConfig;
            let completePrompt;

            if (useParticleSearchApproach && !isContinuation) {
                // Use minimal context + particle search approach
                console.log('[AgentService] Using particle-search optimized approach');

                // Build minimal context
                const minimalContext = await this.buildMinimalContextForParticleSearch(projectId, this.jsondocRepo);

                // Build query-guided prompt
                completePrompt = this.buildQueryGuidedPrompt(request.userRequest, minimalContext);

                // Build agent configuration with minimal context
                agentConfig = await buildAgentConfiguration(
                    request,
                    projectId,
                    this.transformRepo,
                    this.jsondocRepo,
                    userId,
                    {
                        enableCaching: options.enableCaching,
                        seed: options.seed,
                        temperature: options.temperature,
                        topP: options.topP,
                        maxTokens: options.maxTokens
                    }
                );

                console.log(`[AgentService] Minimal context size: ${minimalContext.length} characters (vs traditional approach)`);
            } else {
                // Use traditional full context approach
                console.log('[AgentService] Using traditional full-context approach');

                // Build agent configuration using existing abstraction
                agentConfig = await buildAgentConfiguration(
                    request,
                    projectId,
                    this.transformRepo,
                    this.jsondocRepo,
                    userId,
                    {
                        enableCaching: options.enableCaching,
                        seed: options.seed,
                        temperature: options.temperature,
                        topP: options.topP,
                        maxTokens: options.maxTokens
                    }
                );

                // Use conversation history for continuation or regular prompt
                completePrompt = isContinuation && conversationHistory.length > 0
                    ? this.buildMultiMessagePrompt(conversationHistory)
                    : agentConfig.prompt;
            }

            const toolDefinitions = agentConfig.tools;

            console.log(`[AgentService] ${isContinuation ? 'Continuation' : 'New'} request detected`);
            if (isContinuation) {
                console.log(`[AgentService] Using conversation history with ${conversationHistory.length} messages`);
            }

            // Update computation message to show analysis phase
            if (computationMessageId && this.chatMessageRepo) {
                await this.chatMessageRepo.updateComputationMessage(
                    computationMessageId,
                    this.generateComputationIndicator('analyzing', request.userRequest)
                );
            }

            // 4. Save user request as raw message
            if (this.chatMessageRepo) {
                await this.chatMessageRepo.createRawMessage(
                    projectId,
                    'user',
                    request.userRequest,
                    { metadata: { source: 'streaming_agent', executionId } }
                );

                // Save the complete system prompt sent to the LLM
                await this.chatMessageRepo.createRawMessage(
                    projectId,
                    'system',
                    completePrompt,
                    {
                        metadata: {
                            source: 'streaming_agent',
                            executionId,
                            promptType: isContinuation ? 'continuation_prompt' : 'initial_prompt',
                            useParticleSearch: useParticleSearchApproach,
                            conversationHistoryLength: conversationHistory.length
                        }
                    }
                );
            }

            // 2. Run the streaming agent directly
            console.log('--- Starting Streaming Agent ---');

            // Create agent tools with context information
            const tools: Record<string, any> = {};
            const contextInfo = { projectId, userId };
            for (const toolDef of toolDefinitions) {
                tools[toolDef.name] = createAgentTool(toolDef, contextInfo);
            }

            // Extract caching options
            const {
                enableCaching = false,
                seed,
                temperature,
                topP,
                maxTokens
            } = options;

            const baseModel = await getLLMModel();

            // Create user context middleware to inject original user request into all LLM calls
            const userContextMiddleware = createUserContextMiddleware({
                originalUserRequest: request.userRequest,
                projectId,
                userId,
                timestamp: new Date().toISOString()
            });

            // Wrap model with middleware to ensure tools have access to original user context
            const enhancedModel = wrapLanguageModel({
                model: baseModel,
                middleware: userContextMiddleware
            });

            console.log('[AgentService] Using enhanced model with user context middleware');
            console.log('[AgentService] Original user request length:', request.userRequest.length);

            const result = await streamText({
                model: enhancedModel, // Use enhanced model instead of base model
                tools: tools,
                maxSteps: 25, // Allow more steps for complex editing workflows
                maxTokens: 32768,
                prompt: completePrompt,
                // Pass AI SDK options directly
                ...(seed && { seed }),
                ...(temperature && { temperature }),
                ...(topP && { topP }),
                // ...(maxTokens && { maxTokens })
            });

            console.log('\n\n--- Agent Stream & Final Output ---');
            let finalResponse = '';
            let currentToolCall: any = null;
            let toolCallCount = 0;
            let toolResultCount = 0;

            for await (const delta of result.fullStream) {
                switch (delta.type) {
                    case 'text-delta':
                        process.stdout.write(delta.textDelta);
                        accumulatedResponse += delta.textDelta;
                        finalResponse += delta.textDelta;

                        // Create response message on first content if not already created
                        if (!responseMessageId && options.createChatMessages && this.chatMessageRepo && accumulatedResponse.trim()) {
                            const responseMessage = await this.chatMessageRepo.createResponseMessage(projectId, accumulatedResponse);
                            responseMessageId = responseMessage.id;
                        }

                        // Try to parse JSON and update response message in real-time
                        if (responseMessageId && this.chatMessageRepo) {
                            const parseResult = await this.tryParseAgentJSON(accumulatedResponse);
                            if (parseResult.parsed && parseResult.humanReadableMessage) {
                                // Successfully parsed JSON, update with human readable message
                                await this.chatMessageRepo.updateResponseMessage(
                                    responseMessageId,
                                    parseResult.humanReadableMessage,
                                    'streaming'
                                );
                            } else {
                                // JSON not complete yet, show accumulated text
                                await this.chatMessageRepo.updateResponseMessage(
                                    responseMessageId,
                                    accumulatedResponse,
                                    'streaming'
                                );
                            }
                        }
                        break;

                    case 'tool-call':
                        console.log(`\n[Agent Action] Starting tool call to '${delta.toolName}' with ID '${delta.toolCallId}'`);
                        currentToolCall = delta;
                        toolCallCount++;

                        // Update computation message to show processing phase
                        if (computationMessageId && this.chatMessageRepo) {
                            await this.chatMessageRepo.updateComputationMessage(
                                computationMessageId,
                                this.generateComputationIndicator('processing', delta.toolName)
                            );
                        }

                        // Save tool call as raw message
                        if (this.chatMessageRepo && projectId) {
                            await this.chatMessageRepo.createRawMessage(
                                projectId,
                                'tool',
                                `Tool call: ${delta.toolName}`,
                                {
                                    toolName: delta.toolName,
                                    toolParameters: delta.args,
                                    metadata: {
                                        toolCallId: delta.toolCallId,
                                        source: 'streaming_agent',
                                        executionId
                                    }
                                }
                            );
                        }
                        break;

                    case 'tool-result':
                        console.log(`\n[Agent Action] Received result for tool call '${delta.toolCallId}'`);
                        toolResultCount++;

                        // Update computation message to show generation phase
                        if (computationMessageId && this.chatMessageRepo) {
                            await this.chatMessageRepo.updateComputationMessage(
                                computationMessageId,
                                this.generateComputationIndicator('generating', currentToolCall?.toolName)
                            );
                        }

                        // Save tool result as raw message
                        if (this.chatMessageRepo && projectId && currentToolCall) {
                            await this.chatMessageRepo.createRawMessage(
                                projectId,
                                'tool',
                                `Tool result: ${currentToolCall.toolName}`,
                                {
                                    toolName: currentToolCall.toolName,
                                    toolParameters: currentToolCall.args,
                                    toolResult: delta.result,
                                    metadata: {
                                        toolCallId: delta.toolCallId,
                                        source: 'streaming_agent',
                                        executionId
                                    }
                                }
                            );

                            // Save conversation history for episode synopsis tool
                            if (currentToolCall.toolName === 'generate_episode_synopsis') {
                                await this.saveConversationHistory(
                                    projectId,
                                    currentToolCall.toolName,
                                    delta.toolCallId,
                                    completePrompt, // The complete system prompt that was sent to the LLM
                                    delta.result,
                                    accumulatedResponse || 'Tool executed successfully'
                                );
                            }
                        }
                        break;

                    case 'step-finish':
                        console.log(`\n[Agent Step] Step completed with reason: ${delta.finishReason}`);
                        // These are completion events for agent reasoning/tool-calling steps
                        // They're informational and don't require specific handling
                        break;

                    case 'step-start':
                        console.log(`\n[Agent Step] Step started`);
                        // These are start events for agent reasoning/tool-calling steps
                        // They're informational and don't require specific handling
                        break;

                    case 'error':
                        console.log(`\n[Agent Error] Error occurred:`, (delta as any).error?.message || 'Unknown error');
                        // Error events during agent processing
                        // The error will be handled by the outer try-catch
                        break;

                    case 'finish':
                        console.log(`\n[Agent Finish] Agent completed with reason: ${delta.finishReason}`);
                        // Final completion event for the entire agent execution
                        // This is informational as the result is handled elsewhere
                        break;

                    default:
                        console.log(`[DEBUG] Unhandled delta type: ${delta.type}`, delta);
                        break;
                }
            }
            console.log('\n-----------------------------------');

            // Final processing of the response
            if (options.createChatMessages && this.chatMessageRepo) {
                // Create response message if it wasn't created during streaming (e.g., tool-only responses)
                if (!responseMessageId) {
                    const defaultMessage = toolCallCount > 0 ? '我已完成您的请求。' : '收到您的请求，正在处理中...';
                    const responseMessage = await this.chatMessageRepo.createResponseMessage(projectId, defaultMessage);
                    responseMessageId = responseMessage.id;
                }

                if (responseMessageId) {
                    // Try both accumulatedResponse and finalResponse
                    let finalParseResult = await this.tryParseAgentJSON(accumulatedResponse);
                    if (!finalParseResult.parsed && finalResponse !== accumulatedResponse) {
                        finalParseResult = await this.tryParseAgentJSON(finalResponse);
                    }

                    if (finalParseResult.parsed && finalParseResult.humanReadableMessage) {
                        // Successfully parsed JSON, use human readable message
                        await this.chatMessageRepo.updateResponseMessage(
                            responseMessageId,
                            finalParseResult.humanReadableMessage,
                            'completed'
                        );

                        // Add a small delay and force another update to ensure it's persisted
                        await new Promise(resolve => setTimeout(resolve, 100));
                        await this.chatMessageRepo.updateResponseMessage(
                            responseMessageId,
                            finalParseResult.humanReadableMessage,
                            'completed'
                        );
                    } else {
                        // JSON parsing failed, use accumulated text as fallback
                        const fallbackMessage = accumulatedResponse || finalResponse || (toolCallCount > 0 ? '我已完成您的请求。' : '收到您的请求。');
                        await this.chatMessageRepo.updateResponseMessage(
                            responseMessageId,
                            fallbackMessage,
                            'completed'
                        );
                    }
                }
            }

            // Complete computation message
            if (computationMessageId && this.chatMessageRepo) {
                await this.chatMessageRepo.updateComputationMessage(
                    computationMessageId,
                    this.generateComputationIndicator('completing'),
                    'completed'
                );
            }

            // Save final assistant response as raw message
            if (this.chatMessageRepo && projectId && finalResponse.trim()) {
                await this.chatMessageRepo.createRawMessage(
                    projectId,
                    'assistant',
                    finalResponse.trim(),
                    { metadata: { source: 'streaming_agent', executionId } }
                );
            }

            const finishReason = await result.finishReason;

            // Log summary using our tracked counts
            console.log(`\n--- Agent Execution Summary ---`);
            console.log(`Finish Reason: ${finishReason}`);
            console.log(`\nTool Calls Made: ${toolCallCount}`);
            console.log(`\nTool Results Received by Agent: ${toolResultCount}`);

            console.log(`[AgentService] General agent completed for project ${projectId}.`);

        } catch (error) {
            console.error("\n--- Agent Flow Failed ---");
            console.error(`[AgentService] General agent failed for project ${projectId}:`, error);

            // Generate user-friendly error message based on error type
            const userFriendlyMessage = this.generateUserFriendlyErrorMessage(error);

            // Update messages with error state
            if (computationMessageId && this.chatMessageRepo) {
                await this.chatMessageRepo.updateComputationMessage(
                    computationMessageId,
                    this.generateComputationIndicator('error'),
                    'failed'
                );
            }

            if (options.createChatMessages && this.chatMessageRepo) {
                // Create response message if it wasn't created yet
                if (!responseMessageId) {
                    const responseMessage = await this.chatMessageRepo.createResponseMessage(projectId, userFriendlyMessage);
                    responseMessageId = responseMessage.id;
                } else {
                    await this.chatMessageRepo.updateResponseMessage(
                        responseMessageId,
                        userFriendlyMessage,
                        'failed'
                    );
                }
            }

            // Save error as raw message
            if (this.chatMessageRepo && projectId) {
                await this.chatMessageRepo.createRawMessage(
                    projectId,
                    'assistant',
                    `Error: ${error instanceof Error ? error.message : String(error)}`,
                    { metadata: { source: 'streaming_agent', error: true, executionId } }
                );
            }

            throw error;
        }
    }

    /**
     * Health check for particle-based search capabilities
     */
    public async checkParticleSearchHealth(): Promise<{
        particleSystemAvailable: boolean;
        unifiedSearchAvailable: boolean;
        searchModes: {
            stringSearchAvailable: boolean;
            embeddingSearchAvailable: boolean;
        };
        particleCount: number;
    }> {
        try {
            const particleSystem = getParticleSystem();
            if (!particleSystem) {
                return {
                    particleSystemAvailable: false,
                    unifiedSearchAvailable: false,
                    searchModes: {
                        stringSearchAvailable: false,
                        embeddingSearchAvailable: false
                    },
                    particleCount: 0
                };
            }

            const healthCheck = await particleSystem.unifiedSearch.healthCheck();

            return {
                particleSystemAvailable: true,
                unifiedSearchAvailable: true,
                searchModes: {
                    stringSearchAvailable: healthCheck.stringSearchAvailable,
                    embeddingSearchAvailable: healthCheck.embeddingSearchAvailable
                },
                particleCount: healthCheck.particleCount
            };
        } catch (error) {
            console.error('[AgentService] Particle search health check failed:', error);
            return {
                particleSystemAvailable: false,
                unifiedSearchAvailable: false,
                searchModes: {
                    stringSearchAvailable: false,
                    embeddingSearchAvailable: false
                },
                particleCount: 0
            };
        }
    }
} 