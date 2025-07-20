import { z } from 'zod';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { computeCanonicalJsondocsFromLineage } from '../../common/canonicalJsondocLogic';
import { buildLineageGraph } from '../../common/transform-jsondoc-framework/lineageResolution';
import { createBrainstormToolDefinition, createBrainstormEditToolDefinition } from '../tools/BrainstormTools';
import { createOutlineSettingsToolDefinition, createOutlineSettingsEditToolDefinition } from '../tools/OutlineSettingsTool';
import { createChroniclesToolDefinition, createChroniclesEditToolDefinition } from '../tools/ChroniclesTool';
import { createEpisodePlanningToolDefinition, createEpisodePlanningEditToolDefinition } from '../tools/EpisodePlanningTool';
import { createEpisodeSynopsisToolDefinition } from '../tools/EpisodeSynopsisTool';
import type { GeneralAgentRequest } from '../transform-jsondoc-framework/AgentService';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';
import { dump } from 'js-yaml';

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
 * Builds context string for the request using the same canonical jsondoc logic as tools
 */
export async function buildContextForRequestType(
    projectId: string,
    jsondocRepo: JsondocRepository,
    userId: string = 'system' // Default for system context building
): Promise<string> {
    console.log(`[ContextBuilder] Building context for request type: general`);

    // Get all project data for lineage computation - same as tools
    const jsondocs = await jsondocRepo.getAllProjectJsondocsForLineage(projectId);
    const transforms = await jsondocRepo.getAllProjectTransformsForLineage(projectId);
    const humanTransforms = await jsondocRepo.getAllProjectHumanTransformsForLineage(projectId);
    const transformInputs = await jsondocRepo.getAllProjectTransformInputsForLineage(projectId);
    const transformOutputs = await jsondocRepo.getAllProjectTransformOutputsForLineage(projectId);

    // Build lineage graph - same as tools
    const lineageGraph = buildLineageGraph(
        jsondocs,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    // Compute canonical jsondocs using the same logic as tools
    const canonicalContext = computeCanonicalJsondocsFromLineage(
        lineageGraph,
        jsondocs,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    // Build agent context using the same flattened format as tools
    const contextLines: string[] = [];

    // Helper to format jsondoc data - same as tools
    const formatJsondocForContext = (jsondoc: any, tag: string) => {
        if (!jsondoc) return;

        const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;

        contextLines.push(`[jsondoc]`);
        contextLines.push(`canonical: true`);
        contextLines.push(`tag: ${tag}`);
        contextLines.push(`id: ${jsondoc.id}`);
        contextLines.push(`schema_type: ${jsondoc.schema_type}`);
        contextLines.push(`origin_type: ${jsondoc.origin_type}`);
        contextLines.push(`data: ${JSON.stringify(data, null, 2)}`);
        contextLines.push('');
    };

    // Brainstorm input
    if (canonicalContext.canonicalBrainstormInput) {
        formatJsondocForContext(canonicalContext.canonicalBrainstormInput, 'brainstorm_input');
    }

    // Brainstorm idea
    if (canonicalContext.canonicalBrainstormIdea) {
        formatJsondocForContext(canonicalContext.canonicalBrainstormIdea, 'brainstorm_idea');
    }

    // Brainstorm collection
    if (canonicalContext.canonicalBrainstormCollection) {
        formatJsondocForContext(canonicalContext.canonicalBrainstormCollection, 'brainstorm_collection');
    }

    // Outline settings
    if (canonicalContext.canonicalOutlineSettings) {
        formatJsondocForContext(canonicalContext.canonicalOutlineSettings, 'outline_settings');
    }

    // Chronicles
    if (canonicalContext.canonicalChronicles) {
        formatJsondocForContext(canonicalContext.canonicalChronicles, 'chronicles');
    }

    // Episode planning
    if (canonicalContext.canonicalEpisodePlanning) {
        formatJsondocForContext(canonicalContext.canonicalEpisodePlanning, 'episode_planning');
    }

    // Episode synopsis list
    if (canonicalContext.canonicalEpisodeSynopsisList.length > 0) {
        canonicalContext.canonicalEpisodeSynopsisList.forEach((synopsis, index) => {
            formatJsondocForContext(synopsis, `episode_synopsis_${index + 1}`);
        });
    }

    // Join all context lines - same format as tools
    const contextString = contextLines.join('\n');
    console.log(`[ContextBuilder] Built context (${contextString.length} chars): ${contextString.substring(0, 100)}...`);

    return contextString;
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

1. 仔细分析用户请求，理解用户的真实意图。
2. 审视YAML上下文，识别最新 brainstorm_input, chosen_idea, outline_settings, chronicles, episode_planning 等内容。
6. 选择最合适的工具来满足需求。
7. 执行必要的工具调用。
8. 完成后，返回JSON格式的最终响应。
===你的任务 结束===

===工具选择示例 开始===
示例1："生成一些关于XX的故事创意“
用户请求："基于头脑风暴参数生成故事创意"
当前存在的canonical jsondocs: active_brainstorm_idea
分析：用户明确要求生成故事创意，因此使用 generate_brainstorm_ideas 工具
→ 使用 generate_brainstorm_ideas 工具
→ 参数：otherRequirements="其他要求"
→ **完成生成后立即停止，不要自动进行下一步（如生成剧本设定）**

示例2：基于现有创意生成剧本设定
用户请求："基于故事创意，生成详细的剧本设定"
当前存在的canonical jsondocs: active_brainstorm_idea
分析：用户明确要求生成剧本设定，因此使用 generate_outline_settings 工具
→ 使用 generate_outline_settings 工具
→ 参数：jsondocs=[{ jsondocId: "active_brainstorm_idea", description: "chosen_idea", schemaType: "brainstorm_idea" }]
→ **完成生成后立即停止，不要自动进行下一步（如生成时间顺序大纲）**

示例3：生成时间顺序大纲
用户请求："基于剧本设定创建60集的时间顺序大纲"
当前存在的canonical jsondocs: active_brainstorm_idea, active_outline_settings
分析：用户明确要求生成时间顺序大纲，因此使用 generate_chronicles 工具
→ 使用 generate_chronicles 工具
→ 参数：totalEpisodes=60, jsondocs=[{ jsondocId: "active_brainstorm_idea", description: "chosen_idea", schemaType: "brainstorm_idea" }, { jsondocId: "active_outline_settings", description: "outline_settings", schemaType: "outline_settings" }]
→ **完成生成后立即停止，不要自动进行下一步（如生成剧集框架）**

示例4：生成剧集框架
用户请求："基于时间顺序大纲生成12集的剧集框架"
当前存在的canonical jsondocs: active_brainstorm_idea, active_outline_settings, active_chronicles
分析：用户明确要求生成剧集框架，因此使用 generate_episode_planning 工具
→ 使用 generate_episode_planning 工具
→ 参数：numberOfEpisodes=12, jsondocs=[{ jsondocId: "active_brainstorm_idea", description: "chosen_idea", schemaType: "brainstorm_idea" }, { jsondocId: "active_outline_settings", description: "outline_settings", schemaType: "outline_settings" }, { jsondocId: "active_chronicles", description: "chronicles", schemaType: "chronicles" }]
→ **完成生成后立即停止，不要自动进行下一步**

示例5：编辑现有创意（单步编辑）
用户请求："修改第一个故事创意，增加悬疑元素"
当前存在的canonical jsondocs: active_brainstorm_idea
分析：用户明确要求修改现有创意，因此使用 edit_brainstorm_idea 工具
→ 使用 edit_brainstorm_idea 工具
→ 参数：ideaIndex=0, editRequirements="增加悬疑元素", jsondocs=[{ jsondocId: "active_brainstorm_idea", description: "chosen_idea", schemaType: "brainstorm_idea" }]
→ **完成编辑后立即停止，不要自动更新依赖的剧本设定或大纲**

示例6：编辑剧本设定（单步编辑）
用户请求："修改剧本设定中的角色设定，增加反派角色"
当前存在的canonical jsondocs: active_brainstorm_idea, active_outline_settings
分析：用户明确要求修改剧本设定，因此使用 edit_outline_settings 工具
→ 使用 edit_outline_settings 工具
→ 参数：editRequirements="增加反派角色", jsondocs=[{ jsondocId: "active_brainstorm_idea", description: "chosen_idea", schemaType: "brainstorm_idea" }, { jsondocId: "current_outline_settings", description: "outline_settings", schemaType: "outline_settings" }]
→ **完成编辑后立即停止，不要自动更新依赖的时间顺序大纲**

示例7：编辑时间顺序大纲（单步编辑）
用户请求："修改时间顺序大纲，加入更多XX元素"
当前存在的canonical jsondocs: active_brainstorm_idea, active_outline_settings, active_chronicles
分析：用户明确要求修改时间顺序大纲，因此使用 edit_chronicles 工具
→ 使用 edit_chronicles 工具
→ 参数：editRequirements="加入更多南京本地元素，包括文化，南京话，等等", jsondocs=[{ jsondocId: "active_brainstorm_idea", description: "chosen_idea", schemaType: "brainstorm_idea" }, { jsondocId: "active_outline_settings", description: "outline_settings", schemaType: "outline_settings" }, { jsondocId: "current_chronicles", description: "chronicles", schemaType: "chronicles" }]
→ **完成编辑后立即停止，不要自动更新依赖的剧集框架**

示例8：编辑剧集框架（单步编辑）
用户请求："调整剧集框架，增加更多情感冲突"
当前存在的canonical jsondocs: active_brainstorm_idea, active_outline_settings, active_chronicles, current_episode_planning
分析：用户明确要求修改剧集框架，因此使用 edit_episode_planning 工具
→ 使用 edit_episode_planning 工具
→ 参数：editRequirements="增加更多情感冲突，调整剧集分组以突出戏剧张力", jsondocs=[{ jsondocId: "active_brainstorm_idea", description: "chosen_idea", schemaType: "brainstorm_idea" }, { jsondocId: "active_outline_settings", description: "outline_settings", schemaType: "outline_settings" }, { jsondocId: "active_chronicles", description: "chronicles", schemaType: "chronicles" }, { jsondocId: "current_episode_planning", description: "episode_planning", schemaType: "episode_planning" }]
→ **完成编辑后立即停止**

示例9：模糊请求 - 修改想法并更新大纲（仅当用户明确要求修改多个组件时）
用户请求："在故事中加入童话元素，并更新相关的剧本设定"
当前存在的canonical jsondocs: current_brainstorm_idea, current_outline_settings
分析：用户并没有明确要修改或者生成哪个部分，根据逻辑判断“加入童话元素”需要涉及“想法”和“剧本设定”，因此按照顺序原则，使用 edit_brainstorm_idea 和 edit_outline_settings 工具
→ 第一步：使用 edit_brainstorm_idea 编辑想法，添加童话元素
→ 参数：editRequirements="添加童话元素", jsondocs=[{ jsondocId: "current_brainstorm_idea", description: "chosen_idea", schemaType: "brainstorm_idea" }]. 返回 jsondoc: { id: "new_brainstorm_idea" }
→ 第二步：使用 edit_outline_settings 更新大纲，整合新元素
→ 参数：editRequirements="基于更新后的创意整合童话元素到大纲中", jsondocs=[{ jsondocId: "new_brainstorm_idea", description: "chosen_idea", schemaType: "brainstorm_idea" }, { jsondocId: "current_outline_settings", description: "outline_settings", schemaType: "outline_settings" }]
→ 完成后返回JSON总结

示例10：多步级联编辑 - 修改剧本设定后更新时间顺序大纲、剧集框架和每集大纲（仅当用户明确要求修改多个组件时）
用户请求："优化故事结构，增强戏剧冲突"
当前存在的canonical jsondocs: current_brainstorm_idea, current_outline_settings, current_chronicles, current_episode_planning, current_episode_synopsis_list
分析：用户并没有明确要修改或者生成哪个部分，根据逻辑判断"优化故事结构"需要涉及"剧本设定"、"时间顺序大纲"、"剧集框架"、"每集大纲"，因此按照顺序原则，edit_outline_settings、edit_chronicles、edit_episode_planning、generate_episode_synopsis 工具需要依次调用
→ 第一步 使用 edit_outline_settings 编辑剧本设定，增强戏剧冲突
→ 参数：editRequirements="增强戏剧冲突，优化角色关系和情节设定", jsondocs=[{ jsondocId: "current_brainstorm_idea", description: "chosen_idea", schemaType: "brainstorm_idea" }, { jsondocId: "current_outline_settings", description: "outline_settings", schemaType: "outline_settings" }], 返回 jsondoc: { id: "new_outline_settings" }
→ 第二步 使用 edit_chronicles 更新时间顺序大纲，基于新的框架设定
→ 参数：editRequirements="基于更新后的框架设定调整时间顺序大纲，突出戏剧冲突", jsondocs=[{ jsondocId: "current_brainstorm_idea", description: "chosen_idea", schemaType: "brainstorm_idea" }, { jsondocId: "new_outline_settings", description: "outline_settings", schemaType: "outline_settings" }, { jsondocId: "current_chronicles", description: "chronicles", schemaType: "chronicles" }], 返回 jsondoc: { id: "new_chronicles" }
→ 第三步 使用 edit_episode_planning 更新剧集框架，基于新的时间顺序大纲
→ 参数：editRequirements="基于更新后的时间顺序大纲调整剧集框架，优化情感节拍和悬念设置", jsondocs=[{ jsondocId: "current_brainstorm_idea", description: "chosen_idea", schemaType: "brainstorm_idea" }, { jsondocId: "new_outline_settings", description: "outline_settings", schemaType: "outline_settings" }, { jsondocId: "new_chronicles", description: "chronicles", schemaType: "chronicles" }, { jsondocId: "current_episode_planning", description: "episode_planning", schemaType: "episode_planning" }], 返回 jsondoc: { id: "new_episode_planning" }
→ 第四步 使用 generate_episode_synopsis 重新生成第一组每集大纲，基于更新后的剧集框架
→ 参数：groupTitle="震撼开场：赛亚人觉醒时刻", episodeRange="1-3", episodes=[1,2,3], jsondocs=[{ jsondocId: "current_brainstorm_idea", description: "chosen_idea", schemaType: "brainstorm_idea" }, { jsondocId: "new_outline_settings", description: "outline_settings", schemaType: "outline_settings" }, { jsondocId: "new_chronicles", description: "chronicles", schemaType: "chronicles" }, { jsondocId: "new_episode_planning", description: "episode_planning", schemaType: "episode_planning" }]
→ 完成后返回JSON总结

示例11：多步编辑 - 修改剧本设定后更新时间顺序大纲（仅当用户明确要求修改多个组件时）
用户请求："减少作品的伦理争议，加入更多正面元素"
当前存在的canonical jsondocs: current_brainstorm_idea, current_outline_settings, current_chronicles
分析：用户并没有明确要修改或者生成哪个部分，根据逻辑判断"减少伦理争议"需要涉及"想法"、"剧本设定"、"时间顺序大纲"，因此按照顺序原则，edit_brainstorm_idea、edit_outline_settings、edit_chronicles 工具需要依次调用
→ 第一步 使用 edit_brainstorm_idea 编辑想法，减少伦理争议
→ 参数：editRequirements="减少伦理争议，加入更多正面元素", jsondocs=[{ jsondocId: "current_brainstorm_idea", description: "chosen_idea", schemaType: "brainstorm_idea" }]. 返回 jsondoc: { id: "new_brainstorm_idea" }
→ 第二步 使用 edit_outline_settings 编辑剧本设定，基于新的想法
→ 参数：editRequirements="基于更新后的创意整合正面元素到框架中", jsondocs=[{ jsondocId: "new_brainstorm_idea", description: "chosen_idea", schemaType: "brainstorm_idea" }, { jsondocId: "current_outline_settings", description: "outline_settings", schemaType: "outline_settings" }], 返回 jsondoc: { id: "new_outline_settings" }
→ 第三步 使用 edit_chronicles 更新时间顺序大纲，基于新的框架设定
→ 参数：editRequirements="基于更新后的框架设定调整时间顺序大纲，确保内容一致性", jsondocs=[{ jsondocId: "new_brainstorm_idea", description: "chosen_idea", schemaType: "brainstorm_idea" }, { jsondocId: "new_outline_settings", description: "outline_settings", schemaType: "outline_settings" }, { jsondocId: "current_chronicles", description: "chronicles", schemaType: "chronicles" }]
→ 完成后返回JSON总结

示例12：生成每集大纲
用户请求："基于剧集框架生成第1-3集的详细每集大纲"
当前存在的canonical jsondocs: active_brainstorm_idea, active_outline_settings, active_chronicles, active_episode_planning
分析：用户明确要求生成每集大纲，因此使用 generate_episode_synopsis 工具
→ 使用 generate_episode_synopsis 工具
→ 参数：groupTitle="震撼开场：赛亚人觉醒时刻", episodeRange="1-3", episodes=[1,2,3], jsondocs=[{ jsondocId: "active_brainstorm_idea", description: "chosen_idea", schemaType: "brainstorm_idea" }, { jsondocId: "active_outline_settings", description: "outline_settings", schemaType: "outline_settings" }, { jsondocId: "active_chronicles", description: "chronicles", schemaType: "chronicles" }, { jsondocId: "active_episode_planning", description: "episode_planning", schemaType: "episode_planning" }]
→ **完成生成后立即停止，不要自动进行下一步**

**重要：所有工具都会自动接收相关的上下文jsondocs作为参考资料。在多步工具调用中，后续工具会自动包含前面工具调用的输出jsondocId，确保基于最新数据进行处理。**

**jsondocs参数格式要求：**
所有工具调用中的jsondocs参数必须使用以下格式：
{
  "jsondocId": "实际的jsondoc ID",
  "description": "jsondoc的描述，如chosen_idea、outline_settings、chronicles等",
  "schemaType": "jsondoc的schema类型，如brainstorm_idea、outline_settings、chronicles等"
}

**常用的description和schemaType对应关系：**
- chosen_idea → brainstorm_idea
- outline_settings → outline_settings  
- chronicles → chronicles
- episode_planning → episode_planning
- brainstorm_collection → brainstorm_collection
- brainstorm_input → brainstorm_input_params

===工具选择示例 结束===

===重要提示 开始===
- **一步操作原则：默认情况下，如果判定是生成类操作，每次只完成一个步骤。完成请求的生成后立即停止。
- **不重复生成原则** 如果某个schema_type的jsondoc已经存在，则不应该再次生成，而是使用编辑。比如，如果已经存在outline_settings，则不应该再次生成，而是使用edit_outline_settings工具。
- 对于编辑操作，如果用户明确要求编辑哪些部分，只编辑用户明确要求的组件。如果要求模糊，用常识判断需要修改哪些部分，然后调用编辑工具按照顺序调用。**
- **多步操作条件：只有当用户明确要求修改多个相关组件时，才进行多步编辑。**
- 对于修改请求，始终使用编辑工具更新现有最新内容。如果用户明确要求多个更改，按依赖顺序调用工具（例如，先编辑想法，再编辑依赖于它的内容）。
- **多步工具调用的关键规则：当你在同一个请求中调用多个工具时，后续工具会自动获取前面工具调用的输出作为上下文。这确保后续编辑基于最新的数据，而不是过时的内容。系统会自动处理jsondoc引用和依赖关系。**
- 工具会处理结果的存储和流式传输，请不要尝试显示结果内容。
- 仔细从用户请求和上下文中提取必要的参数。如果用户要求的创意数量未明确说明，默认为3个。
- 工具调用完成后，返回JSON格式的响应
- **对于后续阶段的生成或编辑**：
   - 始终包含相关的上游canonical jsondocs作为参考材料
   - 例如：生成剧集框架时包含 chronicles、brainstorm_idea、outline_settings
   - 例如：编辑时间顺序大纲时包含相关的 outline_settings 和 brainstorm_idea
   - 这确保每个阶段都基于完整的上下文信息，保持整个创作流程的一致性
===重要提示 结束===


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
        createEpisodePlanningEditToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions),
        createEpisodeSynopsisToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions)
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

    // Build context using the same pattern as tools
    const context = await buildContextForRequestType(projectId, jsondocRepo, userId);
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