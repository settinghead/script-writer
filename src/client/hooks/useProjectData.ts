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

  // Note: Outline and stage data now comes from project artifacts via Electric SQL
  // Legacy queries removed as they're replaced by the artifact-based system

  // Sync fetched data with Zustand store
  useEffect(() => {
    if (projectData && projectId) {
      setProject(projectId, projectData);
    }
  }, [projectData, projectId, setProject]);

  // Legacy outline and stage data sync removed - now handled by Electric SQL

  // Update loading state in store
  useEffect(() => {
    if (projectId) {
      setLoading(projectId, isProjectLoading);
    }
  }, [isProjectLoading, projectId, setLoading]);

  // Update error state in store
  useEffect(() => {
    if (projectId) {
      setError(projectId, projectError ? projectError.message : null);
    }
  }, [projectError, projectId, setError]);

  // Return query results for UI to handle loading/error states
  return {
    isLoading: isProjectLoading,
    error: projectError,
  };
};

