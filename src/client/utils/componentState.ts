// Component State System for Universal Editability Control

import { match } from 'ts-pattern';
import type {
    ProjectDataContextType
} from '../../common/types';
import type {
    ElectricJsondoc,
    ElectricTransform
} from '@/common/transform-jsondoc-types';

/**
 * Component State Enum - Rich language for describing component states
 */
export enum ComponentState {
    // Editable states
    EDITABLE = 'editable',                    // User input, no descendants, can edit directly
    CLICK_TO_EDIT = 'clickToEdit',           // AI generated, complete parent transform, can become editable

    // Read-only states  
    READ_ONLY = 'readOnly',                  // Has descendants, cannot be edited
    PENDING_PARENT_TRANSFORM = 'pendingParentTransform', // Parent LLM transform is running/pending

    // Loading/Error states
    LOADING = 'loading',                     // Data is loading
    ERROR = 'error'                          // Error state
}

/**
 * Component State Information - Complete context about why a component is in a particular state
 */
export interface ComponentStateInfo {
    state: ComponentState;
    reason: string;                          // Human-readable explanation
    parentTransformId?: string;              // ID of parent transform (if relevant)
    parentTransformStatus?: string;          // Status of parent transform
    canTransition?: ComponentState[];        // Possible state transitions
    metadata?: Record<string, any>;          // Additional state-specific data
}

/**
 * Helper function to get parent transform of a jsondoc from lineage graph
 */
function getParentTransform(
    jsondoc: ElectricJsondoc,
    projectData: ProjectDataContextType
): ElectricTransform | null {
    // Check if lineage graph is available
    if (projectData.lineageGraph === "pending" || projectData.lineageGraph === "error") {
        return null;
    }

    const node = projectData.lineageGraph.nodes.get(jsondoc.id);
    if (!node || node.type !== 'jsondoc') return null;

    const sourceTransform = node.sourceTransform;
    if (sourceTransform === 'none') return null;

    // Find the actual transform object
    if (Array.isArray(projectData.transforms)) {
        return projectData.transforms.find(t => t.id === sourceTransform.transformId) || null;
    }

    return null;
}

/**
 * Helper function to check if a jsondoc has descendants (is used as input in other transforms)
 */
function hasJsondocDescendants(
    jsondocId: string,
    projectData: ProjectDataContextType
): boolean {
    if (!Array.isArray(projectData.transformInputs)) return false;

    return projectData.transformInputs.some(input => input.jsondoc_id === jsondocId);
}

/**
 * Core function to compute component state based on jsondoc and project context
 * This implements the universal editability rules
 */
export function computeComponentState(
    jsondoc: ElectricJsondoc | null,
    projectData: ProjectDataContextType
): ComponentStateInfo {
    // Handle null jsondoc
    if (!jsondoc) {
        return {
            state: ComponentState.ERROR,
            reason: 'Jsondoc not found'
        };
    }

    // Check loading/error states first
    if (projectData.isLoading) {
        return {
            state: ComponentState.LOADING,
            reason: 'Project data is loading'
        };
    }

    if (projectData.isError) {
        return {
            state: ComponentState.ERROR,
            reason: 'Failed to load project data',
            metadata: { error: projectData.error }
        };
    }

    // Get parent transform info from lineage
    const parentTransform = getParentTransform(jsondoc, projectData);

    // NEW: Brainstorm collection special case when an idea has been chosen
    const isBrainstormCollection = jsondoc.schema_type === 'brainstorm_collection';
    const hasChosenIdea = checkHasChosenIdea(projectData);
    if (jsondoc.origin_type === 'ai_generated' && isBrainstormCollection && hasChosenIdea) {
        return {
            state: ComponentState.READ_ONLY,
            reason: '已选择创意，集合不可再编辑',
            parentTransformId: parentTransform?.id,
            parentTransformStatus: parentTransform?.status,
            metadata: {
                specialCase: 'brainstorm_collection_with_chosen_idea',
                hasChosenIdea: true
            }
        };
    }

    // NEW: Parent transform completion gating for AI-generated content
    const isParentTransformComplete = !parentTransform || parentTransform.status === 'complete' || parentTransform.status === 'completed';

    // NEW: AI-generated content is always click-to-edit when parent is complete, regardless of descendants
    if (jsondoc.origin_type === 'ai_generated') {
        if (!isParentTransformComplete) {
            return {
                state: ComponentState.PENDING_PARENT_TRANSFORM,
                reason: `Parent LLM transform is ${parentTransform?.status}`,
                parentTransformId: parentTransform?.id,
                parentTransformStatus: parentTransform?.status,
                metadata: {
                    transformType: parentTransform?.type,
                    blockingStatus: parentTransform?.status
                }
            };
        }

        return {
            state: ComponentState.CLICK_TO_EDIT,
            reason: '点击创建可编辑版本',
            parentTransformId: parentTransform?.id,
            parentTransformStatus: parentTransform?.status,
            canTransition: [ComponentState.EDITABLE],
            metadata: {
                transformType: parentTransform?.type,
                canCreateEditableVersion: true,
                hasExistingEditableVersion: checkExistingEditableVersion(jsondoc, projectData)
            }
        };
    }

    // NEW: User input editability depends on descendants
    if (jsondoc.origin_type === 'user_input') {
        const hasDescendants = hasJsondocDescendants(jsondoc.id, projectData);
        if (hasDescendants) {
            // Treat as immutable; allow click-to-edit to create a derived copy
            return {
                state: ComponentState.CLICK_TO_EDIT,
                reason: '该内容已有下游引用，点击创建可编辑副本',
                parentTransformId: parentTransform?.id,
                parentTransformStatus: parentTransform?.status,
                canTransition: [ComponentState.EDITABLE],
                metadata: {
                    originType: jsondoc.origin_type,
                    hasDescendants: true,
                    canCreateEditableVersion: true
                }
            };
        }
        return {
            state: ComponentState.EDITABLE,
            reason: '用户创建的内容，可直接编辑',
            parentTransformId: parentTransform?.id,
            parentTransformStatus: parentTransform?.status,
            metadata: {
                originType: jsondoc.origin_type,
                parentAIJsondocId: getParentAIJsondocId(jsondoc, projectData)
            }
        };
    }

    // Fallback to read-only (unknown cases)
    return {
        state: ComponentState.READ_ONLY,
        reason: 'Unknown jsondoc state',
        metadata: { originType: jsondoc.origin_type }
    };
}

/**
 * Helper function to check if a component state allows direct editing
 */
export function isDirectlyEditable(state: ComponentState): boolean {
    return state === ComponentState.EDITABLE;
}

/**
 * Helper function to check if a component state allows click-to-edit
 */
export function canClickToEdit(state: ComponentState): boolean {
    return state === ComponentState.CLICK_TO_EDIT;
}

/**
 * Helper function to check if a component state is interactive (can be clicked)
 */
export function isInteractive(state: ComponentState): boolean {
    return state === ComponentState.EDITABLE || state === ComponentState.CLICK_TO_EDIT;
}

/**
 * Helper function to get user-friendly state description
 */
export function getStateDescription(stateInfo: ComponentStateInfo): string {
    return match(stateInfo.state)
        .with(ComponentState.EDITABLE, () => '可编辑')
        .with(ComponentState.CLICK_TO_EDIT, () => '点击编辑')
        .with(ComponentState.READ_ONLY, () => '只读')
        .with(ComponentState.PENDING_PARENT_TRANSFORM, () => '等待生成完成')
        .with(ComponentState.LOADING, () => '加载中')
        .with(ComponentState.ERROR, () => '错误')
        .exhaustive();
}

/**
 * Helper function to get appropriate UI cursor for state
 */
export function getStateCursor(state: ComponentState): string {
    return match(state)
        .with(ComponentState.EDITABLE, () => 'pointer')
        .with(ComponentState.CLICK_TO_EDIT, () => 'pointer')
        .with(ComponentState.PENDING_PARENT_TRANSFORM, () => 'wait')
        .with(ComponentState.LOADING, () => 'wait')
        .with(ComponentState.READ_ONLY, () => 'default')
        .with(ComponentState.ERROR, () => 'default')
        .exhaustive();
}

// =============================
// Helper functions (new)
// =============================

function checkHasChosenIdea(projectData: ProjectDataContextType): boolean {
    if (
        projectData.canonicalContext === "pending" ||
        projectData.canonicalContext === "error" ||
        !projectData.canonicalContext
    ) {
        return false;
    }

    const canonicalIdea = projectData.canonicalContext.canonicalBrainstormIdea;
    return canonicalIdea !== null && canonicalIdea.origin_type === 'user_input';
}

function checkExistingEditableVersion(
    jsondoc: ElectricJsondoc,
    projectData: ProjectDataContextType
): boolean {
    if (!Array.isArray(projectData.transformInputs) || !Array.isArray(projectData.humanTransforms) || !Array.isArray(projectData.transformOutputs) || !Array.isArray(projectData.jsondocs)) {
        return false;
    }

    // Find human transforms that used this jsondoc as input
    const relatedTransformIds = projectData.transformInputs
        .filter(input => input.jsondoc_id === jsondoc.id)
        .map(input => input.transform_id);

    const humanTransformIds = new Set(
        projectData.humanTransforms
            .filter(t => relatedTransformIds.includes(t.transform_id))
            .map(t => t.transform_id)
    );

    // Check if any output of those human transforms is a user_input jsondoc
    for (const to of projectData.transformOutputs) {
        if (humanTransformIds.has(to.transform_id)) {
            const outputJsondoc = projectData.jsondocs.find(j => j.id === to.jsondoc_id);
            if (outputJsondoc && outputJsondoc.origin_type === 'user_input') {
                return true;
            }
        }
    }
    return false;
}

function getParentAIJsondocId(
    jsondoc: ElectricJsondoc,
    projectData: ProjectDataContextType
): string | null {
    // Only meaningful for user_input jsondocs created via human transform
    const parentTransform = getParentTransform(jsondoc, projectData);
    if (!parentTransform || parentTransform.type !== 'human') {
        return null;
    }

    if (!Array.isArray(projectData.transformInputs)) return null;
    const inputs = projectData.transformInputs.filter(input => input.transform_id === parentTransform.id);
    if (inputs && inputs.length > 0) {
        return inputs[0].jsondoc_id;
    }
    return null;
}