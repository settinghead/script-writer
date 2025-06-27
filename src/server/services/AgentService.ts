import { z } from 'zod';
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { runStreamingAgent } from './StreamingAgentFramework';
import { createBrainstormToolDefinition } from '../tools/BrainstormTool';
import { createBrainstormEditToolDefinition } from '../tools/BrainstormEditTool';
import { AgentBrainstormRequest } from '../../common/types';
import { prepareAgentPromptContext } from '../../common/utils/agentContext';

// Schema for general agent requests
export const GeneralAgentRequestSchema = z.object({
    userRequest: z.string(),
    projectId: z.string(),
    contextType: z.enum(['brainstorm', 'general']).optional(),
    contextData: z.any().optional() // Additional context data
});

export type GeneralAgentRequest = z.infer<typeof GeneralAgentRequestSchema>;

export class AgentService {
    private chatMessageRepo?: any; // Injected later to avoid circular dependency

    constructor(
        private transformRepo: TransformRepository,
        private artifactRepo: ArtifactRepository,
    ) { }

    // Method to inject chat repository after initialization
    public setChatMessageRepository(chatMessageRepo: any) {
        this.chatMessageRepo = chatMessageRepo;
    }

    /**
     * General agent method that can handle various types of requests including brainstorm editing
     */
    public async runGeneralAgent(
        projectId: string,
        userId: string,
        request: GeneralAgentRequest,
        options: {
            createChatMessages?: boolean;
            existingThinkingMessageId?: string;
            existingThinkingStartTime?: string;
        } = { createChatMessages: true }
    ) {
        let thinkingMessageId: string | undefined;
        let thinkingStartTime: string | undefined;

        try {
            // Handle chat messages based on options
            if (options.createChatMessages && this.chatMessageRepo) {
                // Create user message event (only if not called from ChatService)
                await this.chatMessageRepo.createUserMessage(projectId, request.userRequest);

                // Start agent thinking
                const thinkingInfo = await this.chatMessageRepo.createAgentThinkingMessage(
                    projectId,
                    '分析用户请求并选择合适的工具执行'
                );
                thinkingMessageId = thinkingInfo.messageId;
                thinkingStartTime = thinkingInfo.startTime;
            } else if (options.existingThinkingMessageId && options.existingThinkingStartTime) {
                // Use existing thinking message from ChatService
                thinkingMessageId = options.existingThinkingMessageId;
                thinkingStartTime = options.existingThinkingStartTime;
            }

            const artifacts = await this.artifactRepo.getAllProjectArtifactsForLineage(projectId);
            const transforms = await this.artifactRepo.getAllProjectTransformsForLineage(projectId);
            const humanTransforms = await this.artifactRepo.getAllProjectHumanTransformsForLineage(projectId);
            const transformInputs = await this.artifactRepo.getAllProjectTransformInputsForLineage(projectId);
            const transformOutputs = await this.artifactRepo.getAllProjectTransformOutputsForLineage(projectId);

            const contextString = await prepareAgentPromptContext({
                artifacts,
                transforms,
                humanTransforms,
                transformInputs,
                transformOutputs
            })

            // 2. Create tool definitions - include both brainstorm generation and editing tools
            const brainstormToolDef = createBrainstormToolDefinition(
                this.transformRepo,
                this.artifactRepo,
                projectId,
                userId
            );

            const brainstormEditToolDef = createBrainstormEditToolDefinition(
                this.transformRepo,
                this.artifactRepo,
                projectId,
                userId
            );

            // 3. Create complete prompt in Mandarin
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

            // 4. Save user request as raw message
            if (this.chatMessageRepo) {
                await this.chatMessageRepo.createRawMessage(
                    projectId,
                    'user',
                    request.userRequest,
                    { metadata: { source: 'streaming_agent' } }
                );
            }

            // 5. Run the agent with both tools available
            const agentResult = await runStreamingAgent({
                prompt: completePrompt,
                toolDefinitions: [brainstormToolDef, brainstormEditToolDef],
                maxSteps: 5, // Allow more steps for complex editing workflows
                projectId: projectId,
                chatMessageRepo: this.chatMessageRepo
            });

            // 6. Log successful completion
            if (this.chatMessageRepo && thinkingMessageId && thinkingStartTime) {
                // Finish thinking
                await this.chatMessageRepo.finishAgentThinking(
                    thinkingMessageId,
                    '分析用户请求并选择合适的工具执行',
                    thinkingStartTime
                );

                // Add success response based on what was done
                let responseMessage = '我已成功处理您的请求！';
                if (agentResult.toolResults.some(r => r.toolName === 'generate_brainstorm_ideas')) {
                    responseMessage = '我已成功为您的项目生成了创意故事想法！您可以在头脑风暴结果中查看它们。';
                } else if (agentResult.toolResults.some(r => r.toolName === 'edit_brainstorm_idea')) {
                    responseMessage = '我已成功根据您的要求改进了故事创意！您可以查看更新后的想法。';
                }

                await this.chatMessageRepo.addAgentResponse(
                    thinkingMessageId,
                    responseMessage
                );
            }

            console.log(`[AgentService] General agent completed for project ${projectId}.`);

        } catch (error) {
            console.error(`[AgentService] General agent failed for project ${projectId}:`, error);

            // Log error to chat
            if (this.chatMessageRepo && thinkingMessageId) {
                await this.chatMessageRepo.addAgentError(
                    thinkingMessageId,
                    '处理您的请求时遇到错误。请重试，如果问题持续存在，请联系支持。'
                );
            }
        }
    }



} 