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
        // Find leaf nodes from canonical set
        const leafOutlineSettings = canonicalOutlineJsondocs.filter((jsondoc) => {
            const lineageNode = lineageGraph.nodes.get(jsondoc.id);
            return lineageNode && lineageNode.isLeaf;
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
    }

    // Find canonical chronicles (should be only one)
    const canonicalChronicles = canonicalChroniclesJsondocs[0] || null;

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
        'chronicles-display': 5
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
    }

    if (context.canonicalChronicles) {
        components.push({
            id: 'chronicles-display',
            component: getComponentById('chronicles-display'),
            mode: context.hasActiveTransforms ? 'readonly' : 'editable',
            props: {
                chronicles: context.canonicalChronicles,
                isEditable: !context.hasActiveTransforms
            },
            priority: componentOrder['chronicles-display']
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
        effectiveBrainstormIdeas: context.canonicalBrainstormJsondocs,
        chosenBrainstormIdea: context.chosenIdea,
        latestOutlineSettings: context.outlineSettings,
        latestChronicles: context.canonicalChronicles,
        brainstormInput: context.brainstormInput
    };
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