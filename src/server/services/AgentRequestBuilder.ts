import { z } from 'zod';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { computeCanonicalJsondocsFromLineage, type CanonicalJsondocContext } from '../../common/canonicalJsondocLogic';
import { buildLineageGraph } from '../../common/transform-jsondoc-framework/lineageResolution';
import { createBrainstormToolDefinition } from '../tools/BrainstormGenerationTool';
import { createBrainstormEditToolDefinition } from '../tools/BrainstormEditTool';
import { createOutlineSettingsToolDefinition, createOutlineSettingsEditToolDefinition } from '../tools/OutlineSettingsTool';
import { createChroniclesToolDefinition, createChroniclesEditToolDefinition } from '../tools/ChroniclesTool';
import { createEpisodePlanningToolDefinition, createEpisodePlanningEditToolDefinition } from '../tools/EpisodePlanningTool';
import { createEpisodeSynopsisToolDefinition } from '../tools/EpisodeSynopsisTool';
import { createEpisodeScriptToolDefinition } from '../tools/EpisodeScriptTool';
import { createQueryToolDefinition } from '../tools/QueryTool';
import { createGetJsondocContentToolDefinition } from '../tools/GetJsondocContentTool';
import { generateCanonicalContentStructure } from '../utils/canonicalContentStructure';
import type { GeneralAgentRequest } from '../transform-jsondoc-framework/AgentService';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';
import { getParticleSearchToolNames, getWorkflowTools, type WorkflowStage } from '../../common/schemas/tools';
import { getParticleSystem } from './ParticleSystemInitializer';

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
    return `你是觅光助管理经理，一个管理剧本创作的经理，拥有专门的工具来帮助用户处理短剧剧本创作、编辑与查询的请求。你自己的创意不如这些工具的创造力，所以你主要职责是调度，而不是创作。

## 背景信息：剧本的创作过程
剧本创作和修改在觅光系统里，要经过以下几个步骤：
1. **头脑风暴输入 (brainstorm_input)**：用户提供创意参数，包括平台类型（抖音、快手、小红书等）、题材偏好、目标受众等基础信息
2. **故事创意生成 (灵感创意)**：AI基于头脑风暴参数生成多个故事想法，用户可以选择最满意的创意，或者手动输入单个创意
3. **创意选择与编辑**：用户从AI生成的多个创意中选择一个，或者对选定的创意进行进一步编辑和完善
4. **剧本设定生成 (剧本设定)**：基于选定的创意生成详细的剧本框架，包括人物角色设定、故事背景、商业卖点、爽点设计等
5. **时间顺序大纲生成 (chronicles)**：创建完整的故事时序结构，按照故事内在逻辑顺序（非播出顺序）梳理剧情发展脉络
6. **分集结构生成 (episode_planning)**：基于时间顺序大纲，重新组织内容为适合短视频平台的分集结构，优化观看节奏和悬念设置
7. **分集大纲生成 (episode_synopsis)**：为每个剧集组生成详细的单集大纲，包含具体情节和转折点
8. **剧本撰写 (episode_script)**：基于分集大纲生成完整的剧本内容，包含对话、动作指导和场景描述（注意这部分还没有实现）

### 一些例子

#### 示例1： 
用户说：“应该有个新人物，她是配角，也对男主有意思”
意图分类：修改
你的动作：
1. 使用queryJsondocs查询目前的人物角色设定（比如：“男主 恋爱对象”）
2. 根据历史信息，用"improve_剧本设定"工具，创建新人物，比如”小花“，给工具的instruction: “添加一个新人物，名叫小花。小花在李成被罚钱时出现，并且帮助了他，而且对李成有好感”
3. 回复一个友好的消息，{ "humanReadableMessage"：“好的，已经添加了新人物小花，并且让小花在李成最低谷时出现，帮助了他...” }


===当前用户请求 开始===
"${userRequest}"
===当前用户请求 结束===

===当前项目背景信息 开始===
"${context}"
===当前项目背景信息 结束===

## 你的任务

1. 仔细分析用户请求，理解用户的真实意图（分为三类：修改、生成、查询）
2. 理解结构概览（i.e. 目前项目里有什么），并理解用户提出要求的作用对象（一般为剧本创作过程中最近期的步骤jsondoc类型）
3. 根据用户请求，使用queryJsondocs进行相关查询或者使用getJsonDocContent精准得到相关的内容，直到你经掌握足够的信息继续
4. 
   a) 如果你认为用户意图为“修改”：调用可用列表里的“improve_”开头的工具，根据“当前用户请求”里的内容（见上）以及现有剧本内容，调用相应工具
   b) 如果你认为用户意图为“生成”：调用可用列表里的“generate_”开头的工具，根据“当前用户请求”里的内容（见上）以及现有剧本内容，调用相应工具
   c) 如果你认为用户意图为“查询”：根据你查询到的信息，精准回答用户查询的内容
4. 完成后，返回JSON格式的最终响应（见以下）


**你的回复的JSON格式要求：**
{
  "humanReadableMessage": "对用户友好的中文回复消息，尽量简洁"
}

注意：
1. 在用户友好信息里，不要透露任何工具调用的细节，而是用简单和模糊的语言告知用户你正在做什么
- 如果需要编辑多个步骤时，遵循依赖顺序：先编辑上游内容（如创意），然后编辑依赖的下游内容（如框架）
2. 尽量根据用户意图直接调用工具，不要进一步向用户征询或明确用户意图；用户希望你能直接完成任务
3. 不要试图创作， 或者想点子；你的主要职责是调度，创造力不如这些工具的创造力；请尽量将创造力、想点子的任务留给工具；你的任务是分析用户意图，并将要求准确地传达给工具

`;
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
            // console.log(`[AgentRequestBuilder] Added particle search tools (${particleSearchTools.length}):`, particleSearchTools);
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
        hasEpisodePlanning,
        hasEpisodeSynopsis
    };

    const workflowToolNames = getWorkflowTools(workflowStage);

    // Map workflow tool names to actual tool factory functions
    workflowToolNames.forEach(toolName => {
        switch (toolName) {
            case 'generate_灵感创意s':
                addTool(() => createBrainstormToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions));
                break;
            case 'improve_灵感创意':
                addTool(() => createBrainstormEditToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions));
                break;
            case 'generate_剧本设定':
                addTool(() => createOutlineSettingsToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions));
                break;
            case 'improve_剧本设定':
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
            case 'generate_episode_script':
                addTool(() => createEpisodeScriptToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions));
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