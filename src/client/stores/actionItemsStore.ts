import { create } from 'zustand';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useEffect, useRef } from 'react';
import { persist } from 'zustand/middleware';

// Type definitions for form data
interface BrainstormParams {
    platform: string;
    genre: string;
    genrePaths: string[][];
    other_requirements: string;
    numberOfIdeas: number;
}

interface OutlineGenerationParams {
    totalEpisodes: number;
    episodeDuration: number;
    platform: string;
    selectedGenrePaths: string[][];
    requirements?: string;
}

// Selection state for brainstorm ideas
interface SelectedBrainstormIdea {
    artifactId: string;
    originalArtifactId: string;
    artifactPath: string;
    index: number;
}

// Main store state interface
interface ActionItemsState {
    // Brainstorm idea selection (single select)
    selectedBrainstormIdea: SelectedBrainstormIdea | null;

    // Form data persistence (auto-saved drafts)
    formData: {
        brainstormParams: BrainstormParams | null;
        outlineGenerationParams: OutlineGenerationParams | null;
    };

    // Actions
    setSelectedBrainstormIdea: (idea: SelectedBrainstormIdea | null) => void;
    updateFormData: (key: keyof ActionItemsState['formData'], data: any) => void;
    clearFormData: (key: keyof ActionItemsState['formData']) => void;
    resetStore: () => void;
}

// Create the store
const useActionItemsStoreInternal = create<ActionItemsState>()(
    persist(
        (set, get) => {
            return {
                selectedBrainstormIdea: null,
                formData: {
                    brainstormParams: null,
                    outlineGenerationParams: null,
                },

                setSelectedBrainstormIdea: (idea) => {
                    const currentState = get();
                    if (currentState.selectedBrainstormIdea === idea) {
                        return;
                    }
                    set({ selectedBrainstormIdea: idea });
                },

                updateFormData: (key, data) => set((state) => ({
                    formData: {
                        ...state.formData,
                        [key]: data,
                    },
                })),

                clearFormData: (key) => set((state) => ({
                    formData: {
                        ...state.formData,
                        [key]: null,
                    },
                })),

                resetStore: () => set({
                    selectedBrainstormIdea: null,
                    formData: {
                        brainstormParams: null,
                        outlineGenerationParams: null,
                    },
                }),
            };
        },
        {
            name: 'action-items-store',
        }
    )
);

// Type for persisted state
interface PersistedState {
    selectedBrainstormIdea: SelectedBrainstormIdea | null;
    formData: {
        brainstormParams: BrainstormParams | null;
        outlineGenerationParams: OutlineGenerationParams | null;
    };
}

// Hook that integrates with localStorage for persistence
export const useActionItemsStore = (projectId?: string) => {
    const store = useActionItemsStoreInternal();

    // Use refs to prevent circular dependencies
    const isInitializedRef = useRef(false);
    const isSyncingToLocalStorageRef = useRef(false);

    // Use localStorage for persistence if projectId is provided
    const storageKey = projectId ? `action-items-state-${projectId}` : null;
    const [persistedState, setPersistedState] = useLocalStorage<PersistedState>(
        storageKey || 'action-items-state-default',
        {
            selectedBrainstormIdea: null,
            formData: {
                brainstormParams: null,
                outlineGenerationParams: null,
            },
        }
    );

    // Initialize store from localStorage only once
    useEffect(() => {
        if (storageKey && persistedState && !isInitializedRef.current) {
            isInitializedRef.current = true;

            // Load persisted state into store
            if (persistedState.selectedBrainstormIdea) {
                store.setSelectedBrainstormIdea(persistedState.selectedBrainstormIdea);
            }
            if (persistedState.formData) {
                Object.entries(persistedState.formData).forEach(([key, value]) => {
                    if (value) {
                        store.updateFormData(key as keyof ActionItemsState['formData'], value);
                    }
                });
            }
        }
    }, [storageKey]); // Only depend on storageKey, not persistedState or store

    // Sync store changes to localStorage (but prevent circular updates)
    useEffect(() => {
        if (storageKey && isInitializedRef.current && !isSyncingToLocalStorageRef.current) {
            isSyncingToLocalStorageRef.current = true;

            const stateToSave = {
                selectedBrainstormIdea: store.selectedBrainstormIdea,
                formData: store.formData,
            };

            setPersistedState(stateToSave);

            // Reset the flag after a brief delay to allow the update to complete
            setTimeout(() => {
                isSyncingToLocalStorageRef.current = false;
            }, 100);
        }
    }, [storageKey, store.selectedBrainstormIdea, store.formData]); // Remove setPersistedState from deps

    return store;
};

// Export types for use in other components
export type {
    BrainstormParams,
    OutlineGenerationParams,
    SelectedBrainstormIdea,
    ActionItemsState
}; 