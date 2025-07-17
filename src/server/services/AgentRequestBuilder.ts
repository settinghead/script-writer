import { z } from 'zod';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { prepareAgentPromptContext } from '../../common/utils/agentContext';
import { createBrainstormToolDefinition, createBrainstormEditToolDefinition } from '../tools/BrainstormTools';
import { createOutlineSettingsToolDefinition, createOutlineSettingsEditToolDefinition } from '../tools/OutlineSettingsTool';
import { createChroniclesToolDefinition, createChroniclesEditToolDefinition } from '../tools/ChroniclesTool';
import { createEpisodePlanningToolDefinition } from '../tools/EpisodePlanningTool';
import type { GeneralAgentRequest } from '../transform-jsondoc-framework/AgentService';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';

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
    jsondocRepo: JsondocRepository
): Promise<string> {
    // Get all project data for lineage resolution
    const jsondocs = await jsondocRepo.getAllProjectJsondocsForLineage(projectId);
    const transforms = await jsondocRepo.getAllProjectTransformsForLineage(projectId);
    const humanTransforms = await jsondocRepo.getAllProjectHumanTransformsForLineage(projectId);
    const transformInputs = await jsondocRepo.getAllProjectTransformInputsForLineage(projectId);
    const transformOutputs = await jsondocRepo.getAllProjectTransformOutputsForLineage(projectId);

    console.log(`[ContextBuilder] Building context for request type: general`);

    // Always provide full context
    const fullContext = await prepareAgentPromptContext({
        jsondocs,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    }, projectId);
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
    return `你是一个专业的AI短剧剧本创作和编辑助手，拥有专门的工具来帮助用户处理短剧剧本创作和编辑的请求。

**用户请求：** "${userRequest}"

===当前项目背景信息 开始===
当前项目上下文以YAML格式提供，包括最新相关内容的完整数据：
${context}
===当前项目背景信息 结束===

===你的任务 开始===

===创作流程 开始===
我们的创作流程遵循以下顺序：
1. 头脑风暴输入 (brainstorm_input)：用户提供创意参数
2. 故事创意生成 (brainstorm_idea)：AI生成多个故事想法
3. 创意选择与编辑：用户选择并修改创意
4. 剧本框架生成 (outline_settings)：基于选定创意生成人物、背景、商业设定
5. 时间顺序大纲生成 (chronicles)：创建故事时序结构
6. 剧集规划生成 (episode_planning)：基于时间顺序大纲创建优化的分集结构
7. 分集与剧本生成：后续详细内容创作

对于多步修改，始终遵循此顺序：先编辑上游内容（如创意），然后编辑依赖的下游内容（如框架）。
===创作流程 结束===

1. 仔细分析用户请求，理解用户的真实意图。考虑请求是否模糊或复杂，可能需要修改多个部分。
2. 审视YAML上下文，识别最新 brainstorm_input, chosen_idea, outline_settings, chronicles, episode_planning 等内容。
3. 如果请求涉及修改现有内容，优先使用编辑工具（edit_*）来更新最新版本，而非生成新内容。
4. 如果请求复杂，需要修改多个组件（如想法和大纲），则按逻辑顺序调用多个工具（上游先，下游后）。
5. **对于后续阶段的生成或编辑**：
   - 始终包含相关的上游canonical jsondocs作为参考材料
   - 例如：生成剧集规划时包含 chronicles、brainstorm_idea、outline_settings
   - 例如：编辑时间顺序大纲时包含相关的 outline_settings 和 brainstorm_idea
   - 这确保每个阶段都基于完整的上下文信息，保持整个创作流程的一致性
6. 选择最合适的工具（或工具序列）来满足需求。
7. 执行所有必要的工具调用。
8. 所有步骤完成后，返回JSON格式的最终响应。
===你的任务 结束===

===工具选择示例 开始===
示例1：生成新的故事创意
用户请求："基于头脑风暴参数生成故事创意"
→ 使用 generate_brainstorm_ideas 工具
→ 参数：otherRequirements="其他要求"

示例2：基于现有创意生成剧本框架
用户请求："基于故事创意，生成详细的剧本框架"
→ 使用 generate_outline_settings 工具
→ 参数：title="故事标题", requirements="具体要求"

示例3：生成时间顺序大纲
用户请求："基于剧本框架创建60集的时间顺序大纲"
→ 使用 generate_chronicles 工具
→ 参数：totalEpisodes=60

示例4：生成剧集规划
用户请求："基于时间顺序大纲生成12集的剧集规划"
→ 使用 generate_episode_planning 工具
→ 参数：numberOfEpisodes=12

示例5：编辑现有创意
用户请求："修改第一个故事创意，增加悬疑元素"
→ 使用 edit_brainstorm_idea 工具
→ 参数：ideaIndex=0, editRequirements="增加悬疑元素"

示例6：编辑剧本框架
用户请求："修改剧本框架中的角色设定，增加反派角色"
→ 使用 edit_outline_settings 工具
→ 参数：editRequirements="增加反派角色"

示例7：编辑时间顺序大纲
用户请求："修改时间顺序大纲，加入更多南京本地元素"
→ 使用 edit_chronicles 工具
→ 参数：editRequirements="加入更多南京本地元素，包括文化，南京话，等等"

示例8：复杂请求 - 修改想法并更新大纲
用户请求："在故事中加入童话元素"
→ 第一步：使用 edit_brainstorm_idea 编辑想法，添加童话元素
→ 参数：editRequirements="添加童话元素"
→ 第二步：使用 edit_outline_settings 更新大纲，整合新元素
→ 参数：editRequirements="基于更新后的创意整合童话元素到大纲中"
→ 完成后返回JSON总结

示例9：多步编辑 - 修改剧本框架后更新时间顺序大纲
用户请求："减少作品的伦理争议，加入更多正面元素"
→ 第一步 使用 edit_brainstorm_idea 编辑想法，减少伦理争议
→ 参数：editRequirements="减少伦理争议，加入更多正面元素"
→ 第二步 使用 edit_outline_settings 编辑剧本框架，基于新的想法
→ 参数：editRequirements="基于更新后的创意整合正面元素到框架中"
→ 第三步 使用 edit_chronicles 更新时间顺序大纲，基于新的框架设定
→ 参数：editRequirements="基于更新后的框架设定调整时间顺序大纲，确保内容一致性"
→ 完成后返回JSON总结

**重要：所有工具都会自动接收相关的上下文jsondocs作为参考资料。在多步工具调用中，后续工具会自动包含前面工具调用的输出jsondocId，确保基于最新数据进行处理。**
===工具选择示例 结束===

===重要提示 开始===
- 上下文是YAML格式，包含完整数据 - 仔细阅读以了解当前状态。
- 对于修改请求，始终使用编辑工具更新现有最新内容。
- 如果需要多个更改，按依赖顺序调用工具（例如，先编辑想法，再编辑依赖于它的内容）。
- **多步工具调用的关键规则：当你在同一个请求中调用多个工具时，后续工具会自动获取前面工具调用的输出作为上下文。这确保后续编辑基于最新的数据，而不是过时的内容。系统会自动处理jsondoc引用和依赖关系。**
- 工具会处理结果的存储和流式传输，请不要尝试显示结果内容。
- 仔细从用户请求和上下文中提取必要的参数。
- 如果用户要求的创意数量未明确说明，默认为3个。
- 确保选择最符合用户需求的工具或工具序列。
- 所有工具都会自动接收相关的上下文jsondocs作为参考资料，无需手动指定。
===重要提示 结束===

===工作流程要求 开始===
**重要：你必须按照以下顺序完成任务：**

1. **首先：分析用户请求和上下文，确定需要的工具调用序列（可能多个）。**
2. **然后：按顺序调用所有必要的工具。**
3. **最后：所有工具调用完成后，返回JSON格式的响应。**

**你的回复的JSON格式要求：**
{
  "humanReadableMessage": "对用户友好的中文回复消息，说明你完成了什么任务。不要暴露任何工具调用的细节。"
}


**注意：对于简单请求，可能只需一个工具调用；对于复杂请求，进行多个调用。始终在所有操作完成后返回JSON。**

===工作流程要求 结束===

现在，请开始分析请求、审视上下文，并执行必要的工具调用序列，在每个中间和最后步骤输出JSON格式响应。`;
}

/**
 * Builds all available tool definitions
 */
export function buildToolsForRequestType(
    transformRepo: TransformRepository,
    jsondocRepo: JsondocRepository,
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
        createBrainstormToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions),
        createBrainstormEditToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions),
        createOutlineSettingsToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions),
        createOutlineSettingsEditToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions),
        createChroniclesToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions),
        createChroniclesEditToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions),
        createEpisodePlanningToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions)
    ];
}

/**
 * Main function to build complete agent configuration based on user request
 */
export async function buildAgentConfiguration(
    request: GeneralAgentRequest,
    projectId: string,
    transformRepo: TransformRepository,
    jsondocRepo: JsondocRepository,
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
    const context = await buildContextForRequestType(projectId, jsondocRepo);
    console.log(`[AgentConfigBuilder] Built context (${context.length} chars): ${context.substring(0, 100)}...`);

    // Build prompt with few-shot examples
    const prompt = buildPromptForRequestType(request.userRequest, context);
    console.log(`[AgentConfigBuilder] Built prompt (${prompt.length} chars)`);

    // Build all available tools
    const tools = buildToolsForRequestType(transformRepo, jsondocRepo, projectId, userId, cachingOptions);
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