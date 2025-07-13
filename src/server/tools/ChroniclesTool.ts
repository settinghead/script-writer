import { z } from 'zod';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import {
    ChroniclesInputSchema,
    ChroniclesInput,
    ChroniclesOutputSchema,
    ChroniclesOutput
} from '../../common/schemas/outlineSchemas';
import {
    executeStreamingTransform,
    StreamingTransformConfig
} from '../transform-jsondoc-framework/StreamingTransformExecutor';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';

const ChroniclesToolResultSchema = z.object({
    outputJsondocId: z.string(),
    finishReason: z.string()
});

interface ChroniclesToolResult {
    outputJsondocId: string;
    finishReason: string;
}

/**
 * Factory function that creates a chronicles generation tool definition
 */
export function createChroniclesToolDefinition(
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
): StreamingToolDefinition<ChroniclesInput, ChroniclesToolResult> {
    return {
        name: 'generate_chronicles',
        description: '基于已确定的剧本框架生成时间顺序大纲（按时间顺序的故事发展阶段）。适用场景：用户已完成剧本框架，需要生成完整的时间发展脉络。必须使用项目背景信息中显示的完整outline settings jsondoc ID作为sourceJsondocId参数。',
        inputSchema: ChroniclesInputSchema,
        outputSchema: ChroniclesToolResultSchema,
        execute: async (params: ChroniclesInput, { toolCallId }): Promise<ChroniclesToolResult> => {
            const sourceJsondocRef = params.jsondocs[0];
            console.log(`[ChroniclesTool] Starting streaming chronicles generation for outline settings jsondoc ${sourceJsondocRef.jsondocId}`);

            // Extract outline settings data first
            const outlineSettingsJsondoc = await jsondocRepo.getJsondoc(sourceJsondocRef.jsondocId);
            if (!outlineSettingsJsondoc) {
                throw new Error('Outline settings jsondoc not found');
            }

            // Verify user has access to this jsondoc's project
            const hasAccess = await jsondocRepo.userHasProjectAccess(userId, outlineSettingsJsondoc.project_id);
            if (!hasAccess) {
                throw new Error('Access denied to outline settings jsondoc');
            }

            // Verify jsondoc is outline settings type
            if (outlineSettingsJsondoc.schema_type !== 'outline_settings') {
                throw new Error(`Expected outline settings jsondoc, got: ${outlineSettingsJsondoc.schema_type}`);
            }

            // Extract outline settings data
            const outlineSettingsData = outlineSettingsJsondoc.data;
            if (!outlineSettingsData.title || !outlineSettingsData.genre || !outlineSettingsData.characters) {
                throw new Error('Invalid outline settings jsondoc data');
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
                // Extract source jsondoc for proper lineage
                extractSourceJsondocs: (input) => [{
                    jsondocId: input.jsondocs[0].jsondocId,
                    inputRole: 'source'
                }]
            };

            const result = await executeStreamingTransform({
                config,
                input: params,
                projectId,
                userId,
                transformRepo,
                jsondocRepo,
                outputJsondocType: 'chronicles',
                transformMetadata: {
                    toolName: 'generate_chronicles',
                    outline_settings_jsondoc_id: sourceJsondocRef.jsondocId,
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

            console.log(`[ChroniclesTool] Successfully completed streaming chronicles generation with jsondoc ${result.outputJsondocId}`);

            return {
                outputJsondocId: result.outputJsondocId,
                finishReason: result.finishReason
            };
        },
    };
} 