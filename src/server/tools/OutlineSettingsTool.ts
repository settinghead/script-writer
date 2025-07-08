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
        description: '基于选定的故事创意生成剧本框架（人物角色、故事背景、商业定位等），为后续时间顺序大纲奠定基础。适用场景：用户已有满意的故事创意，需要先确定基础设定再进行时序发展。必须使用项目背景信息中显示的完整artifact ID作为sourceArtifactId参数。',
        inputSchema: OutlineSettingsInputSchema,
        outputSchema: OutlineSettingsToolResultSchema,
        execute: async (params: OutlineSettingsInput, { toolCallId }): Promise<OutlineSettingsToolResult> => {
            console.log(`[OutlineSettingsTool] Starting streaming outline settings generation for artifact ${params.sourceArtifactId}`);
            console.log(`[OutlineSettingsTool] Input params:`, JSON.stringify(params, null, 2));

            // Extract source idea data first
            const sourceArtifact = await artifactRepo.getArtifact(params.sourceArtifactId);
            if (!sourceArtifact) {
                console.error(`[OutlineSettingsTool] Source artifact not found: ${params.sourceArtifactId}`);
                throw new Error('Source brainstorm idea not found');
            }

            console.log(`[OutlineSettingsTool] Found source artifact:`, {
                id: sourceArtifact.id,
                type: sourceArtifact.type,
                schema_type: sourceArtifact.schema_type,
                origin_type: sourceArtifact.origin_type,
                project_id: sourceArtifact.project_id
            });

            // Verify user has access to this artifact's project
            const hasAccess = await artifactRepo.userHasProjectAccess(userId, sourceArtifact.project_id);
            if (!hasAccess) {
                throw new Error('Access denied to source artifact');
            }

            // Extract source content - flexible approach that works with any artifact
            console.log(`[OutlineSettingsTool] Processing artifact type: ${sourceArtifact.type}, schema_type: ${sourceArtifact.schema_type}`);
            console.log(`[OutlineSettingsTool] Source artifact data:`, typeof sourceArtifact.data === 'object' ?
                `{${Object.keys(sourceArtifact.data || {}).join(', ')}} (${JSON.stringify(sourceArtifact.data).length} chars)` :
                sourceArtifact.data);
            console.log(`[OutlineSettingsTool] Source artifact metadata:`, typeof sourceArtifact.metadata === 'object' ?
                `{${Object.keys(sourceArtifact.metadata || {}).join(', ')}} (${JSON.stringify(sourceArtifact.metadata).length} chars)` :
                sourceArtifact.metadata);

            // Create a comprehensive source content by combining all available information
            let sourceContent = '';

            // Add basic artifact info
            sourceContent += `Artifact Type: ${sourceArtifact.type}\n`;
            sourceContent += `Schema Type: ${sourceArtifact.schema_type || 'N/A'}\n`;
            sourceContent += `Origin: ${sourceArtifact.origin_type || 'N/A'}\n\n`;

            // Add main data content
            sourceContent += `Main Content:\n${JSON.stringify(sourceArtifact.data, null, 2)}\n\n`;

            // Add metadata if available and contains useful info
            if (sourceArtifact.metadata && Object.keys(sourceArtifact.metadata).length > 0) {
                sourceContent += `Metadata:\n${JSON.stringify(sourceArtifact.metadata, null, 2)}\n\n`;
            }

            // Try to extract a title for logging purposes (best effort)
            let displayTitle = 'Unknown';
            try {
                if (sourceArtifact.data && typeof sourceArtifact.data === 'object') {
                    if ('title' in sourceArtifact.data) {
                        displayTitle = String(sourceArtifact.data.title);
                    } else if (sourceArtifact.metadata?.derived_data?.title) {
                        displayTitle = String(sourceArtifact.metadata.derived_data.title);
                    }
                }
            } catch (e) {
                // Ignore extraction errors, use default
            }

            console.log(`[OutlineSettingsTool] Using source content for artifact: ${displayTitle}`);
            console.log(`[OutlineSettingsTool] Source content length: ${sourceContent.length} characters`);

            // Create streaming config with extracted data
            console.log(`[OutlineSettingsTool] Creating streaming config for template: outline_settings`);
            const config: StreamingTransformConfig<OutlineSettingsInput, OutlineSettingsOutput> = {
                templateName: 'outline_settings',
                inputSchema: OutlineSettingsInputSchema,
                outputSchema: OutlineSettingsOutputSchema,
                prepareTemplateVariables: (input) => {
                    // Use default values for template variables that aren't in the input schema
                    const episodeInfo = `总共60集，每集2分钟`; // Default episode configuration
                    const platform = '抖音'; // Default platform
                    const genre = '现代甜宠'; // Default genre

                    const templateVars = {
                        userInput: sourceContent, // Use the comprehensive source content
                        totalEpisodes: '60',
                        episodeInfo: episodeInfo,
                        platform: platform,
                        genre: genre,
                        requirements: input.requirements || '无特殊要求'
                    };

                    console.log(`[OutlineSettingsTool] Prepared template variables:`, {
                        userInput: `${templateVars.userInput.substring(0, 200)}... (${templateVars.userInput.length} chars total)`,
                        totalEpisodes: templateVars.totalEpisodes,
                        episodeInfo: templateVars.episodeInfo,
                        platform: templateVars.platform,
                        genre: templateVars.genre,
                        requirements: templateVars.requirements
                    });
                    return templateVars;
                },
                // Extract source artifact for proper lineage
                extractSourceArtifacts: (input) => [{
                    artifactId: input.sourceArtifactId,
                    inputRole: 'source'
                }]
            };

            console.log(`[OutlineSettingsTool] Starting executeStreamingTransform with config:`, {
                templateName: config.templateName,
                outputArtifactType: 'outline_settings',
                projectId,
                userId,
                enableCaching: cachingOptions?.enableCaching
            });

            console.log(`[OutlineSettingsTool] About to call executeStreamingTransform with parameters:`);
            console.log(`[OutlineSettingsTool] - templateName: ${config.templateName}`);
            console.log(`[OutlineSettingsTool] - outputArtifactType: outline_settings`);
            console.log(`[OutlineSettingsTool] - projectId: ${projectId}`);
            console.log(`[OutlineSettingsTool] - userId: ${userId}`);
            console.log(`[OutlineSettingsTool] - enableCaching: ${cachingOptions?.enableCaching}`);
            console.log(`[OutlineSettingsTool] - maxTokens: ${cachingOptions?.maxTokens || 'undefined'}`);
            console.log(`[OutlineSettingsTool] - temperature: ${cachingOptions?.temperature || 'undefined'}`);

            let result;
            try {
                result = await executeStreamingTransform({
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
                        source_idea_title: displayTitle,
                        title: params.title,
                        requirements: params.requirements
                    },
                    // Pass caching options from factory
                    enableCaching: cachingOptions?.enableCaching,
                    seed: cachingOptions?.seed,
                    temperature: cachingOptions?.temperature,
                    topP: cachingOptions?.topP,
                    maxTokens: cachingOptions?.maxTokens || 4000  // Set default max tokens to prevent truncation
                });
                console.log(`[OutlineSettingsTool] executeStreamingTransform completed successfully`);
                console.log(`[OutlineSettingsTool] Result:`, {
                    outputArtifactId: result.outputArtifactId,
                    finishReason: result.finishReason
                });
            } catch (error) {
                console.error(`[OutlineSettingsTool] executeStreamingTransform failed:`, error);
                console.error(`[OutlineSettingsTool] Error type:`, typeof error);
                console.error(`[OutlineSettingsTool] Error message:`, error instanceof Error ? error.message : String(error));
                console.error(`[OutlineSettingsTool] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
                throw error;
            }

            console.log(`[OutlineSettingsTool] Successfully completed streaming outline settings generation with artifact ${result.outputArtifactId}`);

            return {
                outputArtifactId: result.outputArtifactId,
                finishReason: result.finishReason
            };
        },
    };
} 