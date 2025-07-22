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
 * Create the query tool definition for agent use
 */
export function createQueryToolDefinition(
    unifiedSearch: UnifiedParticleSearch,
    projectId: string,
    userId: string
): StreamingToolDefinition<QueryToolInput, QueryToolResult> {
    return {
        name: 'query',
        description: '搜索项目中的相关信息。使用自然语言描述你需要什么信息，系统会返回最相关的内容片段及其来源。例如："查找角色信息"、"寻找故事背景设定"、"获取剧集结构"等。根据相关度分数判断信息质量：>0.7为高度相关，0.4-0.7为中等相关，<0.4为低相关。',
        inputSchema: QueryToolInputSchema,
        outputSchema: QueryToolResultSchema,
        execute: async (params: QueryToolInput): Promise<QueryToolResult> => {
            const limit = params.limit || 5;

            console.log(`[QueryTool] Searching for: "${params.query}" (limit: ${limit})`);

            try {
                // Use embedding-based search for high-quality semantic results
                const searchResults = await unifiedSearch.searchParticles(params.query, projectId, {
                    mode: 'embedding',
                    limit,
                    threshold: 0.0 // Don't filter by threshold, let agent decide
                });

                console.log(`[QueryTool] Found ${searchResults.length} results`);

                return {
                    results: searchResults.map(result => ({
                        id: result.id,
                        jsondoc_id: result.jsondoc_id,
                        path: result.path,
                        type: result.type,
                        title: result.title,
                        content_text: result.content_text,
                        similarity: result.similarity || 0
                    })),
                    total_found: searchResults.length,
                    query_processed: params.query
                };
            } catch (error) {
                console.error(`[QueryTool] Search failed:`, error);

                // Return empty results instead of throwing to avoid breaking agent flow
                return {
                    results: [],
                    total_found: 0,
                    query_processed: params.query
                };
            }
        }
    };
} 