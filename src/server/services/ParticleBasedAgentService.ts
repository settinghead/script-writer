import { streamText, wrapLanguageModel } from 'ai';
import type { GeneralAgentRequest } from '../transform-jsondoc-framework/AgentService';
import type { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import type { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';
import { createAgentTool } from '../transform-jsondoc-framework/StreamingAgentFramework';
import { UnifiedParticleSearch } from './UnifiedParticleSearch';
import { createQueryToolDefinition } from '../tools/QueryTool';
import { createGetJsondocContentToolDefinition } from '../tools/GetJsondocContentTool';
import { getLLMModel } from '../transform-jsondoc-framework/LLMConfig';
import { createUserContextMiddleware } from '../middleware/UserContextMiddleware';
import { getParticleSystem } from './ParticleSystemInitializer';

/**
 * Minimal context that provides only workflow state overview
 */
async function buildMinimalContext(
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
        console.warn('[ParticleBasedAgentService] Failed to load project state:', error);
        contextLines.push('无法加载项目状态，请使用查询工具获取信息');
    }

    contextLines.push('');
    contextLines.push('使用 query 工具搜索具体内容，使用 getJsondocContent 工具查看完整文档。');

    return contextLines.join('\n');
}

/**
 * Enhanced prompt with query guidance for the particle-based agent
 */
function buildQueryGuidedPrompt(userRequest: string, minimalContext: string): string {
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
 * Build tools for the particle-based agent
 */
async function buildParticleBasedTools(
    projectId: string,
    userId: string,
    transformRepo: TransformRepository,
    jsondocRepo: JsondocRepository,
    unifiedSearch: UnifiedParticleSearch
): Promise<StreamingToolDefinition<any, any>[]> {
    const tools: StreamingToolDefinition<any, any>[] = [];

    // Add query and getJsondocContent tools first
    tools.push(createQueryToolDefinition(unifiedSearch, projectId, userId));
    tools.push(createGetJsondocContentToolDefinition(jsondocRepo, projectId, userId));

    // TODO: Add other existing tools here based on project state
    // For now, we'll focus on the query-based approach

    console.log(`[ParticleBasedAgentService] Built ${tools.length} tools for particle-based agent`);
    return tools;
}

/**
 * Run the particle-based general agent with minimal context and intelligent queries
 */
export async function runParticleBasedGeneralAgent(
    request: GeneralAgentRequest,
    projectId: string,
    transformRepo: TransformRepository,
    jsondocRepo: JsondocRepository,
    userId: string,
    options: {
        createChatMessages?: boolean;
        existingThinkingMessageId?: string;
        existingThinkingStartTime?: string;
        enableCaching?: boolean;
        seed?: number;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    } = { createChatMessages: true }
) {
    console.log(`[ParticleBasedAgentService] Starting particle-based agent for project: ${projectId}`);
    console.log(`[ParticleBasedAgentService] User request: "${request.userRequest}"`);

    try {
        // Get particle system with unified search
        const particleSystem = getParticleSystem();
        if (!particleSystem) {
            throw new Error('Particle system not available');
        }

        // Build minimal context - just project metadata and workflow state
        const minimalContext = await buildMinimalContext(projectId, jsondocRepo);

        // Build enhanced prompt with query guidance
        const prompt = buildQueryGuidedPrompt(request.userRequest, minimalContext);

        // Build tools including query and getJsondocContent
        const toolDefinitions = await buildParticleBasedTools(
            projectId,
            userId,
            transformRepo,
            jsondocRepo,
            particleSystem.unifiedSearch
        );

        console.log(`[ParticleBasedAgentService] Agent configuration built with ${toolDefinitions.length} tools`);
        console.log(`[ParticleBasedAgentService] Context size: ${minimalContext.length} characters`);

        // Create agent tools with context information
        const tools: Record<string, any> = {};
        const contextInfo = { projectId, userId };
        for (const toolDef of toolDefinitions) {
            tools[toolDef.name] = createAgentTool(toolDef, contextInfo);
        }

        // Get base model
        const baseModel = await getLLMModel();

        // Create user context middleware
        const userContextMiddleware = createUserContextMiddleware({
            originalUserRequest: request.userRequest,
            projectId,
            userId,
            timestamp: new Date().toISOString()
        });

        // Wrap model with middleware
        const enhancedModel = wrapLanguageModel({
            model: baseModel,
            middleware: userContextMiddleware
        });

        console.log('[ParticleBasedAgentService] Using enhanced model with user context middleware');
        console.log('[ParticleBasedAgentService] Original user request length:', request.userRequest.length);

        // Execute the agent with streaming
        const result = await streamText({
            model: enhancedModel,
            tools: tools,
            maxSteps: 25, // Allow multiple query iterations
            prompt: prompt,
            // Pass AI SDK options directly
            ...(options.seed && { seed: options.seed }),
            ...(options.temperature && { temperature: options.temperature }),
            ...(options.topP && { topP: options.topP }),
            ...(options.maxTokens && { maxTokens: options.maxTokens })
        });

        console.log('\n\n--- Particle-Based Agent Stream & Final Output ---');
        let finalResponse = '';
        let toolCallCount = 0;
        let toolResultCount = 0;

        for await (const delta of result.fullStream) {
            switch (delta.type) {
                case 'text-delta':
                    process.stdout.write(delta.textDelta);
                    finalResponse += delta.textDelta;
                    break;

                case 'tool-call':
                    toolCallCount++;
                    console.log(`\n[Particle Agent Action] Starting tool call to '${delta.toolName}' with ID '${delta.toolCallId}'`);
                    break;

                case 'tool-result':
                    toolResultCount++;
                    console.log(`\n[Particle Agent Action] Received result for tool call '${delta.toolCallId}'`);
                    break;

                case 'finish':
                    console.log('\n-----------------------------------');
                    break;
            }
        }

        const finishReason = await result.finishReason;

        // Log summary
        console.log(`\n--- Particle-Based Agent Execution Summary ---`);
        console.log(`Finish Reason: ${finishReason}`);
        console.log(`Tool Calls Made: ${toolCallCount}`);
        console.log(`Tool Results Received: ${toolResultCount}`);
        console.log(`Context Size: ${minimalContext.length} characters (vs traditional 10,000+)`);

        console.log(`[ParticleBasedAgentService] Particle-based agent completed for project ${projectId}.`);

        return {
            finalResponse,
            toolCallCount,
            toolResultCount,
            contextSize: minimalContext.length,
            finishReason
        };

    } catch (error) {
        console.error(`[ParticleBasedAgentService] Particle-based agent failed for project ${projectId}:`, error);
        throw error;
    }
}

/**
 * Health check for particle-based agent system
 */
export async function checkParticleBasedAgentHealth(): Promise<{
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
        console.error('[ParticleBasedAgentService] Health check failed:', error);
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