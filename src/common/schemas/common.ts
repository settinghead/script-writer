import { z } from 'zod';

/**
 * Schema for jsondoc references used in template variable preparation
 * Replaces individual sourceJsondocId fields with structured references
 */
export const JsondocReferenceSchema = z.object({
    jsondocId: z.string().min(1, 'Jsondoc ID不能为空').describe('引用的jsondoc ID'),
    description: z.string().min(1, '描述不能为空').describe('jsondoc描述，用于模板变量命名'),
    schemaType: z.string().min(1, 'Schema类型不能为空').describe('jsondoc的schema类型，用于验证兼容性')
});

/**
 * Array of jsondoc references for tools that need multiple jsondocs
 */
export const JsondocReferencesSchema = z.array(JsondocReferenceSchema).min(1, '至少需要一个jsondoc引用');

/**
 * Base tool input schema that includes jsondocs parameter
 * All tools should extend from this to ensure consistent jsondocs handling
 */
export const BaseToolInputSchema = z.object({
    jsondocs: JsondocReferencesSchema.describe('引用的jsondoc列表，作为工具执行的上下文和参考资料')
});

/**
 * TypeScript type for jsondoc references
 */
export type JsondocReference = z.infer<typeof JsondocReferenceSchema>;

/**
 * TypeScript type for base tool input
 */
export type BaseToolInput = z.infer<typeof BaseToolInputSchema>;

/**
 * Utility function to create a jsondoc reference
 */
export function createJsondocReference(
    jsondocId: string,
    description: string,
    schemaType: string
): JsondocReference {
    return {
        jsondocId,
        description,
        schemaType
    };
} 