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
        availableTools.push('generate_brainstorm_ideas');
    }

    if (hasBrainstormResult) {
        availableTools.push('edit_brainstorm_idea');
    }

    if (context.canonicalBrainstormIdea && !hasOutlineSettings) {
        availableTools.push('generate_outline_settings');
    }

    if (hasOutlineSettings) {
        // Add edit tools for previous stages
        if (context.canonicalBrainstormIdea) {
            availableTools.push('edit_brainstorm_idea');
        }
        availableTools.push('edit_outline_settings');

        // Add next generation tool
        if (!hasChronicles) {
            availableTools.push('generate_chronicles');
        }
    }

    if (hasChronicles) {
        // Add edit tools for previous stages
        if (context.canonicalBrainstormIdea) {
            availableTools.push('edit_brainstorm_idea');
        }
        if (hasOutlineSettings) {
            availableTools.push('edit_outline_settings');
        }
        availableTools.push('edit_chronicles');

        // Add next generation tool
        if (!hasEpisodePlanning) {
            availableTools.push('generate_episode_planning');
        }
    }

    if (hasEpisodePlanning) {
        // Add edit tools for all previous stages
        if (context.canonicalBrainstormIdea) {
            availableTools.push('edit_brainstorm_idea');
        }
        if (hasOutlineSettings) {
            availableTools.push('edit_outline_settings');
        }
        if (hasChronicles) {
            availableTools.push('edit_chronicles');
        }
        availableTools.push('edit_episode_planning');

        // Episode synopsis can be generated multiple times
        availableTools.push('generate_episode_synopsis');
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
        it('should return only generate_brainstorm_ideas for empty project', () => {
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
            expect(tools).toEqual(['generate_brainstorm_ideas']);
        });

        it('should return edit_brainstorm_idea when brainstorm_collection exists', () => {
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
            expect(tools).toEqual(['edit_brainstorm_idea']);
        });

        it('should return edit_brainstorm_idea and generate_outline_settings when single brainstorm_idea exists', () => {
            const mockIdea = createMockJsondoc('idea-1', 'brainstorm_idea', 'user_input');
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
            expect(tools).toEqual(['edit_brainstorm_idea', 'generate_outline_settings']);
        });

        it('should return appropriate tools when outline_settings exists', () => {
            const mockIdea = createMockJsondoc('idea-1', 'brainstorm_idea', 'user_input');
            const mockOutline = createMockJsondoc('outline-1', 'outline_settings');
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
            expect(tools).toEqual(['edit_brainstorm_idea', 'edit_outline_settings', 'generate_chronicles']);
        });

        it('should return all edit tools plus generate_episode_synopsis when episode_planning exists', () => {
            const mockIdea = createMockJsondoc('idea-1', 'brainstorm_idea', 'user_input');
            const mockOutline = createMockJsondoc('outline-1', 'outline_settings');
            const mockChronicles = createMockJsondoc('chronicles-1', 'chronicles');
            const mockEpisodePlanning = createMockJsondoc('episode-planning-1', 'episode_planning');
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
                'edit_brainstorm_idea',
                'edit_outline_settings',
                'edit_chronicles',
                'edit_episode_planning',
                'generate_episode_synopsis'
            ]);
        });

        it('should never include generate_brainstorm_ideas when any brainstorm result exists', () => {
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
            expect(tools).not.toContain('generate_brainstorm_ideas');
        });
    });
}); 