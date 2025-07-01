import { z } from 'zod';
import { TransformRepository } from '../transform-artifact-framework/TransformRepository';
import { ArtifactRepository } from '../transform-artifact-framework/ArtifactRepository';
import {
    OutlineSettingsInputSchema,
    OutlineSettingsInput,
    OutlineSettingsOutputSchema,
    OutlineSettingsOutput
} from '../../common/schemas/outlineSchemas';
import {
    executeStreamingTransform,
    StreamingTransformConfig
} from '../transform-artifact-framework/StreamingTransformExecutor';
import type { StreamingToolDefinition } from '../transform-artifact-framework/StreamingAgentFramework';

const OutlineSettingsToolResultSchema = z.object({
    outputArtifactId: z.string(),
    finishReason: z.string()
});

interface OutlineSettingsToolResult {
    outputArtifactId: string;
    finishReason: string;
}

/**
 * Factory function that creates an outline settings generation tool definition
 */
export function createOutlineSettingsToolDefinition(
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
): StreamingToolDefinition<OutlineSettingsInput, OutlineSettingsToolResult> {
    return {
        name: 'generate_outline_settings',
        description: '基于选定的故事创意生成剧本框架（人物角色、故事背景、商业定位等），为后续时序大纲奠定基础。适用场景：用户已有满意的故事创意，需要先确定基础设定再进行时序发展。必须使用项目背景信息中显示的完整artifact ID作为sourceArtifactId参数。',
        inputSchema: OutlineSettingsInputSchema,
        outputSchema: OutlineSettingsToolResultSchema,
        execute: async (params: OutlineSettingsInput, { toolCallId }): Promise<OutlineSettingsToolResult> => {
            console.log(`[OutlineSettingsTool] Starting streaming outline settings generation for artifact ${params.sourceArtifactId}`);

            // Extract source idea data first
            const sourceArtifact = await artifactRepo.getArtifact(params.sourceArtifactId);
            if (!sourceArtifact) {
                throw new Error('Source brainstorm idea not found');
            }

            // Verify user has access to this artifact's project
            const hasAccess = await artifactRepo.userHasProjectAccess(userId, sourceArtifact.project_id);
            if (!hasAccess) {
                throw new Error('Access denied to source artifact');
            }

            // Extract source idea data
            let sourceIdeaData: { title: string; body: string };
            if (sourceArtifact.type === 'brainstorm_idea') {
                // Check if it's a user_input schema (from human transform) or direct brainstorm_idea
                if (sourceArtifact.schema_type === 'user_input_schema') {
                    // User input artifact - check for derived_data in metadata or direct data
                    const derivedData = sourceArtifact.metadata?.derived_data;
                    if (derivedData && derivedData.title && derivedData.body) {
                        sourceIdeaData = {
                            title: derivedData.title,
                            body: derivedData.body
                        };
                    } else if (sourceArtifact.data.title && sourceArtifact.data.body) {
                        // Direct data structure
                        sourceIdeaData = {
                            title: sourceArtifact.data.title,
                            body: sourceArtifact.data.body
                        };
                    } else {
                        throw new Error('Invalid user input artifact for outline settings generation');
                    }
                } else {
                    // Direct brainstorm idea
                    sourceIdeaData = {
                        title: sourceArtifact.data.title,
                        body: sourceArtifact.data.body
                    };
                }
            } else if (sourceArtifact.type === 'user_input') {
                const derivedData = sourceArtifact.metadata?.derived_data;
                if (!derivedData || !derivedData.title || !derivedData.body) {
                    throw new Error('Invalid user input artifact for outline settings generation');
                }
                sourceIdeaData = {
                    title: derivedData.title,
                    body: derivedData.body
                };
            } else {
                throw new Error(`Unsupported source artifact type: ${sourceArtifact.type}`);
            }

            console.log(`[OutlineSettingsTool] Using source idea: ${sourceIdeaData.title}`);

            // Create streaming config with extracted data
            const config: StreamingTransformConfig<OutlineSettingsInput, OutlineSettingsOutput> = {
                templateName: 'outline_settings',
                inputSchema: OutlineSettingsInputSchema,
                outputSchema: OutlineSettingsOutputSchema,
                prepareTemplateVariables: (input) => {
                    // Use default values for template variables that aren't in the input schema
                    const episodeInfo = `总共60集，每集2分钟`; // Default episode configuration
                    const platform = '抖音'; // Default platform
                    const genre = '现代甜宠'; // Default genre

                    return ({
                        userInput: `${sourceIdeaData.title}\n\n${sourceIdeaData.body}`,
                        totalEpisodes: '60',
                        episodeInfo: episodeInfo,
                        platform: platform,
                        genre: genre,
                        requirements: input.requirements || '无特殊要求'
                    });
                },
                // Extract source artifact for proper lineage
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
                outputArtifactType: 'outline_settings',
                transformMetadata: {
                    toolName: 'generate_outline_settings',
                    source_artifact_id: params.sourceArtifactId,
                    source_idea_title: sourceIdeaData.title,
                    title: params.title,
                    requirements: params.requirements
                },
                // Pass caching options from factory
                enableCaching: cachingOptions?.enableCaching,
                seed: cachingOptions?.seed,
                temperature: cachingOptions?.temperature,
                topP: cachingOptions?.topP,
                maxTokens: cachingOptions?.maxTokens
            });

            console.log(`[OutlineSettingsTool] Successfully completed streaming outline settings generation with artifact ${result.outputArtifactId}`);

            return {
                outputArtifactId: result.outputArtifactId,
                finishReason: result.finishReason
            };
        },
    };
} 