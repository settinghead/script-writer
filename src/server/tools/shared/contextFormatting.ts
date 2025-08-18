import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { diffWords } from 'diff';

export type DiffItem = {
    path: string;
    before?: any;
    after?: any;
    fieldType?: string;
};

export type AffectedItem = {
    schemaType: string;
    reason: string;
    diffs?: DiffItem[];
};

// Build human-readable affected-context section (used by tools and debug routes)
export function buildAffectedContextText(affected?: AffectedItem[] | null): string {
    if (!affected || affected.length === 0) return '';
    const lines: string[] = [];
    lines.push('受影响的内容（请严格依据以下差异进行修改）：');
    // 强化限制，明确只能依据差异进行最小修改
    lines.push('  修改规则:');
    lines.push('  - 仅修改“相关差异”中列出的字段，其他字段必须保持不变');
    lines.push('  - 遵循最小必要修改，避免与差异无关的重写/扩写');
    lines.push('  - 若无差异，请输出空补丁 []');
    for (const a of affected) {
        lines.push(`- ${a.schemaType}: ${a.reason}`);
        if (Array.isArray(a.diffs) && a.diffs.length > 0) {
            lines.push('  相关差异:');
            for (const d of a.diffs) {
                const beforeStr = typeof d.before === 'string' ? d.before : JSON.stringify(d.before);
                const afterStr = typeof d.after === 'string' ? d.after : JSON.stringify(d.after);
                lines.push(`  - 路径: ${d.path}`);

                const isStringChange = typeof d.before === 'string' && typeof d.after === 'string';
                const longText = (beforeStr?.length || 0) + (afterStr?.length || 0) > 500;

                if (isStringChange) {
                    const inline = buildInlineStringDiff(beforeStr, afterStr);
                    lines.push(`    单行对比: ${inline}`);
                }

                if (!isStringChange || !longText) {
                    lines.push(`    原文:`);
                    lines.push(`      ${beforeStr}`);
                    lines.push(`    更新为:`);
                    lines.push(`      ${afterStr}`);
                }
            }
        }
    }
    return '\n' + lines.join('\n');
}

function buildInlineStringDiff(beforeText: string, afterText: string, contextChars: number = 24, maxTotal: number = 320): string {
    try {
        const parts = diffWords(beforeText || '', afterText || '');
        const segments: string[] = [];
        for (const part of parts) {
            if (part.added) {
                segments.push(`{+${truncate(part.value, contextChars)}+}`);
            } else if (part.removed) {
                segments.push(`[-${truncate(part.value, contextChars)}-]`);
            } else {
                const ctx = collapseContext(part.value, contextChars);
                if (ctx) segments.push(ctx);
            }
            if (segments.join(' ').length > maxTotal) break;
        }
        let result = segments.join(' ').trim();
        if (result.length > maxTotal) {
            result = result.slice(0, maxTotal - 1) + '…';
        }
        return result || '(无显著差异)';
    } catch {
        return `{+${truncate(afterText, 60)}+} / [-${truncate(beforeText, 60)}-]`;
    }
}

function truncate(text: string, limit: number): string {
    if (!text) return '';
    if (text.length <= limit) return text;
    return text.slice(0, Math.max(0, limit - 1)) + '…';
}

function collapseContext(text: string, halfWindow: number): string | '' {
    if (!text) return '';
    const trimmed = text.replace(/\s+/g, ' ').trim();
    if (!trimmed) return '';
    if (trimmed.length <= halfWindow * 2) return trimmed;
    return trimmed.slice(0, halfWindow) + '…' + trimmed.slice(-halfWindow);
}

// Convert Zod schema to concise field guidance text
export function computeSchemaGuidance(schema?: z.ZodSchema<any>): string {
    if (!schema) return '';
    try {
        const jsonSchema = zodToJsonSchema(schema);
        const fieldDescriptions: string[] = [];
        function extract(obj: any, path: string = '') {
            if (!obj || typeof obj !== 'object') return;
            if (obj.properties) {
                for (const [key, value] of Object.entries(obj.properties)) {
                    const fieldPath = path ? `${path}.${key}` : key;
                    const desc = (value as any).description;
                    if (desc) fieldDescriptions.push(`${fieldPath}: ${desc}`);
                    extract(value, fieldPath);
                }
            }
            if (obj.items) extract(obj.items, `${path}[*]`);
        }
        extract(jsonSchema);
        if (fieldDescriptions.length > 0) {
            return `\n字段说明(供参考)：\n${fieldDescriptions.map((d) => `- ${d}`).join('\n')}`;
        }
    } catch {
        // ignore
    }
    return '';
}


