import { z } from 'zod';
import { JSONPath } from 'jsonpath-plus';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';
import type { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';

// Input schema for the getJsondocContent tool
export const GetJsondocContentInputSchema = z.object({
    jsondoc_id: z.string().describe('要获取的jsondoc的ID'),
    path: z.string().optional().describe('可选的JSONPath，用于获取jsondoc中的特定部分 (例如: "$.characters[0]")')
});

export type GetJsondocContentInput = z.infer<typeof GetJsondocContentInputSchema>;

// Output schema for the getJsondocContent tool
export const GetJsondocContentResultSchema = z.object({
    jsondoc_id: z.string().describe('jsondoc的ID'),
    schema_type: z.string().describe('jsondoc的架构类型'),
    origin_type: z.string().describe('jsondoc的来源类型'),
    content: z.any().describe('jsondoc的内容，可能是完整内容或通过path过滤的部分内容'),
    metadata: z.any().optional().describe('jsondoc的元数据'),
    extracted_path: z.string().optional().describe('如果使用了path参数，显示实际提取的路径')
});

export type GetJsondocContentResult = z.infer<typeof GetJsondocContentResultSchema>;

/**
 * Create the getJsondocContent tool definition for agent use
 */
export function createGetJsondocContentToolDefinition(
    jsondocRepo: TransformJsondocRepository,
    projectId: string,
    userId: string
): StreamingToolDefinition<GetJsondocContentInput, GetJsondocContentResult> {
    return {
        name: 'getJsondocContent',
        description: '获取指定jsondoc的完整内容或特定部分。当你从query工具获得jsondoc_id后，可以使用此工具查看完整内容。可选择指定JSONPath来获取特定部分，例如"$.characters[0]"获取第一个角色。',
        inputSchema: GetJsondocContentInputSchema,
        outputSchema: GetJsondocContentResultSchema,
        execute: async (params: GetJsondocContentInput): Promise<GetJsondocContentResult> => {
            console.log(`[GetJsondocContentTool] Fetching jsondoc: ${params.jsondoc_id}${params.path ? ` with path: ${params.path}` : ''}`);

            try {
                // Get the jsondoc
                const jsondoc = await jsondocRepo.getJsondoc(params.jsondoc_id);
                if (!jsondoc) {
                    throw new Error(`Jsondoc ${params.jsondoc_id} not found`);
                }

                // Verify user has access to this jsondoc's project
                const hasAccess = await jsondocRepo.userHasProjectAccess(userId, jsondoc.project_id);
                if (!hasAccess) {
                    throw new Error(`Access denied to jsondoc ${params.jsondoc_id}`);
                }

                let content = jsondoc.data;
                let extractedPath: string | undefined;

                // Extract specific path if requested
                if (params.path && params.path !== '$') {
                    try {
                        const results = JSONPath({
                            path: params.path,
                            json: content,
                            wrap: false
                        });

                        if (results === undefined || results === null) {
                            console.warn(`[GetJsondocContentTool] Path ${params.path} returned no results`);
                            content = null;
                        } else {
                            content = results;
                        }

                        extractedPath = params.path;
                        console.log(`[GetJsondocContentTool] Extracted content using path ${params.path}`);
                    } catch (error) {
                        console.error(`[GetJsondocContentTool] JSONPath extraction failed:`, error);
                        throw new Error(`Invalid JSONPath: ${params.path}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }

                console.log(`[GetJsondocContentTool] Successfully retrieved jsondoc content`);

                return {
                    jsondoc_id: jsondoc.id,
                    schema_type: jsondoc.schema_type,
                    origin_type: jsondoc.origin_type,
                    content,
                    metadata: jsondoc.metadata,
                    extracted_path: extractedPath
                };
            } catch (error) {
                console.error(`[GetJsondocContentTool] Failed to get jsondoc content:`, error);
                throw error; // Re-throw to let agent handle the error
            }
        }
    };
} 