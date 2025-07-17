import { describe, it, expect } from 'vitest';
import { isLeafNode, canBecomeEditable } from '../actionComputation';
import { computeActionsFromLineage } from '../lineageBasedActionComputation';
import type { LineageGraph } from '../../../common/transform-jsondoc-framework/lineageResolution';
import { TypedJsondoc } from '../../../common/types';



describe('actionComputation', () => {
    describe('isLeafNode', () => {
        it('should return true for jsondoc with no descendants', () => {
            const transformInputs = [
                { jsondoc_id: 'other-jsondoc', transform_id: 'transform-1' }
            ];
            expect(isLeafNode('test-jsondoc', transformInputs)).toBe(true);
        });

        it('should return false for jsondoc with descendants', () => {
            const transformInputs = [
                { jsondoc_id: 'test-jsondoc', transform_id: 'transform-1' }
            ];
            expect(isLeafNode('test-jsondoc', transformInputs)).toBe(false);
        });

        it('should return true for empty transform inputs', () => {
            expect(isLeafNode('test-jsondoc', [])).toBe(true);
        });
    });

    describe('canBecomeEditable', () => {
        it('should return true for AI-generated leaf node', () => {
            const jsondoc = { id: 'test', origin_type: 'ai_generated' } as TypedJsondoc;
            const transformInputs: any[] = [];
            expect(canBecomeEditable(jsondoc, transformInputs)).toBe(true);
        });

        it('should return false for user input jsondoc', () => {
            const jsondoc = { id: 'test', origin_type: 'user_input' } as TypedJsondoc;
            const transformInputs: any[] = [];
            expect(canBecomeEditable(jsondoc, transformInputs)).toBe(false);
        });

        it('should return false for jsondoc with descendants', () => {
            const jsondoc = { id: 'test', origin_type: 'ai_generated' } as TypedJsondoc;
            const transformInputs = [{ jsondoc_id: 'test', transform_id: 'transform-1' }];
            expect(canBecomeEditable(jsondoc, transformInputs)).toBe(false);
        });
    });

    describe('computeActionsFromLineage with multiple outline settings', () => {
        it('should detect latest leaf outline and add chronicles action', () => {
            const fakeJsondocs = [
                { id: 'outline1', schema_type: 'outline_settings', origin_type: 'ai_generated', created_at: '2024-01-01', project_id: 'test-project', schema_version: 'v1', data: '{}' },
                { id: 'outline2', schema_type: 'outline_settings', origin_type: 'user_input', created_at: '2024-01-02', project_id: 'test-project', schema_version: 'v1', data: '{}' }
            ] as any[];
            const fakeLineageGraph = {
                nodes: new Map([
                    ['outline1', { type: 'jsondoc' as const, jsondocId: 'outline1', isLeaf: false, depth: 0, createdAt: '2024-01-01', jsondoc: fakeJsondocs[0], sourceTransform: 'none' as const }],
                    ['outline2', { type: 'jsondoc' as const, jsondocId: 'outline2', isLeaf: true, depth: 1, createdAt: '2024-01-02', jsondoc: fakeJsondocs[1], sourceTransform: 'none' as const }]
                ]),
                edges: new Map([['outline1', ['transform1']], ['transform1', ['outline2']]]),
                rootNodes: new Set(['outline1']),
                paths: new Map()
            } as any;
            const fakeTransforms = [] as any[];
            const fakeHumanTransforms = [] as any[];
            const fakeInputs = [] as any[];
            const fakeOutputs = [] as any[];

            const result = computeActionsFromLineage(fakeLineageGraph, fakeJsondocs, fakeTransforms, fakeHumanTransforms, fakeInputs, fakeOutputs);

            expect(result.actionContext.latestOutlineSettings?.id).toBe('outline2');
            const hasChroniclesAction = result.actions.some((action: { id: string }) => action.id === 'chronicles_generation');
            expect(hasChroniclesAction).toBe(true);
        });
    });

    it('should prefer user_input leaf over newer ai leaf in branches', () => {
        const fakeJsondocs = [
            { id: 'outline1', schema_type: 'outline_settings', origin_type: 'ai_generated', created_at: '2024-01-01', project_id: 'test-project', schema_version: 'v1', data: '{}' },
            { id: 'outline2', schema_type: 'outline_settings', origin_type: 'user_input', created_at: '2024-01-02', project_id: 'test-project', schema_version: 'v1', data: '{}' },
            { id: 'outline3', schema_type: 'outline_settings', origin_type: 'ai_generated', created_at: '2024-01-03', project_id: 'test-project', schema_version: 'v1', data: '{}' }
        ] as any[];
        const fakeLineageGraph = {
            nodes: new Map([
                ['outline1', { type: 'jsondoc' as const, jsondocId: 'outline1', isLeaf: false, depth: 0, createdAt: '2024-01-01', jsondoc: fakeJsondocs[0], sourceTransform: 'none' as const }],
                ['outline2', { type: 'jsondoc' as const, jsondocId: 'outline2', isLeaf: true, depth: 1, createdAt: '2024-01-02', jsondoc: fakeJsondocs[1], sourceTransform: 'none' as const }],
                ['outline3', { type: 'jsondoc' as const, jsondocId: 'outline3', isLeaf: true, depth: 1, createdAt: '2024-01-03', jsondoc: fakeJsondocs[2], sourceTransform: 'none' as const }]
            ]),
            edges: new Map([['outline1', ['transform1', 'transform2']], ['transform1', ['outline2']], ['transform2', ['outline3']]]),
            rootNodes: new Set(['outline1']),
            paths: new Map()
        } as any;
        const fakeTransforms = [] as any[];
        const fakeHumanTransforms = [] as any[];
        const fakeInputs = [] as any[];
        const fakeOutputs = [] as any[];

        const result = computeActionsFromLineage(fakeLineageGraph, fakeJsondocs, fakeTransforms, fakeHumanTransforms, fakeInputs, fakeOutputs);

        expect(result.actionContext.latestOutlineSettings?.id).toBe('outline2'); // prefers user_input over newer ai
        const hasChroniclesAction = result.actions.some((action: { id: string }) => action.id === 'chronicles_generation');
        expect(hasChroniclesAction).toBe(true);
    });

    it('should NOT show brainstorm creation when ideas and outline already exist', () => {
        const fakeJsondocs = [
            {
                id: 'idea1',
                schema_type: 'brainstorm_idea',
                origin_type: 'user_input',
                created_at: '2024-01-01',
                project_id: 'test-project',
                schema_version: 'v1',
                data: '{"title": "Test Idea", "body": "Test body content"}'
            },
            {
                id: 'outline1',
                schema_type: 'outline_settings',
                origin_type: 'ai_generated',
                created_at: '2024-01-02',
                project_id: 'test-project',
                schema_version: 'v1',
                data: '{"title": "Test Outline"}'
            }
        ] as any[];
        const fakeLineageGraph = {
            nodes: new Map([
                ['idea1', {
                    type: 'jsondoc' as const,
                    jsondocId: 'idea1',
                    isLeaf: false,
                    depth: 0,
                    createdAt: '2024-01-01',
                    jsondoc: fakeJsondocs[0],
                    sourceTransform: 'none' as const
                }],
                ['outline1', {
                    type: 'jsondoc' as const,
                    jsondocId: 'outline1',
                    isLeaf: true,
                    depth: 1,
                    createdAt: '2024-01-02',
                    jsondoc: fakeJsondocs[1],
                    sourceTransform: 'none' as const
                }]
            ]),
            edges: new Map([['idea1', ['outline1']]]),
            rootNodes: new Set(['idea1']),
            paths: new Map()
        } as LineageGraph;
        const fakeTransforms = [] as any[];
        const fakeHumanTransforms = [] as any[];
        const fakeInputs = [] as any[];
        const fakeOutputs = [] as any[];

        const result = computeActionsFromLineage(fakeLineageGraph, fakeJsondocs, fakeTransforms, fakeHumanTransforms, fakeInputs, fakeOutputs);

        // Should have existing ideas and outline
        expect(result.actionContext.effectiveBrainstormIdeas.length).toBeGreaterThan(0);
        expect(result.actionContext.latestOutlineSettings?.id).toBe('outline1');

        // Should NOT have brainstorm_creation action
        const hasBrainstormCreationAction = result.actions.some((action: { id: string }) => action.id === 'brainstorm_creation');
        expect(hasBrainstormCreationAction).toBe(false);

        // Should have chronicles_generation action instead
        const hasChroniclesAction = result.actions.some((action: { id: string }) => action.id === 'chronicles_generation');
        expect(hasChroniclesAction).toBe(true);
    });
}); 