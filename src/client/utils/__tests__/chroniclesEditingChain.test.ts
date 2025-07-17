import { describe, it, expect, beforeEach } from 'vitest';
import { computeUnifiedWorkflowState } from '../actionComputation';
import { ProjectDataContextType } from '../../../common/types';
import { LineageGraph, LineageNodeJsondoc, LineageNodeTransform } from '../../../common/transform-jsondoc-framework/lineageResolution';
import { ElectricJsondoc, ElectricTransform, ElectricHumanTransform, ElectricTransformInput, ElectricTransformOutput } from '../../../common/types';

describe('Chronicles Editing Chain', () => {
    let mockProjectData: ProjectDataContextType;

    beforeEach(() => {
        // Create jsondocs first
        const jsondocs = [
            { id: 'outline-settings', schema_type: 'outline_settings', origin_type: 'ai_generated', created_at: '2025-07-17T18:00:00Z', data: JSON.stringify({}), project_id: 'test', metadata: {}, streaming_status: 'completed' },
            { id: 'chronicles-ai-1', schema_type: 'chronicles', origin_type: 'ai_generated', created_at: '2025-07-17T18:31:40Z', data: JSON.stringify({ stages: [] }), project_id: 'test', metadata: {}, streaming_status: 'completed' },
            { id: 'chronicles-human-1', schema_type: 'chronicles', origin_type: 'user_input', created_at: '2025-07-17T18:32:15Z', data: JSON.stringify({ stages: [] }), project_id: 'test', metadata: {}, streaming_status: 'completed' },
            { id: 'chronicles-ai-2', schema_type: 'chronicles', origin_type: 'ai_generated', created_at: '2025-07-17T22:00:00Z', data: JSON.stringify({ stages: [] }), project_id: 'test', metadata: {}, streaming_status: 'completed' }
        ] as ElectricJsondoc[];

        const createJsondocNode = (id: string, isLeaf: boolean, createdAt: string): LineageNodeJsondoc => ({
            type: 'jsondoc',
            jsondocId: id,
            path: undefined,
            depth: 0,
            isLeaf: isLeaf,
            createdAt: createdAt,
            sourceTransform: 'none',
            jsondoc: jsondocs.find(j => j.id === id) || { id, schema_type: 'chronicles', origin_type: 'ai_generated', created_at: createdAt, data: JSON.stringify({ stages: [] }), project_id: 'test', metadata: '{}', streaming_status: 'completed', schema_version: 'v1' }
        });

        // Create lineage graph
        const mockLineageGraph: LineageGraph = {
            nodes: new Map<string, LineageNodeJsondoc | LineageNodeTransform>([
                ['chronicles-ai-1', createJsondocNode('chronicles-ai-1', false, '2025-07-17T18:31:40Z')],
                ['chronicles-human-1', createJsondocNode('chronicles-human-1', false, '2025-07-17T18:32:15Z')],
                ['chronicles-ai-2', createJsondocNode('chronicles-ai-2', true, '2025-07-17T22:00:00Z')],
                ['outline-settings', createJsondocNode('outline-settings', false, '2025-07-17T18:00:00Z')]
            ]),
            rootNodes: new Set(['outline-settings']),
            edges: new Map([
                ['outline-settings', ['chronicles-ai-1']],
                ['chronicles-ai-1', ['chronicles-human-1']],
                ['chronicles-human-1', ['chronicles-ai-2']]
            ]),
            paths: new Map()
        };

        // Now create mockProjectData with the lineage graph
        mockProjectData = {
            jsondocs,
            transforms: [] as ElectricTransform[],
            humanTransforms: [] as ElectricHumanTransform[],
            transformInputs: [] as ElectricTransformInput[],
            transformOutputs: [] as ElectricTransformOutput[],
            lineageGraph: mockLineageGraph,
            isLoading: false,
            error: null,
            getJsondocById: (id: string) => jsondocs.find(j => j.id === id) || null
        } as ProjectDataContextType;
    });

    it('should select the latest leaf chronicles jsondoc in editing chain', () => {
        const result = computeUnifiedWorkflowState(mockProjectData, 'test');

        const chroniclesComponent = result.displayComponents.find(c => c.id === 'chronicles-display');
        expect(chroniclesComponent).toBeDefined();
        expect(chroniclesComponent?.props.chroniclesJsondoc?.id).toBe('chronicles-ai-2');
    });
}); 