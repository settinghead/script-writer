import { z } from 'zod';
import { TransformRepository } from '../transform-jsonDoc-framework/TransformRepository';
import { JsonDocRepository } from '../transform-jsonDoc-framework/JsonDocRepository';
import {
    ChroniclesInputSchema,
    ChroniclesInput,
    ChroniclesOutputSchema,
    ChroniclesOutput
} from '../../common/schemas/outlineSchemas';
import {
    executeStreamingTransform,
    StreamingTransformConfig
} from '../transform-jsonDoc-framework/StreamingTransformExecutor';
import type { StreamingToolDefinition } from '../transform-jsonDoc-framework/StreamingAgentFramework';

const ChroniclesToolResultSchema = z.object({
    outputJsonDocId: z.string(),
    finishReason: z.string()
});

interface ChroniclesToolResult {
    outputJsonDocId: string;
    finishReason: string;
}

/**
 * Factory function that creates a chronicles generation tool definition
 */
export function createChroniclesToolDefinition(
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
): StreamingToolDefinition<ChroniclesInput, ChroniclesToolResult> {
    return {
        name: 'generate_chronicles',
        description: '基于已确定的剧本框架生成时间顺序大纲（按时间顺序的故事发展阶段）。适用场景：用户已完成剧本框架，需要生成完整的时间发展脉络。必须使用项目背景信息中显示的完整outline settings jsonDoc ID作为sourceJsonDocId参数。',
        inputSchema: ChroniclesInputSchema,
        outputSchema: ChroniclesToolResultSchema,
        execute: async (params: ChroniclesInput, { toolCallId }): Promise<ChroniclesToolResult> => {
            console.log(`[ChroniclesTool] Starting streaming chronicles generation for outline settings jsonDoc ${params.sourceJsonDocId}`);

            // Extract outline settings data first
            const outlineSettingsJsonDoc = await jsonDocRepo.getJsonDoc(params.sourceJsonDocId);
            if (!outlineSettingsJsonDoc) {
                throw new Error('Outline settings jsonDoc not found');
            }

            // Verify user has access to this jsonDoc's project
            const hasAccess = await jsonDocRepo.userHasProjectAccess(userId, outlineSettingsJsonDoc.project_id);
            if (!hasAccess) {
                throw new Error('Access denied to outline settings jsonDoc');
            }

            // Verify jsonDoc is outline settings type
            if (outlineSettingsJsonDoc.schema_type !== 'outline_settings') {
                throw new Error(`Expected outline settings jsonDoc, got: ${outlineSettingsJsonDoc.schema_type}`);
            }

            // Extract outline settings data
            const outlineSettingsData = outlineSettingsJsonDoc.data;
            if (!outlineSettingsData.title || !outlineSettingsData.genre || !outlineSettingsData.characters) {
                throw new Error('Invalid outline settings jsonDoc data');
            }

            console.log(`[ChroniclesTool] Using outline settings: ${outlineSettingsData.title}`);

            // Create streaming config with extracted data
            const config: StreamingTransformConfig<ChroniclesInput, ChroniclesOutput> = {
                templateName: 'chronicles',
                inputSchema: ChroniclesInputSchema,
                outputSchema: ChroniclesOutputSchema,
                prepareTemplateVariables: (input) => {
                    // Use default values for template variables
                    const recommendedStages = 8; // Default stage count
                    const stageGuidance = `请创建${recommendedStages}个左右的故事阶段（60集适合${recommendedStages}个阶段）`;

                    // Stringify the complete outline settings for the template
                    const outlineSettingsJson = JSON.stringify(outlineSettingsData, null, 2);

                    return ({
                        outlineSettingsJson,
                        requirements: input.requirements || '无特殊要求',
                        stageGuidance
                    });
                },
                // Extract source jsonDoc for proper lineage
                extractSourceJsonDocs: (input) => [{
                    jsonDocId: input.sourceJsonDocId,
                    inputRole: 'source'
                }]
            };

            const result = await executeStreamingTransform({
                config,
                input: params,
                projectId,
                userId,
                transformRepo,
                jsonDocRepo,
                outputJsonDocType: 'chronicles',
                transformMetadata: {
                    toolName: 'generate_chronicles',
                    outline_settings_jsonDoc_id: params.sourceJsonDocId,
                    outline_title: outlineSettingsData.title,
                    requirements: params.requirements
                },
                // Pass caching options from factory
                enableCaching: cachingOptions?.enableCaching,
                seed: cachingOptions?.seed,
                temperature: cachingOptions?.temperature,
                topP: cachingOptions?.topP,
                maxTokens: cachingOptions?.maxTokens
            });

            console.log(`[ChroniclesTool] Successfully completed streaming chronicles generation with jsonDoc ${result.outputJsonDocId}`);

            return {
                outputJsonDocId: result.outputJsonDocId,
                finishReason: result.finishReason
            };
        },
    };
} 