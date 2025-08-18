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

    // Check if has descendants (used as input in other transforms)
    const hasDescendants = hasJsondocDescendants(jsondoc.id, projectData);

    if (hasDescendants) {
        return {
            state: ComponentState.READ_ONLY,
            reason: 'This content has been used to generate other content and cannot be edited',
            parentTransformId: parentTransform?.id,
            parentTransformStatus: parentTransform?.status,
            metadata: { hasDescendants: true }
        };
    }

    // Apply parent transform rules - THIS IS THE KEY LOGIC
    if (parentTransform && parentTransform.type === 'llm') {
        // Check if parent LLM transform is not complete
        // Note: status can be 'complete' or 'completed' depending on the system
        if (parentTransform.status !== 'complete' && parentTransform.status !== 'completed') {
            return {
                state: ComponentState.PENDING_PARENT_TRANSFORM,
                reason: `Parent LLM transform is ${parentTransform.status}`,
                parentTransformId: parentTransform.id,
                parentTransformStatus: parentTransform.status,
                metadata: {
                    transformType: parentTransform.type,
                    blockingStatus: parentTransform.status
                }
            };
        }

        // LLM-generated, complete, no descendants -> can become editable
        return {
            state: ComponentState.CLICK_TO_EDIT,
            reason: 'Click to create editable version',
            parentTransformId: parentTransform.id,
            parentTransformStatus: parentTransform.status,
            canTransition: [ComponentState.EDITABLE],
            metadata: {
                transformType: parentTransform.type,
                canCreateEditableVersion: true
            }
        };
    }

    // User input with no descendants -> directly editable
    if (jsondoc.origin_type === 'user_input') {
        return {
            state: ComponentState.EDITABLE,
            reason: 'User-created content, directly editable',
            parentTransformId: parentTransform?.id,
            parentTransformStatus: parentTransform?.status,
            metadata: { originType: jsondoc.origin_type }
        };
    }

    // Fallback to read-only (shouldn't happen in normal cases)
    return {
        state: ComponentState.READ_ONLY,
        reason: 'Content is read-only',
        parentTransformId: parentTransform?.id,
        parentTransformStatus: parentTransform?.status,
        metadata: {
            fallback: true,
            originType: jsondoc.origin_type
        }
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