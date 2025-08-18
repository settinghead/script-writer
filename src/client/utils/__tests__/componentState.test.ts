import { describe, it, expect } from 'vitest';
import { computeComponentState, ComponentState } from '../componentState';

describe('computeComponentState with new rules', () => {
    function baseProjectData(): any {
        return {
            isLoading: false,
            isError: false,
            error: null,
            lineageGraph: { nodes: new Map(), edges: new Map() },
            transforms: [],
            humanTransforms: [],
            transformInputs: [],
            transformOutputs: [],
            jsondocs: [],
            canonicalContext: {
                canonicalBrainstormIdea: null
            }
        };
    }

    it('allows click-to-edit for AI jsondoc even with descendants', () => {
        const projectData = baseProjectData();
        // Parent LLM transform complete
        projectData.transforms = [{ id: 't1', type: 'llm', status: 'complete' }];
        projectData.lineageGraph.nodes.set('ai-1', { type: 'jsondoc', sourceTransform: { transformId: 't1' } });

        // Descendant exists (but should not block)
        projectData.transformInputs = [{ jsondoc_id: 'ai-1', transform_id: 't2' }];

        const jsondoc = { id: 'ai-1', origin_type: 'ai_generated', schema_type: '剧本设定' } as any;

        const result = computeComponentState(jsondoc, projectData);
        expect(result.state).toBe(ComponentState.CLICK_TO_EDIT);
    });

    it('blocks brainstorm collection when idea is chosen', () => {
        const projectData = baseProjectData();
        projectData.canonicalContext = {
            canonicalBrainstormIdea: { id: 'idea-1', origin_type: 'user_input' }
        };
        const jsondoc = { id: 'collection-1', origin_type: 'ai_generated', schema_type: 'brainstorm_collection' } as any;
        const result = computeComponentState(jsondoc, projectData);
        expect(result.state).toBe(ComponentState.READ_ONLY);
        expect(result.metadata?.specialCase).toBe('brainstorm_collection_with_chosen_idea');
    });

    it('user input is always editable', () => {
        const projectData = baseProjectData();
        const jsondoc = { id: 'u1', origin_type: 'user_input', schema_type: '灵感创意' } as any;
        const result = computeComponentState(jsondoc, projectData);
        expect(result.state).toBe(ComponentState.EDITABLE);
    });
});


