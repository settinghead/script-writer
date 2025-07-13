import { z } from 'zod';
import { TransformRepository } from '../transform-jsonDoc-framework/TransformRepository';
import { JsonDocRepository } from '../transform-jsonDoc-framework/JsonDocRepository';
import {
    OutlineSettingsInputSchema,
    OutlineSettingsInput,
    OutlineSettingsOutputSchema,
    OutlineSettingsOutput
} from '../../common/schemas/outlineSchemas';
import {
    executeStreamingTransform,
    StreamingTransformConfig
} from '../transform-jsonDoc-framework/StreamingTransformExecutor';
import type { StreamingToolDefinition } from '../transform-jsonDoc-framework/StreamingAgentFramework';

const OutlineSettingsToolResultSchema = z.object({
    outputJsonDocId: z.string(),
    finishReason: z.string()
});

interface OutlineSettingsToolResult {
    outputJsonDocId: string;
    finishReason: string;
}

/**
 * Factory function that creates an outline settings generation tool definition
 */
export function createOutlineSettingsToolDefinition(
    transformRepo: TransformRepository,
    jsonDocRepo: JsonDocRepository,
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
        description: '基于选定的故事创意生成剧本框架（人物角色、故事背景、商业定位等），为后续时间顺序大纲奠定基础。适用场景：用户已有满意的故事创意，需要先确定基础设定再进行时序发展。必须使用项目背景信息中显示的完整jsonDoc ID作为sourceJsonDocId参数。',
        inputSchema: OutlineSettingsInputSchema,
        outputSchema: OutlineSettingsToolResultSchema,
        execute: async (params: OutlineSettingsInput, { toolCallId }): Promise<OutlineSettingsToolResult> => {
            console.log(`[OutlineSettingsTool] Starting streaming outline settings generation for jsonDoc ${params.sourceJsonDocId}`);
            console.log(`[OutlineSettingsTool] Input params:`, JSON.stringify(params, null, 2));

            // Extract source idea data first
            const sourceJsonDoc = await jsonDocRepo.getJsonDoc(params.sourceJsonDocId);
            if (!sourceJsonDoc) {
                console.error(`[OutlineSettingsTool] Source jsonDoc not found: ${params.sourceJsonDocId}`);
                throw new Error('Source brainstorm idea not found');
            }

            console.log(`[OutlineSettingsTool] Found source jsonDoc:`, {
                id: sourceJsonDoc.id,
                schema_version: sourceJsonDoc.schema_version,
                schema_type: sourceJsonDoc.schema_type,
                origin_type: sourceJsonDoc.origin_type,
                project_id: sourceJsonDoc.project_id
            });

            // Verify user has access to this jsonDoc's project
            const hasAccess = await jsonDocRepo.userHasProjectAccess(userId, sourceJsonDoc.project_id);
            if (!hasAccess) {
                throw new Error('Access denied to source jsonDoc');
            }

            // Extract source content - flexible approach that works with any jsonDoc
            console.log(`[OutlineSettingsTool] Processing jsonDoc type: ${sourceJsonDoc.schema_type}, schema_type: ${sourceJsonDoc.schema_type}`);
            console.log(`[OutlineSettingsTool] Source jsonDoc data:`, typeof sourceJsonDoc.data === 'object' ?
                `{${Object.keys(sourceJsonDoc.data || {}).join(', ')}} (${JSON.stringify(sourceJsonDoc.data).length} chars)` :
                sourceJsonDoc.data);
            console.log(`[OutlineSettingsTool] Source jsonDoc metadata:`, typeof sourceJsonDoc.metadata === 'object' ?
                `{${Object.keys(sourceJsonDoc.metadata || {}).join(', ')}} (${JSON.stringify(sourceJsonDoc.metadata).length} chars)` :
                sourceJsonDoc.metadata);

            // Create a comprehensive source content by combining all available information
            let sourceContent = '';

            // Add basic jsonDoc info
            sourceContent += `JsonDoc Type: ${sourceJsonDoc.schema_type}\n`;
            sourceContent += `Schema Type: ${sourceJsonDoc.schema_type || 'N/A'}\n`;
            sourceContent += `Origin: ${sourceJsonDoc.origin_type || 'N/A'}\n\n`;

            // Add main data content
            sourceContent += `Main Content:\n${JSON.stringify(sourceJsonDoc.data, null, 2)}\n\n`;

            // Add metadata if available and contains useful info
            if (sourceJsonDoc.metadata && Object.keys(sourceJsonDoc.metadata).length > 0) {
                sourceContent += `Metadata:\n${JSON.stringify(sourceJsonDoc.metadata, null, 2)}\n\n`;
            }

            // Try to extract a title for logging purposes (best effort)
            let displayTitle = 'Unknown';
            try {
                if (sourceJsonDoc.data && typeof sourceJsonDoc.data === 'object') {
                    if ('title' in sourceJsonDoc.data) {
                        displayTitle = String(sourceJsonDoc.data.title);
                    } else if (sourceJsonDoc.metadata?.derived_data?.title) {
                        displayTitle = String(sourceJsonDoc.metadata.derived_data.title);
                    }
                }
            } catch (e) {
                // Ignore extraction errors, use default
            }

            console.log(`[OutlineSettingsTool] Using source content for jsonDoc: ${displayTitle}`);
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
                // Extract source jsonDoc for proper lineage
                extractSourceJsonDocs: (input) => [{
                    jsonDocId: input.sourceJsonDocId,
                    inputRole: 'source'
                }]
            };

            console.log(`[OutlineSettingsTool] Starting executeStreamingTransform with config:`, {
                templateName: config.templateName,
                outputJsonDocType: 'outline_settings',
                projectId,
                userId,
                enableCaching: cachingOptions?.enableCaching
            });

            console.log(`[OutlineSettingsTool] About to call executeStreamingTransform with parameters:`);
            console.log(`[OutlineSettingsTool] - templateName: ${config.templateName}`);
            console.log(`[OutlineSettingsTool] - outputJsonDocType: outline_settings`);
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
                    jsonDocRepo,
                    outputJsonDocType: 'outline_settings',
                    transformMetadata: {
                        toolName: 'generate_outline_settings',
                        source_jsonDoc_id: params.sourceJsonDocId,
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
                    outputJsonDocId: result.outputJsonDocId,
                    finishReason: result.finishReason
                });
            } catch (error) {
                console.error(`[OutlineSettingsTool] executeStreamingTransform failed:`, error);
                console.error(`[OutlineSettingsTool] Error type:`, typeof error);
                console.error(`[OutlineSettingsTool] Error message:`, error instanceof Error ? error.message : String(error));
                console.error(`[OutlineSettingsTool] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
                throw error;
            }

            console.log(`[OutlineSettingsTool] Successfully completed streaming outline settings generation with jsonDoc ${result.outputJsonDocId}`);

            return {
                outputJsonDocId: result.outputJsonDocId,
                finishReason: result.finishReason
            };
        },
    };
} 