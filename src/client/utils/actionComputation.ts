import { ProjectDataContextType } from '../../common/types';
import { SelectedBrainstormIdea } from '../stores/actionItemsStore';
import {
    computeActionsFromLineage,
    type ActionItem,
    type WorkflowStage
} from './lineageBasedActionComputation';
import { convertEffectiveIdeasToIdeaWithTitle } from '../../common/transform-artifact-framework/lineageResolution';
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

// Helper function to check if an artifact is a leaf node (no descendants)
export const isLeafNode = (artifactId: string, transformInputs: any[]): boolean => {
    if (!Array.isArray(transformInputs)) return true;
    return !transformInputs.some(input => input.artifact_id === artifactId);
};

// Helper function to check if an artifact can become editable
export const canBecomeEditable = (artifact: any, transformInputs: any[]): boolean => {
    return isLeafNode(artifact.id, transformInputs) && artifact.origin_type === 'ai_generated';
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

    // Resolved artifacts from lineage graph
    canonicalBrainstormArtifacts: any[];
    brainstormInput: any;
    brainstormIdeas: any[];
    chosenIdea: any;
    outlineSettings: any;
    canonicalChronicles: any;

    // Lineage and transform data
    lineageGraph: any;
    transformInputs: any[];
    artifacts: any[];

    // Actions from lineage computation
    actions: ActionItem[];
}

/**
 * Core unified computation function that builds the context once
 * This function performs all lineage graph analysis and artifact filtering in a single pass
 */
function computeUnifiedContext(
    projectData: ProjectDataContextType,
    _projectId: string
): UnifiedComputationContext | null {
    console.log('[computeUnifiedContext] Starting computation with projectData:', {
        artifacts: projectData.artifacts === "pending" ? "pending" :
            projectData.artifacts === "error" ? "error" :
                Array.isArray(projectData.artifacts) ? `${projectData.artifacts.length} artifacts` : "unknown",
        transforms: projectData.transforms === "pending" ? "pending" :
            projectData.transforms === "error" ? "error" :
                Array.isArray(projectData.transforms) ? `${projectData.transforms.length} transforms` : "unknown",
        lineageGraph: projectData.lineageGraph === "pending" ? "pending" :
            projectData.lineageGraph === "error" ? "error" :
                projectData.lineageGraph ? "available" : "null"
    });

    // Check if any data is still loading
    if (projectData.artifacts === "pending" ||
        projectData.transforms === "pending" ||
        projectData.humanTransforms === "pending" ||
        projectData.transformInputs === "pending" ||
        projectData.transformOutputs === "pending") {
        console.log('[computeUnifiedContext] Data still loading, returning null');
        return null;
    }

    // Handle lineage graph pending state
    if (projectData.lineageGraph === "pending") {
        console.log('[computeUnifiedContext] Lineage graph pending, using fallback logic');

        // Simple fallback: check if we have any artifacts
        if (projectData.artifacts === "error" || !Array.isArray(projectData.artifacts) || projectData.artifacts.length === 0) {
            console.log('[computeUnifiedContext] No artifacts available, returning initial stage');
            return {
                currentStage: 'initial',
                hasActiveTransforms: false,
                stageDescription: '准备开始...',
                isManualPath: false,
                canonicalBrainstormArtifacts: [],
                brainstormInput: null,
                brainstormIdeas: [],
                chosenIdea: null,
                outlineSettings: null,
                canonicalChronicles: null,
                lineageGraph: null,
                transformInputs: [],
                artifacts: [],
                actions: []
            };
        }

        console.log('[computeUnifiedContext] Available artifacts:', projectData.artifacts.map(a => ({
            id: a.id,
            type: a.type || a.schema_type,
            origin_type: a.origin_type
        })));

        // Basic stage detection without lineage
        const brainstormIdeas = projectData.artifacts.filter(a =>
            a.schema_type === 'brainstorm_item_schema' || a.type === 'brainstorm_item_schema'
        );

        const brainstormCollections = projectData.artifacts.filter(a =>
            a.schema_type === 'brainstorm_collection_schema' || a.type === 'brainstorm_collection_schema'
        );

        console.log('[computeUnifiedContext] Filtered artifacts:', {
            brainstormIdeas: brainstormIdeas.length,
            brainstormCollections: brainstormCollections.length
        });

        if (brainstormIdeas.length > 0) {
            // Check if we have user_input brainstorm ideas (indicating human transform/chosen idea)
            const userInputIdeas = brainstormIdeas.filter(a => a.origin_type === 'user_input');

            console.log('[computeUnifiedContext] Brainstorm ideas analysis:', {
                totalIdeas: brainstormIdeas.length,
                userInputIdeas: userInputIdeas.length,
                allIdeas: brainstormIdeas.map(a => ({ id: a.id, origin_type: a.origin_type }))
            });

            if (userInputIdeas.length > 0) {
                // We have chosen/edited ideas -> idea_editing stage
                console.log('[computeUnifiedContext] Detected idea_editing stage (user input ideas found)');
                return {
                    currentStage: 'idea_editing',
                    hasActiveTransforms: false,
                    stageDescription: '编辑创意中...',
                    isManualPath: true,
                    canonicalBrainstormArtifacts: brainstormIdeas,
                    brainstormInput: null,
                    brainstormIdeas,
                    chosenIdea: userInputIdeas[0] || null,
                    outlineSettings: null,
                    canonicalChronicles: null,
                    lineageGraph: null,
                    transformInputs: [],
                    artifacts: projectData.artifacts,
                    actions: []
                };
            } else {
                // Only AI-generated ideas -> brainstorm_selection stage
                console.log('[computeUnifiedContext] Detected brainstorm_selection stage (only AI ideas found)');
                return {
                    currentStage: 'brainstorm_selection',
                    hasActiveTransforms: false,
                    stageDescription: '选择创意中...',
                    isManualPath: false,
                    canonicalBrainstormArtifacts: brainstormIdeas,
                    brainstormInput: null,
                    brainstormIdeas,
                    chosenIdea: null,
                    outlineSettings: null,
                    canonicalChronicles: null,
                    lineageGraph: null,
                    transformInputs: [],
                    artifacts: projectData.artifacts,
                    actions: []
                };
            }
        } else if (brainstormCollections.length > 0) {
            // We have brainstorm collections but no individual ideas -> brainstorm_selection stage
            console.log('[computeUnifiedContext] Detected brainstorm_selection stage (collections found)');
            return {
                currentStage: 'brainstorm_selection',
                hasActiveTransforms: false,
                stageDescription: '选择创意中...',
                isManualPath: false,
                canonicalBrainstormArtifacts: brainstormCollections,
                brainstormInput: null,
                brainstormIdeas: brainstormCollections,
                chosenIdea: null,
                outlineSettings: null,
                canonicalChronicles: null,
                lineageGraph: null,
                transformInputs: [],
                artifacts: projectData.artifacts,
                actions: []
            };
        }

        console.log('[computeUnifiedContext] No brainstorm artifacts found, returning initial stage');
        return {
            currentStage: 'initial',
            hasActiveTransforms: false,
            stageDescription: '准备开始...',
            isManualPath: false,
            canonicalBrainstormArtifacts: [],
            brainstormInput: null,
            brainstormIdeas: [],
            chosenIdea: null,
            outlineSettings: null,
            canonicalChronicles: null,
            lineageGraph: null,
            transformInputs: [],
            artifacts: [],
            actions: []
        };
    }

    // Handle error states
    if (projectData.lineageGraph === "error" ||
        projectData.artifacts === "error" ||
        projectData.transforms === "error" ||
        projectData.humanTransforms === "error" ||
        projectData.transformInputs === "error" ||
        projectData.transformOutputs === "error") {
        console.log('[computeUnifiedContext] Error state detected, returning initial stage');
        return {
            currentStage: 'initial',
            hasActiveTransforms: false,
            stageDescription: '加载失败',
            isManualPath: false,
            canonicalBrainstormArtifacts: [],
            brainstormInput: null,
            brainstormIdeas: [],
            chosenIdea: null,
            outlineSettings: null,
            canonicalChronicles: null,
            lineageGraph: null,
            transformInputs: [],
            artifacts: [],
            actions: []
        };
    }

    console.log('[computeUnifiedContext] Using lineage-based computation');

    // Use the lineage-based computation for actions and stage detection
    const lineageResult = computeActionsFromLineage(
        projectData.lineageGraph,
        projectData.artifacts,
        projectData.transforms,
        projectData.humanTransforms,
        projectData.transformInputs,
        projectData.transformOutputs
    );

    console.log('[computeUnifiedContext] Lineage computation result:', {
        currentStage: lineageResult.actionContext.currentStage,
        hasActiveTransforms: lineageResult.actionContext.hasActiveTransforms,
        actionsCount: lineageResult.actions.length,
        stageDescription: lineageResult.stageDescription
    });

    // Extract all needed data from lineage graph and artifacts in a single pass
    const lineageGraph = projectData.lineageGraph;
    const artifacts = projectData.artifacts as any[];
    const transformInputs = Array.isArray(projectData.transformInputs)
        ? projectData.transformInputs
        : [];

    // Single pass through lineage graph to collect all artifact types
    const canonicalBrainstormArtifacts: any[] = [];
    const canonicalOutlineArtifacts: any[] = [];
    const canonicalChroniclesArtifacts: any[] = [];

    // Process all lineage nodes in one pass
    for (const node of lineageGraph.nodes.values()) {
        if (node.type !== 'artifact') continue;

        const lineageArtifactNode = node as any;
        const artifact = artifacts.find((a: any) => a.id === lineageArtifactNode.artifactId);

        if (!artifact) continue;

        // Categorize artifacts by type
        if (artifact.schema_type === 'brainstorm_tool_input_schema' ||
            artifact.type === 'brainstorm_tool_input_schema' ||
            artifact.schema_type === 'brainstorm_item_schema' ||
            artifact.type === 'brainstorm_item_schema' ||
            artifact.schema_type === 'brainstorm_idea_schema' ||
            artifact.type === 'brainstorm_idea' ||
            artifact.schema_type === 'brainstorm_collection_schema' ||
            artifact.type === 'brainstorm_collection_schema') {
            canonicalBrainstormArtifacts.push(artifact);
        } else if (artifact.schema_type === 'outline_settings_schema' ||
            artifact.type === 'outline_settings' ||
            artifact.type === 'outline_settings_schema') {
            canonicalOutlineArtifacts.push(artifact);
        } else if (artifact.schema_type === 'chronicles_schema' ||
            artifact.type === 'chronicles_schema') {
            canonicalChroniclesArtifacts.push(artifact);
        }
    }

    // Extract specific artifact types from brainstorm artifacts
    const brainstormInput = canonicalBrainstormArtifacts.find((a: any) =>
        a.schema_type === 'brainstorm_tool_input_schema' || a.type === 'brainstorm_tool_input_schema'
    );

    // FIXED: Use effective brainstorm ideas from lineage computation instead of filtering artifacts
    // This properly extracts individual ideas from collections
    const brainstormIdeas = lineageResult.actionContext.effectiveBrainstormIdeas;

    // Find chosen idea using lineage computation result
    let chosenIdea = lineageResult.actionContext.chosenBrainstormIdea;

    // Process outline settings with priority logic
    let outlineSettings = null;
    if (canonicalOutlineArtifacts.length > 0) {
        // Find leaf nodes from canonical set
        const leafOutlineSettings = canonicalOutlineArtifacts.filter((artifact: any) => {
            const lineageNode = lineageGraph.nodes.get(artifact.id);
            return lineageNode && lineageNode.isLeaf;
        });

        if (leafOutlineSettings.length > 0) {
            // Prioritize user_input artifacts, then by most recent
            leafOutlineSettings.sort((a: any, b: any) => {
                // First priority: user_input origin type
                if (a.origin_type === 'user_input' && b.origin_type !== 'user_input') return -1;
                if (b.origin_type === 'user_input' && a.origin_type !== 'user_input') return 1;
                // Second priority: most recent
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
            outlineSettings = leafOutlineSettings[0];
        } else {
            // Fallback to most recent from canonical set if no leaf nodes found
            canonicalOutlineArtifacts.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            outlineSettings = canonicalOutlineArtifacts[0];
        }
    }

    // Find canonical chronicles (should be only one)
    const canonicalChronicles = canonicalChroniclesArtifacts[0] || null;

    // Detect workflow path
    const isManualPath = !brainstormInput;

    return {
        currentStage: lineageResult.actionContext.currentStage,
        hasActiveTransforms: lineageResult.actionContext.hasActiveTransforms,
        stageDescription: lineageResult.stageDescription,
        isManualPath,
        canonicalBrainstormArtifacts,
        brainstormInput,
        brainstormIdeas,
        chosenIdea,
        outlineSettings,
        canonicalChronicles,
        lineageGraph,
        transformInputs,
        artifacts,
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
    console.log('[computeDisplayComponentsFromContext] Computing components for stage:', context.currentStage, {
        brainstormIdeas: context.brainstormIdeas.length,
        chosenIdea: context.chosenIdea ? context.chosenIdea.id : null,
        brainstormInput: context.brainstormInput ? context.brainstormInput.id : null,
        hasActiveTransforms: context.hasActiveTransforms
    });

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
                        artifact: context.brainstormInput,
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
                        artifact: context.brainstormInput,
                        isEditable: false,
                        minimized: !isAtLeafLevel // Minimized when not at leaf level
                    },
                    priority: 1
                });
            }

            // Show brainstorm ideas for selection
            if (context.brainstormIdeas.length > 0) {
                components.push({
                    id: 'project-brainstorm-page',
                    component: getComponentById('project-brainstorm-page'),
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
                        artifact: context.brainstormInput,
                        isEditable: false,
                        minimized: !isAtLeafLevel // Minimized when not at leaf level
                    },
                    priority: 1
                });
            }

            // Show brainstorm ideas in readonly mode for reference
            if (context.brainstormIdeas.length > 0) {
                components.push({
                    id: 'project-brainstorm-page',
                    component: getComponentById('project-brainstorm-page'),
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
                    id: 'single-brainstorm-idea-editor',
                    component: getComponentById('single-brainstorm-idea-editor'),
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
                console.warn('[computeDisplayComponents] idea_editing stage but no chosenIdea found - should be brainstorm_selection');
                if (context.brainstormIdeas.length > 0) {
                    components.push({
                        id: 'single-brainstorm-idea-editor',
                        component: getComponentById('single-brainstorm-idea-editor'),
                        mode: context.hasActiveTransforms ? 'readonly' : 'editable',
                        props: {
                            brainstormIdea: context.brainstormIdeas[0], // Fixed: use brainstormIdea instead of idea
                            isEditable: !context.hasActiveTransforms,
                            currentStage: context.currentStage
                        },
                        priority: 3
                    });
                }
            }
            break;

        case 'outline_generation':
            // Show previous components in readonly/collapsed mode
            if (context.brainstormInput) {
                // Check if brainstorm input is at leaf level in lineage graph
                const brainstormInputNode = context.lineageGraph?.nodes.get(context.brainstormInput.id);
                const isAtLeafLevel = brainstormInputNode?.isLeaf ?? true;

                components.push({
                    id: 'brainstorm-input-editor',
                    component: getComponentById('brainstorm-input-editor'),
                    mode: 'readonly',
                    props: {
                        artifact: context.brainstormInput,
                        isEditable: false,
                        minimized: !isAtLeafLevel // Minimized when not at leaf level
                    },
                    priority: 1
                });
            }

            // Only show chosen idea editor (not the collection)
            if (context.chosenIdea) {
                components.push({
                    id: 'single-brainstorm-idea-editor',
                    component: getComponentById('single-brainstorm-idea-editor'),
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
                // Determine if the outline settings artifact is actually editable
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
            // Show previous components in readonly/collapsed mode
            if (context.brainstormInput) {
                // Check if brainstorm input is at leaf level in lineage graph
                const brainstormInputNode = context.lineageGraph?.nodes.get(context.brainstormInput.id);
                const isAtLeafLevel = brainstormInputNode?.isLeaf ?? true;

                components.push({
                    id: 'brainstorm-input-editor',
                    component: getComponentById('brainstorm-input-editor'),
                    mode: 'readonly',
                    props: {
                        artifact: context.brainstormInput,
                        isEditable: false,
                        minimized: !isAtLeafLevel // Minimized when not at leaf level
                    },
                    priority: 1
                });
            }

            // Only show chosen idea editor (not the collection)
            if (context.chosenIdea) {
                components.push({
                    id: 'single-brainstorm-idea-editor',
                    component: getComponentById('single-brainstorm-idea-editor'),
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
            // Show all previous components in readonly/collapsed mode
            if (context.brainstormInput) {
                // Check if brainstorm input is at leaf level in lineage graph
                const brainstormInputNode = context.lineageGraph?.nodes.get(context.brainstormInput.id);
                const isAtLeafLevel = brainstormInputNode?.isLeaf ?? true;

                components.push({
                    id: 'brainstorm-input-editor',
                    component: getComponentById('brainstorm-input-editor'),
                    mode: 'readonly',
                    props: {
                        artifact: context.brainstormInput,
                        isEditable: false,
                        minimized: !isAtLeafLevel // Minimized when not at leaf level
                    },
                    priority: 1
                });
            }

            // Only show chosen idea editor (not the collection)
            if (context.chosenIdea) {
                components.push({
                    id: 'single-brainstorm-idea-editor',
                    component: getComponentById('single-brainstorm-idea-editor'),
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

    console.log('[computeDisplayComponentsFromContext] Final components:', sortedComponents.map(c => ({
        id: c.id,
        mode: c.mode,
        priority: c.priority,
        propsKeys: Object.keys(c.props || {})
    })));

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
        effectiveBrainstormIdeas: context.canonicalBrainstormArtifacts,
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
 * Lineage-based action computation (main method)
 * Uses lineage graph traversal for robust state detection
 * @deprecated Use computeUnifiedWorkflowState instead
 */
export const computeParamsAndActionsFromLineage = (
    projectData: ProjectDataContextType
): ComputedActions => {
    const context = computeUnifiedContext(projectData, 'legacy');

    if (!context) {
        return {
            actions: [],
            currentStage: 'initial',
            hasActiveTransforms: false,
            stageDescription: '加载中...'
        };
    }

    return {
        actions: context.actions,
        currentStage: context.currentStage,
        hasActiveTransforms: context.hasActiveTransforms,
        stageDescription: context.stageDescription
    };
};

/**
 * Compute workflow steps based on current state
 * @deprecated Use computeUnifiedWorkflowState instead
 */
export const computeWorkflowSteps = (
    currentStage: WorkflowStage,
    hasActiveTransforms: boolean,
    projectData: ProjectDataContextType
): WorkflowStep[] => {
    // For backward compatibility, create a minimal context that matches the old behavior
    const context: UnifiedComputationContext = {
        currentStage,
        hasActiveTransforms,
        stageDescription: '',
        isManualPath: detectIsManualPath(projectData),
        canonicalBrainstormArtifacts: [],
        brainstormInput: null,
        brainstormIdeas: [],
        chosenIdea: null,
        outlineSettings: null,
        canonicalChronicles: null,
        lineageGraph: null,
        transformInputs: [],
        artifacts: [],
        actions: []
    };

    return computeWorkflowStepsFromContext(context);
};

/**
 * Detect if this is a manual path (user directly entered an idea) vs AI path (brainstorm generation)
 */
const detectIsManualPath = (projectData: ProjectDataContextType): boolean => {
    if (projectData.artifacts === "pending" || projectData.artifacts === "error") {
        return false;
    }

    // Simple heuristic: if we have brainstorm_tool_input_schema artifacts, it's AI path
    // Otherwise, it's manual path
    const hasBrainstormInput = projectData.artifacts.some(a =>
        a.schema_type === 'brainstorm_tool_input_schema' || a.type === 'brainstorm_tool_input_schema'
    );

    return !hasBrainstormInput;
};

/**
 * Compute display components based on current state
 * @deprecated Use computeUnifiedWorkflowState instead
 */
export const computeDisplayComponents = (
    currentStage: WorkflowStage,
    hasActiveTransforms: boolean,
    projectData: ProjectDataContextType
): DisplayComponent[] => {
    // For backward compatibility, call the unified context but handle edge cases
    const context = computeUnifiedContext(projectData, 'legacy');

    if (!context) {
        // Handle the case where lineage graph is missing but we should still show project creation
        // Only show project creation form if we have valid artifacts (not pending/error)
        if (currentStage === 'initial' &&
            projectData.artifacts !== "pending" &&
            projectData.artifacts !== "error") {
            return [{
                id: 'project-creation-form',
                component: getComponentById('project-creation-form'),
                mode: 'editable',
                props: {},
                priority: 1
            }];
        }
        return [];
    }

    // Override the context with the passed parameters for backward compatibility
    const compatContext: UnifiedComputationContext = {
        ...context,
        currentStage,
        hasActiveTransforms
    };

    return computeDisplayComponentsFromContext(compatContext);
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
    _selectedBrainstormIdea?: SelectedBrainstormIdea | null
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