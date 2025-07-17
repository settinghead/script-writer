import { z } from 'zod';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { prepareAgentPromptContext } from '../../common/utils/agentContext';
import { createBrainstormToolDefinition, createBrainstormEditToolDefinition } from '../tools/BrainstormTools';
import { createOutlineSettingsToolDefinition, createOutlineSettingsEditToolDefinition } from '../tools/OutlineSettingsTool';
import { createChroniclesToolDefinition, createChroniclesEditToolDefinition } from '../tools/ChroniclesTool';
import { createEpisodePlanningToolDefinition, createEpisodePlanningEditToolDefinition } from '../tools/EpisodePlanningTool';
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
4. 剧本设定生成 (outline_settings)：基于选定创意生成人物、背景、商业设定
5. 时间顺序大纲生成 (chronicles)：创建故事时序结构
6. 剧集框架生成 (episode_planning)：基于时间顺序大纲创建优化的分集结构
7. 分集与剧本生成：后续详细内容创作

**重要原则：一次只完成一个步骤**
- 对于生成操作：完成用户请求的单一生成步骤后立即停止，不要自动进行下一步
- 对于编辑操作：只有当用户明确要求修改多个相关组件时，才进行多步编辑
- 编辑多个组件时，遵循依赖顺序：先编辑上游内容（如创意），然后编辑依赖的下游内容（如框架）
===创作流程 结束===

1. 仔细分析用户请求，理解用户的真实意图。**特别注意：用户是否只要求单一步骤，还是明确要求多步操作。**
2. 审视YAML上下文，识别最新 brainstorm_input, chosen_idea, outline_settings, chronicles, episode_planning 等内容。
3. **对于生成请求**：只完成用户明确要求的单一生成步骤，不要自动进行后续步骤。
4. **对于编辑请求**：如果用户只要求编辑单一组件，则只编辑该组件；只有当用户明确要求修改多个相关组件时，才进行多步编辑。
5. **对于后续阶段的生成或编辑**：
   - 始终包含相关的上游canonical jsondocs作为参考材料
   - 例如：生成剧集框架时包含 chronicles、brainstorm_idea、outline_settings
   - 例如：编辑时间顺序大纲时包含相关的 outline_settings 和 brainstorm_idea
   - 这确保每个阶段都基于完整的上下文信息，保持整个创作流程的一致性
6. 选择最合适的工具来满足需求。**注意：除非用户明确要求多步操作，否则只调用一个工具。**
7. 执行必要的工具调用。
8. 完成后，返回JSON格式的最终响应。
===你的任务 结束===

===工具选择示例 开始===
示例1：生成新的故事创意
用户请求："基于头脑风暴参数生成故事创意"
→ 使用 generate_brainstorm_ideas 工具
→ 参数：otherRequirements="其他要求"
→ **完成生成后立即停止，不要自动进行下一步（如生成剧本设定）**

示例2：基于现有创意生成剧本设定
用户请求："基于故事创意，生成详细的剧本设定"
→ 使用 generate_outline_settings 工具
→ 参数：title="故事标题", requirements="具体要求"
→ **完成生成后立即停止，不要自动进行下一步（如生成时间顺序大纲）**

示例3：生成时间顺序大纲
用户请求："基于剧本设定创建60集的时间顺序大纲"
→ 使用 generate_chronicles 工具
→ 参数：totalEpisodes=60
→ **完成生成后立即停止，不要自动进行下一步（如生成剧集框架）**

示例4：生成剧集框架
用户请求："基于时间顺序大纲生成12集的剧集框架"
→ 使用 generate_episode_planning 工具
→ 参数：numberOfEpisodes=12, jsondocs=[{ id: "active_brainstorm_idea" }, { id: "active_outline_settings" }, { id: "active_chronicles" }]
→ **完成生成后立即停止，不要自动进行下一步**

示例5：编辑现有创意（单步编辑）
用户请求："修改第一个故事创意，增加悬疑元素"
→ 使用 edit_brainstorm_idea 工具
→ 参数：ideaIndex=0, editRequirements="增加悬疑元素"
→ **完成编辑后立即停止，不要自动更新依赖的剧本设定或大纲**

示例6：编辑剧本设定（单步编辑）
用户请求："修改剧本设定中的角色设定，增加反派角色"
→ 使用 edit_outline_settings 工具
→ 参数：editRequirements="增加反派角色", jsondocs=[{ id: "active_brainstorm_idea" }, { id: "current_outline_settings" }]
→ **完成编辑后立即停止，不要自动更新依赖的时间顺序大纲**

示例7：编辑时间顺序大纲（单步编辑）
用户请求："修改时间顺序大纲，加入更多南京本地元素"
→ 使用 edit_chronicles 工具
→ 参数：editRequirements="加入更多南京本地元素，包括文化，南京话，等等", jsondocs=[{ id: "active_brainstorm_idea" }, { id: "active_outline_settings" },  { id: "current_chronicles" }]
→ **完成编辑后立即停止，不要自动更新依赖的剧集框架**

示例8：编辑剧集框架（单步编辑）
用户请求："调整剧集框架，增加更多情感冲突"
当前可用的canonical jsondocs: active_brainstorm_idea, active_outline_settings, active_chronicles, current_episode_planning
→ 使用 edit_episode_planning 工具
→ 参数：editRequirements="增加更多情感冲突，调整剧集分组以突出戏剧张力", jsondocs=[{ id: "active_brainstorm_idea" }, { id: "active_outline_settings" }, { id: "active_chronicles" }, { id: "current_episode_planning" }]
→ **完成编辑后立即停止**

示例9：复杂请求 - 修改想法并更新大纲（仅当用户明确要求修改多个组件时）
用户请求："在故事中加入童话元素，并更新相关的剧本设定"
**注意：用户明确要求修改多个组件，因此进行多步编辑**
当前可用的canonical jsondocs: current_brainstorm_idea, current_outline_settings
→ 第一步：使用 edit_brainstorm_idea 编辑想法，添加童话元素
→ 参数：editRequirements="添加童话元素", jsondocs=[{ id: "current_brainstorm_idea" }]. 返回 jsondoc: { id: "new_brainstorm_idea" }
→ 第二步：使用 edit_outline_settings 更新大纲，整合新元素
→ 参数：editRequirements="基于更新后的创意整合童话元素到大纲中", jsondocs=[{ id: "new_brainstorm_idea" }, { id: "current_outline_settings" }]
→ 完成后返回JSON总结

示例10：多步编辑 - 修改剧本设定后更新时间顺序大纲（仅当用户明确要求修改多个组件时）
用户请求："减少作品的伦理争议，加入更多正面元素，并更新相关的剧本设定和时间顺序大纲"
**注意：用户明确要求修改多个组件，因此进行多步编辑**
当前可用的canonical jsondocs: current_brainstorm_idea, current_outline_settings, current_chronicles
→ 第一步 使用 edit_brainstorm_idea 编辑想法，减少伦理争议
→ 参数：editRequirements="减少伦理争议，加入更多正面元素", jsondocs=[{ id: "current_brainstorm_idea" }]. 返回 jsondoc: { id: "new_brainstorm_idea" }
→ 第二步 使用 edit_outline_settings 编辑剧本设定，基于新的想法
→ 参数：editRequirements="基于更新后的创意整合正面元素到框架中", jsondocs=[{ id: "new_brainstorm_idea" }, { id: "current_outline_settings" }], 返回 jsondoc: { id: "new_outline_settings" }
→ 第三步 使用 edit_chronicles 更新时间顺序大纲，基于新的框架设定
→ 参数：editRequirements="基于更新后的框架设定调整时间顺序大纲，确保内容一致性", jsondocs=[{ id: "new_brainstorm_idea" }, { id: "new_outline_settings" }, { id: "current_chronicles" }]
→ 完成后返回JSON总结

示例11：多步级联编辑 - 修改剧本设定后更新时间顺序大纲和剧集框架（仅当用户明确要求修改多个组件时）
用户请求："优化故事结构，增强戏剧冲突，并更新相关的剧本设定、时间顺序大纲和剧集框架"
**注意：用户明确要求修改多个组件，因此进行多步编辑**
当前可用的canonical jsondocs: current_brainstorm_idea, current_outline_settings, current_chronicles, current_episode_planning
→ 第一步 使用 edit_outline_settings 编辑剧本设定，增强戏剧冲突
→ 参数：editRequirements="增强戏剧冲突，优化角色关系和情节设定", jsondocs=[{ id: "current_brainstorm_idea" }, { id: "current_outline_settings" }], 返回 jsondoc: { id: "new_outline_settings" }
→ 第二步 使用 edit_chronicles 更新时间顺序大纲，基于新的框架设定
→ 参数：editRequirements="基于更新后的框架设定调整时间顺序大纲，突出戏剧冲突", jsondocs=[{ id: "current_brainstorm_idea" }, { id: "new_outline_settings" }, { id: "current_chronicles" }], 返回 jsondoc: { id: "new_chronicles" }
→ 第三步 使用 edit_episode_planning 更新剧集框架，基于新的时间顺序大纲
→ 参数：editRequirements="基于更新后的时间顺序大纲调整剧集框架，优化情感节拍和悬念设置", jsondocs=[{ id: "current_brainstorm_idea" }, { id: "new_outline_settings" }, { id: "new_chronicles" }, { id: "current_episode_planning" }]
→ 完成后返回JSON总结

**重要：所有工具都会自动接收相关的上下文jsondocs作为参考资料。在多步工具调用中，后续工具会自动包含前面工具调用的输出jsondocId，确保基于最新数据进行处理。**
===工具选择示例 结束===

===重要提示 开始===
- **一步操作原则：默认情况下，每次只完成一个步骤。对于生成操作，完成请求的生成后立即停止。对于编辑操作，只编辑用户明确要求的组件。**
- **多步操作条件：只有当用户明确要求修改多个相关组件时，才进行多步编辑。**
- 上下文是YAML格式，包含完整数据 - 仔细阅读以了解当前状态。
- 对于修改请求，始终使用编辑工具更新现有最新内容。
- 如果用户明确要求多个更改，按依赖顺序调用工具（例如，先编辑想法，再编辑依赖于它的内容）。
- **多步工具调用的关键规则：当你在同一个请求中调用多个工具时，后续工具会自动获取前面工具调用的输出作为上下文。这确保后续编辑基于最新的数据，而不是过时的内容。系统会自动处理jsondoc引用和依赖关系。**
- 工具会处理结果的存储和流式传输，请不要尝试显示结果内容。
- 仔细从用户请求和上下文中提取必要的参数。
- 如果用户要求的创意数量未明确说明，默认为3个。
- 确保选择最符合用户需求的工具。**注意：除非用户明确要求多步操作，否则只调用一个工具。**
- 所有工具都会自动接收相关的上下文jsondocs作为参考资料，无需手动指定。
===重要提示 结束===

===工作流程要求 开始===
**重要：你必须按照以下顺序完成任务：**

1. **首先：分析用户请求和上下文，判断是单步操作还是多步操作。**
   - **单步操作：** 用户只要求一个具体的生成或编辑步骤
   - **多步操作：** 用户明确要求修改多个相关组件
2. **然后：根据判断结果调用工具。**
   - **单步操作：** 只调用一个工具，完成后立即停止
   - **多步操作：** 按依赖顺序调用多个工具
3. **最后：工具调用完成后，返回JSON格式的响应。**

**你的回复的JSON格式要求：**
{
  "humanReadableMessage": "对用户友好的中文回复消息，说明你完成了什么任务。不要暴露任何工具调用的细节。"
}

**关键原则：默认情况下，每次只完成一个步骤。只有当用户明确要求修改多个组件时，才进行多步操作。**

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
        createEpisodePlanningToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions),
        createEpisodePlanningEditToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions)
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