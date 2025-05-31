import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { JobBroadcaster } from './streaming/JobBroadcaster';

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
    synopsis_stages?: string[];
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
  ) {}

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
          const chunks = await this.transformRepo.getTransformChunks(latestTransform.id);
          streamingData = {
            transformId: latestTransform.id,
            chunks,
            progress: this.calculateProgress(chunks)
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
      // 1. Get session artifact
      const sessionArtifacts = await this.artifactRepo.getArtifactsByType(userId, 'outline_session');
      const sessionArtifact = sessionArtifacts.find(a => a.data.id === sessionId);

      if (!sessionArtifact) {
        return null;
      }

      // 2. Get latest transform for this outline session
      const transforms = await this.transformRepo.getTransformsByOutlineSession(userId, sessionId);
      const latestTransform = transforms.length > 0 ? transforms[0] : null;

      // 3. Get components from artifacts and LLM response
      const components = await this.getOutlineComponents(userId, sessionId, transforms);

      // 4. Get source artifact
      const sourceArtifact = await this.getOutlineSourceArtifact(userId, transforms);

      // 5. Get parameters
      const { totalEpisodes, episodeDuration } = await this.getOutlineParameters(userId, transforms);

      // 6. Check if currently streaming
      let streamingData: { transformId: string; chunks: string[]; progress: number } | undefined = undefined;
      let status: 'streaming' | 'completed' | 'failed' = 'completed';

      if (latestTransform) {
        if (latestTransform.status === 'running') {
          status = 'streaming';
          const chunks = await this.transformRepo.getTransformChunks(latestTransform.id);
          streamingData = {
            transformId: latestTransform.id,
            chunks,
            progress: this.calculateProgress(chunks)
          };
        } else if (latestTransform.status === 'failed') {
          status = 'failed';
        }
      }

      return {
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
        createdAt: sessionArtifact.created_at
      };

    } catch (error) {
      console.error(`[UnifiedStreamingService] Error getting outline session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Get streaming state for any transform
   */
  async getStreamingState(transformId: string): Promise<StreamingState | null> {
    try {
      const transform = await this.transformRepo.getTransform(transformId);
      if (!transform) {
        return null;
      }

      const chunks = await this.transformRepo.getTransformChunks(transformId);
      
      // Get results from artifacts if completed
      const results = [];
      if (transform.status === 'completed') {
        const outputs = await this.transformRepo.getTransformOutputs(transformId);
        for (const output of outputs) {
          const artifact = await this.artifactRepo.getArtifact(output.artifact_id, transform.user_id);
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
        progress: this.calculateProgress(chunks)
      };

    } catch (error) {
      console.error(`[UnifiedStreamingService] Error getting streaming state for ${transformId}:`, error);
      return null;
    }
  }

  /**
   * Store chunk to database (replaces StreamingCache.addChunk)
   */
  async addStreamingChunk(transformId: string, chunkData: string): Promise<void> {
    try {
      await this.transformRepo.addTransformChunk(transformId, chunkData);
      
      // Broadcast chunk to connected clients
      const broadcaster = JobBroadcaster.getInstance();
      broadcaster.broadcast(transformId, chunkData);
      
    } catch (error) {
      console.error(`[UnifiedStreamingService] Error adding chunk for ${transformId}:`, error);
      throw error;
    }
  }

  /**
   * Mark streaming as complete and clean up
   */
  async completeStreaming(transformId: string): Promise<void> {
    try {
      await this.transformRepo.updateTransformStatus(transformId, 'completed');
      
      // Broadcast completion
      const broadcaster = JobBroadcaster.getInstance();
      broadcaster.broadcast(transformId, 'stream:complete');
      
      // Schedule cleanup after grace period
      setTimeout(async () => {
        await this.transformRepo.cleanupTransformChunks(transformId);
        broadcaster.cleanup(transformId);
      }, 5 * 60 * 1000); // 5 minutes
      
    } catch (error) {
      console.error(`[UnifiedStreamingService] Error completing streaming for ${transformId}:`, error);
      throw error;
    }
  }

  // Private helper methods

  private async getIdeasFromTransforms(userId: string, transforms: any[]): Promise<any[]> {
    const ideas = [];
    
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
            const cleanContent = this.cleanLLMResponse(llmData.raw_response);
            const parsedData = JSON.parse(cleanContent);
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

    // Add other component overrides as needed...

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
          let ideationRunId = null;
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

  private cleanLLMResponse(response: string): string {
    let cleanContent = response.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return cleanContent;
  }

  private calculateProgress(chunks: string[]): number {
    // Simple progress calculation based on chunk count
    // Could be enhanced with more sophisticated logic
    return Math.min(chunks.length * 10, 100);
  }
} 