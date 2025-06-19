import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { ReasoningEvent } from '../../common/streaming/types';

// Unified streaming state interface
export interface StreamingState {
  transformId: string;
  status: 'running' | 'completed' | 'failed';
  chunks: string[];
  results: any[];
  progress: number;
}

// Unified data interfaces
export interface IdeationData {
  id: string;
  status: 'streaming' | 'completed' | 'failed';
  userInput: string;
  selectedPlatform: string;
  genrePaths: string[][];
  genreProportions: number[];
  ideas: Array<{
    title: string;
    body: string;
    artifactId?: string;
  }>;
  requirements: string;
  streamingData?: {
    transformId: string;
    chunks: string[];
    progress: number;
  };
  createdAt: string;
}

export interface OutlineData {
  id: string;
  status: 'streaming' | 'completed' | 'failed';
  sourceArtifact: {
    id: string;
    text: string;
    title?: string;
    type: string;
    ideationRunId?: string;
  };
  components: {
    title?: string;
    genre?: string;
    target_audience?: {
      demographic?: string;
      core_themes?: string[];
    };
    selling_points?: string;
    satisfaction_points?: string[];
    setting?: string;
    synopsis?: string;
    synopsis_stages?: Array<{
      stageSynopsis: string;
      numberOfEpisodes: number;
    }>;
    characters?: Array<{
      name: string;
      type?: string;
      description: string;
      age?: string;
      gender?: string;
      occupation?: string;
      personality_traits?: string[];
      character_arc?: string;
      relationships?: { [key: string]: string };
      key_scenes?: string[];
    }>;
  };
  streamingData?: {
    transformId: string;
    chunks: string[];
    progress: number;
  };
  totalEpisodes?: number;
  episodeDuration?: number;
  createdAt: string;
}

/**
 * Unified Streaming Service
 * 
 * This service replaces the caching layer with database-backed state management.
 * It provides a single source of truth for both streaming and completed data.
 */
export class UnifiedStreamingService {
  constructor(
    private artifactRepo: ArtifactRepository,
    private transformRepo: TransformRepository
  ) { }

  /**
   * Get complete ideation run data from database
   * Works for both streaming and completed states
   */
  async getIdeationRun(userId: string, runId: string): Promise<IdeationData | null> {
    try {
      // 1. Get session artifact
      const sessionArtifacts = await this.artifactRepo.getArtifactsByType(userId, 'ideation_session');
      const sessionArtifact = sessionArtifacts.find(a => a.data.id === runId);

      if (!sessionArtifact) {
        return null;
      }

      // 2. Get latest transform for this ideation run
      const transforms = await this.transformRepo.getTransformsByIdeationRun(userId, runId);
      const latestTransform = transforms.length > 0 ? transforms[0] : null;

      // 3. Get all idea artifacts from completed transforms
      const ideas = await this.getIdeasFromTransforms(userId, transforms);

      // 4. Get parameters
      const { selectedPlatform, genrePaths, genreProportions, requirements, userInput } =
        await this.getIdeationParameters(userId, transforms);

      // 5. Check if currently streaming
      let streamingData: { transformId: string; chunks: string[]; progress: number } | undefined = undefined;
      let status: 'streaming' | 'completed' | 'failed' = 'completed';

      if (latestTransform) {
        if (latestTransform.status === 'running') {
          status = 'streaming';
          // Note: getTransformChunks method removed as part of Electric Sync migration
          const chunks: string[] = []; // Empty for now - Electric Sync will handle streaming
          streamingData = {
            transformId: latestTransform.id,
            chunks,
            progress: 0 // Progress will be handled by Electric Sync
          };
        } else if (latestTransform.status === 'failed') {
          status = 'failed';
        }
      }

      return {
        id: runId,
        status,
        userInput,
        selectedPlatform,
        genrePaths,
        genreProportions,
        ideas,
        requirements,
        streamingData,
        createdAt: sessionArtifact.created_at
      };

    } catch (error) {
      console.error(`[UnifiedStreamingService] Error getting ideation run ${runId}:`, error);
      return null;
    }
  }

  /**
   * Get complete outline session data from database
   * Works for both streaming and completed states
   */
  async getOutlineSession(userId: string, sessionId: string): Promise<OutlineData | null> {
    try {
      console.log(`[UnifiedStreamingService] Getting outline session ${sessionId} for user ${userId}`);

      // Get all transforms related to this outline session
      const transforms = await this.transformRepo.getTransformsByOutlineSession(userId, sessionId);
      console.log(`[UnifiedStreamingService] Found ${transforms.length} transforms for session ${sessionId}`);

      if (transforms.length === 0) {
        console.log(`[UnifiedStreamingService] No transforms found for session ${sessionId}`);
        return null;
      }

      // Get source artifact and parameters
      const sourceArtifact = await this.getOutlineSourceArtifact(userId, transforms);
      const { totalEpisodes, episodeDuration } = await this.getOutlineParameters(userId, transforms);

      // Get components (with user edits)
      const components = await this.getOutlineComponents(userId, sessionId, transforms);

      // Determine status
      const hasRunningTransform = transforms.some(t => t.status === 'running');
      const hasFailedTransform = transforms.some(t => t.status === 'failed');
      const status = hasRunningTransform ? 'streaming' : hasFailedTransform ? 'failed' : 'completed';

      // Get streaming data if there's an active transform
      let streamingData: { transformId: string; chunks: string[]; progress: number } | undefined = undefined;
      const runningTransform = transforms.find(t => t.status === 'running');
      if (runningTransform) {
        const streamingState = await this.getStreamingState(runningTransform.id);
        if (streamingState) {
          streamingData = {
            transformId: streamingState.transformId,
            chunks: streamingState.chunks,
            progress: streamingState.progress
          };
        }
      }

      const result: OutlineData = {
        id: sessionId,
        status,
        sourceArtifact: sourceArtifact || {
          id: '',
          text: '',
          type: 'unknown'
        },
        components,
        streamingData,
        totalEpisodes,
        episodeDuration,
        createdAt: transforms[0]?.created_at || new Date().toISOString()
      };

      console.log(`[UnifiedStreamingService] Returning outline session data for ${sessionId}:`, {
        status: result.status,
        hasComponents: !!result.components,
        hasStreamingData: !!result.streamingData,
        componentKeys: Object.keys(result.components || {})
      });

      return result;
    } catch (error) {
      console.error(`[UnifiedStreamingService] Error getting outline session ${sessionId}:`, error);
      throw error;
    }
  }

  // Get original outline data without user edits
  async getOriginalOutlineData(userId: string, sessionId: string): Promise<OutlineData | null> {
    try {
      console.log(`[UnifiedStreamingService] Getting original outline data for session ${sessionId}`);

      // Get all transforms related to this outline session
      const transforms = await this.transformRepo.getTransformsByOutlineSession(userId, sessionId);

      if (transforms.length === 0) {
        return null;
      }

      // Get source artifact and parameters
      const sourceArtifact = await this.getOutlineSourceArtifact(userId, transforms);
      const { totalEpisodes, episodeDuration } = await this.getOutlineParameters(userId, transforms);

      // Get ONLY original LLM components (no user edits)
      const originalComponents = await this.getOriginalOutlineComponents(userId, transforms);

      const result: OutlineData = {
        id: sessionId,
        status: 'completed', // Original data is always completed
        sourceArtifact: sourceArtifact || {
          id: '',
          text: '',
          type: 'unknown'
        },
        components: originalComponents,
        totalEpisodes,
        episodeDuration,
        createdAt: transforms[0]?.created_at || new Date().toISOString()
      };

      return result;
    } catch (error) {
      console.error(`[UnifiedStreamingService] Error getting original outline data:`, error);
      throw error;
    }
  }

  /**
   * Get streaming state for any transform (Electric Sync migration - simplified)
   */
  async getStreamingState(transformId: string): Promise<StreamingState | null> {
    try {
      const transform = await this.transformRepo.getTransform(transformId);
      if (!transform) {
        return null;
      }

      // Note: getTransformChunks method removed as part of Electric Sync migration
      const chunks: string[] = []; // Empty for now - Electric Sync will handle streaming

      // Get results from artifacts if completed
      const results: any[] = [];
      if (transform.status === 'completed') {
        const outputs = await this.transformRepo.getTransformOutputs(transformId);
        for (const output of outputs) {
          const artifact = await this.artifactRepo.getArtifact(output.artifact_id);
          if (artifact) {
            results.push(artifact.data);
          }
        }
      }

      return {
        transformId,
        status: transform.status,
        chunks,
        results,
        progress: transform.status === 'completed' ? 100 : 0
      };

    } catch (error) {
      console.error(`[UnifiedStreamingService] Error getting streaming state for ${transformId}:`, error);
      return null;
    }
  }

  /**
   * Store chunk to database (Electric Sync migration - method disabled)
   */
  async addStreamingChunk(transformId: string, chunkData: string): Promise<void> {
    try {
      // Note: addTransformChunk method removed as part of Electric Sync migration
      // await this.transformRepo.addTransformChunk(transformId, chunkData);

      // Broadcasting removed - Electric Sync will handle real-time updates
      console.log(`[UnifiedStreamingService] Chunk added for ${transformId} (Electric Sync migration)`);

    } catch (error) {
      console.error(`[UnifiedStreamingService] Error adding chunk for ${transformId}:`, error);
      throw error;
    }
  }

  /**
   * Mark streaming as complete (Electric Sync migration - simplified)
   */
  async completeStreaming(transformId: string): Promise<void> {
    try {
      await this.transformRepo.updateTransformStatus(transformId, 'completed');

      // Broadcasting and cleanup removed - Electric Sync will handle real-time updates
      console.log(`[UnifiedStreamingService] Streaming completed for ${transformId} (Electric Sync migration)`);

    } catch (error) {
      console.error(`[UnifiedStreamingService] Error completing streaming for ${transformId}:`, error);
      throw error;
    }
  }

  /**
   * Broadcast reasoning event (Electric Sync migration - disabled)
   */
  async broadcastReasoningEvent(transformId: string, event: ReasoningEvent): Promise<void> {
    try {
      // Broadcasting removed - Electric Sync will handle real-time updates
      console.log(`[UnifiedStreamingService] Reasoning event for ${transformId} (Electric Sync migration)`, event);
    } catch (error) {
      console.error(`[UnifiedStreamingService] Error broadcasting reasoning event for ${transformId}:`, error);
    }
  }

  // Private helper methods

  private async getIdeasFromTransforms(userId: string, transforms: any[]): Promise<any[]> {
    const ideas: any[] = [];

    for (const transform of transforms) {
      if (transform.status === 'completed') {
        const outputs = await this.transformRepo.getTransformOutputs(transform.id);
        for (const output of outputs) {
          const artifact = await this.artifactRepo.getArtifact(output.artifact_id, userId);
          if (artifact && artifact.type === 'brainstorm_idea') {
            ideas.push({
              title: artifact.data.idea_title || '',
              body: artifact.data.idea_text || '',
              artifactId: artifact.id
            });
          }
        }
      }
    }

    // Sort by artifact ID for consistent ordering
    return ideas.sort((a, b) => a.artifactId.localeCompare(b.artifactId));
  }

  private async getIdeationParameters(userId: string, transforms: any[]): Promise<{
    selectedPlatform: string;
    genrePaths: string[][];
    genreProportions: number[];
    requirements: string;
    userInput: string;
  }> {
    let selectedPlatform = '';
    let genrePaths: string[][] = [];
    let genreProportions: number[] = [];
    let requirements = '';
    let userInput = '';

    for (const transform of transforms) {
      const inputs = await this.transformRepo.getTransformInputs(transform.id);
      for (const input of inputs) {
        const artifact = await this.artifactRepo.getArtifact(input.artifact_id, userId);
        if (artifact) {
          if (artifact.type === 'brainstorming_job_params') {
            selectedPlatform = artifact.data.platform || '';
            genrePaths = artifact.data.genrePaths || [];
            genreProportions = artifact.data.genreProportions || [];
            requirements = artifact.data.requirements || '';
          } else if (artifact.type === 'user_input') {
            userInput = artifact.data.text || '';
          }
        }
      }
    }

    return { selectedPlatform, genrePaths, genreProportions, requirements, userInput };
  }

  private async getOutlineComponents(userId: string, sessionId: string, transforms: any[]): Promise<any> {
    const components: any = {};

    // Get from LLM response first (latest generation)
    for (const transform of transforms) {
      if (transform.type === 'llm' && transform.status === 'completed') {
        const llmData = await this.transformRepo.getLLMTransformData(transform.id);
        if (llmData?.raw_response) {
          try {
            const { robustJSONParse } = await import('../../common/utils/textCleaning');
            const parsedData = await robustJSONParse(llmData.raw_response);
            Object.assign(components, parsedData);
            break; // Use most recent LLM response
          } catch (error) {
            console.warn('Failed to parse LLM response:', error);
          }
        }
      }
    }

    // Override with user modifications (individual component artifacts)
    const relatedArtifacts = await this.getOutlineArtifacts(userId, sessionId);

    const titleArtifact = relatedArtifacts.find(a => a.type === 'outline_title');
    if (titleArtifact) components.title = titleArtifact.data.title;

    const genreArtifact = relatedArtifacts.find(a => a.type === 'outline_genre');
    if (genreArtifact) components.genre = genreArtifact.data.genre;

    const sellingPointsArtifact = relatedArtifacts.find(a => a.type === 'outline_selling_points');
    if (sellingPointsArtifact) components.selling_points = sellingPointsArtifact.data.selling_points;

    const settingArtifact = relatedArtifacts.find(a => a.type === 'outline_setting');
    if (settingArtifact) components.setting = settingArtifact.data.setting;

    const synopsisArtifact = relatedArtifacts.find(a => a.type === 'outline_synopsis');
    if (synopsisArtifact) components.synopsis = synopsisArtifact.data.synopsis;

    const targetAudienceArtifact = relatedArtifacts.find(a => a.type === 'outline_target_audience');
    if (targetAudienceArtifact) {
      components.target_audience = {
        demographic: targetAudienceArtifact.data.demographic,
        core_themes: targetAudienceArtifact.data.core_themes
      };
    }

    const satisfactionPointsArtifact = relatedArtifacts.find(a => a.type === 'outline_satisfaction_points');
    if (satisfactionPointsArtifact) components.satisfaction_points = satisfactionPointsArtifact.data.satisfaction_points;

    const charactersArtifact = relatedArtifacts.find(a => a.type === 'outline_characters');
    if (charactersArtifact) components.characters = charactersArtifact.data.characters;

    const synopsisStagesArtifact = relatedArtifacts.find(a => a.type === 'outline_synopsis_stages');
    if (synopsisStagesArtifact) components.synopsis_stages = synopsisStagesArtifact.data.synopsis_stages;

    return components;
  }

  private async getOutlineArtifacts(userId: string, sessionId: string): Promise<any[]> {
    const transforms = await this.transformRepo.getTransformsByOutlineSession(userId, sessionId);
    const artifactIds = new Set<string>();

    for (const transform of transforms) {
      const inputs = await this.transformRepo.getTransformInputs(transform.id);
      const outputs = await this.transformRepo.getTransformOutputs(transform.id);

      inputs.forEach(i => artifactIds.add(i.artifact_id));
      outputs.forEach(o => artifactIds.add(o.artifact_id));
    }

    return await this.artifactRepo.getArtifactsByIds([...artifactIds], userId);
  }

  private async getOutlineSourceArtifact(userId: string, transforms: any[]): Promise<any | null> {
    for (const transform of transforms) {
      const inputs = await this.transformRepo.getTransformInputs(transform.id);
      for (const input of inputs) {
        const artifact = await this.artifactRepo.getArtifact(input.artifact_id, userId);
        if (artifact && (artifact.type === 'brainstorm_idea' || artifact.type === 'user_input')) {
          // If it's a brainstorm_idea, try to find the originating ideation run
          let ideationRunId: string | null = null;
          if (artifact.type === 'brainstorm_idea') {
            ideationRunId = await this.findIdeationRunForArtifact(userId, artifact.id);
          }

          return {
            id: artifact.id,
            text: artifact.data.idea_text || artifact.data.text || '',
            title: artifact.data.idea_title || artifact.data.title,
            type: artifact.type,
            ideationRunId
          };
        }
      }
    }
    return null;
  }

  private async findIdeationRunForArtifact(userId: string, artifactId: string): Promise<string | null> {
    try {
      console.log(`[findIdeationRunForArtifact] Looking for ideation run for artifact: ${artifactId}`);

      // Find transforms that produced this artifact
      const userTransforms = await this.transformRepo.getUserTransforms(userId);
      console.log(`[findIdeationRunForArtifact] Found ${userTransforms.length} user transforms`);

      for (const transform of userTransforms) {
        const outputs = await this.transformRepo.getTransformOutputs(transform.id);

        // If this transform produced the artifact
        if (outputs.some(o => o.artifact_id === artifactId)) {
          console.log(`[findIdeationRunForArtifact] Transform ${transform.id} produced artifact ${artifactId}`);
          console.log(`[findIdeationRunForArtifact] Execution context:`, transform.execution_context);

          // Check if the transform has an ideation_run_id in execution context
          if (transform.execution_context?.ideation_run_id) {
            console.log(`[findIdeationRunForArtifact] Found ideation_run_id: ${transform.execution_context.ideation_run_id}`);
            return transform.execution_context.ideation_run_id;
          }
        }
      }

      console.log(`[findIdeationRunForArtifact] No ideation run found for artifact ${artifactId}`);
      return null;
    } catch (error) {
      console.error('Error finding ideation run for artifact:', error);
      return null;
    }
  }

  private async getOutlineParameters(userId: string, transforms: any[]): Promise<{
    totalEpisodes?: number;
    episodeDuration?: number;
  }> {
    for (const transform of transforms) {
      const inputs = await this.transformRepo.getTransformInputs(transform.id);
      for (const input of inputs) {
        const artifact = await this.artifactRepo.getArtifact(input.artifact_id, userId);
        if (artifact && artifact.type === 'outline_job_params') {
          return {
            totalEpisodes: artifact.data.totalEpisodes,
            episodeDuration: artifact.data.episodeDuration
          };
        }
      }
    }
    return {};
  }

  private async cleanLLMResponse(response: string): Promise<string> {
    const { cleanLLMContent } = await import('../../common/utils/textCleaning');
    return cleanLLMContent(response);
  }

  private calculateProgress(chunks: string[]): number {
    // Simple progress calculation based on chunk count
    // Could be enhanced with more sophisticated logic
    return Math.min(chunks.length * 10, 100);
  }

  private async getOriginalOutlineComponents(userId: string, transforms: any[]): Promise<any> {
    const components: any = {};

    // Get ONLY from LLM response (no user edits)
    for (const transform of transforms) {
      if (transform.type === 'llm' && transform.status === 'completed') {
        const outputs = await this.transformRepo.getTransformOutputs(transform.id);
        for (const output of outputs) {
          const artifact = await this.artifactRepo.getArtifact(output.artifact_id, userId);
          if (artifact) {
            // Map artifact types to component fields
            switch (artifact.type) {
              case 'outline_title':
                components.title = artifact.data.title;
                break;
              case 'outline_genre':
                components.genre = artifact.data.genre;
                break;
              case 'outline_selling_points':
                components.selling_points = artifact.data.selling_points;
                break;
              case 'outline_setting':
                components.setting = artifact.data.setting;
                break;
              case 'outline_synopsis':
                components.synopsis = artifact.data.synopsis;
                break;
              case 'outline_target_audience':
                components.target_audience = {
                  demographic: artifact.data.demographic,
                  core_themes: artifact.data.core_themes
                };
                break;
              case 'outline_satisfaction_points':
                components.satisfaction_points = artifact.data.satisfaction_points;
                break;
              case 'outline_characters':
                components.characters = artifact.data.characters;
                break;
              case 'outline_synopsis_stages':
                components.synopsis_stages = artifact.data.synopsis_stages;
                break;
            }
          }
        }
        break; // Use most recent LLM response
      }
    }

    return components;
  }
} 