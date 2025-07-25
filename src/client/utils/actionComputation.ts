import { ElectricJsondoc, ProjectDataContextType, TypedJsondoc } from '../../common/types';
import { SelectedJsondocAndPath } from '../stores/actionItemsStore';
import {
    computeActionsFromLineage,
    type ActionItem,
} from './lineageBasedActionComputation';
import {
    UnifiedWorkflowState,
    DisplayComponent,
    WorkflowParameters,
} from './workflowTypes';
import { getComponentById } from './componentRegistry';
import {
    type CanonicalJsondocContext
} from '../../common/canonicalJsondocLogic';
// Import the new component state system
import {
    ComponentState,
    ComponentStateInfo,
    computeComponentState,
    isDirectlyEditable,
    canClickToEdit,
    isInteractive
} from './componentState';

// Re-export types from lineageBasedActionComputation for backward compatibility
export type { ActionItem } from './lineageBasedActionComputation';

// Result of action computation
export interface ComputedActions {
    actions: ActionItem[];
    hasActiveTransforms: boolean;
    stageDescription: string;
}

// Legacy helper functions - kept for backward compatibility with other parts of the app
// TODO: Eventually migrate all usage to universal component state functions

// Helper function to check if an jsondoc is a leaf node (no descendants)
export const isLeafNode = (jsondocId: string, transformInputs: any[]): boolean => {
    if (!Array.isArray(transformInputs)) return true;
    return !transformInputs.some(input => input.jsondoc_id === jsondocId);
};

// Helper function to check if an jsondoc can become editable
export const canBecomeEditable = (jsondoc: TypedJsondoc, transformInputs: any[]): boolean => {
    // Only AI-generated jsondocs can become editable via click-to-edit
    // User-created jsondocs should be directly editable, not click-to-edit
    return isLeafNode(jsondoc.id, transformInputs) && jsondoc.origin_type === 'ai_generated';
};

// Helper function to check if an jsondoc should be directly editable
export const isDirectlyEditableOld = (jsondoc: TypedJsondoc, transformInputs: any[]): boolean => {
    // User-created jsondocs should be directly editable if they have no descendants
    return isLeafNode(jsondoc.id, transformInputs) && jsondoc.origin_type === 'user_input';
};

// Helper function to check if an jsondoc can be edited (either directly or via click-to-edit)
export const canBeEdited = (jsondoc: TypedJsondoc, transformInputs: any[]): boolean => {
    return isDirectlyEditableOld(jsondoc, transformInputs) || canBecomeEditable(jsondoc, transformInputs);
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

    // Canonical jsondocs from canonical logic
    canonicalContext: CanonicalJsondocContext;

    // Legacy computed data for backward compatibility
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

    // Add project data for component state computation
    projectData: ProjectDataContextType;
}

/**
 * Core unified computation function that builds the context once
 * This function performs all lineage graph analysis and jsondoc filtering in a single pass
 */
function computeUnifiedContext(
    projectData: ProjectDataContextType,
    projectId: string
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
                canonicalContext: {
                    canonicalBrainstormIdea: null,
                    canonicalBrainstormCollection: null,
                    canonicalOutlineSettings: null,
                    canonicalChronicles: null,
                    canonicalEpisodePlanning: null,
                    canonicalBrainstormInput: null,
                    canonicalEpisodeSynopsisList: [],
                    canonicalEpisodeScriptsList: [],
                    workflowNodes: [],
                    hasActiveTransforms: false,
                    activeTransforms: [],
                    lineageGraph: { nodes: new Map(), edges: new Map(), rootNodes: new Set(), paths: new Map() },
                    rootNodes: [],
                    leafNodes: []
                },
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
                actions: [],
                projectData: projectData
            };
        }

        // Basic stage detection without lineage
        const brainstormIdeas = projectData.jsondocs.filter(a =>
            a.schema_type === '灵感创意'
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
                    canonicalContext: {
                        canonicalBrainstormIdea: userInputIdeas[0],
                        canonicalBrainstormCollection: null,
                        canonicalOutlineSettings: null,
                        canonicalChronicles: null,
                        canonicalEpisodePlanning: null,
                        canonicalBrainstormInput: null,
                        canonicalEpisodeSynopsisList: [],
                        canonicalEpisodeScriptsList: [],
                        workflowNodes: [],
                        hasActiveTransforms: false,
                        activeTransforms: [],
                        lineageGraph: { nodes: new Map(), edges: new Map(), rootNodes: new Set(), paths: new Map() },
                        rootNodes: [],
                        leafNodes: []
                    },
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
                    actions: [],
                    projectData: projectData
                };
            } else {
                return {
                    hasActiveTransforms: false,
                    isManualPath: false,
                    canonicalContext: {
                        canonicalBrainstormIdea: brainstormIdeas[0],
                        canonicalBrainstormCollection: null,
                        canonicalOutlineSettings: null,
                        canonicalChronicles: null,
                        canonicalEpisodePlanning: null,
                        canonicalBrainstormInput: null,
                        canonicalEpisodeSynopsisList: [],
                        canonicalEpisodeScriptsList: [],
                        workflowNodes: [],
                        hasActiveTransforms: false,
                        activeTransforms: [],
                        lineageGraph: { nodes: new Map(), edges: new Map(), rootNodes: new Set(), paths: new Map() },
                        rootNodes: [],
                        leafNodes: []
                    },
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
                    actions: [],
                    projectData: projectData
                };
            }
        } else if (brainstormCollections.length > 0) {
            // We have brainstorm collections but no individual ideas -> brainstorm_selection stage
            return {
                hasActiveTransforms: false,
                isManualPath: false,
                canonicalContext: {
                    canonicalBrainstormIdea: null,
                    canonicalBrainstormCollection: brainstormCollections[0],
                    canonicalOutlineSettings: null,
                    canonicalChronicles: null,
                    canonicalEpisodePlanning: null,
                    canonicalBrainstormInput: null,
                    canonicalEpisodeSynopsisList: [],
                    canonicalEpisodeScriptsList: [],
                    workflowNodes: [],
                    hasActiveTransforms: false,
                    activeTransforms: [],
                    lineageGraph: { nodes: new Map(), edges: new Map(), rootNodes: new Set(), paths: new Map() },
                    rootNodes: [],
                    leafNodes: []
                },
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
                actions: [],
                projectData: projectData
            };
        }

        return {
            hasActiveTransforms: false,
            isManualPath: false,
            canonicalContext: {
                canonicalBrainstormIdea: null,
                canonicalBrainstormCollection: null,
                canonicalOutlineSettings: null,
                canonicalChronicles: null,
                canonicalEpisodePlanning: null,
                canonicalBrainstormInput: null,
                canonicalEpisodeSynopsisList: [],
                canonicalEpisodeScriptsList: [],
                workflowNodes: [],
                hasActiveTransforms: false,
                activeTransforms: [],
                lineageGraph: { nodes: new Map(), edges: new Map(), rootNodes: new Set(), paths: new Map() },
                rootNodes: [],
                leafNodes: []
            },
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
            actions: [],
            projectData: projectData
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
            canonicalContext: {
                canonicalBrainstormIdea: null,
                canonicalBrainstormCollection: null,
                canonicalOutlineSettings: null,
                canonicalChronicles: null,
                canonicalEpisodePlanning: null,
                canonicalBrainstormInput: null,
                canonicalEpisodeSynopsisList: [],
                canonicalEpisodeScriptsList: [],
                workflowNodes: [],
                hasActiveTransforms: false,
                activeTransforms: [],
                lineageGraph: { nodes: new Map(), edges: new Map(), rootNodes: new Set(), paths: new Map() },
                rootNodes: [],
                leafNodes: []
            },
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
            actions: [],
            projectData: projectData
        };
    }



    // *** USE PRE-COMPUTED CANONICAL JSONDOC CONTEXT ***
    const canonicalContext = projectData.canonicalContext === "pending" || projectData.canonicalContext === "error"
        ? null
        : projectData.canonicalContext;

    if (!canonicalContext) {
        return {
            hasActiveTransforms: false,
            isManualPath: false,
            canonicalContext: {
                canonicalBrainstormIdea: null,
                canonicalBrainstormCollection: null,
                canonicalOutlineSettings: null,
                canonicalChronicles: null,
                canonicalEpisodePlanning: null,
                canonicalBrainstormInput: null,
                canonicalEpisodeSynopsisList: [],
                canonicalEpisodeScriptsList: [],
                workflowNodes: [],
                hasActiveTransforms: false,
                activeTransforms: [],
                lineageGraph: { nodes: new Map(), edges: new Map(), rootNodes: new Set(), paths: new Map() },
                rootNodes: [],
                leafNodes: []
            },
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
            actions: [],
            projectData: projectData
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

    // Extract legacy data from canonical context for backward compatibility
    const lineageGraph = projectData.lineageGraph;
    const jsondocs = projectData.jsondocs;
    const transformInputs = Array.isArray(projectData.transformInputs)
        ? projectData.transformInputs
        : [];

    // Build legacy canonical brainstorm jsondocs array
    const canonicalBrainstormJsondocs: ElectricJsondoc[] = [];
    if (canonicalContext.canonicalBrainstormInput) {
        canonicalBrainstormJsondocs.push(canonicalContext.canonicalBrainstormInput);
    }
    if (canonicalContext.canonicalBrainstormIdea) {
        canonicalBrainstormJsondocs.push(canonicalContext.canonicalBrainstormIdea);
    }
    if (canonicalContext.canonicalBrainstormCollection) {
        canonicalBrainstormJsondocs.push(canonicalContext.canonicalBrainstormCollection);
    }

    // Extract brainstorm ideas from canonical context
    const brainstormIdeas: any[] = [];

    // If we have a canonical brainstorm collection, extract ideas from it
    if (canonicalContext.canonicalBrainstormCollection) {
        try {
            const collectionData = typeof canonicalContext.canonicalBrainstormCollection.data === 'string'
                ? JSON.parse(canonicalContext.canonicalBrainstormCollection.data)
                : canonicalContext.canonicalBrainstormCollection.data;
            if (collectionData.ideas && Array.isArray(collectionData.ideas)) {
                brainstormIdeas.push(...collectionData.ideas.map((idea: any, index: number) => ({
                    title: idea.title || `创意 ${index + 1}`,
                    body: idea.body || idea.description || '',
                    jsondocId: canonicalContext.canonicalBrainstormCollection!.id,
                    ideaIndex: index
                })));
            }
        } catch (error) {
            console.warn('Failed to parse brainstorm collection data:', error);
        }
    }

    // If we have a canonical brainstorm idea, add it as well
    if (canonicalContext.canonicalBrainstormIdea) {
        try {
            const ideaData = typeof canonicalContext.canonicalBrainstormIdea.data === 'string'
                ? JSON.parse(canonicalContext.canonicalBrainstormIdea.data)
                : canonicalContext.canonicalBrainstormIdea.data;
            brainstormIdeas.push({
                title: ideaData.title || '创意',
                body: ideaData.body || ideaData.description || '',
                jsondocId: canonicalContext.canonicalBrainstormIdea.id,
                ideaIndex: 0
            });

        } catch (error) {
            console.warn('Failed to parse brainstorm idea data:', error);
        }
    }

    // Detect workflow path
    const isManualPath = !canonicalContext.canonicalBrainstormInput;



    return {
        hasActiveTransforms: canonicalContext.hasActiveTransforms,
        isManualPath,
        canonicalContext,
        canonicalBrainstormJsondocs,
        brainstormInput: canonicalContext.canonicalBrainstormInput,
        brainstormIdeas,
        chosenIdea: canonicalContext.canonicalBrainstormIdea,
        outlineSettings: canonicalContext.canonicalOutlineSettings,
        canonicalChronicles: canonicalContext.canonicalChronicles,
        canonicalEpisodePlanning: canonicalContext.canonicalEpisodePlanning,
        lineageGraph,
        transformInputs,
        jsondocs,
        actions: lineageResult.actions,
        projectData
    };
}

/**
 * Compute display components from unified context
 * Uses the new universal component state system
 */
function computeDisplayComponentsFromContext(context: UnifiedComputationContext): DisplayComponent[] {

    const components: DisplayComponent[] = [];

    // Define the order of components to display
    const componentOrder: { [key: string]: number } = {
        'brainstorm-input-editor': 1,
        'idea-collection': 2,
        'single-idea-editor': 3,
        '剧本设定-display': 4,
        'chronicles-display': 5,
        'episode-planning-display': 6,
        'episode-content-display': 7
    };

    // Add components based on context using universal component state system
    if (context.brainstormInput) {
        const componentState = computeComponentState(context.brainstormInput, context.projectData);

        components.push({
            id: 'brainstorm-input-editor',
            component: getComponentById('brainstorm-input-editor'),
            mode: isDirectlyEditable(componentState.state) ? 'editable' : 'readonly',
            props: {
                jsondoc: context.brainstormInput,
                componentState, // Pass full state info instead of isEditable
                minimized: false // Always full mode when at brainstorm_input stage
            },
            priority: componentOrder['brainstorm-input-editor']
        });
    }

    // Only show idea collection if we have a brainstorm collection (not individual ideas)
    if (context.canonicalContext.canonicalBrainstormCollection && context.brainstormIdeas.length > 0) {
        const componentState = computeComponentState(context.canonicalContext.canonicalBrainstormCollection, context.projectData);

        components.push({
            id: 'idea-collection',
            component: getComponentById('idea-collection'),
            mode: isInteractive(componentState.state) ? 'editable' : 'readonly',
            props: {
                componentState, // Pass state info
                selectionMode: true,
                isLoading: componentState.state === ComponentState.LOADING || componentState.state === ComponentState.PENDING_PARENT_TRANSFORM
            },
            priority: componentOrder['idea-collection']
        });
    }

    if (context.chosenIdea) {
        const componentState = computeComponentState(context.chosenIdea, context.projectData);

        components.push({
            id: 'single-idea-editor',
            component: getComponentById('single-idea-editor'),
            mode: isInteractive(componentState.state) ? 'editable' : 'readonly',
            props: {
                brainstormIdea: context.chosenIdea,
                componentState, // Pass state info instead of isEditable
                currentStage: 'idea_editing' // This will be removed from UnifiedWorkflowState
            },
            priority: componentOrder['single-idea-editor']
        });
    }

    if (context.outlineSettings) {
        const componentState = computeComponentState(context.outlineSettings, context.projectData);

        components.push({
            id: '剧本设定-display',
            component: getComponentById('剧本设定-display'),
            mode: isInteractive(componentState.state) ? 'editable' : 'readonly',
            props: {
                outlineSettings: context.outlineSettings,
                componentState // Pass state info instead of isEditable
            },
            priority: componentOrder['剧本设定-display']
        });
    }

    if (context.canonicalChronicles) {
        const componentState = computeComponentState(context.canonicalChronicles, context.projectData);

        components.push({
            id: 'chronicles-display',
            component: getComponentById('chronicles-display'),
            mode: isInteractive(componentState.state) ? 'editable' : 'readonly',
            props: {
                chroniclesJsondoc: context.canonicalChronicles,
                componentState // Pass state info instead of isEditable
            },
            priority: componentOrder['chronicles-display']
        });
    }

    if (context.canonicalEpisodePlanning) {
        const componentState = computeComponentState(context.canonicalEpisodePlanning, context.projectData);

        components.push({
            id: 'episode-planning-display',
            component: getComponentById('episode-planning-display'),
            mode: isInteractive(componentState.state) ? 'editable' : 'readonly',
            props: {
                episodePlanningJsondoc: context.canonicalEpisodePlanning,
                componentState // Pass state info instead of isEditable
            },
            priority: componentOrder['episode-planning-display']
        });
    }

    // Episode content display - show synopsis and script pairs
    if (context.canonicalContext.canonicalEpisodeSynopsisList.length > 0 || context.canonicalContext.canonicalEpisodeScriptsList.length > 0) {
        const synopsisItems = context.canonicalContext.canonicalEpisodeSynopsisList.map(synopsis => {
            const componentState = computeComponentState(synopsis, context.projectData);

            return {
                jsondoc: synopsis,
                componentState, // Use universal state instead of boolean flags
            };
        });

        const scriptItems = context.canonicalContext.canonicalEpisodeScriptsList.map(script => {
            const componentState = computeComponentState(script, context.projectData);

            return {
                jsondoc: script,
                componentState, // Use universal state instead of boolean flags
            };
        });

        components.push({
            id: 'episode-content-display',
            component: getComponentById('episode-content-display'),
            mode: 'readonly', // The container is readonly, but items can be editable
            props: {
                synopsisItems: synopsisItems,
                scriptItems: scriptItems,
            },
            priority: componentOrder['episode-content-display'],
        });
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
            return typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
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
        agentContext.剧本设定 = getFullData(context.outlineSettings);
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