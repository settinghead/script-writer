# Frontend Refactor Plan: TanStack Query & Zustand

This document outlines the implementation plan for refactoring the script-writer frontend to use TanStack Query for server state management and Zustand for global client state management.

## 1. Objective

The goal is to replace the current imperative, `useEffect`-based data fetching and context-based state management with a more robust, declarative, and performant architecture. This will solve two primary issues:

1.  **Inefficient Data Fetching:** Multiple components (e.g., `ProjectLayout`, `ScriptLayout`, `EpisodeContext`) trigger redundant API calls for the same data.
2.  **Lack of Unified State:** Streamed data and fetched data are handled in separate, localized states, making global access and synchronization difficult.

## 2. Core Technologies

-   **[TanStack Query (React Query)](https://tanstack.com/query/latest):** Will be used to manage all **server state**. It handles fetching, caching, synchronizing, and updating data from the backend APIs, removing the need for most data-fetching `useEffect` and `useState` hooks.
-   **[Zustand](https://github.com/pmndrs/zustand):** Will be used as a lightweight, global **client state** manager. It will hold the "single source of truth" for UI state and the assembled results of fetched/streamed data that components will render.

## 3. Implementation Phases

---

### Phase 1: Setup & Store Creation

**1. Install Dependencies:**

```bash
npm install @tanstack/react-query zustand
```

**2. Initialize TanStack Query:**

Wrap the main application component (likely in `src/client/main.tsx` or similar) with the `QueryClientProvider`.

```tsx
// src/client/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false, // Optional: disable aggressive refetching
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

**3. Create the Global Zustand Store:**

Create a new file for the store. This store will hold all project-related data that needs to be accessed globally.

```typescript
// src/client/stores/projectStore.ts
import create from 'zustand';
import type { OutlineSessionData } from '../../server/services/OutlineService';
import type { Stage, EpisodeData } from '../types'; // Assuming types exist

// Define the shape of a single project's data
interface ProjectData {
  id: string;
  outline: OutlineSessionData | null;
  stages: Stage[];
  episodes: Record<string, EpisodeData[]>; // Keyed by stage artifactId
}

// Define the store's state and actions
interface ProjectStoreState {
  projects: Record<string, Partial<ProjectData>>;
  
  // Actions
  setOutline: (projectId: string, outline: OutlineSessionData) => void;
  setStages: (projectId: string, stages: Stage[]) => void;
  setEpisodesForStage: (projectId: string, stageId: string, episodes: EpisodeData[]) => void;
  
  // Action for streaming updates
  updateStreamingOutline: (projectId: string, partialOutline: Partial<OutlineSessionData['components']>) => void;
}

export const useProjectStore = create<ProjectStoreState>((set) => ({
  projects: {},
  
  setOutline: (projectId, outline) => set(state => ({
    projects: {
      ...state.projects,
      [projectId]: { ...state.projects[projectId], outline },
    },
  })),
  
  setStages: (projectId, stages) => set(state => ({
    projects: {
      ...state.projects,
      [projectId]: { ...state.projects[projectId], stages },
    },
  })),
  
  setEpisodesForStage: (projectId, stageId, episodes) => set(state => ({
    projects: {
      ...state.projects,
      [projectId]: {
        ...state.projects[projectId],
        episodes: {
          ...(state.projects[projectId]?.episodes),
          [stageId]: episodes,
        },
      },
    },
  })),

  updateStreamingOutline: (projectId, partialOutline) => set(state => {
    const project = state.projects[projectId] || {};
    const outline = project.outline || { components: {} };
    return {
      projects: {
        ...state.projects,
        [projectId]: {
          ...project,
          outline: {
            ...outline,
            components: {
              ...outline.components,
              ...partialOutline,
            },
          } as OutlineSessionData,
        },
      },
    };
  }),
}));
```

---

### Phase 2: Refactor Data Fetching & Deprecate `EpisodeContext`

The logic within `EpisodeContext` is a perfect use case for TanStack Query. We will replace it entirely.

**1. Create a Custom Hook for Project Data:**

This hook will encapsulate all TanStack Query logic for a given project.

```typescript
// src/client/hooks/useProjectData.ts
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import { useProjectStore } from '../stores/projectStore';
import { useEffect } from 'react';

// Define query keys for caching
export const projectKeys = {
  all: ['projects'] as const,
  detail: (projectId: string) => [...projectKeys.all, projectId] as const,
  outline: (projectId: string) => [...projectKeys.detail(projectId), 'outline'] as const,
  stages: (projectId: string) => [...projectKeys.detail(projectId), 'stages'] as const,
  episodes: (stageId: string) => [...projectKeys.all, 'episodes', stageId] as const,
};

// The main hook
export const useProjectData = (projectId: string) => {
  const setOutline = useProjectStore(state => state.setOutline);
  const setStages = useProjectStore(state => state.setStages);

  // 1. Fetch Outline
  const { data: outlineData, isLoading: isOutlineLoading, error: outlineError } = useQuery({
    queryKey: projectKeys.outline(projectId),
    queryFn: () => apiService.getOutlineSession(projectId),
    enabled: !!projectId,
  });

  // 2. Fetch Stages
  const { data: stagesData, isLoading: areStagesLoading, error: stagesError } = useQuery({
    queryKey: projectKeys.stages(projectId),
    queryFn: () => apiService.getStagesForProject(projectId), // Assumes this new API endpoint exists or is created
    enabled: !!projectId,
  });
  
  // Sync fetched data with Zustand store
  useEffect(() => {
    if (outlineData) setOutline(projectId, outlineData);
  }, [outlineData, projectId, setOutline]);

  useEffect(() => {
    if (stagesData) setStages(projectId, stagesData);
  }, [stagesData, projectId, setStages]);

  // Return query results for UI to handle loading/error states
  return {
    isLoading: isOutlineLoading || areStagesLoading,
    error: outlineError || stagesError,
  };
};

// Hook for fetching episodes for a specific stage (to be used on-demand)
export const useStageEpisodes = (projectId: string, stageId: string, enabled: boolean) => {
    const setEpisodesForStage = useProjectStore(state => state.setEpisodesForStage);

    const { data: episodesData, ...queryInfo } = useQuery({
        queryKey: projectKeys.episodes(stageId),
        queryFn: () => apiService.getEpisodesForStage(stageId), // Assumes API endpoint
        enabled: !!stageId && enabled,
    });

    useEffect(() => {
        if (episodesData) {
            setEpisodesForStage(projectId, stageId, episodesData);
        }
    }, [episodesData, projectId, stageId, setEpisodesForStage]);

    return queryInfo;
};
```

**2. Remove `EpisodeContext`:**

-   Delete `src/client/contexts/EpisodeContext.tsx`.
-   Remove the `EpisodeContextProvider` from the component tree.

---

### Phase 3: Integrating Streaming with Zustand

Modify the existing `useLLMStreaming` hook to pipe its data into the Zustand store instead of managing it locally.

```typescript
// src/client/hooks/useLLMStreaming.ts (Conceptual Change)

// ... imports, including useProjectStore

export const useLLMStreaming = (service, config) => {
  const updateStreamingOutline = useProjectStore(state => state.updateStreamingOutline);
  // ... other existing state for status, error, etc.

  // Inside the streaming logic (e.g., onmessage handler)
  const onNewData = (newPartialObject) => {
    // Instead of setItems(...)
    if (config.projectId) {
      updateStreamingOutline(config.projectId, newPartialObject);
    }
  };
  
  // The hook no longer needs to return `items`.
  // Components will get the items from useProjectStore.
  return { status, isThinking, stop, error }; 
};
```

---

### Phase 4: Refactor `ProjectLayout.tsx` and `ScriptLayout.tsx`

**1. Refactor `ProjectLayout.tsx`:**

-   Remove all `useState` and `useEffect` hooks related to data fetching (`outlineData`, `loading`, `error`).
-   Call the new `useProjectData` hook to trigger data fetching.
-   Select all required data directly from the `useProjectStore`.
-   Pass the `projectId` to the `useLLMStreaming` hook.

```tsx
// src/client/components/ProjectLayout.tsx (Simplified Example)
import { useProjectStore } from '../stores/projectStore';
import { useProjectData } from '../hooks/useProjectData';

export const ProjectLayout: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();

  // 1. Trigger data fetching and handle loading/error states
  const { isLoading, error } = useProjectData(projectId!);

  // 2. Select data from the global store for rendering
  const outline = useProjectStore(state => state.projects[projectId!]?.outline);
  const stages = useProjectStore(state => state.projects[projectId!]?.stages);
  const episodes = useProjectStore(state => state.projects[projectId!]?.episodes);

  // ... instantiate useLLMStreaming hook with projectId

  if (isLoading) return <Spin />;
  if (error) return <Alert message={error.message} type="error" />;
  if (!outline) return <div>Project not found.</div>;

  // 3. Build the UI using data from the store
  const episodeTreeData = useMemo(() => {
    // Build tree using `stages` and `episodes` from the store
  }, [stages, episodes]);
  
  return (
    // ... Layout with components that use outline, episodeTreeData, etc.
  );
};
```

**2. Refactor `ScriptLayout.tsx`:**

`ScriptLayout` appears to be a subset of the view now consolidated into `ProjectLayout`. The refactor should aim to have **one primary layout (`ProjectLayout`)** that handles the display of both the outline and the episode structure. `ScriptLayout` will likely be deprecated or heavily simplified. The logic for its tree view will be merged into `ProjectLayout`'s episode tree, which is now sourced from the global store.

**3. Refactor Episode Tree Expansion:**

The on-demand loading of episodes when a stage node is expanded can now be handled cleanly.

```tsx
// Inside ProjectLayout.tsx
const [expandedStageIds, setExpandedStageIds] = useState<string[]>([]);

// ... in the episode tree component
const onExpand = (keys) => {
  setExpandedStageIds(keys);
};

// ... In a child component that renders a stage, or back in the main layout
expandedStageIds.forEach(stageId => {
  // This hook will fetch data only when `enabled` is true
  useStageEpisodes(projectId, stageId, true);
});
```

---

## 4. Benefits of This Refactor

1.  **Single Source of Truth:** All components read from `useProjectStore`, ensuring UI consistency.
2.  **Performance:** TanStack Query's cache eliminates redundant API calls, making navigation faster.
3.  **Separation of Concerns:** Components become declarative renderers of state, while hooks and the store manage the complex logic of fetching and state updates.
4.  **Simplified Logic:** Complex `useEffect` chains are replaced by declarative `useQuery` hooks.
5.  **Scalability:** This pattern is highly scalable. Adding new data types or views becomes a matter of adding a new query and a new slice to the store, without complex prop-drilling or context nesting.
6.  **Improved Developer Experience:** State is predictable and easy to trace. The React Query Devtools can be added for easy debugging of server state. 