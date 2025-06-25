import { useProjectData } from '../contexts/ProjectDataContext';

export type EntityType = 'artifacts' | 'transforms' | 'humanTransforms';
export type MutationStatus = 'idle' | 'pending' | 'success' | 'error';

export interface MutationState {
    status: MutationStatus;
    error?: string;
    timestamp?: number;
}

/**
 * Hook to easily access mutation state for a specific entity
 */
export function useMutationState(entityType: EntityType, entityId: string): MutationState {
    const projectData = useProjectData();
    return projectData.mutationStates[entityType].get(entityId) || { status: 'idle' };
}

/**
 * Hook to check if an entity is currently being mutated (pending state)
 */
export function useIsPending(entityType: EntityType, entityId: string): boolean {
    const state = useMutationState(entityType, entityId);
    return state.status === 'pending';
}

/**
 * Hook to check if an entity mutation recently succeeded
 */
export function useIsSuccess(entityType: EntityType, entityId: string): boolean {
    const state = useMutationState(entityType, entityId);
    return state.status === 'success';
}

/**
 * Hook to check if an entity mutation failed
 */
export function useIsError(entityType: EntityType, entityId: string): boolean {
    const state = useMutationState(entityType, entityId);
    return state.status === 'error';
} 