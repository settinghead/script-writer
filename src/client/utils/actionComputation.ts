import { ElectricJsondoc, ProjectDataContextType, TypedJsondoc } from '../../common/types';
import { SelectedJsondocAndPath } from '../stores/actionItemsStore';
import {
    computeActionsFromLineage,
    type ActionItem,
    type WorkflowStage
} from './lineageBasedActionComputation';
import { convertEffectiveIdeasToIdeaWithTitle } from '../../common/transform-jsondoc-framework/lineageResolution';
import {
    UnifiedWorkflowState,
    WorkflowStep,
    DisplayComponent,
    WorkflowParameters,
    WORKFLOW_STEPS
} from './workflowTypes';
import { getComponentById } from './componentRegistry';

// Re-export types from lineageBasedActionComputation for backward compatibility
export type { WorkflowStage, ActionItem } from './lineageBasedActionComputation';

// Result of action computation
export interface ComputedActions {
    actions: ActionItem[];
    currentStage: WorkflowStage;
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
    currentStage: WorkflowStage;
    hasActiveTransforms: boolean;
    stageDescription: string;

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
                currentStage: 'initial',
                hasActiveTransforms: false,
                stageDescription: '准备开始...',
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
                    currentStage: 'idea_editing',
                    hasActiveTransforms: false,
                    stageDescription: '编辑创意中...',
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
                    currentStage: 'brainstorm_selection',
                    hasActiveTransforms: false,
                    stageDescription: '选择创意中...',
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
                currentStage: 'brainstorm_selection',
                hasActiveTransforms: false,
                stageDescription: '选择创意中...',
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
            currentStage: 'initial',
            hasActiveTransforms: false,
            stageDescription: '准备开始...',
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
            currentStage: 'initial',
            hasActiveTransforms: false,
            stageDescription: '加载失败',
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
        currentStage: lineageResult.actionContext.currentStage,
        hasActiveTransforms: lineageResult.actionContext.hasActiveTransforms,
        stageDescription: lineageResult.stageDescription,
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
 * Compute workflow steps from unified context
 */
function computeWorkflowStepsFromContext(context: UnifiedComputationContext): WorkflowStep[] {
    // Return empty array if currentStage is initial - no workflow steps to show
    if (context.currentStage === 'initial') {
        return [];
    }

    // Define steps for each path
    const manualPathSteps: WorkflowStep[] = [
        {
            id: WORKFLOW_STEPS.IDEA_EDITING,
            title: '创意编辑',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.OUTLINE_GENERATION,
            title: '剧本框架',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.CHRONICLES_GENERATION,
            title: '时间顺序大纲',
            status: 'wait'
        },
        {
            id: 'episode_outline',
            title: '每集大纲',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.EPISODE_GENERATION,
            title: '分集剧本',
            status: 'wait'
        }
    ];

    const aiPathSteps: WorkflowStep[] = [
        {
            id: WORKFLOW_STEPS.BRAINSTORM_INPUT,
            title: '创意输入',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.BRAINSTORM_GENERATION,
            title: '头脑风暴',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.IDEA_EDITING,
            title: '创意编辑',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.OUTLINE_GENERATION,
            title: '剧本框架',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.CHRONICLES_GENERATION,
            title: '时间顺序大纲',
            status: 'wait'
        },
        {
            id: 'episode_outline',
            title: '每集大纲',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.EPISODE_GENERATION,
            title: '分集剧本',
            status: 'wait'
        }
    ];

    // Choose steps based on path
    const steps = context.isManualPath ? manualPathSteps : aiPathSteps;

    // Map workflow stages to step indices based on path
    const manualStageToStepMap: Record<WorkflowStage, number> = {
        'initial': -1,
        'brainstorm_input': -1, // Not used in manual path
        'brainstorm_selection': -1, // Not used in manual path
        'idea_editing': 0,
        'outline_generation': 1,
        'chronicles_generation': 2,
        'episode_synopsis_generation': 4 // Skip "每集大纲" for now, map to final step
    };

    const aiStageToStepMap: Record<WorkflowStage, number> = {
        'initial': -1,
        'brainstorm_input': 0,
        'brainstorm_selection': 1,
        'idea_editing': 2,
        'outline_generation': 3,
        'chronicles_generation': 4,
        'episode_synopsis_generation': 6 // Skip "每集大纲" for now, map to final step
    };

    const stageToStepMap = context.isManualPath ? manualStageToStepMap : aiStageToStepMap;
    const currentStepIndex = stageToStepMap[context.currentStage];

    // Update step statuses
    steps.forEach((step, index) => {
        if (index < currentStepIndex) {
            step.status = 'finish';
        } else if (index === currentStepIndex) {
            if (context.hasActiveTransforms) {
                step.status = 'process'; // Show loading spinner
            } else {
                step.status = 'finish'; // Current step is completed
            }
        } else {
            step.status = 'wait';
        }
    });

    return steps;
}

/**
 * Compute display components from unified context
 */
function computeDisplayComponentsFromContext(context: UnifiedComputationContext): DisplayComponent[] {

    const components: DisplayComponent[] = [];

    switch (context.currentStage) {
        case 'initial':
            // Show project creation form
            components.push({
                id: 'project-creation-form',
                component: getComponentById('project-creation-form'),
                mode: 'editable',
                props: {},
                priority: 1
            });
            break;

        case 'brainstorm_input':
            // Show brainstorm input editor
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
                    priority: 1
                });
            }
            break;

        case 'brainstorm_selection':
            // Show brainstorm input in readonly mode
            if (context.brainstormInput) {
                // Check if brainstorm input is at leaf level in lineage graph
                const brainstormInputNode = context.lineageGraph?.nodes.get(context.brainstormInput.id);
                const isAtLeafLevel = brainstormInputNode?.isLeaf ?? true;

                components.push({
                    id: 'brainstorm-input-editor',
                    component: getComponentById('brainstorm-input-editor'),
                    mode: 'readonly',
                    props: {
                        jsondoc: context.brainstormInput,
                        isEditable: false,
                        minimized: !isAtLeafLevel // Minimized when not at leaf level
                    },
                    priority: 1
                });
            }

            // Show brainstorm ideas for selection
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
                    priority: 2
                });
            }
            break;

        case 'idea_editing':
            // Show brainstorm input in readonly mode (only for AI path)
            if (context.brainstormInput && !context.isManualPath) {
                // Check if brainstorm input is at leaf level in lineage graph
                const brainstormInputNode = context.lineageGraph?.nodes.get(context.brainstormInput.id);
                const isAtLeafLevel = brainstormInputNode?.isLeaf ?? true;

                components.push({
                    id: 'brainstorm-input-editor',
                    component: getComponentById('brainstorm-input-editor'),
                    mode: 'readonly',
                    props: {
                        jsondoc: context.brainstormInput,
                        isEditable: false,
                        minimized: !isAtLeafLevel // Minimized when not at leaf level
                    },
                    priority: 1
                });
            }

            // Show brainstorm ideas in readonly mode for reference (only for AI path)
            if (context.brainstormIdeas.length > 0 && !context.isManualPath) {
                components.push({
                    id: 'idea-collection',
                    component: getComponentById('idea-collection'),
                    mode: 'readonly',
                    props: {
                        ideas: context.brainstormIdeas,
                        selectionMode: false, // Not in selection mode anymore
                        isLoading: false,
                        readOnly: true // Explicitly mark as read-only
                    },
                    priority: 2
                });
            }

            // Show chosen idea editor (if we have one)
            if (context.chosenIdea) {
                components.push({
                    id: 'single-idea-editor',
                    component: getComponentById('single-idea-editor'),
                    mode: context.hasActiveTransforms ? 'readonly' : 'editable',
                    props: {
                        brainstormIdea: context.chosenIdea, // Fixed: use brainstormIdea instead of idea
                        isEditable: !context.hasActiveTransforms,
                        currentStage: context.currentStage
                    },
                    priority: 3
                });
            } else {
                // No chosen idea yet - this should be brainstorm_selection stage instead
                // But for backward compatibility, show brainstorm collection for selection
                if (context.brainstormIdeas.length > 0) {
                    components.push({
                        id: 'single-idea-editor',
                        component: getComponentById('single-idea-editor'),
                        mode: context.hasActiveTransforms ? 'readonly' : 'editable',
                        props: {
                            brainstormIdea: context.brainstormIdeas[0],
                            isEditable: !context.hasActiveTransforms,
                            currentStage: context.currentStage
                        },
                        priority: 3
                    });
                }
            }
            break;

        case 'outline_generation':
            // Show previous components in readonly/collapsed mode (only for AI path)
            if (context.brainstormInput && !context.isManualPath) {
                // Check if brainstorm input is at leaf level in lineage graph
                const brainstormInputNode = context.lineageGraph?.nodes.get(context.brainstormInput.id);
                const isAtLeafLevel = brainstormInputNode?.isLeaf ?? true;

                components.push({
                    id: 'brainstorm-input-editor',
                    component: getComponentById('brainstorm-input-editor'),
                    mode: 'readonly',
                    props: {
                        jsondoc: context.brainstormInput,
                        isEditable: false,
                        minimized: !isAtLeafLevel // Minimized when not at leaf level
                    },
                    priority: 1
                });
            }

            // Only show chosen idea editor (not the collection)
            if (context.chosenIdea) {
                components.push({
                    id: 'single-idea-editor',
                    component: getComponentById('single-idea-editor'),
                    mode: 'readonly',
                    props: {
                        brainstormIdea: context.chosenIdea, // Fixed: use brainstormIdea instead of idea
                        isEditable: false,
                        currentStage: context.currentStage
                    },
                    priority: 2
                });
            }

            // Show outline settings
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
                    priority: 4
                });
            }
            break;

        case 'chronicles_generation':
            // Show previous components in readonly/collapsed mode (only for AI path)
            if (context.brainstormInput && !context.isManualPath) {
                // Check if brainstorm input is at leaf level in lineage graph
                const brainstormInputNode = context.lineageGraph?.nodes.get(context.brainstormInput.id);
                const isAtLeafLevel = brainstormInputNode?.isLeaf ?? true;

                components.push({
                    id: 'brainstorm-input-editor',
                    component: getComponentById('brainstorm-input-editor'),
                    mode: 'readonly',
                    props: {
                        jsondoc: context.brainstormInput,
                        isEditable: false,
                        minimized: !isAtLeafLevel // Minimized when not at leaf level
                    },
                    priority: 1
                });
            }

            // Only show chosen idea editor (not the collection)
            if (context.chosenIdea) {
                components.push({
                    id: 'single-idea-editor',
                    component: getComponentById('single-idea-editor'),
                    mode: 'readonly',
                    props: {
                        brainstormIdea: context.chosenIdea, // Fixed: use brainstormIdea instead of idea
                        isEditable: false,
                        currentStage: context.currentStage
                    },
                    priority: 2
                });
            }

            if (context.outlineSettings) {
                components.push({
                    id: 'outline-settings-display',
                    component: getComponentById('outline-settings-display'),
                    mode: 'readonly',
                    props: {
                        outlineSettings: context.outlineSettings,
                        isEditable: false
                    },
                    priority: 4
                });
            }

            // Show chronicles
            if (context.canonicalChronicles) {
                components.push({
                    id: 'chronicles-display',
                    component: getComponentById('chronicles-display'),
                    mode: context.hasActiveTransforms ? 'readonly' : 'editable',
                    props: {
                        chronicles: context.canonicalChronicles,
                        isEditable: !context.hasActiveTransforms
                    },
                    priority: 5
                });
            }
            break;

        case 'episode_synopsis_generation':
            // Show all previous components in readonly/collapsed mode (only for AI path)
            if (context.brainstormInput && !context.isManualPath) {
                // Check if brainstorm input is at leaf level in lineage graph
                const brainstormInputNode = context.lineageGraph?.nodes.get(context.brainstormInput.id);
                const isAtLeafLevel = brainstormInputNode?.isLeaf ?? true;

                components.push({
                    id: 'brainstorm-input-editor',
                    component: getComponentById('brainstorm-input-editor'),
                    mode: 'readonly',
                    props: {
                        jsondoc: context.brainstormInput,
                        isEditable: false,
                        minimized: !isAtLeafLevel // Minimized when not at leaf level
                    },
                    priority: 1
                });
            }

            // Only show chosen idea editor (not the collection)
            if (context.chosenIdea) {
                components.push({
                    id: 'single-idea-editor',
                    component: getComponentById('single-idea-editor'),
                    mode: 'readonly',
                    props: {
                        idea: context.chosenIdea,
                        isEditable: false,
                        currentStage: context.currentStage
                    },
                    priority: 2
                });
            }

            if (context.outlineSettings) {
                components.push({
                    id: 'outline-settings-display',
                    component: getComponentById('outline-settings-display'),
                    mode: 'readonly',
                    props: {
                        outlineSettings: context.outlineSettings,
                        isEditable: false
                    },
                    priority: 4
                });
            }

            if (context.canonicalChronicles) {
                components.push({
                    id: 'chronicles-display',
                    component: getComponentById('chronicles-display'),
                    mode: 'readonly',
                    props: {
                        chronicles: context.canonicalChronicles,
                        isEditable: false
                    },
                    priority: 5
                });
            }
            break;
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
        currentStage: context.currentStage,
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
            currentStage: 'initial',
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
            steps: [],
            displayComponents: [],
            actions: [],
            parameters: {
                projectId,
                currentStage: 'initial',
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
    const steps = computeWorkflowStepsFromContext(context);
    const displayComponents = computeDisplayComponentsFromContext(context);
    const parameters = computeWorkflowParametersFromContext(context, projectId);

    return {
        steps,
        displayComponents,
        actions: context.actions,
        parameters
    };
}; 