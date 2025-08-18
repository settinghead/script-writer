import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

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
    lines.push('受影响的内容：');
    for (const a of affected) {
        lines.push(`- ${a.schemaType}: ${a.reason}`);
        if (Array.isArray(a.diffs) && a.diffs.length > 0) {
            lines.push('  相关差异:');
            for (const d of a.diffs) {
                const beforeStr = typeof d.before === 'string' ? d.before : JSON.stringify(d.before);
                const afterStr = typeof d.after === 'string' ? d.after : JSON.stringify(d.after);
                lines.push(`  - 路径(${d.path}) 从 ${beforeStr} 到 ${afterStr}`);
            }
        }
    }
    return '\n' + lines.join('\n');
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


