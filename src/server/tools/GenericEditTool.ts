import { z } from 'zod';
import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';
import {
    executeStreamingTransform,
    type StreamingTransformConfig
} from '../transform-jsondoc-framework/StreamingTransformExecutor';
import { JsonPatchOperationsSchema } from '@/common/schemas/transforms';
import { JsondocSchemaRegistry } from '@/common/schemas/jsondocs';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { buildAffectedContextText, computeSchemaGuidance } from './shared/contextFormatting';
import { computeAffectedContextForEdit } from '../services/EditPromptContextService';

// =============================
// Generic Edit Input Schema
// =============================

export const GenericEditInputSchema = z.object({
    jsondocId: z.string().describe('要编辑的jsondoc ID'),
    editRequirements: z.string().describe('编辑要求的详细描述'),
    // No affectedContext in the external contract; backend computes it when needed
    // Provide source/context jsondocs for lineage linking and prompt assembly
    jsondocs: z.array(z.object({
        jsondocId: z.string(),
        schemaType: z.string().optional(),
        description: z.string().optional()
    })).optional()
});

export type GenericEditInput = z.infer<typeof GenericEditInputSchema>;

// =============================
// Schema Registry → Template Mapping
// =============================

type SupportedSchemaType = keyof typeof JsondocSchemaRegistry;

const schemaTypeToTemplateId: Partial<Record<SupportedSchemaType, string>> = {
    '灵感创意': 'brainstorm_edit_diff',
    '剧本设定': '剧本设定_edit_diff',
    'chronicles': 'chronicles_edit_diff',
    '分集结构': '分集结构_edit_diff'
};

const schemaTypeDisplayName: Partial<Record<SupportedSchemaType, string>> = {
    '灵感创意': '故事创意',
    '剧本设定': '剧本设定',
    'chronicles': '编年史',
    '分集结构': '分集结构'
};

// =============================
// Factory: Create One Generic Edit Tool
// =============================

export function createGenericEditToolDefinition(
    schemaType: SupportedSchemaType,
    transformRepo: TransformJsondocRepository,
    jsondocRepo: TransformJsondocRepository,
    projectId: string,
    userId: string,
    cachingOptions?: {
        enableCaching?: boolean;
        seed?: number;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    }
): StreamingToolDefinition<GenericEditInput, any> | null {

    const templateId = schemaTypeToTemplateId[schemaType];
    const zodSchema = JsondocSchemaRegistry[schemaType];

    if (!templateId || !zodSchema) {
        console.warn(`[GenericEditTool] Unsupported schema type: ${schemaType}`);
        return null;
    }

    const displayName = schemaTypeDisplayName[schemaType] || schemaType;

    return {
        name: `edit_${schemaType}`,
        description: `编辑${displayName}内容（统一补丁流程）`,
        inputSchema: GenericEditInputSchema,
        outputSchema: JsonPatchOperationsSchema,
        execute: async (params: GenericEditInput): Promise<any> => {
            // Fetch source jsondoc and validate schema type
            const sourceJsondoc = await jsondocRepo.getJsondoc(params.jsondocId);
            if (!sourceJsondoc) {
                throw new Error(`Jsondoc not found: ${params.jsondocId}`);
            }

            if (sourceJsondoc.schema_type !== schemaType) {
                throw new Error(`Schema type mismatch: expected ${schemaType}, got ${sourceJsondoc.schema_type}`);
            }

            // For user_input, return guidance since UI handles direct edit
            if (sourceJsondoc.origin_type === 'user_input') {
                return {
                    success: true,
                    jsondocId: sourceJsondoc.id,
                    message: '用户创建的内容可直接编辑，无需生成补丁'
                };
            }

            // Build tool input with explicit jsondocs array so the executor records transform_inputs
            const toolInput: GenericEditInput = {
                jsondocId: params.jsondocId,
                editRequirements: params.editRequirements,
                jsondocs: [
                    {
                        jsondocId: params.jsondocId,
                        schemaType,
                        description: 'source'
                    }
                ]
            };

            // Prepare config for unified diff → JSON Patch pipeline
            const config: StreamingTransformConfig<GenericEditInput, any> = {
                templateName: templateId,
                inputSchema: GenericEditInputSchema,
                outputSchema: JsonPatchOperationsSchema,
                prepareTemplateVariables: async (input) => {
                    const jsondocData = typeof sourceJsondoc.data === 'string'
                        ? JSON.parse(sourceJsondoc.data)
                        : sourceJsondoc.data;

                    const schemaGuidance = computeSchemaGuidance(zodSchema as unknown as z.ZodSchema<any>);
                    // affectedContext is computed server-side and attached onto config when available
                    const computedAffected = (config as any)._computedAffectedContext as any[] | undefined;
                    const additionalContextText = buildAffectedContextText(computedAffected);

                    return {
                        jsondocs: { [schemaType]: jsondocData },
                        params: {
                            editRequirements: input.editRequirements + additionalContextText + schemaGuidance
                        }
                    };
                }
            };

            // Unify runtime behavior with debug: compute and attach affected context for all edit_* tools
            try {
                if (!(config as any)._computedAffectedContext) {
                    const affected = await computeAffectedContextForEdit(
                        projectId,
                        schemaType,
                        params.jsondocId,
                        jsondocRepo,
                        transformRepo
                    );
                    (config as any)._computedAffectedContext = affected;
                }
            } catch {
                // Non-fatal: proceed without affected context if computation fails
            }

            const result = await executeStreamingTransform({
                config,
                input: toolInput,
                projectId,
                userId,
                transformRepo,
                jsondocRepo,
                outputJsondocType: schemaType,
                executionMode: {
                    mode: 'patch-approval',
                    originalJsondoc: sourceJsondoc
                },
                transformMetadata: {
                    toolName: `edit_${schemaType}`,
                    source_jsondoc_id: params.jsondocId,
                    edit_requirements: params.editRequirements,
                    method: 'json_patch'
                },
                enableCaching: cachingOptions?.enableCaching,
                seed: cachingOptions?.seed,
                temperature: cachingOptions?.temperature,
                topP: cachingOptions?.topP,
                maxTokens: cachingOptions?.maxTokens
            });

            return {
                success: true,
                jsondocId: result.outputJsondocId,
                message: `已生成${displayName}的修改补丁`
            };
        }
    };
}

// =============================
// Factory: Create All Generic Edit Tools
// =============================

export function createAllGenericEditTools(
    projectId: string,
    userId: string,
    jsondocRepo: TransformJsondocRepository,
    transformRepo: TransformJsondocRepository,
    cachingOptions?: {
        enableCaching?: boolean;
        seed?: number;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    }
): StreamingToolDefinition<any, any>[] {
    const tools: StreamingToolDefinition<any, any>[] = [];
    (Object.keys(schemaTypeToTemplateId) as SupportedSchemaType[]).forEach((schemaType) => {
        const tool = createGenericEditToolDefinition(
            schemaType,
            transformRepo,
            jsondocRepo,
            projectId,
            userId,
            cachingOptions
        );
        if (tool) tools.push(tool);
    });
    return tools;
}


