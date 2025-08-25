import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';

// Global registry for local component generation states
// This is outside the component to persist across re-renders
const localGenerationStates = new Map<string, boolean>();
const stateChangeCallbacks = new Set<() => void>();

// Helper to trigger all registered callbacks when state changes
const notifyStateChange = () => {
    stateChangeCallbacks.forEach(callback => callback());
};

/**
 * Centralized hook for managing generation states across the application
 * 
 * This hook combines:
 * 1. Project-level hasActiveTransforms (from transforms with running/pending status)
 * 2. Local component generation states (when user clicks but transform hasn't started yet)
 * 3. Individual jsondoc mutation states (from mutation state map)
 * 
 * Usage:
 * ```tsx
 * const { 
 *   isAnyGenerating, 
 *   isLocalGenerating, 
 *   setLocalGenerating,
 *   getDisabledReason 
 * } = useGenerationState('my-component-id');
 * 
 * // When user clicks generate button:
 * const handleGenerate = async () => {
 *   setLocalGenerating(true);
 *   try {
 *     await generateSomething();
 *   } finally {
 *     setLocalGenerating(false);
 *   }
 * };
 * ```
 */
export interface GenerationStateHook {
    /** True if ANY generation is happening (project-wide or local) */
    isAnyGenerating: boolean;

    /** True if this specific component is generating locally */
    isLocalGenerating: boolean;

    /** Set the local generation state for this component */
    setLocalGenerating: (generating: boolean) => void;

    /** Get human-readable reason why buttons are disabled (if any) */
    getDisabledReason: () => string | null;

    /** Array of active transform types that are running */
    activeTransformTypes: string[];

    /** True if project has active transforms (running/pending) */
    hasActiveTransforms: boolean;
}

export const useGenerationState = (componentId?: string): GenerationStateHook => {
    const projectData = useProjectData();
    const componentIdRef = useRef(componentId || `component-${Math.random()}`);
    const [localGenerationSnapshot, setLocalGenerationSnapshot] = useState(() =>
        Array.from(localGenerationStates.values()).some(state => state)
    );
    const [componentLocalState, setComponentLocalState] = useState(() =>
        localGenerationStates.get(componentIdRef.current) || false
    );

    // Force component to re-render when global state changes
    const forceUpdate = useCallback(() => {
        const newSnapshot = Array.from(localGenerationStates.values()).some(state => state);
        const newComponentState = localGenerationStates.get(componentIdRef.current) || false;
        setLocalGenerationSnapshot(newSnapshot);
        setComponentLocalState(newComponentState);
    }, []);

    // Register this component for state change notifications
    useEffect(() => {
        stateChangeCallbacks.add(forceUpdate);

        return () => {
            stateChangeCallbacks.delete(forceUpdate);
        };
    }, [forceUpdate]);

    // Get project-level active transforms and streaming jsondocs
    const { hasActiveTransforms, activeTransforms, activeTransformTypes, hasStreamingJsondocs } = useMemo<{
        hasActiveTransforms: boolean;
        activeTransforms: any[];
        activeTransformTypes: string[];
        hasStreamingJsondocs: boolean;
    }>(() => {
        if (projectData.canonicalContext === "pending" || projectData.canonicalContext === "error") {
            return {
                hasActiveTransforms: false,
                activeTransforms: [],
                activeTransformTypes: [],
                hasStreamingJsondocs: false
            };
        }

        const context = projectData.canonicalContext;
        const transformTypes: string[] = context.activeTransforms.map(t =>
            String((t as any).transform_name || (t as any).transform_type || 'unknown')
        );

        // Fallback/augment: also consider jsondocs that are currently streaming
        const hasStreaming = Array.isArray(projectData.jsondocs)
            ? projectData.jsondocs.some(j => j.streaming_status === 'streaming')
            : false;

        return {
            hasActiveTransforms: context.hasActiveTransforms,
            activeTransforms: context.activeTransforms,
            activeTransformTypes: transformTypes,
            hasStreamingJsondocs: hasStreaming
        };
    }, [projectData.canonicalContext]);

    // Get local generation state for this component (from state, not direct map access)
    const isLocalGenerating = componentLocalState;

    // Use the snapshot for hasAnyLocalGeneration
    const hasAnyLocalGeneration = localGenerationSnapshot;

    // Combined generation state (augment with streaming jsondocs)
    const isAnyGenerating = hasActiveTransforms || hasAnyLocalGeneration || hasStreamingJsondocs;

    // Function to set local generation state
    const setLocalGenerating = useCallback((generating: boolean) => {
        const currentState = localGenerationStates.get(componentIdRef.current);
        if (currentState !== generating) {
            if (generating) {
                localGenerationStates.set(componentIdRef.current, true);
            } else {
                localGenerationStates.delete(componentIdRef.current);
            }
            notifyStateChange();
        }
    }, []);

    // Get human-readable disabled reason
    const getDisabledReason = useCallback((): string | null => {
        if (hasActiveTransforms && activeTransformTypes.length > 0) {
            const transformNames = activeTransformTypes.join('、');
            return `${transformNames} 生成中，生成完成后可编辑`;
        }

        // If any jsondoc is streaming but we didn't detect transform types
        if (hasStreamingJsondocs) {
            return '生成中，生成完成后可编辑';
        }

        if (localGenerationSnapshot) {
            return '生成中，请稍等...';
        }

        return null;
    }, [hasActiveTransforms, activeTransformTypes, localGenerationSnapshot, hasStreamingJsondocs]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            localGenerationStates.delete(componentIdRef.current);
            notifyStateChange();
        };
    }, []);

    return {
        isAnyGenerating,
        isLocalGenerating,
        setLocalGenerating,
        getDisabledReason,
        activeTransformTypes,
        hasActiveTransforms
    };
};

/**
 * Hook variant that only checks for generation state without creating local state
 * Useful for components that only need to check if they should be disabled
 */
export const useIsGenerating = (): boolean => {
    const { isAnyGenerating } = useGenerationState();
    return isAnyGenerating;
};

/**
 * Hook to get disabled reason without managing local state
 */
export const useDisabledReason = (): string | null => {
    const { getDisabledReason } = useGenerationState();
    return getDisabledReason();
};
