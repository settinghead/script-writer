import { z } from 'zod';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';
import { UnifiedParticleSearch } from '../services/UnifiedParticleSearch';

// Input schema for the query tool
export const QueryToolInputSchema = z.object({
    query: z.string().describe('自然语言查询，描述你需要什么信息'),
    limit: z.number().min(1).max(10).default(5).optional().describe('返回结果的数量限制')
});

export type QueryToolInput = z.infer<typeof QueryToolInputSchema>;

// Output schema for the query tool
export const QueryToolResultSchema = z.object({
    results: z.array(z.object({
        id: z.string().describe('粒子ID'),
        jsondoc_id: z.string().describe('来源jsondoc的ID'),
        path: z.string().describe('在jsondoc中的JSONPath'),
        type: z.string().describe('粒子类型'),
        title: z.string().describe('粒子标题'),
        content_text: z.string().describe('可搜索的文本内容'),
        similarity: z.number().describe('相关度分数 (0-1)')
    })),
    total_found: z.number().describe('找到的结果总数'),
    query_processed: z.string().describe('处理的查询文本')
});

export type QueryToolResult = z.infer<typeof QueryToolResultSchema>;

/**
 * Create a query tool for searching project content using particle-based search
 */
export function createQueryToolDefinition(
    unifiedSearch: UnifiedParticleSearch,
    projectId: string,
    userId: string
): StreamingToolDefinition<QueryToolInput, QueryToolResult> {
    return {
        name: 'queryJsondocs',
        description: '语义搜索项目中的相关信息。使用自然语言查询来找到相关的内容片段。',
        inputSchema: QueryToolInputSchema,
        outputSchema: QueryToolResultSchema,
        execute: async (input: QueryToolInput) => {
            try {
                console.log(`[QueryTool] Executing search for project ${projectId}, user ${userId}:`, input.query);

                // Perform the search using UnifiedParticleSearch
                const searchResults = await unifiedSearch.searchParticles(input.query, projectId, {
                    mode: 'embedding',
                    limit: input.limit || 5,
                    threshold: 0.0 // Don't filter by threshold, let agent decide
                });

                const results = searchResults.map((result: any) => ({
                    id: result.id,
                    jsondoc_id: result.jsondoc_id,
                    path: result.path,
                    type: result.type,
                    title: result.title,
                    content_text: result.content_text,
                    similarity: result.similarity || 0
                }));

                const toolResult: QueryToolResult = {
                    results: results,
                    total_found: searchResults.length,
                    query_processed: input.query
                };

                console.log(`[QueryTool] Found ${results.length} results for query: "${input.query}"`);
                return toolResult;

            } catch (error) {
                console.error('[QueryTool] Search failed:', error);
                throw new Error(`搜索失败: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    };
} 