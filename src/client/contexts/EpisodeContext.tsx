import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { EpisodeSynopsisV1 } from '../../common/types';
import { EpisodeStreamingService, EpisodeSynopsis } from '../services/implementations/EpisodeStreamingService';
import { useLLMStreaming } from '../hooks/useLLMStreaming';

// Types
interface StageData {
    artifactId: string;
    stageNumber: number;
    stageSynopsis: string;
    numberOfEpisodes: number;
    outlineSessionId: string;
}

interface EpisodeGenerationSessionData {
    session: { id: string };
    status: 'active' | 'completed' | 'failed';
    episodes: EpisodeSynopsisV1[];
    currentTransformId?: string;
}

interface StageEpisodeState {
    episodes: EpisodeSynopsisV1[];
    loading: boolean;
    isStreaming: boolean;
    sessionData?: EpisodeGenerationSessionData;
}

interface EpisodeState {
    // Script and selection
    scriptId: string | null;
    selectedStageId: string | null;
    selectedEpisodeId: string | null;

    // Data
    stages: StageData[];
    stageEpisodeData: Record<string, StageEpisodeState>;

    // UI State
    expandedKeys: string[];
    loading: boolean;
    error: string | null;

    // Streaming State
    activeStreamingStageId: string | null;
    streamingTransformId: string | null;
}

// Actions
type EpisodeAction =
    | { type: 'SET_SCRIPT_ID'; payload: string }
    | { type: 'SET_SELECTED_STAGE'; payload: string | null }
    | { type: 'SET_SELECTED_EPISODE'; payload: string | null }
    | { type: 'SET_STAGES'; payload: StageData[] }
    | { type: 'SET_STAGE_EPISODES'; payload: { stageId: string; data: StageEpisodeState } }
    | { type: 'SET_EXPANDED_KEYS'; payload: string[] }
    | { type: 'ADD_EXPANDED_KEY'; payload: string }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'START_STREAMING'; payload: { stageId: string; transformId: string } }
    | { type: 'STOP_STREAMING' }
    | { type: 'UPDATE_STREAMING_EPISODES'; payload: { stageId: string; episodes: EpisodeSynopsisV1[] } }
    | { type: 'UPDATE_EPISODE_SCRIPT_STATUS'; payload: { stageId: string; episodeNumber: number; hasScript: boolean } };

// Reducer
const episodeReducer = (state: EpisodeState, action: EpisodeAction): EpisodeState => {
    switch (action.type) {
        case 'SET_SCRIPT_ID':
            return { ...state, scriptId: action.payload };

        case 'SET_SELECTED_STAGE':
            return { ...state, selectedStageId: action.payload };

        case 'SET_SELECTED_EPISODE':
            return { ...state, selectedEpisodeId: action.payload };

        case 'SET_STAGES':
            return { ...state, stages: action.payload, loading: false, error: null };

        case 'SET_STAGE_EPISODES':
            return {
                ...state,
                stageEpisodeData: {
                    ...state.stageEpisodeData,
                    [action.payload.stageId]: action.payload.data
                }
            };

        case 'SET_EXPANDED_KEYS':
            return { ...state, expandedKeys: action.payload };

        case 'ADD_EXPANDED_KEY':
            if (state.expandedKeys.includes(action.payload)) {
                return state;
            }
            return { ...state, expandedKeys: [...state.expandedKeys, action.payload] };

        case 'SET_LOADING':
            return { ...state, loading: action.payload };

        case 'SET_ERROR':
            return { ...state, error: action.payload, loading: false };

        case 'START_STREAMING':
            return {
                ...state,
                activeStreamingStageId: action.payload.stageId,
                streamingTransformId: action.payload.transformId
            };

        case 'STOP_STREAMING':
            // Find the currently streaming stage and update its state
            const updatedStageEpisodeData = { ...state.stageEpisodeData };
            if (state.activeStreamingStageId && updatedStageEpisodeData[state.activeStreamingStageId]) {
                updatedStageEpisodeData[state.activeStreamingStageId] = {
                    ...updatedStageEpisodeData[state.activeStreamingStageId],
                    isStreaming: false
                };
            }

            return {
                ...state,
                activeStreamingStageId: null,
                streamingTransformId: null,
                stageEpisodeData: updatedStageEpisodeData
            };

        case 'UPDATE_STREAMING_EPISODES':
            return {
                ...state,
                stageEpisodeData: {
                    ...state.stageEpisodeData,
                    [action.payload.stageId]: {
                        ...state.stageEpisodeData[action.payload.stageId],
                        episodes: action.payload.episodes,
                        isStreaming: true
                    }
                }
            };

        case 'UPDATE_EPISODE_SCRIPT_STATUS':
            const currentStageData = state.stageEpisodeData[action.payload.stageId];
            if (!currentStageData) return state;

            const updatedEpisodes = currentStageData.episodes.map(episode =>
                episode.episodeNumber === action.payload.episodeNumber
                    ? { ...episode, hasScript: action.payload.hasScript }
                    : episode
            );

            return {
                ...state,
                stageEpisodeData: {
                    ...state.stageEpisodeData,
                    [action.payload.stageId]: {
                        ...currentStageData,
                        episodes: updatedEpisodes
                    }
                }
            };

        default:
            return state;
    }
};

// Initial state
const initialState: EpisodeState = {
    scriptId: null,
    selectedStageId: null,
    selectedEpisodeId: null,
    stages: [],
    stageEpisodeData: {},
    expandedKeys: [],
    loading: false,
    error: null,
    activeStreamingStageId: null,
    streamingTransformId: null
};

// Context
interface EpisodeContextType {
    state: EpisodeState;
    actions: {
        setScriptId: (scriptId: string) => void;
        setSelectedStage: (stageId: string | null) => void;
        setSelectedEpisode: (episodeId: string | null) => void;
        loadStages: (scriptId: string) => Promise<void>;
        loadStageEpisodes: (stageId: string) => Promise<void>;
        expandStage: (stageId: string) => void;
        setExpandedKeys: (keys: string[]) => void;
        startEpisodeGeneration: (stageId: string, numberOfEpisodes: number, customRequirements?: string, cascadedParams?: any) => Promise<void>;
        stopEpisodeGeneration: (stageId: string) => Promise<void>;
        updateEpisodeScriptStatus: (stageId: string, episodeNumber: number, hasScript: boolean) => void;
    };
}

const EpisodeContext = createContext<EpisodeContextType | null>(null);

// API Service
export class EpisodeApiService {
    static async getStageArtifacts(outlineSessionId: string): Promise<StageData[]> {
        const response = await fetch(`/api/episodes/outlines/${outlineSessionId}/stages`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error('Failed to fetch stage artifacts');
        }
        return await response.json();
    }

    static async getStageDetails(stageId: string): Promise<StageData | null> {
        const response = await fetch(`/api/episodes/stages/${stageId}`, {
            credentials: 'include'
        });
        if (!response.ok) {
            return null;
        }
        return await response.json();
    }

    static async getStageEpisodes(stageId: string): Promise<EpisodeGenerationSessionData | null> {
        const response = await fetch(`/api/episodes/stages/${stageId}/latest-generation`, {
            credentials: 'include'
        });
        if (!response.ok) {
            return null;
        }
        return await response.json();
    }

    static async startEpisodeGeneration(
        stageId: string,
        numberOfEpisodes: number,
        customRequirements?: string,
        cascadedParams?: any
    ): Promise<{ sessionId: string; transformId: string }> {
        const response = await fetch(`/api/episodes/stages/${stageId}/episodes/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
                numberOfEpisodes, 
                customRequirements,
                cascadedParams 
            })
        });

        if (!response.ok) {
            throw new Error('Failed to start episode generation');
        }

        return await response.json();
    }

    static async stopEpisodeGeneration(sessionId: string): Promise<void> {
        const response = await fetch(`/api/episodes/episode-generation/${sessionId}/stop`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to stop episode generation');
        }
    }

    static async getCascadedParams(outlineSessionId: string): Promise<any> {
        try {
            // Get brainstorm params for platform, genre, requirements
            const brainstormResponse = await fetch(`/api/artifacts?type=brainstorm_params&sessionId=${outlineSessionId}`, {
                credentials: 'include'
            });

            // Get outline job params for totalEpisodes and episodeDuration
            const outlineJobResponse = await fetch(`/api/artifacts?type=outline_job_params&sessionId=${outlineSessionId}`, {
                credentials: 'include'
            });

            const cascadedParams: any = {};

            // Extract from brainstorm params
            if (brainstormResponse.ok) {
                const brainstormArtifacts = await brainstormResponse.json();
                if (brainstormArtifacts.length > 0) {
                    const latestBrainstorm = brainstormArtifacts[0];
                    cascadedParams.platform = latestBrainstorm.data.platform;
                    cascadedParams.genre_paths = latestBrainstorm.data.genre_paths;
                    cascadedParams.requirements = latestBrainstorm.data.requirements;
                }
            }

            // Extract from outline job params
            if (outlineJobResponse.ok) {
                const outlineJobArtifacts = await outlineJobResponse.json();
                if (outlineJobArtifacts.length > 0) {
                    const latestOutlineJob = outlineJobArtifacts[0];
                    cascadedParams.totalEpisodes = latestOutlineJob.data.totalEpisodes;
                    cascadedParams.episodeDuration = latestOutlineJob.data.episodeDuration;
                }
            }

            // Return null if no meaningful data was found
            if (Object.keys(cascadedParams).length === 0) {
                return null;
            }

            return cascadedParams;
        } catch (error) {
            console.warn('Failed to load cascaded parameters:', error);
            return null;
        }
    }

    static async checkScriptExists(episodeId: string, stageId: string): Promise<boolean> {
        try {
            const response = await fetch(`/api/scripts/${episodeId}/${stageId}/exists`, {
                credentials: 'include'
            });
            
            if (response.status === 200) {
                // Parse the JSON response to get the actual exists status
                const data = await response.json();
                return data.exists === true;
            } else if (response.status === 404) {
                return false;
            } else if (response.status === 401) {
                console.warn(`Authentication required for script check: episode ${episodeId}, stage ${stageId}`);
                return false;
            } else {
                console.warn(`Unexpected status ${response.status} when checking script exists: episode ${episodeId}, stage ${stageId}`);
                return false;
            }
        } catch (error) {
            console.warn(`Failed to check script exists for episode ${episodeId}, stage ${stageId}:`, error);
            return false;
        }
    }
}

// Provider Component
export const EpisodeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(episodeReducer, initialState);

    // Streaming service and hook
    const streamingService = React.useMemo(() => new EpisodeStreamingService(), []);
    const {
        status: streamingStatus,
        items: streamingEpisodes,
        stop: stopStreaming
    } = useLLMStreaming(streamingService, {
        transformId: state.streamingTransformId || undefined
    });

    // Handle streaming updates
    useEffect(() => {
        if (state.activeStreamingStageId && streamingEpisodes.length > 0) {
            const convertedEpisodes: EpisodeSynopsisV1[] = streamingEpisodes.map(ep => ({
                episodeNumber: ep.episodeNumber,
                title: ep.title,
                briefSummary: ep.synopsis || ep.briefSummary || '',
                keyEvents: ep.keyEvents,
                hooks: ep.endHook || ep.hooks || '',
                stageArtifactId: state.activeStreamingStageId!,
                episodeGenerationSessionId: '',
                emotionDevelopments: ep.emotionDevelopments || [],
                relationshipDevelopments: ep.relationshipDevelopments || []
            }));

            dispatch({
                type: 'UPDATE_STREAMING_EPISODES',
                payload: {
                    stageId: state.activeStreamingStageId,
                    episodes: convertedEpisodes
                }
            });

            // Auto-expand streaming stage
            dispatch({ type: 'ADD_EXPANDED_KEY', payload: state.activeStreamingStageId });
        }
    }, [state.activeStreamingStageId, streamingEpisodes.length]); // Only depend on stage ID and episode count

    // Handle streaming completion
    useEffect(() => {
        if (streamingStatus === 'completed' || streamingStatus === 'error') {
            console.log('[EpisodeContext] Streaming ended:', streamingStatus);
            dispatch({ type: 'STOP_STREAMING' });
        }
    }, [streamingStatus]);

    // Actions
    const actions = {
        setScriptId: (scriptId: string) => {
            dispatch({ type: 'SET_SCRIPT_ID', payload: scriptId });
        },

        setSelectedStage: (stageId: string | null) => {
            dispatch({ type: 'SET_SELECTED_STAGE', payload: stageId });
        },

        setSelectedEpisode: (episodeId: string | null) => {
            dispatch({ type: 'SET_SELECTED_EPISODE', payload: episodeId });
        },

        loadStages: async (scriptId: string) => {
            try {
                dispatch({ type: 'SET_LOADING', payload: true });
                const stages = await EpisodeApiService.getStageArtifacts(scriptId);
                dispatch({ type: 'SET_STAGES', payload: stages });

                // Load existing episodes for all stages and check script status
                const episodePromises = stages.map(async (stage) => {
                    const sessionData = await EpisodeApiService.getStageEpisodes(stage.artifactId);
                    
                    // Check script status for each episode
                    const episodesWithScriptStatus = sessionData?.episodes ? await Promise.all(
                        sessionData.episodes.map(async (episode) => {
                            const hasScript = await EpisodeApiService.checkScriptExists(
                                episode.episodeNumber.toString(), 
                                stage.artifactId
                            );
                            return {
                                ...episode,
                                hasScript
                            };
                        })
                    ) : [];
                    
                    return {
                        stageId: stage.artifactId,
                        data: {
                            episodes: episodesWithScriptStatus,
                            loading: false,
                            isStreaming: sessionData?.status === 'active',
                            sessionData: sessionData || undefined
                        }
                    };
                });

                const results = await Promise.all(episodePromises);

                // Check for active generation sessions that need to be resumed
                let activeSession: { stageId: string; transformId: string } | null = null;

                results.forEach(result => {
                    dispatch({ type: 'SET_STAGE_EPISODES', payload: result });

                    // Check if this stage has an active generation session
                    if (result.data.sessionData?.status === 'active' &&
                        result.data.sessionData.currentTransformId &&
                        !activeSession) {
                        activeSession = {
                            stageId: result.stageId,
                            transformId: result.data.sessionData.currentTransformId
                        };
                    }
                });

                // Auto-expand stages with episodes
                const stagesToExpand = results
                    .filter(result => result.data.episodes.length > 0)
                    .map(result => result.stageId);

                if (stagesToExpand.length > 0) {
                    dispatch({ type: 'SET_EXPANDED_KEYS', payload: stagesToExpand });
                }

                // Resume active streaming session if found
                if (activeSession) {
                    console.log('[EpisodeContext] Resuming active generation session:', activeSession);
                    dispatch({
                        type: 'START_STREAMING',
                        payload: activeSession
                    });
                }

            } catch (error) {
                console.error('Error loading stages:', error);
                dispatch({ type: 'SET_ERROR', payload: 'Failed to load stages' });
            }
        },

        loadStageEpisodes: async (stageId: string) => {
            try {
                dispatch({
                    type: 'SET_STAGE_EPISODES',
                    payload: {
                        stageId,
                        data: { episodes: [], loading: true, isStreaming: false }
                    }
                });

                const sessionData = await EpisodeApiService.getStageEpisodes(stageId);
                dispatch({
                    type: 'SET_STAGE_EPISODES',
                    payload: {
                        stageId,
                        data: {
                            episodes: sessionData?.episodes || [],
                            loading: false,
                            isStreaming: false,
                            sessionData: sessionData || undefined
                        }
                    }
                });
            } catch (error) {
                console.error('Error loading stage episodes:', error);
                dispatch({
                    type: 'SET_STAGE_EPISODES',
                    payload: {
                        stageId,
                        data: { episodes: [], loading: false, isStreaming: false }
                    }
                });
            }
        },

        expandStage: (stageId: string) => {
            dispatch({ type: 'ADD_EXPANDED_KEY', payload: stageId });
        },

        setExpandedKeys: (keys: string[]) => {
            dispatch({ type: 'SET_EXPANDED_KEYS', payload: keys });
        },

        startEpisodeGeneration: async (stageId: string, numberOfEpisodes: number, customRequirements?: string, cascadedParams?: any) => {
            try {
                const result = await EpisodeApiService.startEpisodeGeneration(stageId, numberOfEpisodes, customRequirements, cascadedParams);

                // Update state to show streaming
                dispatch({
                    type: 'SET_STAGE_EPISODES',
                    payload: {
                        stageId,
                        data: { episodes: [], loading: false, isStreaming: true }
                    }
                });

                // Start streaming
                dispatch({
                    type: 'START_STREAMING',
                    payload: { stageId, transformId: result.transformId }
                });

            } catch (error) {
                console.error('Error starting episode generation:', error);
                throw error;
            }
        },

        stopEpisodeGeneration: async (stageId: string) => {
            try {
                const stageData = state.stageEpisodeData[stageId];
                if (stageData?.sessionData?.session.id) {
                    await EpisodeApiService.stopEpisodeGeneration(stageData.sessionData.session.id);
                }
                await stopStreaming();
                dispatch({ type: 'STOP_STREAMING' });
            } catch (error) {
                console.error('Error stopping episode generation:', error);
                throw error;
            }
        },

        updateEpisodeScriptStatus: (stageId: string, episodeNumber: number, hasScript: boolean) => {
            dispatch({
                type: 'UPDATE_EPISODE_SCRIPT_STATUS',
                payload: { stageId, episodeNumber, hasScript }
            });
        }
    };

    return (
        <EpisodeContext.Provider value={{ state, actions }}>
            {children}
        </EpisodeContext.Provider>
    );
};

// Hook to use the context
export const useEpisodeContext = () => {
    const context = useContext(EpisodeContext);
    if (!context) {
        throw new Error('useEpisodeContext must be used within an EpisodeProvider');
    }
    return context;
}; 