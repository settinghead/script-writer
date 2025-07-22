import { z } from 'zod';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { computeCanonicalJsondocsFromLineage, type CanonicalJsondocContext } from '../../common/canonicalJsondocLogic';
import { buildLineageGraph } from '../../common/transform-jsondoc-framework/lineageResolution';
import { createBrainstormToolDefinition, createBrainstormEditToolDefinition } from '../tools/BrainstormTools';
import { createOutlineSettingsToolDefinition, createOutlineSettingsEditToolDefinition } from '../tools/OutlineSettingsTool';
import { createChroniclesToolDefinition, createChroniclesEditToolDefinition } from '../tools/ChroniclesTool';
import { createEpisodePlanningToolDefinition, createEpisodePlanningEditToolDefinition } from '../tools/EpisodePlanningTool';
import { createEpisodeSynopsisToolDefinition } from '../tools/EpisodeSynopsisTool';
import { createQueryToolDefinition } from '../tools/QueryTool';
import { createGetJsondocContentToolDefinition } from '../tools/GetJsondocContentTool';
import { generateCanonicalContentStructure } from '../utils/canonicalContentStructure';
import type { GeneralAgentRequest } from '../transform-jsondoc-framework/AgentService';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';
import { getParticleSearchToolNames, getWorkflowTools, type WorkflowStage } from '../../common/schemas/tools';
import { getParticleSystem } from './ParticleSystemInitializer';
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

    // Generate canonical content structure overview (table of contents)
    const contentStructure = generateCanonicalContentStructure(canonicalContext, projectId);

    // Build agent context using the same flattened format as tools
    const contextLines: string[] = [];

    // Add the canonical content structure overview at the beginning
    contextLines.push('===项目内容结构概览 开始===');
    contextLines.push(contentStructure);
    contextLines.push('===项目内容结构概览 结束===');
    contextLines.push('');
    contextLines.push('===详细内容数据 开始===');

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
        formatJsondocForContext(canonicalContext.canonicalBrainstormIdea, '灵感创意');
    }

    // Brainstorm collection
    if (canonicalContext.canonicalBrainstormCollection) {
        formatJsondocForContext(canonicalContext.canonicalBrainstormCollection, 'brainstorm_collection');
    }

    // Outline settings
    if (canonicalContext.canonicalOutlineSettings) {
        formatJsondocForContext(canonicalContext.canonicalOutlineSettings, '剧本设定');
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

    contextLines.push('===详细内容数据 结束===');

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
    return `你是一个专业的短剧剧本创作和编辑助手，拥有专门的工具来帮助用户处理短剧剧本创作和编辑的请求。

**用户请求：** "${userRequest}"

===当前项目背景信息 开始===

${context}
===当前项目背景信息 结束===

===你的任务 开始===

===创作流程 开始===
我们的创作流程遵循以下顺序：
1. 头脑风暴输入 (brainstorm_input)：用户提供创意参数
2. 故事创意生成 (灵感创意)：AI生成多个故事想法
3. 创意选择与编辑：用户选择并修改创意
4. 剧本设定生成 (剧本设定)：基于选定创意生成人物、背景、商业设定
5. 时间顺序大纲生成 (chronicles)：创建故事时序结构
6. 剧集框架生成 (episode_planning)：基于时间顺序大纲创建优化的分集结构
7. 分集与剧本生成：后续详细内容创作

**重要原则：一次只完成一个步骤**
- 对于生成操作：完成用户请求的单一生成步骤后立即停止，不要自动进行下一步
- 对于编辑操作：只有当用户明确要求修改多个相关组件时，才进行多步编辑
- 编辑多个组件时，遵循依赖顺序：先编辑上游内容（如创意），然后编辑依赖的下游内容（如框架）
===创作流程 结束===

===智能信息搜索指南 开始===
你现在拥有智能查询工具来按需获取项目信息：

**queryJsondocs工具** - 语义搜索项目中的相关信息
- 使用自然语言查询：如"主角的性格设定"、"故事的核心冲突"
- 基于语义理解，不需要精确匹配关键词
- 返回最相关的信息片段和来源

**getJsondocContent工具** - 获取完整的jsondoc内容
- 当你需要查看特定文档的完整内容时使用
- 输入jsondoc ID来获取详细信息
- 用于深入了解特定组件的所有细节

**搜索策略：**
1. 首先使用queryJsondocs进行语义搜索找到相关信息
2. 如果需要更多细节，使用getJsondocContent获取完整内容
3. 根据搜索结果来决定如何处理用户请求

**重要：优先使用搜索工具** - 在生成或编辑内容之前，先搜索相关的现有信息，这样可以：
- 保持故事一致性
- 避免重复创建已有内容
- 基于现有设定进行合理扩展
===智能信息搜索指南 结束===

1. 仔细分析用户请求，理解用户的真实意图。
2. **如果需要了解项目现状或特定内容，使用query工具搜索相关信息。**
3. 审视YAML上下文，识别最新 brainstorm_input, chosen_idea, 剧本设定, chronicles, episode_planning 等内容。
4. 选择最合适的工具来满足需求。
5. 执行必要的工具调用。
6. 完成后，返回JSON格式的最终响应。
===你的任务 结束===

===工具选择示例 开始===
示例1："生成一些关于XX的故事创意“
用户请求："基于头脑风暴参数生成故事创意"
当前存在的canonical jsondocs: active_灵感创意
分析：用户明确要求生成故事创意，因此使用 generate_灵感创意s 工具
→ 使用 generate_灵感创意s 工具
→ 参数：otherRequirements="其他要求"
→ **完成生成后立即停止，不要自动进行下一步（如生成剧本设定）**

示例2：基于现有创意生成剧本设定
用户请求："基于故事创意，生成详细的剧本设定"
当前存在的canonical jsondocs: active_灵感创意
分析：用户明确要求生成剧本设定，因此使用 generate_剧本设定 工具
→ 使用 generate_剧本设定 工具
→ 参数：jsondocs=[{ jsondocId: "active_灵感创意", description: "chosen_idea", schemaType: "灵感创意" }]
→ **完成生成后立即停止，不要自动进行下一步（如生成时间顺序大纲）**

示例3：生成时间顺序大纲
用户请求："基于剧本设定创建60集的时间顺序大纲"
当前存在的canonical jsondocs: active_灵感创意, active_剧本设定
分析：用户明确要求生成时间顺序大纲，因此使用 generate_chronicles 工具
→ 使用 generate_chronicles 工具
→ 参数：totalEpisodes=60, jsondocs=[{ jsondocId: "active_灵感创意", description: "chosen_idea", schemaType: "灵感创意" }, { jsondocId: "active_剧本设定", description: "剧本设定", schemaType: "剧本设定" }]
→ **完成生成后立即停止，不要自动进行下一步（如生成剧集框架）**

示例4：生成剧集框架
用户请求："基于时间顺序大纲生成12集的剧集框架"
当前存在的canonical jsondocs: active_灵感创意, active_剧本设定, active_chronicles
分析：用户明确要求生成剧集框架，因此使用 generate_episode_planning 工具
→ 使用 generate_episode_planning 工具
→ 参数：numberOfEpisodes=12, jsondocs=[{ jsondocId: "active_灵感创意", description: "chosen_idea", schemaType: "灵感创意" }, { jsondocId: "active_剧本设定", description: "剧本设定", schemaType: "剧本设定" }, { jsondocId: "active_chronicles", description: "chronicles", schemaType: "chronicles" }]
→ **完成生成后立即停止，不要自动进行下一步**

示例5：编辑现有创意（单步编辑）
用户请求："修改第一个故事创意，增加悬疑元素"
当前存在的canonical jsondocs: active_灵感创意
分析：用户明确要求修改现有创意，因此使用 edit_灵感创意 工具
→ 使用 edit_灵感创意 工具
→ 参数：ideaIndex=0, editRequirements="增加悬疑元素", jsondocs=[{ jsondocId: "active_灵感创意", description: "chosen_idea", schemaType: "灵感创意" }]
→ **完成编辑后立即停止，不要自动更新依赖的剧本设定或大纲**

示例6：编辑剧本设定（单步编辑）
用户请求："修改剧本设定中的角色设定，增加反派角色"
当前存在的canonical jsondocs: active_灵感创意, active_剧本设定
分析：用户明确要求修改剧本设定，因此使用 edit_剧本设定 工具
→ 使用 edit_剧本设定 工具
→ 参数：editRequirements="增加反派角色", jsondocs=[{ jsondocId: "active_灵感创意", description: "chosen_idea", schemaType: "灵感创意" }, { jsondocId: "current_剧本设定", description: "剧本设定", schemaType: "剧本设定" }]
→ **完成编辑后立即停止，不要自动更新依赖的时间顺序大纲**

示例7：编辑时间顺序大纲（单步编辑）
用户请求："修改时间顺序大纲，加入更多XX元素"
当前存在的canonical jsondocs: active_灵感创意, active_剧本设定, active_chronicles
分析：用户明确要求修改时间顺序大纲，因此使用 edit_chronicles 工具
→ 使用 edit_chronicles 工具
→ 参数：editRequirements="加入更多南京本地元素，包括文化，南京话，等等", jsondocs=[{ jsondocId: "active_灵感创意", description: "chosen_idea", schemaType: "灵感创意" }, { jsondocId: "active_剧本设定", description: "剧本设定", schemaType: "剧本设定" }, { jsondocId: "current_chronicles", description: "chronicles", schemaType: "chronicles" }]
→ **完成编辑后立即停止，不要自动更新依赖的剧集框架**

示例8：编辑剧集框架（单步编辑）
用户请求："调整剧集框架，增加更多情感冲突"
当前存在的canonical jsondocs: active_灵感创意, active_剧本设定, active_chronicles, current_episode_planning
分析：用户明确要求修改剧集框架，因此使用 edit_episode_planning 工具
→ 使用 edit_episode_planning 工具
→ 参数：editRequirements="增加更多情感冲突，调整剧集分组以突出戏剧张力", jsondocs=[{ jsondocId: "active_灵感创意", description: "chosen_idea", schemaType: "灵感创意" }, { jsondocId: "active_剧本设定", description: "剧本设定", schemaType: "剧本设定" }, { jsondocId: "active_chronicles", description: "chronicles", schemaType: "chronicles" }, { jsondocId: "current_episode_planning", description: "episode_planning", schemaType: "episode_planning" }]
→ **完成编辑后立即停止**

示例9：模糊请求 - 修改想法并更新大纲（仅当用户明确要求修改多个组件时）
用户请求："在故事中加入童话元素，并更新相关的剧本设定"
当前存在的canonical jsondocs: current_灵感创意, current_剧本设定
分析：用户并没有明确要修改或者生成哪个部分，根据逻辑判断“加入童话元素”需要涉及“想法”和“剧本设定”，因此按照顺序原则，使用 edit_灵感创意 和 edit_剧本设定 工具
→ 第一步：使用 edit_灵感创意 编辑想法，添加童话元素
→ 参数：editRequirements="添加童话元素", jsondocs=[{ jsondocId: "current_灵感创意", description: "chosen_idea", schemaType: "灵感创意" }]. 返回 jsondoc: { id: "new_灵感创意" }
→ 第二步：使用 edit_剧本设定 更新大纲，整合新元素
→ 参数：editRequirements="基于更新后的创意整合童话元素到大纲中", jsondocs=[{ jsondocId: "new_灵感创意", description: "chosen_idea", schemaType: "灵感创意" }, { jsondocId: "current_剧本设定", description: "剧本设定", schemaType: "剧本设定" }]
→ 完成后返回JSON总结

示例10：多步级联编辑 - 修改剧本设定后更新时间顺序大纲、剧集框架和每集大纲（仅当用户明确要求修改多个组件时）
用户请求："优化故事结构，增强戏剧冲突"
当前存在的canonical jsondocs: current_灵感创意, current_剧本设定, current_chronicles, current_episode_planning, current_episode_synopsis_list
分析：用户并没有明确要修改或者生成哪个部分，根据逻辑判断"优化故事结构"需要涉及"剧本设定"、"时间顺序大纲"、"剧集框架"、"每集大纲"，因此按照顺序原则，edit_剧本设定、edit_chronicles、edit_episode_planning、generate_episode_synopsis 工具需要依次调用
→ 第一步 使用 edit_剧本设定 编辑剧本设定，增强戏剧冲突
→ 参数：editRequirements="增强戏剧冲突，优化角色关系和情节设定", jsondocs=[{ jsondocId: "current_灵感创意", description: "chosen_idea", schemaType: "灵感创意" }, { jsondocId: "current_剧本设定", description: "剧本设定", schemaType: "剧本设定" }], 返回 jsondoc: { id: "new_剧本设定" }
→ 第二步 使用 edit_chronicles 更新时间顺序大纲，基于新的框架设定
→ 参数：editRequirements="基于更新后的框架设定调整时间顺序大纲，突出戏剧冲突", jsondocs=[{ jsondocId: "current_灵感创意", description: "chosen_idea", schemaType: "灵感创意" }, { jsondocId: "new_剧本设定", description: "剧本设定", schemaType: "剧本设定" }, { jsondocId: "current_chronicles", description: "chronicles", schemaType: "chronicles" }], 返回 jsondoc: { id: "new_chronicles" }
→ 第三步 使用 edit_episode_planning 更新剧集框架，基于新的时间顺序大纲
→ 参数：editRequirements="基于更新后的时间顺序大纲调整剧集框架，优化情感节拍和悬念设置", jsondocs=[{ jsondocId: "current_灵感创意", description: "chosen_idea", schemaType: "灵感创意" }, { jsondocId: "new_剧本设定", description: "剧本设定", schemaType: "剧本设定" }, { jsondocId: "new_chronicles", description: "chronicles", schemaType: "chronicles" }, { jsondocId: "current_episode_planning", description: "episode_planning", schemaType: "episode_planning" }], 返回 jsondoc: { id: "new_episode_planning" }
→ 第四步 使用 generate_episode_synopsis 重新生成第一组每集大纲，基于更新后的剧集框架
→ 参数：groupTitle="震撼开场：赛亚人觉醒时刻", episodeRange="1-3", episodes=[1,2,3], jsondocs=[{ jsondocId: "current_灵感创意", description: "chosen_idea", schemaType: "灵感创意" }, { jsondocId: "new_剧本设定", description: "剧本设定", schemaType: "剧本设定" }, { jsondocId: "new_chronicles", description: "chronicles", schemaType: "chronicles" }, { jsondocId: "new_episode_planning", description: "episode_planning", schemaType: "episode_planning" }]
→ 完成后返回JSON总结

示例11：多步编辑 - 修改剧本设定后更新时间顺序大纲（仅当用户明确要求修改多个组件时）
用户请求："减少作品的伦理争议，加入更多正面元素"
当前存在的canonical jsondocs: current_灵感创意, current_剧本设定, current_chronicles
分析：用户并没有明确要修改或者生成哪个部分，根据逻辑判断"减少伦理争议"需要涉及"想法"、"剧本设定"、"时间顺序大纲"，因此按照顺序原则，edit_灵感创意、edit_剧本设定、edit_chronicles 工具需要依次调用
→ 第一步 使用 edit_灵感创意 编辑想法，减少伦理争议
→ 参数：editRequirements="减少伦理争议，加入更多正面元素", jsondocs=[{ jsondocId: "current_灵感创意", description: "chosen_idea", schemaType: "灵感创意" }]. 返回 jsondoc: { id: "new_灵感创意" }
→ 第二步 使用 edit_剧本设定 编辑剧本设定，基于新的想法
→ 参数：editRequirements="基于更新后的创意整合正面元素到框架中", jsondocs=[{ jsondocId: "new_灵感创意", description: "chosen_idea", schemaType: "灵感创意" }, { jsondocId: "current_剧本设定", description: "剧本设定", schemaType: "剧本设定" }], 返回 jsondoc: { id: "new_剧本设定" }
→ 第三步 使用 edit_chronicles 更新时间顺序大纲，基于新的框架设定
→ 参数：editRequirements="基于更新后的框架设定调整时间顺序大纲，确保内容一致性", jsondocs=[{ jsondocId: "new_灵感创意", description: "chosen_idea", schemaType: "灵感创意" }, { jsondocId: "new_剧本设定", description: "剧本设定", schemaType: "剧本设定" }, { jsondocId: "current_chronicles", description: "chronicles", schemaType: "chronicles" }]
→ 完成后返回JSON总结

示例12：生成每集大纲
用户请求："基于剧集框架生成第1-3集的详细每集大纲"
当前存在的canonical jsondocs: active_灵感创意, active_剧本设定, active_chronicles, active_episode_planning
分析：用户明确要求生成每集大纲，因此使用 generate_episode_synopsis 工具
→ 使用 generate_episode_synopsis 工具
→ 参数：groupTitle="震撼开场：赛亚人觉醒时刻", episodeRange="1-3", episodes=[1,2,3], jsondocs=[{ jsondocId: "active_灵感创意", description: "chosen_idea", schemaType: "灵感创意" }, { jsondocId: "active_剧本设定", description: "剧本设定", schemaType: "剧本设定" }, { jsondocId: "active_chronicles", description: "chronicles", schemaType: "chronicles" }, { jsondocId: "active_episode_planning", description: "episode_planning", schemaType: "episode_planning" }]
→ **完成生成后立即停止，不要自动进行下一步**

**重要：所有工具都会自动接收相关的上下文jsondocs作为参考资料。在多步工具调用中，后续工具会自动包含前面工具调用的输出jsondocId，确保基于最新数据进行处理。**

**jsondocs参数格式要求：**
所有工具调用中的jsondocs参数必须使用以下格式：
{
  "jsondocId": "实际的jsondoc ID",
  "description": "jsondoc的描述，如chosen_idea、剧本设定、chronicles等",
  "schemaType": "jsondoc的schema类型，如灵感创意、剧本设定、chronicles等"
}

**常用的description和schemaType对应关系：**
- chosen_idea → 灵感创意
- 剧本设定 → 剧本设定  
- chronicles → chronicles
- episode_planning → episode_planning
- brainstorm_collection → brainstorm_collection
- brainstorm_input → brainstorm_input_params

===工具选择示例 结束===

===重要提示 开始===
- **一步操作原则：默认情况下，如果判定是生成类操作，每次只完成一个步骤。完成请求的生成后立即停止。
- **不重复生成原则** 如果某个schema_type的jsondoc已经存在，则不应该再次生成，而是使用编辑。比如，如果已经存在剧本设定，则不应该再次生成，而是使用edit_剧本设定工具。
- 对于编辑操作，如果用户明确要求编辑哪些部分，只编辑用户明确要求的组件。如果要求模糊，用常识判断需要修改哪些部分，然后调用编辑工具按照顺序调用。**
- **多步操作条件：只有当用户明确要求修改多个相关组件时，才进行多步编辑。**
- 对于修改请求，始终使用编辑工具更新现有最新内容。如果用户明确要求多个更改，按依赖顺序调用工具（例如，先编辑想法，再编辑依赖于它的内容）。
- **多步工具调用的关键规则：当你在同一个请求中调用多个工具时，后续工具会自动获取前面工具调用的输出作为上下文。这确保后续编辑基于最新的数据，而不是过时的内容。系统会自动处理jsondoc引用和依赖关系。**
- 工具会处理结果的存储和流式传输，请不要尝试显示结果内容。
- 仔细从用户请求和上下文中提取必要的参数。如果用户要求的创意数量未明确说明，默认为3个。
- 工具调用完成后，返回JSON格式的响应
- **对于后续阶段的生成或编辑**：
   - 始终包含相关的上游canonical jsondocs作为参考材料
   - 例如：生成剧集框架时包含 chronicles、灵感创意、剧本设定
   - 例如：编辑时间顺序大纲时包含相关的 剧本设定 和 灵感创意
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
 * Compute available tools based on canonical jsondoc context
 * This is the core logic that filters tools based on the current workflow state
 * 
 * Filtering rules:
 * 1. Never show generate tools if the corresponding jsondoc already exists
 * 2. Only show edit tools if the corresponding jsondoc exists
 * 3. Show next-stage generate tools only when prerequisites are met
 * 4. generate_episode_synopsis is special - can be used multiple times
 */
export function computeAvailableToolsFromCanonicalContext(
    context: CanonicalJsondocContext,
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
    const availableTools: StreamingToolDefinition<any, any>[] = [];

    // Helper function to add tool if it doesn't exist
    const addTool = (toolFactory: () => StreamingToolDefinition<any, any>) => {
        availableTools.push(toolFactory());
    };

    // === PARTICLE SEARCH TOOLS ===
    // Always add particle search tools if the particle system is available
    try {
        const particleSystem = getParticleSystem();
        if (particleSystem && particleSystem.unifiedSearch) {
            const particleSearchTools = getParticleSearchToolNames();
            particleSearchTools.forEach(toolName => {
                if (toolName === 'queryJsondocs') {
                    addTool(() => createQueryToolDefinition(particleSystem.unifiedSearch, projectId, userId));
                } else if (toolName === 'getJsondocContent') {
                    addTool(() => createGetJsondocContentToolDefinition(jsondocRepo, projectId, userId));
                }
            });
            console.log(`[AgentRequestBuilder] Added particle search tools (${particleSearchTools.length}):`, particleSearchTools);
        } else {
            console.log('[AgentRequestBuilder] Particle system not available, skipping particle search tools');
        }
    } catch (error) {
        console.log('[AgentRequestBuilder] Failed to initialize particle search tools:', error);
    }

    // Check what canonical jsondocs exist
    const hasBrainstormInput = !!context.canonicalBrainstormInput;
    const hasBrainstormCollection = !!context.canonicalBrainstormCollection;
    const hasBrainstormIdea = !!context.canonicalBrainstormIdea;
    const hasOutlineSettings = !!context.canonicalOutlineSettings;
    const hasChronicles = !!context.canonicalChronicles;
    const hasEpisodePlanning = !!context.canonicalEpisodePlanning;
    const hasEpisodeSynopsis = context.canonicalEpisodeSynopsisList.length > 0;

    // Check if any brainstorm result exists (collection or idea)
    const hasBrainstormResult = hasBrainstormCollection || hasBrainstormIdea;

    // === WORKFLOW TOOLS ===
    // Use shared workflow logic to determine which workflow tools are available
    const workflowStage: WorkflowStage = {
        hasBrainstormResult,
        hasBrainstormIdea,
        hasOutlineSettings,
        hasChronicles,
        hasEpisodePlanning
    };

    const workflowToolNames = getWorkflowTools(workflowStage);

    // Map workflow tool names to actual tool factory functions
    workflowToolNames.forEach(toolName => {
        switch (toolName) {
            case 'generate_灵感创意s':
                addTool(() => createBrainstormToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions));
                break;
            case 'edit_灵感创意':
                addTool(() => createBrainstormEditToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions));
                break;
            case 'generate_剧本设定':
                addTool(() => createOutlineSettingsToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions));
                break;
            case 'edit_剧本设定':
                addTool(() => createOutlineSettingsEditToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions));
                break;
            case 'generate_chronicles':
                addTool(() => createChroniclesToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions));
                break;
            case 'edit_chronicles':
                addTool(() => createChroniclesEditToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions));
                break;
            case 'generate_episode_planning':
                addTool(() => createEpisodePlanningToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions));
                break;
            case 'edit_episode_planning':
                addTool(() => createEpisodePlanningEditToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions));
                break;
            case 'generate_episode_synopsis':
                addTool(() => createEpisodeSynopsisToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions));
                break;
        }
    });

    console.log(`[AgentRequestBuilder] Added ${availableTools.length} tools total`);
    return availableTools;
}

/**
 * Main function to build complete agent configuration based on user request
 * Uses canonical jsondoc context to filter available tools based on workflow state
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

    // Compute canonical context for tool filtering
    const jsondocs = await jsondocRepo.getAllProjectJsondocsForLineage(projectId);
    const transforms = await jsondocRepo.getAllProjectTransformsForLineage(projectId);
    const humanTransforms = await jsondocRepo.getAllProjectHumanTransformsForLineage(projectId);
    const transformInputs = await jsondocRepo.getAllProjectTransformInputsForLineage(projectId);
    const transformOutputs = await jsondocRepo.getAllProjectTransformOutputsForLineage(projectId);

    // Build lineage graph for canonical context computation
    const lineageGraph = buildLineageGraph(
        jsondocs,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    // Compute canonical jsondocs context
    const canonicalContext = computeCanonicalJsondocsFromLineage(
        lineageGraph,
        jsondocs,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    // Build filtered tools based on canonical context
    const tools = computeAvailableToolsFromCanonicalContext(
        canonicalContext,
        transformRepo,
        jsondocRepo,
        projectId,
        userId,
        cachingOptions
    );
    console.log(`[AgentConfigBuilder] Built ${tools.length} filtered tools based on canonical context`);
    console.log(`[AgentConfigBuilder] Available tools: ${tools.map(t => t.name).join(', ')}`);

    const config = {
        requestType,
        context,
        prompt,
        tools
    };

    console.log(`[AgentConfigBuilder] Final config requestType: ${config.requestType}`);
    return config;
} 