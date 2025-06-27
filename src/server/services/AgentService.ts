import { z } from 'zod';
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { runStreamingAgent } from './StreamingAgentFramework';
import { createBrainstormToolDefinition } from '../tools/BrainstormTool';
import { createBrainstormEditToolDefinition } from '../tools/BrainstormEditTool';
import { AgentBrainstormRequest } from '../../common/types';
import {
    extractEffectiveBrainstormIdeas,
    convertEffectiveIdeasToIdeaWithTitle
} from '../../common/utils/lineageResolution';

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

            // 1. Prepare context for agent by gathering brainstorm artifacts
            const contextString = await this.preparePromptContext(projectId);

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

            // 3. Enhanced user request with context
            const enhancedUserRequest = `${request.userRequest}

**当前项目背景信息：**
${contextString}

**可用工具与使用指南：**

1. **generate_brainstorm_ideas** - 生成新的故事创意
   - 适用场景：用户想要全新的故事想法、需要更多创意选择、或当前没有满意的故事创意时
   - 例如："给我一些新的故事想法"、"再想几个不同的创意"

2. **edit_brainstorm_idea** - 编辑和改进现有故事创意  
   - 适用场景：用户对现有创意有具体的修改要求或改进建议
   - **重要：必须使用上面显示的完整ID作为sourceArtifactId参数**
   - 支持各种编辑类型：
     * 内容扩展："每个再长一点"、"详细一些"、"展开描述"
     * 风格调整："太老套，创新一点"、"更有趣一些"、"换个风格"
     * 情节修改："改成现代背景"、"加入悬疑元素"、"让主角更强势"
     * 结构调整："重新安排情节"、"调整人物关系"
     * 其他改进："更符合年轻人口味"、"增加商业价值"等

**分析指导：**
- 仔细理解用户的真实意图和需求
- 如果用户提到现有创意的具体问题或改进方向，优先使用edit工具
- 如果用户想要全新的内容或对现有创意完全不满意，使用generate工具
- 编辑时要准确理解用户的修改要求，并在editingInstructions中详细说明
- 确保选择最符合用户需求的工具和参数`;

            // 4. Run the agent with both tools available
            const agentResult = await runStreamingAgent({
                userRequest: enhancedUserRequest,
                toolDefinitions: [brainstormToolDef, brainstormEditToolDef],
                maxSteps: 5, // Allow more steps for complex editing workflows
                projectId: projectId,
                chatMessageRepo: this.chatMessageRepo
            });

            // 5. Log successful completion
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

    /**
     * Prepare prompt context with effective brainstorm ideas using principled lineage resolution
     */
    private async preparePromptContext(projectId: string): Promise<string> {
        try {
            // Get all project data needed for lineage resolution
            const artifacts = await this.artifactRepo.getAllProjectArtifactsForLineage(projectId);
            const transforms = await this.artifactRepo.getAllProjectTransformsForLineage(projectId);
            const humanTransforms = await this.artifactRepo.getAllProjectHumanTransformsForLineage(projectId);
            const transformInputs = await this.artifactRepo.getAllProjectTransformInputsForLineage(projectId);
            const transformOutputs = await this.artifactRepo.getAllProjectTransformOutputsForLineage(projectId);

            // Use principled lineage resolution to get effective brainstorm ideas
            const effectiveIdeas = extractEffectiveBrainstormIdeas(
                artifacts,
                transforms,
                humanTransforms,
                transformInputs,
                transformOutputs
            );

            if (effectiveIdeas.length === 0) {
                return '当前项目还没有故事创意。';
            }

            // Convert to IdeaWithTitle format for easier handling
            const ideaList = convertEffectiveIdeasToIdeaWithTitle(effectiveIdeas, artifacts);

            let contextString = '**当前项目的故事创意：**\n\n';

            // Format ideas for LLM consumption
            ideaList.forEach((idea, index) => {
                const statusIndicator = idea.artifactId !== idea.originalArtifactId ? ' [已编辑]' : ' [AI生成]';
                const title = idea.title || `想法 ${index + 1}`;
                const body = idea.body || '内容加载中...';

                contextString += `${index + 1}. **${title}**${statusIndicator} (ID: ${idea.artifactId})\n`;
                contextString += `   ${body}\n\n`;
            });

            contextString += '\n**编辑说明：** 如果需要编辑某个故事创意，请使用上面显示的ID作为sourceArtifactId参数。已编辑的创意是用户修改后的最新版本。\n';

            return contextString;

        } catch (error) {
            console.error('[AgentService] Error preparing prompt context:', error);
            return '无法获取项目背景信息。';
        }
    }

    public async runBrainstormAgent(
        projectId: string,
        userId: string,
        request: AgentBrainstormRequest
    ) {
        let thinkingMessageId: string | undefined;
        let thinkingStartTime: string | undefined;

        try {
            // Log user request and start thinking using event-based messaging
            if (this.chatMessageRepo) {
                // Create user message event
                await this.chatMessageRepo.createUserMessage(projectId, request.userRequest);

                // Start agent thinking
                const thinkingInfo = await this.chatMessageRepo.createAgentThinkingMessage(
                    projectId,
                    '分析头脑风暴请求并生成创意故事想法'
                );
                thinkingMessageId = thinkingInfo.messageId;
                thinkingStartTime = thinkingInfo.startTime;
            }

            // 1. Create the tool definition. The tool's execute function will
            // be responsible for creating its own transform and artifacts.
            const brainstormToolDef = createBrainstormToolDefinition(
                this.transformRepo,
                this.artifactRepo,
                projectId,
                userId
            );

            // 2. Run the agent
            const agentResult = await runStreamingAgent({
                userRequest: request.userRequest,
                toolDefinitions: [brainstormToolDef],
                maxSteps: 3,
                projectId: projectId,
                chatMessageRepo: this.chatMessageRepo
            });

            // 3. Log successful completion
            if (this.chatMessageRepo && thinkingMessageId && thinkingStartTime) {
                // Finish thinking
                await this.chatMessageRepo.finishAgentThinking(
                    thinkingMessageId,
                    '分析头脑风暴请求并生成创意故事想法',
                    thinkingStartTime
                );

                // Add success response
                await this.chatMessageRepo.addAgentResponse(
                    thinkingMessageId,
                    '我已成功为您的项目生成了创意故事想法！您可以在头脑风暴结果中查看它们。'
                );
            }

            console.log(`[AgentService] Brainstorm agent completed for project ${projectId}.`);

        } catch (error) {
            console.error(`[AgentService] Brainstorm agent failed for project ${projectId}:`, error);

            // Log error to chat
            if (this.chatMessageRepo && thinkingMessageId) {
                await this.chatMessageRepo.addAgentError(
                    thinkingMessageId,
                    '生成故事想法时遇到错误。请重试，如果问题持续存在，请联系支持。'
                );
            }
        }
    }
} 