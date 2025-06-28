import { z } from 'zod';
import { prepareAgentPromptContext } from '../../common/utils/agentContext';
import { createBrainstormToolDefinition, createBrainstormEditToolDefinition } from '../tools/BrainstormTool';
import { IdeationInputSchema, IdeationOutputSchema } from '../../common/transform_schemas';
import { BrainstormEditInputSchema, BrainstormEditOutputSchema } from '../../common/schemas/transforms';
import type { TransformRepository } from '../repositories/TransformRepository';
import type { ArtifactRepository } from '../repositories/ArtifactRepository';
import type { GeneralAgentRequest } from './AgentService';
import type { StreamingToolDefinition } from './StreamingAgentFramework';

export interface AgentPromptToolsData {
    prompt: string;
    tools: Array<{
        name: string;
        description: string;
        inputSchema: any; // JSON Schema format
        outputSchema: any; // JSON Schema format
    }>;
    contextData: {
        artifacts: any[];
        transforms: any[];
        humanTransforms: any[];
        transformInputs: any[];
        transformOutputs: any[];
        contextString: string;
    };
}

/**
 * Pure function to generate agent prompt for general requests
 */
export async function generateAgentPrompt(
    request: GeneralAgentRequest,
    projectId: string,
    artifactRepo: ArtifactRepository
): Promise<string> {
    // Get all project data needed for lineage resolution
    const artifacts = await artifactRepo.getAllProjectArtifactsForLineage(projectId);
    const transforms = await artifactRepo.getAllProjectTransformsForLineage(projectId);
    const humanTransforms = await artifactRepo.getAllProjectHumanTransformsForLineage(projectId);
    const transformInputs = await artifactRepo.getAllProjectTransformInputsForLineage(projectId);
    const transformOutputs = await artifactRepo.getAllProjectTransformOutputsForLineage(projectId);

    const contextString = prepareAgentPromptContext({
        artifacts,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    });

    // Create complete prompt in Mandarin
    const completePrompt = `你是一个专业的AI助手，拥有专门的工具来帮助用户处理故事创意相关的请求。

**用户请求：** "${request.userRequest}"

**当前项目背景信息：**
${contextString}

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

    return completePrompt;
}

/**
 * Pure function to generate tool definitions for general agent
 */
export function generateAgentTools(
    { transformRepo, artifactRepo, projectId, userId }: { transformRepo: TransformRepository; artifactRepo: ArtifactRepository; projectId: string; userId: string; }): StreamingToolDefinition<any, any>[] {
    const brainstormToolDef = createBrainstormToolDefinition(
        transformRepo,
        artifactRepo,
        projectId,
        userId
    );

    const brainstormEditToolDef = createBrainstormEditToolDefinition(
        transformRepo,
        artifactRepo,
        projectId,
        userId
    );

    return [brainstormToolDef, brainstormEditToolDef];
}

/**
 * Pure function to generate complete agent data for debugging
 */
export async function generateAgentDebugData(
    request: GeneralAgentRequest,
    projectId: string,
    userId: string,
    transformRepo: TransformRepository,
    artifactRepo: ArtifactRepository
): Promise<AgentPromptToolsData> {
    // Get all project data for context
    const artifacts = await artifactRepo.getAllProjectArtifactsForLineage(projectId);
    const transforms = await artifactRepo.getAllProjectTransformsForLineage(projectId);
    const humanTransforms = await artifactRepo.getAllProjectHumanTransformsForLineage(projectId);
    const transformInputs = await artifactRepo.getAllProjectTransformInputsForLineage(projectId);
    const transformOutputs = await artifactRepo.getAllProjectTransformOutputsForLineage(projectId);

    const contextString = prepareAgentPromptContext({
        artifacts,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    });

    // Generate prompt
    const prompt = await generateAgentPrompt(request, projectId, artifactRepo);

    // Generate tools
    const toolDefinitions = generateAgentTools({ transformRepo, artifactRepo, projectId, userId });

    // Serialize tools for JSON with proper schema conversion
    const tools = toolDefinitions.map(tool => {
        let inputJsonSchema: z.ZodTypeAny;
        let outputJsonSchema: z.ZodTypeAny;

        // Convert Zod schemas to JSON Schema using Zod 4's toJSONSchema
        if (tool.name === 'generate_brainstorm_ideas') {
            inputJsonSchema = IdeationInputSchema;
            outputJsonSchema = IdeationOutputSchema;
        } else if (tool.name === 'edit_brainstorm_idea') {
            inputJsonSchema = BrainstormEditInputSchema;
            outputJsonSchema = BrainstormEditOutputSchema;
        } else {
            throw new Error(`Unknown tool name: ${tool.name}`);
        }


        return {
            name: tool.name,
            description: tool.description,
            inputSchema: inputJsonSchema,
            outputSchema: outputJsonSchema
        };
    });

    return {
        prompt,
        tools,
        contextData: {
            artifacts,
            transforms,
            humanTransforms,
            transformInputs,
            transformOutputs,
            contextString
        }
    };
} 