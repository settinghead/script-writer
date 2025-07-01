import { IdeationInputSchema, IdeationOutputSchema, IdeationInput, IdeationOutput } from '../../common/transform_schemas';
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import {
    executeStreamingTransform,
    StreamingTransformConfig
} from '../services/StreamingTransformExecutor';
import { LLMService } from '../services/LLMService';
import { brainstormEditTemplate } from '../services/templates/brainstormEdit';
import {
    BrainstormEditInputSchema,
    BrainstormEditInput,
    BrainstormEditOutputSchema,
    BrainstormEditOutput
} from '../../common/schemas/transforms';
import { extractDataAtPath } from '../services/transform-instantiations/pathTransforms';
import { cleanLLMContent, robustJSONParse } from '../../common/utils/textCleaning';
import type { StreamingToolDefinition } from '../services/StreamingAgentFramework';
import { z } from 'zod';

const BrainstormEditToolResultSchema = z.object({
    outputArtifactId: z.string(),
    finishReason: z.string(),
    originalIdea: z.object({
        title: z.string(),
        body: z.string()
    }).optional(),
    editedIdea: z.object({
        title: z.string(),
        body: z.string()
    }).optional()
});

const BrainstormToolResultSchema = z.object({
    outputArtifactId: z.string(),
    finishReason: z.string()
});

interface BrainstormEditToolResult {
    outputArtifactId: string;
    finishReason: string;
    originalIdea?: {
        title: string;
        body: string;
    };
    editedIdea?: {
        title: string;
        body: string;
    };
}

/**
 * Extract source idea data from different artifact types
 */
async function extractSourceIdeaData(
    params: BrainstormEditInput,
    artifactRepo: ArtifactRepository,
    userId: string
): Promise<{
    originalIdea: { title: string; body: string };
    targetPlatform: string;
    storyGenre: string;
}> {
    // Get source artifact and extract the idea to edit
    const sourceArtifact = await artifactRepo.getArtifact(params.sourceArtifactId);
    if (!sourceArtifact) {
        throw new Error('Source artifact not found');
    }

    // Verify user has access to this artifact's project
    const hasAccess = await artifactRepo.userHasProjectAccess(userId, sourceArtifact.project_id);
    if (!hasAccess) {
        throw new Error('Access denied to source artifact');
    }

    let sourceData = sourceArtifact.data;
    let originalIdea: { title: string; body: string };
    let targetPlatform = 'unknown';
    let storyGenre = 'unknown';

    if (sourceArtifact.type === 'brainstorm_idea_collection') {
        // Collection artifact - extract specific idea using JSONPath
        const ideaPath = `$.ideas[${params.ideaIndex}]`;
        try {
            const extractedIdea = extractDataAtPath(sourceData, ideaPath);
            if (!extractedIdea || !extractedIdea.title || !extractedIdea.body) {
                throw new Error(`Invalid idea at index ${params.ideaIndex} in collection`);
            }

            originalIdea = {
                title: extractedIdea.title,
                body: extractedIdea.body
            };

            // Get platform/genre from collection metadata
            targetPlatform = sourceData.platform || 'unknown';
            storyGenre = sourceData.genre || 'unknown';
        } catch (extractError) {
            throw new Error(`Failed to extract idea at index ${params.ideaIndex}: ${extractError instanceof Error ? extractError.message : String(extractError)}`);
        }
    } else if (sourceArtifact.type === 'brainstorm_idea') {
        // Direct brainstorm idea artifact
        if (!sourceData.title || !sourceData.body) {
            throw new Error('Invalid brainstorm idea artifact');
        }

        originalIdea = {
            title: sourceData.title,
            body: sourceData.body
        };

        if (sourceArtifact.metadata) {
            targetPlatform = sourceArtifact.metadata.platform || 'unknown';
            storyGenre = sourceArtifact.metadata.genre || 'unknown';
        }
    } else if (sourceArtifact.type === 'user_input') {
        // User-edited artifact - extract from derived data
        let derivedData = sourceArtifact.metadata?.derived_data;
        if (!derivedData && sourceData.text) {
            try {
                derivedData = JSON.parse(sourceData.text);
            } catch (e) {
                throw new Error('Failed to parse user input data');
            }
        }

        if (!derivedData || !derivedData.title || !derivedData.body) {
            throw new Error('Invalid user input artifact');
        }

        originalIdea = {
            title: derivedData.title,
            body: derivedData.body
        };

        // Try to get platform/genre from original artifact metadata
        if (sourceArtifact.metadata?.original_artifact_id) {
            const originalArtifact = await artifactRepo.getArtifact(sourceArtifact.metadata.original_artifact_id);
            if (originalArtifact?.metadata) {
                targetPlatform = originalArtifact.metadata.platform || 'unknown';
                storyGenre = originalArtifact.metadata.genre || 'unknown';
            }
        }
    } else {
        throw new Error(`Unsupported source artifact type: ${sourceArtifact.type}`);
    }

    return { originalIdea, targetPlatform, storyGenre };
}

/**
 * Factory function that creates a brainstorm edit tool definition using the new streaming framework
 */
export function createBrainstormEditToolDefinition(
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
): StreamingToolDefinition<BrainstormEditInput, BrainstormEditToolResult> {
    return {
        name: 'edit_brainstorm_idea',
        description: '编辑和改进现有故事创意。适用场景：用户对现有创意有具体的修改要求或改进建议。重要：必须使用项目背景信息中显示的完整ID作为sourceArtifactId参数。支持各种编辑类型：内容扩展（"每个再长一点"、"详细一些"）、风格调整（"太老套，创新一点"、"更有趣一些"）、情节修改（"改成现代背景"、"加入悬疑元素"）、结构调整（"重新安排情节"、"调整人物关系"）、其他改进（"更符合年轻人口味"、"增加商业价值"）等。',
        inputSchema: BrainstormEditInputSchema,
        outputSchema: BrainstormEditToolResultSchema,
        execute: async (params: BrainstormEditInput, { toolCallId }): Promise<BrainstormEditToolResult> => {
            console.log(`[BrainstormEditTool] Starting streaming edit for artifact ${params.sourceArtifactId}`);

            // Extract source idea data for context - this must be done first
            const { originalIdea, targetPlatform, storyGenre } = await extractSourceIdeaData(params, artifactRepo, userId);

            // Create config with extracted data
            const config: StreamingTransformConfig<BrainstormEditInput, BrainstormEditOutput> = {
                templateName: 'brainstorm_edit',
                inputSchema: BrainstormEditInputSchema,
                outputSchema: BrainstormEditOutputSchema,
                prepareTemplateVariables: (input) => ({
                    originalTitle: originalIdea.title,
                    originalBody: originalIdea.body,
                    targetPlatform: targetPlatform,
                    storyGenre: storyGenre,
                    editRequirements: input.editRequirements,
                    agentInstructions: input.agentInstructions || '请根据用户要求进行适当的改进和优化。'
                }),
                // NEW: Extract source artifact for proper lineage
                extractSourceArtifacts: (input) => [{
                    artifactId: input.sourceArtifactId,
                    inputRole: 'source'
                }]
            };

            const result = await executeStreamingTransform({
                config,
                input: params,
                projectId,
                userId,
                transformRepo,
                artifactRepo,
                outputArtifactType: 'brainstorm_idea',
                transformMetadata: {
                    toolName: 'edit_brainstorm_idea',
                    source_artifact_id: params.sourceArtifactId,
                    idea_index: params.ideaIndex,
                    edit_requirements: params.editRequirements,
                    original_idea: originalIdea,
                    platform: targetPlatform,
                    genre: storyGenre
                },
                // Pass caching options from factory
                enableCaching: cachingOptions?.enableCaching,
                seed: cachingOptions?.seed,
                temperature: cachingOptions?.temperature,
                topP: cachingOptions?.topP,
                maxTokens: cachingOptions?.maxTokens
            });

            console.log(`[BrainstormEditTool] Successfully completed streaming edit with artifact ${result.outputArtifactId}`);

            return {
                outputArtifactId: result.outputArtifactId,
                finishReason: result.finishReason,
                originalIdea,
                editedIdea: undefined // Will be populated by the actual artifact data
            };
        }
    };
}

// Tool execution result type - now returns single collection artifact ID
interface BrainstormToolResult {
    outputArtifactId: string; // Single collection artifact ID
    finishReason: string;
}

// Collection-based brainstorm tool - no longer needs individual idea caching

/**
 * Build requirements section for brainstorming template
 */
function buildRequirementsSection(input: IdeationInput): string {
    // Build requirements based on actual input parameters
    const parts: string[] = [];

    // Add platform and genre context
    parts.push(`请为${input.platform}平台创作${input.genre}类型的故事创意。`);

    // Add user requirements if provided
    if (input.other_requirements) {
        parts.push(`用户要求: ${input.other_requirements}`);
    }

    return parts.join('\n');
}

/**
 * Transform LLM output (array of ideas) to collection artifact format
 */
function transformToCollectionFormat(llmOutput: IdeationOutput, input: IdeationInput): any {
    const collectionIdeas = llmOutput
        .filter((idea: any) => idea && idea.title && idea.body && idea.body.length >= 10)
        .map((idea: any, index: number) => ({
            title: idea.title,
            body: idea.body,
            metadata: {
                ideaIndex: index,
                confidence_score: 0.8 // Default confidence
            }
        }));

    return {
        ideas: collectionIdeas,
        platform: input.platform,
        genre: input.genre,
        total_ideas: collectionIdeas.length
    };
}

/**
 * Factory function that creates a brainstorm tool definition using the new streaming framework
 */
export function createBrainstormToolDefinition(
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
): StreamingToolDefinition<IdeationInput, BrainstormToolResult> {
    const config: StreamingTransformConfig<IdeationInput, IdeationOutput> = {
        templateName: 'brainstorming',
        inputSchema: IdeationInputSchema,
        outputSchema: IdeationOutputSchema,
        prepareTemplateVariables: (input) => ({
            genre: input.genre,
            platform: input.platform,
            requirementsSection: buildRequirementsSection(input)
        }),
        transformLLMOutput: transformToCollectionFormat
    };

    return {
        name: 'generate_brainstorm_ideas',
        description: '生成新的故事创意。适用场景：用户想要全新的故事想法、需要更多创意选择、或当前没有满意的故事创意时。例如："给我一些新的故事想法"、"再想几个不同的创意"。基于平台和类型生成适合短视频内容的创意故事概念。',
        inputSchema: IdeationInputSchema,
        outputSchema: BrainstormToolResultSchema,
        execute: async (params: IdeationInput): Promise<BrainstormToolResult> => {
            const result = await executeStreamingTransform({
                config,
                input: params,
                projectId,
                userId,
                transformRepo,
                artifactRepo,
                outputArtifactType: 'brainstorm_idea_collection',
                transformMetadata: {
                    toolName: 'generate_brainstorm_ideas',
                    platform: params.platform,
                    genre: params.genre,
                    initialData: {
                        ideas: [],
                        platform: params.platform,
                        genre: params.genre,
                        total_ideas: 0
                    }
                },
                // Pass caching options from factory
                enableCaching: cachingOptions?.enableCaching,
                seed: cachingOptions?.seed,
                temperature: cachingOptions?.temperature,
                topP: cachingOptions?.topP,
                maxTokens: cachingOptions?.maxTokens
            });

            return {
                outputArtifactId: result.outputArtifactId,
                finishReason: result.finishReason
            };
        }
    };
} 