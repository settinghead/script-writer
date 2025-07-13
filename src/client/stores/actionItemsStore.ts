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

// Selection state for any jsonDoc and path
interface SelectedJsonDocAndPath {
    jsonDocId: string;
    originalJsonDocId: string;
    jsonDocPath: string; // JSONPath notation, use '$' for root
    index: number;
    title: string;
}

// Main store state interface
interface ActionItemsState {
    // JsonDoc and path selection (single select)
    selectedJsonDocAndPath: SelectedJsonDocAndPath | null;

    // Form data persistence (auto-saved drafts)
    formData: {
        brainstormParams: BrainstormParams | null;
        outlineGenerationParams: OutlineGenerationParams | null;
    };

    // Actions
    setSelectedJsonDocAndPath: (selection: SelectedJsonDocAndPath | null) => void;
    updateFormData: (key: keyof ActionItemsState['formData'], data: any) => void;
    clearFormData: (key: keyof ActionItemsState['formData']) => void;
    resetStore: () => void;
}

// Create the store
const useActionItemsStoreInternal = create<ActionItemsState>()(
    persist(
        (set, get) => {
            return {
                selectedJsonDocAndPath: null,
                formData: {
                    brainstormParams: null,
                    outlineGenerationParams: null,
                },

                setSelectedJsonDocAndPath: (selection) => {
                    const currentState = get();
                    if (currentState.selectedJsonDocAndPath === selection) {
                        return;
                    }
                    set({ selectedJsonDocAndPath: selection });
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
                    selectedJsonDocAndPath: null,
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
    selectedJsonDocAndPath: SelectedJsonDocAndPath | null;
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
            selectedJsonDocAndPath: null,
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
            if (persistedState.selectedJsonDocAndPath) {
                store.setSelectedJsonDocAndPath(persistedState.selectedJsonDocAndPath);
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
                selectedJsonDocAndPath: store.selectedJsonDocAndPath,
                formData: store.formData,
            };

            setPersistedState(stateToSave);

            // Reset the flag after a brief delay to allow the update to complete
            setTimeout(() => {
                isSyncingToLocalStorageRef.current = false;
            }, 100);
        }
    }, [storageKey, store.selectedJsonDocAndPath, store.formData]); // Remove setPersistedState from deps

    return store;
};

// Export types for use in other components
export type {
    BrainstormParams,
    OutlineGenerationParams,
    SelectedJsonDocAndPath,
    ActionItemsState
}; 