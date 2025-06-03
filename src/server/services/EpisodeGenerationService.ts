import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import {
    EpisodeGenerationSessionV1,
    EpisodeGenerationParamsV1,
    EpisodeSynopsisV1,
    OutlineSynopsisStageV1
} from '../../common/types';
import { v4 as uuidv4 } from 'uuid';

export interface EpisodeGenerationSessionData {
    session: EpisodeGenerationSessionV1;
    stage: OutlineSynopsisStageV1 & { artifactId: string };
    episodes: EpisodeSynopsisV1[];
    currentTransformId?: string;
    status: 'active' | 'completed' | 'failed';
}

export interface StageArtifactWithId extends OutlineSynopsisStageV1 {
    artifactId: string;
}

export class EpisodeGenerationService {
    constructor(
        private artifactRepo: ArtifactRepository,
        private transformRepo: TransformRepository
    ) { }

    async startEpisodeGeneration(
        userId: string,
        stageArtifactId: string,
        numberOfEpisodes?: number,
        customRequirements?: string
    ): Promise<{ sessionId: string; transformId: string }> {
        // 1. Get stage artifact and validate ownership
        const stageArtifact = await this.artifactRepo.getArtifact(stageArtifactId, userId);
        if (!stageArtifact || stageArtifact.type !== 'outline_synopsis_stage') {
            throw new Error('Invalid stage artifact');
        }

        const stageData = stageArtifact.data as OutlineSynopsisStageV1;

        // 2. Create or get user_input artifact if modifications exist
        let paramsArtifact;
        if (numberOfEpisodes !== stageData.numberOfEpisodes || customRequirements) {
            // Create human transform for modifications
            const humanTransform = await this.transformRepo.createTransform(
                userId, 'human', 'v1', 'completed',
                { action: 'modify_episode_params' }
            );

            // Create user_input artifact
            paramsArtifact = await this.artifactRepo.createArtifact(
                userId,
                'episode_generation_params',
                {
                    stageArtifactId,
                    numberOfEpisodes: numberOfEpisodes || stageData.numberOfEpisodes,
                    stageSynopsis: stageData.stageSynopsis,
                    customRequirements
                } as EpisodeGenerationParamsV1,
                'v1'
            );

            // Link human transform to params artifact
            await this.transformRepo.addTransformOutputs(humanTransform.id, [
                { artifactId: paramsArtifact.id, outputRole: 'episode_params' }
            ]);
        }

        // 3. Create episode generation session
        const sessionId = `ep-gen-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const sessionArtifact = await this.artifactRepo.createArtifact(
            userId,
            'episode_generation_session',
            {
                id: sessionId,
                outlineSessionId: stageData.outlineSessionId,
                stageArtifactId,
                status: 'active',
                totalEpisodes: numberOfEpisodes || stageData.numberOfEpisodes,
                episodeDuration: 45 // Default, can be parameterized
            } as EpisodeGenerationSessionV1,
            'v1'
        );

        // 4. Create transform for streaming generation
        const transform = await this.transformRepo.createTransform(
            userId, 'llm', 'v1', 'running',
            {
                episode_generation_session_id: sessionId,
                stage_artifact_id: stageArtifactId,
                total_episodes: numberOfEpisodes || stageData.numberOfEpisodes,
                template_id: 'episode_synopsis_generation'
            }
        );

        // 5. Add input artifacts
        const inputArtifacts = [{ artifactId: stageArtifactId, inputRole: 'stage_data' }];
        if (paramsArtifact) {
            inputArtifacts.push({ artifactId: paramsArtifact.id, inputRole: 'episode_params' });
        }
        await this.transformRepo.addTransformInputs(transform.id, inputArtifacts);

        // 6. Start the streaming job in the background
        // Import and use StreamingTransformExecutor to start the job
        const { StreamingTransformExecutor } = await import('./streaming/StreamingTransformExecutor');
        const { TemplateService } = await import('./templates/TemplateService');

        const templateService = new TemplateService();
        const executor = new StreamingTransformExecutor(
            this.artifactRepo,
            this.transformRepo,
            templateService
        );

        // Start the job execution immediately in the background
        executor.executeStreamingJobWithRetries(transform.id)
            .catch(error => {
                console.error(`Error starting episode generation streaming job for transform ${transform.id}:`, error);
                this.transformRepo.updateTransformStatus(transform.id, 'failed');
            });

        return { sessionId, transformId: transform.id };
    }

    async getEpisodeGenerationSession(
        userId: string,
        sessionId: string
    ): Promise<EpisodeGenerationSessionData | null> {
        try {
            // Get session artifact
            const sessionArtifacts = await this.artifactRepo.getArtifactsByType(
                userId,
                'episode_generation_session'
            );

            const sessionArtifact = sessionArtifacts.find(
                artifact => (artifact.data as EpisodeGenerationSessionV1).id === sessionId
            );

            if (!sessionArtifact) {
                return null;
            }

            const sessionData = sessionArtifact.data as EpisodeGenerationSessionV1;

            // Get stage artifact
            const stageArtifact = await this.artifactRepo.getArtifact(
                sessionData.stageArtifactId,
                userId
            );

            if (!stageArtifact) {
                throw new Error('Stage artifact not found');
            }

            // Get episode artifacts for this session
            const episodeArtifacts = await this.artifactRepo.getArtifactsByType(
                userId,
                'episode_synopsis'
            );

            const episodes = episodeArtifacts
                .filter(artifact =>
                    (artifact.data as EpisodeSynopsisV1).episodeGenerationSessionId === sessionId
                )
                .map(artifact => artifact.data as EpisodeSynopsisV1)
                .sort((a, b) => a.episodeNumber - b.episodeNumber);

            // Check for active transform
            let currentTransformId: string | undefined;
            let status: 'active' | 'completed' | 'failed' = sessionData.status;

            return {
                session: sessionData,
                stage: {
                    ...stageArtifact.data as OutlineSynopsisStageV1,
                    artifactId: stageArtifact.id
                },
                episodes,
                currentTransformId,
                status
            };

        } catch (error) {
            console.error('Error getting episode generation session:', error);
            return null;
        }
    }

    async getStageArtifacts(userId: string, outlineSessionId: string): Promise<StageArtifactWithId[]> {
        const stageArtifacts = await this.artifactRepo.getArtifactsByType(
            userId,
            'outline_synopsis_stage'
        );

        return stageArtifacts
            .filter(artifact =>
                (artifact.data as OutlineSynopsisStageV1).outlineSessionId === outlineSessionId
            )
            .map(artifact => ({
                ...artifact.data as OutlineSynopsisStageV1,
                artifactId: artifact.id
            } as StageArtifactWithId))
            .sort((a, b) => a.stageNumber - b.stageNumber);
    }

    async getStageArtifact(userId: string, stageArtifactId: string): Promise<StageArtifactWithId | null> {
        const artifact = await this.artifactRepo.getArtifact(stageArtifactId, userId);

        if (!artifact || artifact.type !== 'outline_synopsis_stage') {
            return null;
        }

        return {
            ...artifact.data as OutlineSynopsisStageV1,
            artifactId: artifact.id
        } as StageArtifactWithId;
    }

    async checkActiveEpisodeGeneration(
        userId: string,
        stageArtifactId: string
    ): Promise<{ sessionId: string; transformId: string } | null> {
        // Find active episode generation sessions for this stage
        const sessionArtifacts = await this.artifactRepo.getArtifactsByType(
            userId,
            'episode_generation_session'
        );

        for (const sessionArtifact of sessionArtifacts) {
            const sessionData = sessionArtifact.data as EpisodeGenerationSessionV1;

            if (sessionData.stageArtifactId === stageArtifactId && sessionData.status === 'active') {
                // Check for running transforms using getUserTransforms
                const userTransforms = await this.transformRepo.getUserTransforms(userId);

                const activeTransform = userTransforms.find(transform =>
                    transform.status === 'running' &&
                    transform.execution_context?.episode_generation_session_id === sessionData.id
                );

                if (activeTransform) {
                    return {
                        sessionId: sessionData.id,
                        transformId: activeTransform.id
                    };
                }
            }
        }

        return null;
    }
} 