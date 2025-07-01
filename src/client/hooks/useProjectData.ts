import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiService } from '../services/apiService';
import { useProjectStore, type Stage, type EpisodeData, type StageEpisodeState } from '../stores/projectStore';

// Define query keys for caching
export const projectKeys = {
  all: ['projects'] as const,
  detail: (projectId: string) => [...projectKeys.all, projectId] as const,
  outline: (projectId: string) => [...projectKeys.detail(projectId), 'outline'] as const,
  stages: (projectId: string) => [...projectKeys.detail(projectId), 'stages'] as const,
  episodes: (stageId: string) => [...projectKeys.all, 'episodes', stageId] as const,
};

// The main hook for loading project data
export const useProjectData = (projectId: string) => {
  const setProject = useProjectStore(state => state.setProject);
  const setOutline = useProjectStore(state => state.setOutline);
  const setStages = useProjectStore(state => state.setStages);
  const setLoading = useProjectStore(state => state.setLoading);
  const setError = useProjectStore(state => state.setError);

  // 0. Fetch Core Project Data
  const { data: projectData, isLoading: isProjectLoading, error: projectError } = useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => apiService.getProject(projectId),
    enabled: !!projectId,
  });

  // 1. Fetch Outline (disabled for new project-based architecture)
  const { data: outlineData, isLoading: isOutlineLoading, error: outlineError } = useQuery({
    queryKey: projectKeys.outline(projectId),
    queryFn: () => apiService.getOutlineSession(projectId),
    enabled: false, // Disabled - we'll get outline data from project artifacts instead
  });

  // 2. Fetch Stages (disabled for new project-based architecture)
  const { data: stagesData, isLoading: areStagesLoading, error: stagesError } = useQuery({
    queryKey: projectKeys.stages(projectId),
    queryFn: () => apiService.getStageArtifacts(projectId),
    enabled: false, // Disabled - we'll get stage data from project artifacts instead
  });

  // Sync fetched data with Zustand store
  useEffect(() => {
    if (projectData && projectId) {
      setProject(projectId, projectData);
    }
  }, [projectData, projectId, setProject]);

  useEffect(() => {
    if (outlineData && projectId) {
      setOutline(projectId, outlineData);
    }
  }, [outlineData, projectId, setOutline]);

  useEffect(() => {
    if (stagesData && projectId) {
      // Transform API response to match our Stage type
      const transformedStages: Stage[] = stagesData.map((stage: any) => ({
        artifactId: stage.artifactId,
        stageNumber: stage.stageNumber,
        stageSynopsis: stage.stageSynopsis,
        numberOfEpisodes: stage.numberOfEpisodes,
        outlineSessionId: stage.outlineSessionId,
      }));

      setStages(projectId, transformedStages);
    }
  }, [stagesData, projectId, setStages]);

  // Update loading state in store
  useEffect(() => {
    if (projectId) {
      setLoading(projectId, isProjectLoading || isOutlineLoading || areStagesLoading);
    }
  }, [isProjectLoading, isOutlineLoading, areStagesLoading, projectId, setLoading]);

  // Update error state in store
  useEffect(() => {
    if (projectId) {
      const error = projectError || outlineError || stagesError;
      setError(projectId, error ? error.message : null);
    }
  }, [projectError, outlineError, stagesError, projectId, setError]);

  // Return query results for UI to handle loading/error states
  return {
    isLoading: isProjectLoading || isOutlineLoading || areStagesLoading,
    error: projectError || outlineError || stagesError,
  };
};

// Hook for fetching episodes for a specific stage (to be used on-demand)
export const useStageEpisodes = (projectId: string, stageId: string, enabled: boolean = false) => {
  const setStageEpisodes = useProjectStore(state => state.setStageEpisodes);

  const { data: episodesData, isLoading, error, ...queryInfo } = useQuery({
    queryKey: projectKeys.episodes(stageId),
    queryFn: async () => {
      // Use the existing API to get latest episode generation
      const result = await fetch(`/api/episodes/stages/${stageId}/latest-generation`, {
        credentials: 'include'
      });

      if (!result.ok) {
        if (result.status === 404) {
          // No episodes generated yet, return empty state
          return null;
        }
        throw new Error('Failed to fetch episodes');
      }

      return result.json();
    },
    enabled: !!stageId && enabled,
  });

  useEffect(() => {
    if (episodesData !== undefined) {
      let episodeState: StageEpisodeState;

      if (episodesData === null) {
        // No episodes generated yet
        episodeState = {
          episodes: [],
          loading: false,
          isStreaming: false,
        };
      } else {
        // Transform the episodes data
        const episodes: EpisodeData[] = episodesData.episodes.map((episode: any) => ({
          ...episode,
          hasScript: false, // TODO: Check script existence
        }));

        episodeState = {
          episodes,
          loading: false,
          isStreaming: episodesData.status === 'active',
          sessionData: episodesData,
        };
      }

      setStageEpisodes(projectId, stageId, episodeState);
    }
  }, [episodesData, projectId, stageId, setStageEpisodes]);

  return {
    isLoading,
    error,
    ...queryInfo,
  };
};

