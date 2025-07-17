import { ElectricJsondoc, ProjectDataContextType, TypedJsondoc } from '../../common/types';
import { SelectedJsondocAndPath } from '../stores/actionItemsStore';
import {
    computeActionsFromLineage,
    type ActionItem,
} from './lineageBasedActionComputation';
import { convertEffectiveIdeasToIdeaWithTitle } from '../../common/transform-jsondoc-framework/lineageResolution';
import {
    UnifiedWorkflowState,
    DisplayComponent,
    WorkflowParameters,
} from './workflowTypes';
import { getComponentById } from './componentRegistry';

// Re-export types from lineageBasedActionComputation for backward compatibility
export type { ActionItem } from './lineageBasedActionComputation';

// Result of action computation
export interface ComputedActions {
    actions: ActionItem[];
    hasActiveTransforms: boolean;
    stageDescription: string;
}

// Legacy helper functions - kept for backward compatibility with other parts of the app
// TODO: Eventually migrate all usage to lineage-based functions

// Helper function to check if an jsondoc is a leaf node (no descendants)
export const isLeafNode = (jsondocId: string, transformInputs: any[]): boolean => {
    if (!Array.isArray(transformInputs)) return true;
    return !transformInputs.some(input => input.jsondoc_id === jsondocId);
};

// Helper function to check if an jsondoc can become editable
export const canBecomeEditable = (jsondoc: TypedJsondoc, transformInputs: any[]): boolean => {
    return isLeafNode(jsondoc.id, transformInputs) && jsondoc.origin_type === 'ai_generated';
};

// ==============================================================================
// UNIFIED COMPUTATION SYSTEM
// ==============================================================================

/**
 * Internal context computed from lineage graph - contains all the data needed 
 * for workflow steps, display components, actions, and parameters
 */
interface UnifiedComputationContext {
    // Basic state
    hasActiveTransforms: boolean;
    // Workflow path detection
    isManualPath: boolean;

    // Resolved jsondocs from lineage graph
    canonicalBrainstormJsondocs: any[];
    brainstormInput: any;
    brainstormIdeas: any[];
    chosenIdea: any;
    outlineSettings: any;
    canonicalChronicles: any;
    canonicalEpisodePlanning: any;

    // Lineage and transform data
    lineageGraph: any;
    transformInputs: any[];
    jsondocs: any[];

    // Actions from lineage computation
    actions: ActionItem[];
}

/**
 * Core unified computation function that builds the context once
 * This function performs all lineage graph analysis and jsondoc filtering in a single pass
 */
function computeUnifiedContext(
    projectData: ProjectDataContextType,
    _projectId: string
): UnifiedComputationContext | null {

    // Check if any data is still loading
    if (projectData.jsondocs === "pending" ||
        projectData.transforms === "pending" ||
        projectData.humanTransforms === "pending" ||
        projectData.transformInputs === "pending" ||
        projectData.transformOutputs === "pending") {
        return null;
    }

    // Handle lineage graph pending state
    if (projectData.lineageGraph === "pending") {
        // Simple fallback: check if we have any jsondocs
        if (projectData.jsondocs === "error" || !Array.isArray(projectData.jsondocs) || projectData.jsondocs.length === 0) {
            return {
                hasActiveTransforms: false,
                isManualPath: false,
                canonicalBrainstormJsondocs: [],
                brainstormInput: null,
                brainstormIdeas: [],
                chosenIdea: null,
                outlineSettings: null,
                canonicalChronicles: null,
                canonicalEpisodePlanning: null,
                lineageGraph: null,
                transformInputs: [],
                jsondocs: [],
                actions: []
            };
        }

        // Basic stage detection without lineage
        const brainstormIdeas = projectData.jsondocs.filter(a =>
            a.schema_type === 'brainstorm_idea'
        );

        const brainstormCollections = projectData.jsondocs.filter(a =>
            a.schema_type === 'brainstorm_collection'
        );

        if (brainstormIdeas.length > 0) {
            // Check if we have user_input brainstorm ideas (indicating human transform/chosen idea)
            const userInputIdeas = brainstormIdeas.filter(a => a.origin_type === 'user_input');

            if (userInputIdeas.length > 0) {
                // We have chosen/edited ideas -> idea_editing stage
                return {
                    hasActiveTransforms: false,
                    isManualPath: true,
                    canonicalBrainstormJsondocs: brainstormIdeas,
                    brainstormInput: null,
                    brainstormIdeas,
                    chosenIdea: userInputIdeas[0] || null,
                    outlineSettings: null,
                    canonicalChronicles: null,
                    canonicalEpisodePlanning: null,
                    lineageGraph: null,
                    transformInputs: [],
                    jsondocs: projectData.jsondocs,
                    actions: []
                };
            } else {
                return {
                    hasActiveTransforms: false,
                    isManualPath: false,
                    canonicalBrainstormJsondocs: brainstormIdeas,
                    brainstormInput: null,
                    brainstormIdeas,
                    chosenIdea: null,
                    outlineSettings: null,
                    canonicalChronicles: null,
                    canonicalEpisodePlanning: null,
                    lineageGraph: null,
                    transformInputs: [],
                    jsondocs: projectData.jsondocs,
                    actions: []
                };
            }
        } else if (brainstormCollections.length > 0) {
            // We have brainstorm collections but no individual ideas -> brainstorm_selection stage
            return {
                hasActiveTransforms: false,
                isManualPath: false,
                canonicalBrainstormJsondocs: brainstormCollections,
                brainstormInput: null,
                brainstormIdeas: brainstormCollections,
                chosenIdea: null,
                outlineSettings: null,
                canonicalChronicles: null,
                canonicalEpisodePlanning: null,
                lineageGraph: null,
                transformInputs: [],
                jsondocs: projectData.jsondocs,
                actions: []
            };
        }

        return {
            hasActiveTransforms: false,
            isManualPath: false,
            canonicalBrainstormJsondocs: [],
            brainstormInput: null,
            brainstormIdeas: [],
            chosenIdea: null,
            outlineSettings: null,
            canonicalChronicles: null,
            canonicalEpisodePlanning: null,
            lineageGraph: null,
            transformInputs: [],
            jsondocs: [],
            actions: []
        };
    }

    // Handle error states
    if (projectData.lineageGraph === "error" ||
        projectData.jsondocs === "error" ||
        projectData.transforms === "error" ||
        projectData.humanTransforms === "error" ||
        projectData.transformInputs === "error" ||
        projectData.transformOutputs === "error") {
        return {
            hasActiveTransforms: false,
            isManualPath: false,
            canonicalBrainstormJsondocs: [],
            brainstormInput: null,
            brainstormIdeas: [],
            chosenIdea: null,
            outlineSettings: null,
            canonicalChronicles: null,
            canonicalEpisodePlanning: null,
            lineageGraph: null,
            transformInputs: [],
            jsondocs: [],
            actions: []
        };
    }

    // Use the lineage-based computation for actions and stage detection
    const lineageResult = computeActionsFromLineage(
        projectData.lineageGraph,
        projectData.jsondocs,
        projectData.transforms,
        projectData.humanTransforms,
        projectData.transformInputs,
        projectData.transformOutputs
    );

    // Extract all needed data from lineage graph and jsondocs in a single pass
    const lineageGraph = projectData.lineageGraph;
    const jsondocs = projectData.jsondocs;
    const transformInputs = Array.isArray(projectData.transformInputs)
        ? projectData.transformInputs
        : [];

    // Single pass through lineage graph to collect all jsondoc types
    const canonicalBrainstormJsondocs: ElectricJsondoc[] = [];
    const canonicalOutlineJsondocs: ElectricJsondoc[] = [];
    const canonicalChroniclesJsondocs: ElectricJsondoc[] = [];
    const canonicalEpisodePlanningJsondocs: ElectricJsondoc[] = [];

    // Process all lineage nodes in one pass
    for (const node of lineageGraph.nodes.values()) {
        if (node.type !== 'jsondoc') continue;

        const lineageJsondocNode = node as any;
        const jsondoc = jsondocs.find((a) => a.id === lineageJsondocNode.jsondocId);

        if (!jsondoc) {
            continue;
        }

        // Categorize jsondocs by type
        if (jsondoc.schema_type === 'brainstorm_input_params' ||
            jsondoc.schema_type === 'brainstorm_idea' ||
            jsondoc.schema_type === 'brainstorm_collection') {
            canonicalBrainstormJsondocs.push(jsondoc);
        } else if (jsondoc.schema_type === 'outline_settings') {
            canonicalOutlineJsondocs.push(jsondoc);
        } else if (jsondoc.schema_type === 'chronicles') {
            canonicalChroniclesJsondocs.push(jsondoc);
        } else if (jsondoc.schema_type === 'episode_planning') {
            canonicalEpisodePlanningJsondocs.push(jsondoc);
        }
    }

    // Extract specific jsondoc types from brainstorm jsondocs
    const brainstormInput = canonicalBrainstormJsondocs.find((a) =>
        a.schema_type === 'brainstorm_input_params'
    );

    // This properly extracts individual ideas from collections
    const brainstormIdeas = lineageResult.actionContext.effectiveBrainstormIdeas;

    // Convert EffectiveBrainstormIdea[] to IdeaWithTitle[] format for components
    const brainstormIdeasWithTitle = brainstormIdeas ?
        convertEffectiveIdeasToIdeaWithTitle(brainstormIdeas, projectData.jsondocs) :
        [];

    // Find chosen idea using lineage computation result
    let chosenIdea = lineageResult.actionContext.chosenBrainstormIdea;

    // Process outline settings with priority logic
    let outlineSettings = null;
    if (canonicalOutlineJsondocs.length > 0) {
        console.log('[computeUnifiedContext] Found outline jsondocs:', {
            count: canonicalOutlineJsondocs.length,
            outlines: canonicalOutlineJsondocs.map(j => ({
                id: j.id,
                origin_type: j.origin_type,
                created_at: j.created_at
            }))
        });

        // Find leaf nodes from canonical set
        const leafOutlineSettings = canonicalOutlineJsondocs.filter((jsondoc) => {
            const lineageNode = lineageGraph.nodes.get(jsondoc.id);
            const isLeaf = lineageNode && lineageNode.isLeaf;
            console.log(`[computeUnifiedContext] Outline ${jsondoc.id}: isLeaf=${isLeaf}, lineageNode exists=${!!lineageNode}`);
            return isLeaf;
        });

        console.log('[computeUnifiedContext] Leaf outline settings:', {
            leafCount: leafOutlineSettings.length,
            leafNodes: leafOutlineSettings.map(j => ({
                id: j.id,
                origin_type: j.origin_type
            }))
        });

        if (leafOutlineSettings.length > 0) {
            // Prioritize user_input jsondocs, then by most recent
            leafOutlineSettings.sort((a, b) => {
                // First priority: user_input origin type
                if (a.origin_type === 'user_input' && b.origin_type !== 'user_input') return -1;
                if (b.origin_type === 'user_input' && a.origin_type !== 'user_input') return 1;
                // Second priority: most recent
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
            outlineSettings = leafOutlineSettings[0];
        } else {
            // Fallback to most recent from canonical set if no leaf nodes found
            canonicalOutlineJsondocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            outlineSettings = canonicalOutlineJsondocs[0];
        }

        console.log('[computeUnifiedContext] Selected outline settings:', {
            selected: outlineSettings ? {
                id: outlineSettings.id,
                origin_type: outlineSettings.origin_type,
                created_at: outlineSettings.created_at
            } : null
        });
    } else {
        console.log('[computeUnifiedContext] No outline jsondocs found in lineage graph');
    }

    // Process chronicles with priority logic (same as outline settings)
    let canonicalChronicles = null;
    if (canonicalChroniclesJsondocs.length > 0) {
        console.log('[computeUnifiedContext] Found chronicles jsondocs:', {
            count: canonicalChroniclesJsondocs.length,
            chronicles: canonicalChroniclesJsondocs.map(j => ({
                id: j.id,
                origin_type: j.origin_type,
                created_at: j.created_at
            }))
        });

        // Find leaf nodes from canonical set
        const leafChronicles = canonicalChroniclesJsondocs.filter((jsondoc) => {
            const lineageNode = lineageGraph.nodes.get(jsondoc.id);
            const isLeaf = lineageNode && lineageNode.isLeaf;
            console.log(`[computeUnifiedContext] Chronicles ${jsondoc.id}: isLeaf=${isLeaf}, lineageNode exists=${!!lineageNode}`);
            return isLeaf;
        });

        console.log('[computeUnifiedContext] Leaf chronicles:', {
            leafCount: leafChronicles.length,
            leafNodes: leafChronicles.map(j => ({
                id: j.id,
                origin_type: j.origin_type
            }))
        });

        if (leafChronicles.length > 0) {
            // Prioritize user_input jsondocs, then by most recent
            leafChronicles.sort((a, b) => {
                // First priority: user_input origin type
                if (a.origin_type === 'user_input' && b.origin_type !== 'user_input') return -1;
                if (b.origin_type === 'user_input' && a.origin_type !== 'user_input') return 1;
                // Second priority: most recent
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
            canonicalChronicles = leafChronicles[0];
        } else {
            // Fallback to most recent from canonical set if no leaf nodes found
            canonicalChroniclesJsondocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            canonicalChronicles = canonicalChroniclesJsondocs[0];
        }

        console.log('[computeUnifiedContext] Selected chronicles:', {
            selected: canonicalChronicles ? {
                id: canonicalChronicles.id,
                origin_type: canonicalChronicles.origin_type,
                created_at: canonicalChronicles.created_at
            } : null
        });
    } else {
        console.log('[computeUnifiedContext] No chronicles jsondocs found in lineage graph');
    }

    // Process episode planning with priority logic (same as outline settings)
    let canonicalEpisodePlanning = null;
    if (canonicalEpisodePlanningJsondocs.length > 0) {
        console.log('[computeUnifiedContext] Found episode planning jsondocs:', {
            count: canonicalEpisodePlanningJsondocs.length,
            episodePlanning: canonicalEpisodePlanningJsondocs.map(j => ({
                id: j.id,
                origin_type: j.origin_type,
                created_at: j.created_at
            }))
        });

        // Find leaf nodes from canonical set
        const leafEpisodePlanning = canonicalEpisodePlanningJsondocs.filter((jsondoc) => {
            const lineageNode = lineageGraph.nodes.get(jsondoc.id);
            const isLeaf = lineageNode && lineageNode.isLeaf;
            console.log(`[computeUnifiedContext] Episode planning ${jsondoc.id}: isLeaf=${isLeaf}, lineageNode exists=${!!lineageNode}`);
            return isLeaf;
        });

        console.log('[computeUnifiedContext] Leaf episode planning:', {
            leafCount: leafEpisodePlanning.length,
            leafNodes: leafEpisodePlanning.map(j => ({
                id: j.id,
                origin_type: j.origin_type
            }))
        });

        if (leafEpisodePlanning.length > 0) {
            // Prioritize user_input jsondocs, then by most recent
            leafEpisodePlanning.sort((a, b) => {
                // First priority: user_input origin type
                if (a.origin_type === 'user_input' && b.origin_type !== 'user_input') return -1;
                if (b.origin_type === 'user_input' && a.origin_type !== 'user_input') return 1;
                // Second priority: most recent
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
            canonicalEpisodePlanning = leafEpisodePlanning[0];
        } else {
            // Fallback to most recent from canonical set if no leaf nodes found
            canonicalEpisodePlanningJsondocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            canonicalEpisodePlanning = canonicalEpisodePlanningJsondocs[0];
        }

        console.log('[computeUnifiedContext] Selected episode planning:', {
            selected: canonicalEpisodePlanning ? {
                id: canonicalEpisodePlanning.id,
                origin_type: canonicalEpisodePlanning.origin_type,
                created_at: canonicalEpisodePlanning.created_at
            } : null
        });
    } else {
        console.log('[computeUnifiedContext] No episode planning jsondocs found in lineage graph');
    }

    console.log('[computeUnifiedContext] Episode planning analysis:', {
        canonicalEpisodePlanningJsondocs: canonicalEpisodePlanningJsondocs.map(j => ({
            id: j.id,
            schema_type: j.schema_type,
            origin_type: j.origin_type,
            created_at: j.created_at
        })),
        canonicalEpisodePlanning: canonicalEpisodePlanning ? {
            id: canonicalEpisodePlanning.id,
            schema_type: canonicalEpisodePlanning.schema_type,
            origin_type: canonicalEpisodePlanning.origin_type,
            created_at: canonicalEpisodePlanning.created_at
        } : null
    });

    // Detect workflow path
    const isManualPath = !brainstormInput;

    return {
        hasActiveTransforms: lineageResult.actionContext.hasActiveTransforms,
        isManualPath,
        canonicalBrainstormJsondocs,
        brainstormInput,
        brainstormIdeas: brainstormIdeasWithTitle, // Use converted format
        chosenIdea,
        outlineSettings,
        canonicalChronicles,
        canonicalEpisodePlanning,
        lineageGraph,
        transformInputs,
        jsondocs,
        actions: lineageResult.actions
    };
}

/**
 * Compute display components from unified context
 */
function computeDisplayComponentsFromContext(context: UnifiedComputationContext): DisplayComponent[] {

    const components: DisplayComponent[] = [];

    // Define the order of components to display
    const componentOrder: { [key: string]: number } = {
        'brainstorm-input-editor': 1,
        'idea-collection': 2,
        'single-idea-editor': 3,
        'outline-settings-display': 4,
        'chronicles-display': 5,
        'episode-planning-display': 6
    };

    // Add components based on context
    if (context.brainstormInput) {
        components.push({
            id: 'brainstorm-input-editor',
            component: getComponentById('brainstorm-input-editor'),
            mode: context.hasActiveTransforms ? 'readonly' : 'editable',
            props: {
                jsondoc: context.brainstormInput,
                isEditable: !context.hasActiveTransforms,
                minimized: false // Always full mode when at brainstorm_input stage
            },
            priority: componentOrder['brainstorm-input-editor']
        });
    }

    if (context.brainstormIdeas.length > 0) {
        components.push({
            id: 'idea-collection',
            component: getComponentById('idea-collection'),
            mode: context.hasActiveTransforms ? 'readonly' : 'editable',
            props: {
                ideas: context.brainstormIdeas,
                selectionMode: true,
                isLoading: context.hasActiveTransforms
            },
            priority: componentOrder['idea-collection']
        });
    }

    if (context.chosenIdea) {
        components.push({
            id: 'single-idea-editor',
            component: getComponentById('single-idea-editor'),
            mode: context.hasActiveTransforms ? 'readonly' : 'editable',
            props: {
                brainstormIdea: context.chosenIdea, // Fixed: use brainstormIdea instead of idea
                isEditable: !context.hasActiveTransforms,
                currentStage: 'idea_editing' // This will be removed from UnifiedWorkflowState
            },
            priority: componentOrder['single-idea-editor']
        });
    }

    if (context.outlineSettings) {
        // Determine if the outline settings jsondoc is actually editable
        const isOutlineLeafNode = isLeafNode(context.outlineSettings.id, context.transformInputs);
        const isOutlineEditable = !context.hasActiveTransforms &&
            isOutlineLeafNode &&
            context.outlineSettings.origin_type === 'user_input';


        components.push({
            id: 'outline-settings-display',
            component: getComponentById('outline-settings-display'),
            mode: context.hasActiveTransforms ? 'readonly' : 'editable',
            props: {
                outlineSettings: context.outlineSettings,
                isEditable: isOutlineEditable
            },
            priority: componentOrder['outline-settings-display']
        });
    } else {
    }

    if (context.canonicalChronicles) {
        // Chronicles should be read-only if there are active transforms OR if episode planning exists
        const isChroniclesEditable = !context.hasActiveTransforms && !context.canonicalEpisodePlanning;

        components.push({
            id: 'chronicles-display',
            component: getComponentById('chronicles-display'),
            mode: isChroniclesEditable ? 'editable' : 'readonly',
            props: {
                chroniclesJsondoc: context.canonicalChronicles,
                isEditable: isChroniclesEditable
            },
            priority: componentOrder['chronicles-display']
        });
    }

    if (context.canonicalEpisodePlanning) {
        console.log('[computeDisplayComponentsFromContext] Adding episode planning component:', {
            episodePlanningId: context.canonicalEpisodePlanning.id,
            episodePlanningSchemaType: context.canonicalEpisodePlanning.schema_type,
            episodePlanningOriginType: context.canonicalEpisodePlanning.origin_type,
            episodePlanningDataLength: context.canonicalEpisodePlanning.data?.length,
            hasActiveTransforms: context.hasActiveTransforms,
            isEditable: !context.hasActiveTransforms
        });

        components.push({
            id: 'episode-planning-display',
            component: getComponentById('episode-planning-display'),
            mode: context.hasActiveTransforms ? 'readonly' : 'editable',
            props: {
                episodePlanningJsondoc: context.canonicalEpisodePlanning,
                isEditable: !context.hasActiveTransforms
            },
            priority: componentOrder['episode-planning-display']
        });
    } else {
        console.log('[computeDisplayComponentsFromContext] No canonical episode planning found');
    }

    // Sort by priority
    const sortedComponents = components.sort((a, b) => a.priority - b.priority);



    return sortedComponents;
}

/**
 * Compute workflow parameters from unified context
 */
function computeWorkflowParametersFromContext(
    context: UnifiedComputationContext,
    projectId: string
): WorkflowParameters {
    return {
        projectId,
        hasActiveTransforms: context.hasActiveTransforms,
        effectiveBrainstormIdeas: context.canonicalBrainstormJsondocs,
        chosenBrainstormIdea: context.chosenIdea,
        latestOutlineSettings: context.outlineSettings,
        latestChronicles: context.canonicalChronicles,
        brainstormInput: context.brainstormInput
    };
}

/**
 * Computes structured agent context with full content of latest relevant jsondocs.
 * Mirrors display components but excludes collection if chosen idea exists.
 * Throws on multiple instances of same type.
 */
export function computeAgentContext(
    projectData: ProjectDataContextType,
    projectId: string
): Record<string, any> | null {
    const context = computeUnifiedContext(projectData, projectId);
    if (!context) return null;

    const agentContext: Record<string, any> = {};

    // Helper to get full parsed data
    const getFullData = (jsondoc: ElectricJsondoc | null) => {
        if (!jsondoc) return undefined;
        try {
            return JSON.parse(jsondoc.data);
        } catch (error) {
            throw new Error(`Failed to parse jsondoc data for ${jsondoc.schema_type}: ${(error as Error).message}`);
        }
    };

    // Brainstorm input
    if (context.brainstormInput) {
        agentContext.brainstorm_input = getFullData(context.brainstormInput);
    }

    // Chosen idea
    if (context.chosenIdea) {
        agentContext.chosen_idea = getFullData(context.chosenIdea);
    }

    // Brainstorm collection - only if no chosen idea
    if (!context.chosenIdea && context.brainstormIdeas.length > 0) {
        // Assuming brainstormIdeas are from collections; find the latest collection
        const collections = context.canonicalBrainstormJsondocs.filter(j => j.schema_type === 'brainstorm_collection');
        if (collections.length > 1) {
            throw new Error('Multiple brainstorm collections found');
        }
        if (collections.length === 1) {
            agentContext.brainstorm_collection = getFullData(collections[0]);
        }
    }

    // Outline settings
    if (context.outlineSettings) {
        agentContext.outline_settings = getFullData(context.outlineSettings);
    }

    // Chronicles
    if (context.canonicalChronicles) {
        agentContext.chronicles = getFullData(context.canonicalChronicles);
    }

    // Check for multiples - but since we already filter to latest/leaf, assume single
    // Additional checks if needed

    return agentContext;
}

// ==============================================================================
// BACKWARD COMPATIBILITY FUNCTIONS
// ==============================================================================

/**
 * Detect if this is a manual path (user directly entered an idea) vs AI path (brainstorm generation)
 */
const detectIsManualPath = (projectData: ProjectDataContextType): boolean => {
    if (projectData.jsondocs === "pending" || projectData.jsondocs === "error") {
        return false;
    }

    // Simple heuristic: if we have brainstorm_input_params jsondocs, it's AI path
    // Otherwise, it's manual path
    const hasBrainstormInput = projectData.jsondocs.some(a =>
        a.schema_type === 'brainstorm_input_params'
    );

    return !hasBrainstormInput;
};

/**
 * Compute workflow parameters for components and actions
 * @deprecated Use computeUnifiedWorkflowState instead
 */
export const computeWorkflowParameters = (
    projectData: ProjectDataContextType,
    projectId: string
): WorkflowParameters => {
    const context = computeUnifiedContext(projectData, projectId);

    if (!context) {
        return {
            projectId,
            hasActiveTransforms: false,
            effectiveBrainstormIdeas: [],
            chosenBrainstormIdea: null,
            latestOutlineSettings: null,
            latestChronicles: null,
            brainstormInput: null
        };
    }

    return computeWorkflowParametersFromContext(context, projectId);
};

/**
 * MAIN UNIFIED COMPUTATION FUNCTION
 * Computes steps, display components, actions, and parameters in a single pass
 */
export const computeUnifiedWorkflowState = (
    projectData: ProjectDataContextType,
    projectId: string,
    _selectedJsondocAndPath?: SelectedJsondocAndPath | null
): UnifiedWorkflowState => {
    const context = computeUnifiedContext(projectData, projectId);

    if (!context) {
        return {
            displayComponents: [],
            actions: [],
            parameters: {
                projectId,
                hasActiveTransforms: false,
                effectiveBrainstormIdeas: [],
                chosenBrainstormIdea: null,
                latestOutlineSettings: null,
                latestChronicles: null,
                brainstormInput: null
            }
        };
    }

    // Compute all outputs from the unified context
    const displayComponents = computeDisplayComponentsFromContext(context);
    const parameters = computeWorkflowParametersFromContext(context, projectId);

    return {
        displayComponents,
        actions: context.actions,
        parameters
    };
}; 