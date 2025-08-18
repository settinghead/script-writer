import { describe, it, expect, vi } from 'vitest';
import { createGenericEditToolDefinition } from '../GenericEditTool';

// Simple in-memory repo mocks
class RepoMock {
    private jsondocs: Record<string, any> = {};
    constructor(seed?: Record<string, any>) { if (seed) this.jsondocs = seed; }
    async getJsondoc(id: string) { return this.jsondocs[id]; }
}

describe('GenericEditTool', () => {
    it('returns direct-edit message for user_input jsondoc', async () => {
        const jsondocId = 'doc-1';
        const jsondoc = { id: jsondocId, schema_type: '剧本设定', origin_type: 'user_input', data: '{}' };
        const jsondocRepo: any = new RepoMock({ [jsondocId]: jsondoc });
        const transformRepo: any = {};

        const tool = createGenericEditToolDefinition(
            '剧本设定',
            transformRepo,
            jsondocRepo,
            'p1',
            'u1'
        );

        expect(tool).toBeTruthy();
        const res = await (tool as any).execute({ jsondocId, editRequirements: '调整角色' });
        expect(res.message).toContain('可直接编辑');
    });
});


