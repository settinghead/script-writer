import { create } from 'zustand';
import type { EpisodeSynopsisV1 } from '../../common/types';

// Legacy outline session data type (simplified for backward compatibility)
interface OutlineSessionData {
  components: any;
}

// Types based on existing EpisodeContext
export interface Stage {
  artifactId: string;
  stageNumber: number;
  stageSynopsis: string;
  numberOfEpisodes: number;
  outlineSessionId: string;
}

export interface EpisodeData extends EpisodeSynopsisV1 {
  hasScript?: boolean;
}

export interface StageEpisodeState {
  episodes: EpisodeData[];
  loading: boolean;
  isStreaming: boolean;
  sessionData?: {
    session: { id: string };
    status: 'active' | 'completed' | 'failed';
    episodes: EpisodeSynopsisV1[];
    currentTransformId?: string;
  };
}

// Define the shape of a single project's data
interface ProjectData {
  id: string;
  name?: string;
  description?: string;
  outline: OutlineSessionData | null;
  stages: Stage[];
  episodes: Record<string, StageEpisodeState>; // Keyed by stage artifactId
  expandedKeys: string[];
  selectedStageId: string | null;
  selectedEpisodeId: string | null;
  loading: boolean;
  error: string | null;

  // Streaming state
  activeStreamingStageId: string | null;
  streamingTransformId: string | null;
  streamingError: string | null;
  brainstormIdeas?: any[];
  streamingStatus?: 'idle' | 'connecting' | 'streaming' | 'completed' | 'error';
}

// Define the store's state and actions
interface ProjectStoreState {
  projects: Record<string, Partial<ProjectData>>;

  // Actions for outline data
  setOutline: (projectId: string, outline: OutlineSessionData) => void;
  updateStreamingOutline: (projectId: string, partialOutline: Partial<OutlineSessionData['components']>) => void;

  // Actions for stages data
  setStages: (projectId: string, stages: Stage[]) => void;
  setStageEpisodes: (projectId: string, stageId: string, episodeState: StageEpisodeState) => void;
  updateStreamingEpisodes: (projectId: string, stageId: string, episodes: EpisodeData[]) => void;

  // Actions for UI state
  setExpandedKeys: (projectId: string, keys: string[]) => void;
  setSelectedStage: (projectId: string, stageId: string | null) => void;
  setSelectedEpisode: (projectId: string, episodeId: string | null) => void;
  setLoading: (projectId: string, loading: boolean) => void;
  setError: (projectId: string, error: string | null) => void;

  // Actions for streaming state
  startStreaming: (projectId: string, stageId: string, transformId: string) => void;
  stopStreaming: (projectId: string) => void;

  // Action to update episode script status
  updateEpisodeScriptStatus: (projectId: string, stageId: string, episodeNumber: number, hasScript: boolean) => void;

  // Helper action to ensure project exists
  ensureProject: (projectId: string) => void;

  // New action to set project data
  setProject: (projectId: string, projectData: ProjectData) => void;

  // New action to set brainstorm ideas
  setBrainstormIdeas: (projectId: string, ideas: any[]) => void;

  // New action to set streaming error
  setStreamingError: (projectId: string, error: string | null) => void;

  // New action to set streaming status
  setStreamingStatus: (projectId: string, status: 'idle' | 'connecting' | 'streaming' | 'completed' | 'error') => void;
}

// Helper function to create empty project data
const createEmptyProject = (id: string): ProjectData => ({
  id,
  name: undefined,
  description: undefined,
  outline: null,
  stages: [],
  episodes: {},
  expandedKeys: [],
  selectedStageId: null,
  selectedEpisodeId: null,
  loading: false,
  error: null,
  activeStreamingStageId: null,
  streamingTransformId: null,
  streamingError: null,
  brainstormIdeas: undefined,
  streamingStatus: 'idle',
});

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  projects: {},

  ensureProject: (projectId: string) => set(state => {
    if (!state.projects[projectId]) {
      return {
        projects: {
          ...state.projects,
          [projectId]: createEmptyProject(projectId),
        },
      };
    }
    return state;
  }),

  setOutline: (projectId, outline) => set(state => {
    const project = state.projects[projectId] || createEmptyProject(projectId);
    return {
      projects: {
        ...state.projects,
        [projectId]: { ...project, outline },
      },
    };
  }),

  updateStreamingOutline: (projectId, partialOutline) => set(state => {
    const project = state.projects[projectId] || createEmptyProject(projectId);
    const outline = project.outline || { components: {} } as OutlineSessionData;

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

  setStages: (projectId, stages) => set(state => {
    const project = state.projects[projectId] || createEmptyProject(projectId);
    return {
      projects: {
        ...state.projects,
        [projectId]: { ...project, stages },
      },
    };
  }),

  setStageEpisodes: (projectId, stageId, episodeState) => set(state => {
    const project = state.projects[projectId] || createEmptyProject(projectId);

    return {
      projects: {
        ...state.projects,
        [projectId]: {
          ...project,
          episodes: {
            ...project.episodes,
            [stageId]: episodeState,
          },
        },
      },
    };
  }),

  updateStreamingEpisodes: (projectId, stageId, episodes) => set(state => {
    const project = state.projects[projectId] || createEmptyProject(projectId);
    const currentEpisodeState = project.episodes?.[stageId] || {
      episodes: [],
      loading: false,
      isStreaming: false,
    };

    return {
      projects: {
        ...state.projects,
        [projectId]: {
          ...project,
          episodes: {
            ...project.episodes,
            [stageId]: {
              ...currentEpisodeState,
              episodes,
              isStreaming: true,
            },
          },
        },
      },
    };
  }),

  setExpandedKeys: (projectId, keys) => set(state => {
    const project = state.projects[projectId] || createEmptyProject(projectId);
    return {
      projects: {
        ...state.projects,
        [projectId]: { ...project, expandedKeys: keys },
      },
    };
  }),

  setSelectedStage: (projectId, stageId) => set(state => {
    const project = state.projects[projectId] || createEmptyProject(projectId);
    return {
      projects: {
        ...state.projects,
        [projectId]: { ...project, selectedStageId: stageId },
      },
    };
  }),

  setSelectedEpisode: (projectId, episodeId) => set(state => {
    const project = state.projects[projectId] || createEmptyProject(projectId);
    return {
      projects: {
        ...state.projects,
        [projectId]: { ...project, selectedEpisodeId: episodeId },
      },
    };
  }),

  setLoading: (projectId, loading) => set(state => {
    const project = state.projects[projectId] || createEmptyProject(projectId);
    return {
      projects: {
        ...state.projects,
        [projectId]: { ...project, loading },
      },
    };
  }),

  setError: (projectId, error) => set(state => {
    const project = state.projects[projectId] || createEmptyProject(projectId);
    return {
      projects: {
        ...state.projects,
        [projectId]: { ...project, error, loading: false },
      },
    };
  }),

  startStreaming: (projectId, stageId, transformId) => set(state => {
    const project = state.projects[projectId] || createEmptyProject(projectId);
    return {
      projects: {
        ...state.projects,
        [projectId]: {
          ...project,
          activeStreamingStageId: stageId,
          streamingTransformId: transformId,
        },
      },
    };
  }),

  stopStreaming: (projectId) => set(state => {
    const project = state.projects[projectId] || createEmptyProject(projectId);

    // Update the streaming stage's state
    const updatedEpisodes = { ...project.episodes };
    if (project.activeStreamingStageId && updatedEpisodes[project.activeStreamingStageId]) {
      updatedEpisodes[project.activeStreamingStageId] = {
        ...updatedEpisodes[project.activeStreamingStageId],
        isStreaming: false,
      };
    }

    return {
      projects: {
        ...state.projects,
        [projectId]: {
          ...project,
          activeStreamingStageId: null,
          streamingTransformId: null,
          episodes: updatedEpisodes,
        },
      },
    };
  }),

  updateEpisodeScriptStatus: (projectId, stageId, episodeNumber, hasScript) => set(state => {
    const project = state.projects[projectId] || createEmptyProject(projectId);
    const currentStageData = project.episodes?.[stageId];

    if (!currentStageData) return state;

    const updatedEpisodes = currentStageData.episodes.map(episode =>
      episode.episodeNumber === episodeNumber
        ? { ...episode, hasScript }
        : episode
    );

    return {
      projects: {
        ...state.projects,
        [projectId]: {
          ...project,
          episodes: {
            ...project.episodes,
            [stageId]: {
              ...currentStageData,
              episodes: updatedEpisodes,
            },
          },
        },
      },
    };
  }),

  setProject: (projectId, projectData) =>
    set(state => {
      const project = state.projects[projectId] || createEmptyProject(projectId);
      return {
        projects: {
          ...state.projects,
          [projectId]: {
            ...project,
            ...projectData,
            loading: false,
          }
        }
      }
    }),

  setBrainstormIdeas: (projectId, ideas) =>
    set(state => {
      console.log('[Store] Setting brainstorm ideas for project', projectId, ':', ideas);
      const project = state.projects[projectId];
      if (project) {
        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...project,
              brainstormIdeas: ideas
            }
          }
        }
      }
      console.log('[Store] Project not found for brainstorm ideas:', projectId);
      return state;
    }),

  setStreamingError: (projectId, error) =>
    set(state => {
      const project = state.projects[projectId];
      if (project) {
        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...project,
              streamingError: error
            }
          }
        }
      }
      return state;
    }),

  setStreamingStatus: (projectId, status) =>
    set(state => {
      const project = state.projects[projectId];
      if (project) {
        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...project,
              streamingStatus: status
            }
          }
        }
      }
      return state;
    }),
})); 