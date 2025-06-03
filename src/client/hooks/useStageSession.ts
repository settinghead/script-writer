import { useState, useEffect, useMemo } from 'react';
import { EpisodeGenerationSessionV1, EpisodeSynopsisV1 } from '../../common/types';
import { EpisodeStreamingService, EpisodeSynopsis } from '../services/implementations/EpisodeStreamingService';
import { useLLMStreaming } from './useLLMStreaming';

interface StageData {
    artifactId: string;
    stageNumber: number;
    stageSynopsis: string;
    numberOfEpisodes: number;
    outlineSessionId: string;
}

interface EpisodeGenerationSessionData {
    session: EpisodeGenerationSessionV1;
    status: 'active' | 'completed' | 'failed';
    episodes: EpisodeSynopsisV1[];
    currentTransformId?: string;
}

// API service functions
const apiService = {
    async getStageDetails(stageId: string): Promise<StageData | null> {
        console.log('[useStageSession] Getting stage details for:', stageId);
        try {
            const response = await fetch(`/api/episodes/stages/${stageId}`, {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error('Failed to fetch stage details');
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('[useStageSession] Error getting stage details:', error);
            return null;
        }
    },

    async getLatestEpisodeGeneration(stageId: string): Promise<EpisodeGenerationSessionData | null> {
        console.log('[useStageSession] Checking latest generation for:', stageId);
        try {
            const response = await fetch(`/api/episodes/stages/${stageId}/latest-generation`, {
                credentials: 'include'
            });
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('[useStageSession] Error checking latest generation:', error);
            return null;
        }
    },

    async startEpisodeGeneration(
        stageId: string,
        numberOfEpisodes: number,
        customRequirements?: string
    ): Promise<{ sessionId: string; transformId: string }> {
        console.log('[useStageSession] Starting episode generation for:', stageId);
        const response = await fetch(`/api/episodes/stages/${stageId}/episodes/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                numberOfEpisodes,
                customRequirements
            })
        });

        if (!response.ok) {
            throw new Error('Failed to start episode generation');
        }

        const data = await response.json();
        return data;
    },

    async stopEpisodeGeneration(sessionId: string): Promise<void> {
        console.log('[useStageSession] Stopping episode generation for session:', sessionId);
        const response = await fetch(`/api/episodes/episode-generation/${sessionId}/stop`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to stop episode generation');
        }
    }
};

export const useStageSession = (stageId: string | null) => {
    const [stageData, setStageData] = useState<StageData | null>(null);
    const [sessionData, setSessionData] = useState<EpisodeGenerationSessionData | null>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [currentTransformId, setCurrentTransformId] = useState<string | undefined>(undefined);

    // Create streaming service instance
    const streamingService = useMemo(() => new EpisodeStreamingService(), []);

    // Use the LLM streaming hook with derived transformId
    const {
        status: streamingStatus,
        items: streamingEpisodes,
        isThinking,
        stop: stopStreaming,
        error: streamingError
    } = useLLMStreaming(streamingService, {
        transformId: currentTransformId
    });

    // Derived streaming state
    const isStreaming = streamingStatus === 'streaming';

    // Load stage data and check for active generation when stageId changes
    useEffect(() => {
        if (!stageId || stageId === 'undefined') {
            // Clear state when no valid stageId
            setStageData(null);
            setSessionData(null);
            setGenerating(false);
            setCurrentTransformId(undefined);
            return;
        }

        console.log('[useStageSession] Stage changed to:', stageId);

        // Clear previous state
        setStageData(null);
        setSessionData(null);
        setGenerating(false);
        setCurrentTransformId(undefined);

        // Stop any ongoing streaming
        streamingService.stop();

        // Load new stage data
        loadStageData();
        checkLatestGeneration();
    }, [stageId, streamingService]);

    // Update session data when streaming provides new episode data
    useEffect(() => {
        if (streamingEpisodes.length > 0 && sessionData && sessionData.session.id) {
            console.log('[useStageSession] Updating session data with streaming episodes:', streamingEpisodes.length);

            const convertedEpisodes: EpisodeSynopsisV1[] = streamingEpisodes.map(episode => ({
                episodeNumber: episode.episodeNumber,
                title: episode.title,
                briefSummary: episode.synopsis || episode.briefSummary || '',
                keyEvents: episode.keyEvents,
                hooks: episode.endHook || episode.hooks || '',
                stageArtifactId: stageData?.artifactId || '',
                episodeGenerationSessionId: sessionData.session.id
            }));

            setSessionData(prev => prev ? {
                ...prev,
                episodes: convertedEpisodes,
                status: isStreaming ? 'active' : prev.status
            } : null);
        }
    }, [streamingEpisodes, isStreaming, stageData, sessionData]);

    const loadStageData = async () => {
        if (!stageId) return;

        console.log('[useStageSession] Loading stage data for:', stageId);
        setLoading(true);

        try {
            const data = await apiService.getStageDetails(stageId);
            if (data) {
                setStageData(data);
            }
        } catch (error) {
            console.error('[useStageSession] Error loading stage data:', error);
        } finally {
            setLoading(false);
        }
    };

    const checkLatestGeneration = async () => {
        if (!stageId) return;

        console.log('[useStageSession] Checking latest generation for:', stageId);

        try {
            const latestGeneration = await apiService.getLatestEpisodeGeneration(stageId);
            if (latestGeneration) {
                setSessionData(latestGeneration);
                setGenerating(latestGeneration.status === 'active');

                // If there's an active session with a transform ID, set it for streaming
                if (latestGeneration.status === 'active' && latestGeneration.currentTransformId) {
                    console.log('[useStageSession] Active generation found with transformId:', latestGeneration.currentTransformId);
                    setCurrentTransformId(latestGeneration.currentTransformId);
                } else {
                    setCurrentTransformId(undefined);
                }
            } else {
                setGenerating(false);
                setSessionData(null);
                setCurrentTransformId(undefined);
            }
        } catch (error) {
            console.error('[useStageSession] Error checking latest generation:', error);
            setGenerating(false);
        }
    };

    const startGeneration = async (numberOfEpisodes: number, customRequirements?: string) => {
        if (!stageId) throw new Error('No stage ID available');

        console.log('[useStageSession] Starting generation for stage:', stageId);
        setGenerating(true);
        setSessionData(null);

        try {
            const result = await apiService.startEpisodeGeneration(
                stageId,
                numberOfEpisodes,
                customRequirements
            );

            // Set the transformId for streaming
            setCurrentTransformId(result.transformId);

            return result;
        } catch (error) {
            setGenerating(false);
            throw error;
        }
    };

    const stopGeneration = async () => {
        if (!sessionData) return;

        try {
            await stopStreaming();
            if (sessionData.session.id) {
                await apiService.stopEpisodeGeneration(sessionData.session.id);
            }
            setGenerating(false);
            setCurrentTransformId(undefined);
        } catch (error) {
            throw error;
        }
    };

    // Log current state for debugging
    console.log('[useStageSession] Current state:', {
        stageId,
        generating,
        isStreaming,
        streamingEpisodesCount: streamingEpisodes.length,
        sessionDataEpisodesCount: sessionData?.episodes.length || 0,
        currentTransformId
    });

    return {
        // Data
        stageData,
        sessionData,

        // Streaming - provide episodes directly from streaming service
        streamingEpisodes,
        isStreaming,
        isThinking,
        streamingError,

        // State
        loading,
        generating,

        // Actions
        startGeneration,
        stopGeneration,

        // Computed
        progress: stageData ? Math.min((streamingEpisodes.length / stageData.numberOfEpisodes) * 100, 100) : 0,
        episodeCount: streamingEpisodes.length || (sessionData?.episodes.length || 0)
    };
}; 