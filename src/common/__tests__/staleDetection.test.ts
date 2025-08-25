import { describe, it, expect } from 'vitest';
import { computeStaleJsondocs, type DiffChange } from '../staleDetection';

// Minimal LineageGraph type compatible with usage
type LineageNode = { type: 'jsondoc' | 'transform' };
interface LineageGraph {
    nodes: Map<string, LineageNode>;
    edges: Map<string, string[]>;
}

describe('staleDetection', () => {
    it('should detect direct AI children as affected with high severity for title change', async () => {
        const diffs: DiffChange[] = [{
            jsondocId: 'idea-1',
            path: '$.title',
            before: 'Old Title',
            after: 'New Title'
        }];

        const lineageGraph: LineageGraph = {
            edges: new Map([
                ['idea-1', ['transform-1']],
                ['transform-1', ['outline-1']]
            ]),
            nodes: new Map([
                ['idea-1', { type: 'jsondoc' }],
                ['transform-1', { type: 'transform' }],
                ['outline-1', { type: 'jsondoc' }]
            ])
        };

        const jsondocs = [
            { id: 'idea-1', schema_type: '灵感创意', origin_type: 'user_input', data: '{}', created_at: new Date().toISOString() } as any,
            { id: 'outline-1', schema_type: '故事设定', origin_type: 'ai_generated', data: '{}', created_at: new Date().toISOString() } as any
        ];

        const affected = await computeStaleJsondocs(diffs, lineageGraph as any, jsondocs as any);

        expect(affected).toHaveLength(1);
        expect(affected[0].jsondocId).toBe('outline-1');
        expect(affected[0].severity).toBe('high');
    });
});


