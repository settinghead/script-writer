import { z } from 'zod';
import { TransformRepository } from '../transform-artifact-framework/TransformRepository';
import { ArtifactRepository } from '../transform-artifact-framework/ArtifactRepository';
import { prepareAgentPromptContext } from '../../common/utils/agentContext';
import { createBrainstormToolDefinition, createBrainstormEditToolDefinition } from '../tools/BrainstormTools';
import { createOutlineSettingsToolDefinition } from '../tools/OutlineSettingsTool';
import { createChroniclesToolDefinition } from '../tools/ChroniclesTool';
import type { GeneralAgentRequest } from '../transform-artifact-framework/AgentService';
import type { StreamingToolDefinition } from '../transform-artifact-framework/StreamingAgentFramework';

// Updated request types - removed outline_generation
export type RequestType = 'brainstorm_generation' | 'outline_settings_generation' | 'chronicles_generation' | 'general';

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

    // Outline settings generation keywords (NEW)
    const outlineSettingsKeywords = ['剧本设定', '故事设定', '角色设定', '背景设定', 'outline settings', 'script settings'];
    const outlineSettingsPatterns = [
        '生成剧本设定', '创建剧本设定', '生成故事设定', '创建故事设定',
        '角色设定', '背景设定', '基础设定',
        'generate outline settings', 'create script settings'
    ];

    // Chronicles generation keywords (NEW)
    const chroniclesKeywords = ['时序大纲', '时序发展', '故事时序', '时间线', 'chronicles', '时序阶段'];
    const chroniclesPatterns = [
        '生成时序大纲', '创建时序大纲', '时序发展', '时间线生成',
        '基于剧本设定', '基于设定生成',
        'generate chronicles', 'create chronicles'
    ];

    // Check for outline settings generation first (most specific)
    const hasOutlineSettingsPattern = outlineSettingsPatterns.some(pattern => request.includes(pattern));
    const hasOutlineSettingsKeyword = outlineSettingsKeywords.some(keyword => request.includes(keyword));

    if (hasOutlineSettingsPattern || hasOutlineSettingsKeyword) {
        console.log(`[RequestAnalysis] -> outline_settings_generation (pattern: ${hasOutlineSettingsPattern}, keywords: ${hasOutlineSettingsKeyword})`);
        return 'outline_settings_generation';
    }

    // Check for chronicles generation second (specific)
    const hasChroniclesPattern = chroniclesPatterns.some(pattern => request.includes(pattern));
    const hasChroniclesKeyword = chroniclesKeywords.some(keyword => request.includes(keyword));

    if (hasChroniclesPattern || hasChroniclesKeyword) {
        console.log(`[RequestAnalysis] -> chronicles_generation (pattern: ${hasChroniclesPattern}, keywords: ${hasChroniclesKeyword})`);
        return 'chronicles_generation';
    }

    // Removed old outline generation logic

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

        case 'outline_settings_generation':
            // For outline settings generation, provide brainstorm context but focus on settings needs
            const brainstormSettingsContext = prepareAgentPromptContext({
                artifacts,
                transforms,
                humanTransforms,
                transformInputs,
                transformOutputs
            });
            const settingsContext = `${brainstormSettingsContext}\n\n***准备进行剧本设定创建阶段***\n请基于现有故事创意来创建详细的剧本设定（角色、背景、商业定位等），为后续时序大纲奠定基础。`;
            console.log(`[ContextBuilder] Returning outline settings context: ${settingsContext.substring(0, 100)}...`);
            return settingsContext;

        case 'chronicles_generation':
            // For chronicles generation, provide outline settings context for time-based development
            const chroniclesFullContext = prepareAgentPromptContext({
                artifacts,
                transforms,
                humanTransforms,
                transformInputs,
                transformOutputs
            });
            const chroniclesContext = `${chroniclesFullContext}\n\n***准备进行时序大纲创建阶段***\n请基于已确定的剧本设定来创建时序大纲，按时间顺序梳理整个故事发展。`;
            console.log(`[ContextBuilder] Returning chronicles context: ${chroniclesContext.substring(0, 100)}...`);
            return chroniclesContext;

        // Removed outline_generation case

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
1. 分析用户的头脑风暴需求（平台、类型、要求、创意数量等）
2. 从用户请求中提取创意数量（如果用户没有明确说明，默认为3个）
3. 使用brainstorm工具生成符合要求的故事创意
4. 确保生成的创意符合用户指定的平台特点和类型要求
5. 完成后确认任务完成

**参数提取指导：**
- 平台：从用户请求中识别目标平台（如抖音、快手、小红书等）
- 故事类型：提取故事类型或题材（如甜宠、霸总、复仇等）
- 创意数量：提取用户要求的创意数量（1-4个），如"生成3个"、"给我2个创意"等
- 其他要求：提取额外的特殊要求

**重要提示：** 专注于生成新的创意故事想法，工具会处理结果的存储和展示。

开始分析请求并生成故事创意。`;

        case 'outline_settings_generation':
            return `${basePrompt}

**你的任务：**
1. 基于现有的故事创意，创建详细的剧本设定
2. 分析角色背景、故事世界、商业定位和核心卖点
3. 使用outline_settings工具生成完整的剧本设定
4. 确保设定符合短剧制作的要求和去脸谱化原则
5. 完成后确认任务完成

**重要提示：** 当前是剧本设定创建阶段，需要将故事创意转化为详细的基础设定，为后续时序大纲奠定基础。

开始分析现有创意并创建剧本设定。`;

        case 'chronicles_generation':
            return `${basePrompt}

**你的任务：**
1. 基于已确定的剧本设定，创建时序大纲
2. 按时间顺序分析故事发展阶段，包括历史背景事件
3. 使用chronicles工具生成完整的时序发展
4. 确保时序符合逻辑性和短剧节奏要求
5. 完成后确认任务完成

**重要提示：** 当前是时序大纲创建阶段，需要基于剧本设定来创建按时间顺序的故事发展脉络。

开始分析现有设定并创建时序大纲。`;

        // Removed outline_generation case

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
- 对于brainstorm工具：从用户请求中提取创意数量（1-4个），如"生成3个"、"给我2个创意"等，如果用户没有明确说明，默认为3个

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
    userId: string,
    cachingOptions?: {
        enableCaching?: boolean;
        seed?: number;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    }
): StreamingToolDefinition<any, any>[] {
    switch (requestType) {
        case 'brainstorm_generation':
            // Only provide brainstorm generation tool
            return [
                createBrainstormToolDefinition(transformRepo, artifactRepo, projectId, userId, cachingOptions)
            ];

        case 'outline_settings_generation':
            // Provide outline settings generation tool and edit tools
            return [
                createOutlineSettingsToolDefinition(transformRepo, artifactRepo, projectId, userId, cachingOptions),
                createBrainstormEditToolDefinition(transformRepo, artifactRepo, projectId, userId, cachingOptions)
            ];

        case 'chronicles_generation':
            // Provide chronicles generation tool
            return [
                createChroniclesToolDefinition(transformRepo, artifactRepo, projectId, userId, cachingOptions)
            ];

        // Removed outline_generation case

        case 'general':
        default:
            // Provide all available tools for general requests
            return [
                createBrainstormToolDefinition(transformRepo, artifactRepo, projectId, userId, cachingOptions),
                createBrainstormEditToolDefinition(transformRepo, artifactRepo, projectId, userId, cachingOptions),
                // Removed createOutlineToolDefinition
                createOutlineSettingsToolDefinition(transformRepo, artifactRepo, projectId, userId, cachingOptions),
                createChroniclesToolDefinition(transformRepo, artifactRepo, projectId, userId, cachingOptions)
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
    const tools = buildToolsForRequestType(requestType, transformRepo, artifactRepo, projectId, userId, cachingOptions);
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