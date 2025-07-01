import { z } from 'zod';
import { TransformRepository } from '../transform-artifact-framework/TransformRepository';
import { ArtifactRepository } from '../transform-artifact-framework/ArtifactRepository';
import { prepareAgentPromptContext } from '../../common/utils/agentContext';
import { createBrainstormToolDefinition, createBrainstormEditToolDefinition } from '../tools/BrainstormTools';
import { createOutlineSettingsToolDefinition } from '../tools/OutlineSettingsTool';
import { createChroniclesToolDefinition } from '../tools/ChroniclesTool';
import type { GeneralAgentRequest } from '../transform-artifact-framework/AgentService';
import type { StreamingToolDefinition } from '../transform-artifact-framework/StreamingAgentFramework';

// Simplified to just general type
export type RequestType = 'general';

// Interface for the complete agent configuration
export interface AgentConfiguration {
    requestType: RequestType;
    context: string;
    prompt: string;
    tools: StreamingToolDefinition<any, any>[];
}

/**
 * Builds context string for the request
 */
export async function buildContextForRequestType(
    projectId: string,
    artifactRepo: ArtifactRepository
): Promise<string> {
    // Get all project data for lineage resolution
    const artifacts = await artifactRepo.getAllProjectArtifactsForLineage(projectId);
    const transforms = await artifactRepo.getAllProjectTransformsForLineage(projectId);
    const humanTransforms = await artifactRepo.getAllProjectHumanTransformsForLineage(projectId);
    const transformInputs = await artifactRepo.getAllProjectTransformInputsForLineage(projectId);
    const transformOutputs = await artifactRepo.getAllProjectTransformOutputsForLineage(projectId);

    console.log(`[ContextBuilder] Building context for request type: general`);

    // Always provide full context
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

/**
 * Builds prompt with few-shot examples to guide tool selection
 */
export function buildPromptForRequestType(
    userRequest: string,
    context: string
): string {
    return `你是一个专业的AI助手，拥有专门的工具来帮助用户处理故事创意相关的请求。

**用户请求：** "${userRequest}"

**当前项目背景信息：**
${context}

**你的任务：**
1. 仔细分析用户请求，理解用户的真实意图
2. 根据以下示例选择最合适的工具来满足用户需求
3. 使用适当的参数调用相应工具
4. 完成后确认任务完成

**工具选择示例：**

**示例1：生成新的故事创意**
用户请求："为抖音平台生成3个现代甜宠故事创意"
→ 使用 generate_brainstorm_ideas 工具
→ 参数：platform="抖音", genre="现代甜宠", numberOfIdeas=3

**示例2：基于现有创意生成剧本框架**
用户请求："基于artifact ID abc123 的故事创意，生成详细的剧本框架"
→ 使用 generate_outline_settings 工具
→ 参数：sourceArtifactId="abc123"

**示例3：生成时序大纲**
用户请求："基于剧本框架创建60集的时序大纲"
→ 使用 generate_chronicles 工具
→ 参数：sourceArtifactId="设定artifact的ID", totalEpisodes=60

**示例4：编辑现有创意**
用户请求："修改第一个故事创意，增加悬疑元素"
→ 使用 edit_brainstorm_ideas 工具
→ 参数：sourceArtifactId="集合artifact的ID", ideaIndex=0, editRequirements="增加悬疑元素"

**重要提示：**
- 工具会处理结果的存储和流式传输，请不要尝试显示结果内容
- 仔细从用户请求中提取必要的参数
- 如果用户要求的创意数量未明确说明，默认为3个
- 确保选择最符合用户需求的工具

开始分析请求并调用最合适的工具。`;
}

/**
 * Builds all available tool definitions
 */
export function buildToolsForRequestType(
    transformRepo: TransformRepository,
    artifactRepo: ArtifactRepository,
    projectId: string,
    userId: string,
    cachingOptions?: {
        enableCaching?: boolean;
        seed?: number;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    }
): StreamingToolDefinition<any, any>[] {
    // Always provide all available tools
    return [
        createBrainstormToolDefinition(transformRepo, artifactRepo, projectId, userId, cachingOptions),
        createBrainstormEditToolDefinition(transformRepo, artifactRepo, projectId, userId, cachingOptions),
        createOutlineSettingsToolDefinition(transformRepo, artifactRepo, projectId, userId, cachingOptions),
        createChroniclesToolDefinition(transformRepo, artifactRepo, projectId, userId, cachingOptions)
    ];
}

/**
 * Main function to build complete agent configuration based on user request
 */
export async function buildAgentConfiguration(
    request: GeneralAgentRequest,
    projectId: string,
    transformRepo: TransformRepository,
    artifactRepo: ArtifactRepository,
    userId: string,
    cachingOptions?: {
        enableCaching?: boolean;
        seed?: number;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    }
): Promise<AgentConfiguration> {
    console.log(`[AgentConfigBuilder] Starting configuration build for request: "${request.userRequest}"`);

    const requestType: RequestType = 'general';
    console.log(`[AgentConfigBuilder] Using request type: ${requestType}`);

    // Build context
    const context = await buildContextForRequestType(projectId, artifactRepo);
    console.log(`[AgentConfigBuilder] Built context (${context.length} chars): ${context.substring(0, 100)}...`);

    // Build prompt with few-shot examples
    const prompt = buildPromptForRequestType(request.userRequest, context);
    console.log(`[AgentConfigBuilder] Built prompt (${prompt.length} chars)`);

    // Build all available tools
    const tools = buildToolsForRequestType(transformRepo, artifactRepo, projectId, userId, cachingOptions);
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