import { z } from 'zod';
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { prepareAgentPromptContext } from '../../common/utils/agentContext';
import { createBrainstormToolDefinition, createBrainstormEditToolDefinition } from '../tools/BrainstormTool';
import type { GeneralAgentRequest } from './AgentService';
import type { StreamingToolDefinition } from './StreamingAgentFramework';

// Request type enumeration
export type RequestType = 'brainstorm_generation' | 'outline_generation' | 'general';

// Interface for the complete agent configuration
export interface AgentConfiguration {
    requestType: RequestType;
    context: string;
    prompt: string;
    tools: StreamingToolDefinition<any, any>[];
}

/**
 * Analyzes user request to determine the appropriate request type
 */
export function analyzeRequestType(userRequest: string): RequestType {
    const request = userRequest.toLowerCase();

    // Simple keyword-based matching for now
    // Brainstorm generation keywords
    const brainstormKeywords = ['故事', '创意', '想法', '头脑风暴', 'story', 'idea', 'brainstorm'];
    const generationKeywords = ['生成', '创建', '产生', 'generate', 'create'];

    // Outline generation keywords
    const outlineKeywords = ['大纲', 'outline', '提纲', '结构'];

    // Check for brainstorm generation
    const hasBrainstormKeyword = brainstormKeywords.some(keyword => request.includes(keyword));
    const hasGenerationKeyword = generationKeywords.some(keyword => request.includes(keyword));

    console.log(`[RequestAnalysis] User request: "${userRequest}"`);
    console.log(`[RequestAnalysis] Lowercase: "${request}"`);
    console.log(`[RequestAnalysis] Has brainstorm keyword: ${hasBrainstormKeyword}`);
    console.log(`[RequestAnalysis] Has generation keyword: ${hasGenerationKeyword}`);

    if (hasBrainstormKeyword && hasGenerationKeyword) {
        console.log(`[RequestAnalysis] -> brainstorm_generation`);
        return 'brainstorm_generation';
    }

    // Check for outline generation
    const hasOutlineKeyword = outlineKeywords.some(keyword => request.includes(keyword));
    if (hasOutlineKeyword && hasGenerationKeyword) {
        console.log(`[RequestAnalysis] -> outline_generation`);
        return 'outline_generation';
    }

    // Default to general for everything else (including edits)
    console.log(`[RequestAnalysis] -> general (fallback)`);
    return 'general';
}

/**
 * Builds context string based on request type
 */
export async function buildContextForRequestType(
    requestType: RequestType,
    projectId: string,
    artifactRepo: ArtifactRepository
): Promise<string> {
    // Get all project data for lineage resolution
    const artifacts = await artifactRepo.getAllProjectArtifactsForLineage(projectId);
    const transforms = await artifactRepo.getAllProjectTransformsForLineage(projectId);
    const humanTransforms = await artifactRepo.getAllProjectHumanTransformsForLineage(projectId);
    const transformInputs = await artifactRepo.getAllProjectTransformInputsForLineage(projectId);
    const transformOutputs = await artifactRepo.getAllProjectTransformOutputsForLineage(projectId);

    console.log(`[ContextBuilder] Building context for request type: ${requestType}`);

    switch (requestType) {
        case 'brainstorm_generation':
            // For brainstorm generation, provide minimal context since user wants new ideas
            const minimalContext = '当前项目正在进行头脑风暴阶段，准备生成新的故事创意。';
            console.log(`[ContextBuilder] Returning minimal context: ${minimalContext}`);
            return minimalContext;

        case 'outline_generation':
            // For outline generation, provide brainstorm context but focus on outline needs
            const brainstormContext = prepareAgentPromptContext({
                artifacts,
                transforms,
                humanTransforms,
                transformInputs,
                transformOutputs
            });
            const outlineContext = `${brainstormContext}\n\n***准备进行大纲创建阶段***\n请基于现有故事创意来创建详细的大纲结构。`;
            console.log(`[ContextBuilder] Returning outline context: ${outlineContext.substring(0, 100)}...`);
            return outlineContext;

        case 'general':
        default:
            // For general requests (including edits), provide full context with current ideas
            const fullContext = prepareAgentPromptContext({
                artifacts,
                transforms,
                humanTransforms,
                transformInputs,
                transformOutputs
            });
            console.log(`[ContextBuilder] Returning full context: ${fullContext.substring(0, 100)}...`);
            return fullContext;
    }
}

/**
 * Builds prompt based on request type and context
 */
export function buildPromptForRequestType(
    requestType: RequestType,
    userRequest: string,
    context: string
): string {
    const basePrompt = `你是一个专业的AI助手，拥有专门的工具来帮助用户处理故事创意相关的请求。

**用户请求：** "${userRequest}"

**当前项目背景信息：**
${context}`;

    switch (requestType) {
        case 'brainstorm_generation':
            return `${basePrompt}

**你的任务：**
1. 分析用户的头脑风暴需求（平台、类型、要求等）
2. 使用brainstorm工具生成符合要求的故事创意
3. 确保生成的创意符合用户指定的平台特点和类型要求
4. 完成后确认任务完成

**重要提示：** 专注于生成新的创意故事想法，工具会处理结果的存储和展示。

开始分析请求并生成故事创意。`;

        case 'outline_generation':
            return `${basePrompt}

**你的任务：**
1. 基于现有的故事创意，创建详细的剧集大纲
2. 分析故事结构、角色发展和情节安排
3. 使用outline工具生成完整的大纲结构
4. 确保大纲符合短剧制作的要求
5. 完成后确认任务完成

**重要提示：** 当前是大纲创建阶段，需要将故事创意转化为可执行的剧集结构。

开始分析现有创意并创建大纲。`;

        case 'general':
        default:
            return `${basePrompt}

**你的任务：**
1. 仔细分析用户请求
2. 确定哪个工具最适合满足用户需求
3. 根据工具的参数要求从用户请求中提取必要参数
4. 使用适当的参数调用相应工具
5. 工具将执行并存储结果，你需要确认任务完成
6. 完成后在新行写上"任务完成"

**分析指导：**
- 仔细理解用户的真实意图和需求
- 如果用户要求修改的对象不明确或涵盖多个对象，请将每个对象逐个编辑
- 编辑时要准确理解用户的修改要求，并在editingInstructions中详细说明
- 确保选择最符合用户需求的工具和参数

**重要提示：** 工具会处理结果的存储和流式传输，请不要尝试显示结果内容。

开始分析请求并调用最合适的工具。`;
    }
}

/**
 * Builds tool definitions based on request type
 */
export function buildToolsForRequestType(
    requestType: RequestType,
    transformRepo: TransformRepository,
    artifactRepo: ArtifactRepository,
    projectId: string,
    userId: string
): StreamingToolDefinition<any, any>[] {
    switch (requestType) {
        case 'brainstorm_generation':
            // Only provide brainstorm generation tool
            return [
                createBrainstormToolDefinition(transformRepo, artifactRepo, projectId, userId)
            ];

        case 'outline_generation':
            // TODO: Add outline generation tool when it's implemented
            // For now, provide a mock or fallback to general tools
            return [
                createBrainstormToolDefinition(transformRepo, artifactRepo, projectId, userId),
                createBrainstormEditToolDefinition(transformRepo, artifactRepo, projectId, userId)
            ];

        case 'general':
        default:
            // Provide all available tools for general requests
            return [
                createBrainstormToolDefinition(transformRepo, artifactRepo, projectId, userId),
                createBrainstormEditToolDefinition(transformRepo, artifactRepo, projectId, userId)
            ];
    }
}

/**
 * Main function to build complete agent configuration based on user request
 */
export async function buildAgentConfiguration(
    request: GeneralAgentRequest,
    projectId: string,
    transformRepo: TransformRepository,
    artifactRepo: ArtifactRepository,
    userId: string
): Promise<AgentConfiguration> {
    console.log(`[AgentConfigBuilder] Starting configuration build for request: "${request.userRequest}"`);

    // 1. Analyze request type
    const requestType = analyzeRequestType(request.userRequest);
    console.log(`[AgentConfigBuilder] Detected request type: ${requestType}`);

    // 2. Build context for this request type
    const context = await buildContextForRequestType(requestType, projectId, artifactRepo);
    console.log(`[AgentConfigBuilder] Built context (${context.length} chars): ${context.substring(0, 100)}...`);

    // 3. Build prompt for this request type
    const prompt = buildPromptForRequestType(requestType, request.userRequest, context);
    console.log(`[AgentConfigBuilder] Built prompt (${prompt.length} chars)`);

    // 4. Build tools for this request type
    const tools = buildToolsForRequestType(requestType, transformRepo, artifactRepo, projectId, userId);
    console.log(`[AgentConfigBuilder] Built ${tools.length} tools for request type`);

    const config = {
        requestType,
        context,
        prompt,
        tools
    };

    console.log(`[AgentConfigBuilder] Final config requestType: ${config.requestType}`);
    return config;
} 