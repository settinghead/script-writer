import { z } from 'zod';
import { TransformRepository } from '../transform-artifact-framework/TransformRepository';
import { ArtifactRepository } from '../transform-artifact-framework/ArtifactRepository';
import {
    ChroniclesInputSchema,
    ChroniclesInput,
    ChroniclesOutputSchema,
    ChroniclesOutput
} from '../../common/schemas/outlineSchemas';
import {
    executeStreamingTransform,
    StreamingTransformConfig
} from '../transform-artifact-framework/StreamingTransformExecutor';
import type { StreamingToolDefinition } from '../transform-artifact-framework/StreamingAgentFramework';

const ChroniclesToolResultSchema = z.object({
    outputArtifactId: z.string(),
    finishReason: z.string()
});

interface ChroniclesToolResult {
    outputArtifactId: string;
    finishReason: string;
}

/**
 * Factory function that creates a chronicles generation tool definition
 */
export function createChroniclesToolDefinition(
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
): StreamingToolDefinition<ChroniclesInput, ChroniclesToolResult> {
    return {
        name: 'generate_chronicles',
        description: '基于已确定的剧本框架生成时间顺序故事描述（按时间顺序的故事发展阶段）。适用场景：用户已完成剧本框架，需要生成完整的时间发展脉络。必须使用项目背景信息中显示的完整outline settings artifact ID作为sourceArtifactId参数。',
        inputSchema: ChroniclesInputSchema,
        outputSchema: ChroniclesToolResultSchema,
        execute: async (params: ChroniclesInput, { toolCallId }): Promise<ChroniclesToolResult> => {
            console.log(`[ChroniclesTool] Starting streaming chronicles generation for outline settings artifact ${params.sourceArtifactId}`);

            // Extract outline settings data first
            const outlineSettingsArtifact = await artifactRepo.getArtifact(params.sourceArtifactId);
            if (!outlineSettingsArtifact) {
                throw new Error('Outline settings artifact not found');
            }

            // Verify user has access to this artifact's project
            const hasAccess = await artifactRepo.userHasProjectAccess(userId, outlineSettingsArtifact.project_id);
            if (!hasAccess) {
                throw new Error('Access denied to outline settings artifact');
            }

            // Verify artifact is outline settings type
            if (outlineSettingsArtifact.schema_type !== 'outline_settings_schema' &&
                outlineSettingsArtifact.type !== 'outline_settings') {
                throw new Error(`Expected outline settings artifact, got: ${outlineSettingsArtifact.schema_type || outlineSettingsArtifact.type}`);
            }

            // Extract outline settings data
            const outlineSettingsData = outlineSettingsArtifact.data;
            if (!outlineSettingsData.title || !outlineSettingsData.genre || !outlineSettingsData.characters) {
                throw new Error('Invalid outline settings artifact data');
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
                outputArtifactType: 'chronicles',
                transformMetadata: {
                    toolName: 'generate_chronicles',
                    outline_settings_artifact_id: params.sourceArtifactId,
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

            console.log(`[ChroniclesTool] Successfully completed streaming chronicles generation with artifact ${result.outputArtifactId}`);

            return {
                outputArtifactId: result.outputArtifactId,
                finishReason: result.finishReason
            };
        },
    };
} 