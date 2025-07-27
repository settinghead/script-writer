import { describe, it, expect } from 'vitest';
import type { CanonicalJsondocContext } from '../../../../common/canonicalJsondocLogic';
import type { ElectricJsondoc } from '../../../../common/types';
import type { LineageGraph } from '../../../../common/transform-jsondoc-framework/lineageResolution';

// Import the function we want to test - we'll need to extract it from the component
// For now, let's create a separate utility file for the logic

// Helper function to create mock jsondocs
function createMockJsondoc(
    id: string,
    schemaType: ElectricJsondoc['schema_type'],
    originType: ElectricJsondoc['origin_type'] = 'ai_generated'
): ElectricJsondoc {
    return {
        id,
        schema_type: schemaType,
        schema_version: 'v1',
        origin_type: originType,
        data: '{}',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        project_id: 'test-project',
        metadata: undefined,
        streaming_status: 'completed'
    };
}

// Replicate the tool filtering logic from AgentContextView for testing
function computeAvailableToolsFromCanonicalContext(context: CanonicalJsondocContext): string[] {
    const availableTools: string[] = [];

    // Check what canonical jsondocs exist
    const hasBrainstormResult = context.canonicalBrainstormCollection || context.canonicalBrainstormIdea;
    const hasOutlineSettings = !!context.canonicalOutlineSettings;
    const hasChronicles = !!context.canonicalChronicles;
    const hasEpisodePlanning = !!context.canonicalEpisodePlanning;

    // Apply filtering rules (same as server)
    if (!hasBrainstormResult) {
        availableTools.push('generate_灵感创意s');
    }

    if (hasBrainstormResult) {
        availableTools.push('edit_灵感创意');
    }

    if (context.canonicalBrainstormIdea && !hasOutlineSettings) {
        availableTools.push('generate_剧本设定');
    }

    if (hasOutlineSettings) {
        // Add edit tools for previous stages
        if (context.canonicalBrainstormIdea) {
            availableTools.push('edit_灵感创意');
        }
        availableTools.push('edit_剧本设定');

        // Add next generation tool
        if (!hasChronicles) {
            availableTools.push('generate_chronicles');
        }
    }

    if (hasChronicles) {
        // Add edit tools for previous stages
        if (context.canonicalBrainstormIdea) {
            availableTools.push('edit_灵感创意');
        }
        if (hasOutlineSettings) {
            availableTools.push('edit_剧本设定');
        }
        availableTools.push('edit_时间顺序大纲');

        // Add next generation tool
        if (!hasEpisodePlanning) {
            availableTools.push('generate_分集结构');
        }
    }

    if (hasEpisodePlanning) {
        // Add edit tools for all previous stages
        if (context.canonicalBrainstormIdea) {
            availableTools.push('edit_灵感创意');
        }
        if (hasOutlineSettings) {
            availableTools.push('edit_剧本设定');
        }
        if (hasChronicles) {
            availableTools.push('edit_时间顺序大纲');
        }
        availableTools.push('edit_分集结构');

        // Episode synopsis can be generated multiple times
        availableTools.push('generate_单集大纲');
    }

    // Remove duplicates and return
    return [...new Set(availableTools)];
}

describe('AgentContextView Tool Filtering', () => {
    // Helper to create mock lineage graph
    const createMockLineageGraph = (): LineageGraph => ({
        nodes: new Map(),
        edges: new Map(),
        paths: new Map(),
        rootNodes: new Set<string>()
    });

    describe('computeAvailableToolsFromCanonicalContext', () => {
        it('should return only generate_灵感创意s for empty project', () => {
            const context: CanonicalJsondocContext = {
                canonicalBrainstormIdea: null,
                canonicalBrainstormCollection: null,
                canonicalOutlineSettings: null,
                canonicalChronicles: null,
                canonicalEpisodePlanning: null,
                canonicalBrainstormInput: null,
                canonicalEpisodeSynopsisList: [],
                workflowNodes: [],
                hasActiveTransforms: false,
                activeTransforms: [],
                lineageGraph: createMockLineageGraph(),
                rootNodes: [],
                leafNodes: []
            };

            const tools = computeAvailableToolsFromCanonicalContext(context);
            expect(tools).toEqual(['generate_灵感创意s']);
        });

        it('should return edit_灵感创意 when brainstorm_collection exists', () => {
            const mockCollection = createMockJsondoc('collection-1', 'brainstorm_collection');
            const context: CanonicalJsondocContext = {
                canonicalBrainstormIdea: null,
                canonicalBrainstormCollection: mockCollection,
                canonicalOutlineSettings: null,
                canonicalChronicles: null,
                canonicalEpisodePlanning: null,
                canonicalBrainstormInput: null,
                canonicalEpisodeSynopsisList: [],
                workflowNodes: [],
                hasActiveTransforms: false,
                activeTransforms: [],
                lineageGraph: createMockLineageGraph(),
                rootNodes: [],
                leafNodes: []
            };

            const tools = computeAvailableToolsFromCanonicalContext(context);
            expect(tools).toEqual(['edit_灵感创意']);
        });

        it('should return edit_灵感创意 and generate_剧本设定 when single 灵感创意 exists', () => {
            const mockIdea = createMockJsondoc('idea-1', '灵感创意', 'user_input');
            const context: CanonicalJsondocContext = {
                canonicalBrainstormIdea: mockIdea,
                canonicalBrainstormCollection: null,
                canonicalOutlineSettings: null,
                canonicalChronicles: null,
                canonicalEpisodePlanning: null,
                canonicalBrainstormInput: null,
                canonicalEpisodeSynopsisList: [],
                workflowNodes: [],
                hasActiveTransforms: false,
                activeTransforms: [],
                lineageGraph: createMockLineageGraph(),
                rootNodes: [],
                leafNodes: []
            };

            const tools = computeAvailableToolsFromCanonicalContext(context);
            expect(tools).toEqual(['edit_灵感创意', 'generate_剧本设定']);
        });

        it('should return appropriate tools when 剧本设定 exists', () => {
            const mockIdea = createMockJsondoc('idea-1', '灵感创意', 'user_input');
            const mockOutline = createMockJsondoc('outline-1', '剧本设定');
            const context: CanonicalJsondocContext = {
                canonicalBrainstormIdea: mockIdea,
                canonicalBrainstormCollection: null,
                canonicalOutlineSettings: mockOutline,
                canonicalChronicles: null,
                canonicalEpisodePlanning: null,
                canonicalBrainstormInput: null,
                canonicalEpisodeSynopsisList: [],
                workflowNodes: [],
                hasActiveTransforms: false,
                activeTransforms: [],
                lineageGraph: createMockLineageGraph(),
                rootNodes: [],
                leafNodes: []
            };

            const tools = computeAvailableToolsFromCanonicalContext(context);
            expect(tools).toEqual(['edit_灵感创意', 'edit_剧本设定', 'generate_chronicles']);
        });

        it('should return all edit tools plus generate_单集大纲 when 分集结构 exists', () => {
            const mockIdea = createMockJsondoc('idea-1', '灵感创意', 'user_input');
            const mockOutline = createMockJsondoc('outline-1', '剧本设定');
            const mockChronicles = createMockJsondoc('chronicles-1', 'chronicles');
            const mockEpisodePlanning = createMockJsondoc('episode-planning-1', '分集结构');
            const context: CanonicalJsondocContext = {
                canonicalBrainstormIdea: mockIdea,
                canonicalBrainstormCollection: null,
                canonicalOutlineSettings: mockOutline,
                canonicalChronicles: mockChronicles,
                canonicalEpisodePlanning: mockEpisodePlanning,
                canonicalBrainstormInput: null,
                canonicalEpisodeSynopsisList: [],
                workflowNodes: [],
                hasActiveTransforms: false,
                activeTransforms: [],
                lineageGraph: createMockLineageGraph(),
                rootNodes: [],
                leafNodes: []
            };

            const tools = computeAvailableToolsFromCanonicalContext(context);
            expect(tools).toEqual([
                'edit_灵感创意',
                'edit_剧本设定',
                'edit_时间顺序大纲',
                'edit_分集结构',
                'generate_单集大纲'
            ]);
        });

        it('should never include generate_灵感创意s when any brainstorm result exists', () => {
            const mockCollection = createMockJsondoc('collection-1', 'brainstorm_collection');
            const context: CanonicalJsondocContext = {
                canonicalBrainstormIdea: null,
                canonicalBrainstormCollection: mockCollection,
                canonicalOutlineSettings: null,
                canonicalChronicles: null,
                canonicalEpisodePlanning: null,
                canonicalBrainstormInput: null,
                canonicalEpisodeSynopsisList: [],
                workflowNodes: [],
                hasActiveTransforms: false,
                activeTransforms: [],
                lineageGraph: createMockLineageGraph(),
                rootNodes: [],
                leafNodes: []
            };

            const tools = computeAvailableToolsFromCanonicalContext(context);
            expect(tools).not.toContain('generate_灵感创意s');
        });
    });
}); 