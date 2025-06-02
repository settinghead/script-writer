import { v4 as uuidv4 } from 'uuid';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import {
    Artifact,
    OutlineSessionV1,
    OutlineJobParamsV1,
    OutlineTitleV1,
    OutlineGenreV1,
    OutlineSellingPointsV1,
    OutlineSettingV1,
    OutlineSynopsisV1,
    OutlineCharactersV1,
    OutlineTargetAudienceV1,
    OutlineSatisfactionPointsV1,
    OutlineSynopsisStagesV1
} from '../types/artifacts';
import { UnifiedStreamingService } from './UnifiedStreamingService';

// Response interfaces
export interface OutlineSessionData {
    id: string;
    sourceArtifact: {
        id: string;
        text: string;
        title?: string;
        type: string;
    };
    ideationRunId?: string;
    totalEpisodes?: number;
    episodeDuration?: number;
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
    status: 'active' | 'completed' | 'failed';
    createdAt: string;
}

export interface OutlineSessionSummary {
    id: string;
    source_idea: string;
    source_idea_title?: string;
    source_artifact_id: string;
    ideation_run_id?: string;
    title?: string;
    genre?: string;
    total_episodes?: number;
    episode_duration?: number;
    created_at: string;
    status: 'active' | 'completed' | 'failed';
}

export interface LineageData {
    nodes: Array<{
        id: string;
        type: 'artifact' | 'transform';
        data: Artifact | any;
        level: number;
        label: string;
        timestamp: string;
    }>;
    edges: Array<{
        from: string;
        to: string;
        role?: string;
    }>;
}

export interface OutlineCharacter {
    name: string;
    description: string;
}

export class OutlineService {
    constructor(
        private artifactRepo: ArtifactRepository,
        private transformRepo: TransformRepository,
        private unifiedStreamingService: UnifiedStreamingService
    ) { }

    // Validate session ownership helper
    private async validateSessionOwnership(userId: string, sessionId: string): Promise<any> {
        const sessionArtifacts = await this.artifactRepo.getArtifactsByType(userId, 'outline_session');
        const sessionArtifact = sessionArtifacts.find(a => a.data.id === sessionId);

        if (!sessionArtifact) {
            throw new Error(`Outline session ${sessionId} not found or not accessible by user ${userId}`);
        }

        return sessionArtifact;
    }

    // Helper to find all related artifacts for an outline session
    private async getOutlineArtifacts(userId: string, sessionId: string): Promise<Artifact[]> {
        const userTransforms = await this.transformRepo.getUserTransforms(userId);
        const relatedArtifactIds = new Set<string>();

        // Find transforms for this outline session
        const outlineTransforms = userTransforms.filter(t =>
            t.execution_context?.outline_session_id === sessionId
        );

        // Collect all input and output artifact IDs
        for (const transform of outlineTransforms) {
            const inputs = await this.transformRepo.getTransformInputs(transform.id);
            const outputs = await this.transformRepo.getTransformOutputs(transform.id);

            inputs.forEach(i => relatedArtifactIds.add(i.artifact_id));
            outputs.forEach(o => relatedArtifactIds.add(o.artifact_id));
        }

        return await this.artifactRepo.getArtifactsByIds([...relatedArtifactIds], userId);
    }

    // Get outline session by ID
    async getOutlineSession(userId: string, sessionId: string): Promise<OutlineSessionData | null> {

        try {
            // Use unified streaming service to get data from database
            const outlineData = await this.unifiedStreamingService.getOutlineSession(userId, sessionId);

            if (!outlineData) {
                return null;
            }

            // Convert to legacy format for backward compatibility
            return {
                id: outlineData.id,
                sourceArtifact: outlineData.sourceArtifact,
                ideationRunId: outlineData.sourceArtifact?.ideationRunId,
                totalEpisodes: outlineData.totalEpisodes,
                episodeDuration: outlineData.episodeDuration,
                components: outlineData.components,
                status: outlineData.status === 'streaming' ? 'active' : outlineData.status,
                createdAt: outlineData.createdAt,
                // Add streaming info if active
                ...(outlineData.streamingData && {
                    streamingData: outlineData.streamingData
                })
            };

        } catch (error) {
            if (error instanceof Error && error.message.includes('not found or not accessible')) {
                return null;
            }
            throw error;
        }
    }

    // List all outline sessions for a user
    async listOutlineSessions(userId: string): Promise<OutlineSessionSummary[]> {

        // Get all outline session artifacts for the user
        const sessionArtifacts = await this.artifactRepo.getArtifactsByType(userId, 'outline_session');

        const sessions: OutlineSessionSummary[] = [];

        for (const sessionArtifact of sessionArtifacts) {
            const sessionId = sessionArtifact.data.id;

            try {
                // Get minimal data for listing
                const relatedArtifacts = await this.getOutlineArtifacts(userId, sessionId);

                const jobParams = relatedArtifacts.find(a => a.type === 'outline_job_params');
                const titleArtifact = relatedArtifacts.find(a => a.type === 'outline_title');
                const genreArtifact = relatedArtifacts.find(a => a.type === 'outline_genre');

                let sourceArtifact: Artifact | null = null;
                if (jobParams) {
                    sourceArtifact = await this.artifactRepo.getArtifact(
                        jobParams.data.sourceArtifactId,
                        userId
                    );
                }

                // Determine status
                const userTransforms = await this.transformRepo.getUserTransforms(userId);
                const outlineTransforms = userTransforms.filter(t =>
                    t.execution_context?.outline_session_id === sessionId
                );

                let status: 'active' | 'completed' | 'failed' = 'active';
                if (outlineTransforms.length > 0) {
                    const latestTransform = outlineTransforms.sort((a, b) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    )[0];

                    if (latestTransform.status === 'completed') status = 'completed';
                    else if (latestTransform.status === 'failed') status = 'failed';
                }

                sessions.push({
                    id: sessionId,
                    source_idea: sourceArtifact?.data.idea_text || sourceArtifact?.data.text || '',
                    source_idea_title: sourceArtifact?.data.idea_title || sourceArtifact?.data.title,
                    source_artifact_id: sourceArtifact?.id || '',
                    ideation_run_id: sessionArtifact.data.ideation_session_id !== 'job-based'
                        ? sessionArtifact.data.ideation_session_id
                        : undefined,
                    title: titleArtifact?.data.title,
                    genre: genreArtifact?.data.genre,
                    total_episodes: jobParams?.data.totalEpisodes,
                    episode_duration: jobParams?.data.episodeDuration,
                    created_at: sessionArtifact.created_at,
                    status
                });
            } catch (error) {
                // Skip sessions that can't be loaded
                console.warn(`Error loading outline session ${sessionId}:`, error);
            }
        }

        const sortedSessions = sessions.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return sortedSessions;
    }

    // Delete outline session and all related artifacts
    async deleteOutlineSession(userId: string, sessionId: string): Promise<boolean> {
        try {
            // Validate ownership first
            await this.validateSessionOwnership(userId, sessionId);

            // Get all related artifacts
            const relatedArtifacts = await this.getOutlineArtifacts(userId, sessionId);

            // Delete all related artifacts
            for (const artifact of relatedArtifacts) {
                await this.artifactRepo.deleteArtifact(artifact.id, userId);
            }

            return true;
        } catch (error) {
            console.error(`Error deleting outline session ${sessionId}:`, error);
            return false;
        }
    }

    // Clear all user edits for an outline session
    async clearUserEdits(userId: string, sessionId: string): Promise<void> {
        try {
            // Validate ownership first
            await this.validateSessionOwnership(userId, sessionId);

            // Define edit artifact types
            const editTypes = [
                'title_edit', 'genre_edit', 'selling_points_edit', 'setting_edit',
                'synopsis_edit', 'target_audience_edit', 'satisfaction_points_edit',
                'characters_edit', 'synopsis_stages_edit'
            ];

            // Get all edit artifacts for this session
            for (const editType of editTypes) {
                const editArtifacts = await this.artifactRepo.getArtifactsByType(userId, editType);
                const sessionEdits = editArtifacts.filter(a =>
                    a.data.outline_session_id === sessionId
                );

                // Delete each edit artifact
                for (const editArtifact of sessionEdits) {
                    await this.artifactRepo.deleteArtifact(editArtifact.id, userId);
                }
            }

            console.log(`[OutlineService] Cleared user edits for session ${sessionId}`);
        } catch (error) {
            console.error(`[OutlineService] Error clearing user edits for session ${sessionId}:`, error);
            throw error;
        }
    }

    // Get lineage data for visualization
    async getOutlineLineage(userId: string, sessionId: string): Promise<LineageData> {
        // Validate session ownership
        await this.validateSessionOwnership(userId, sessionId);

        // Get all related artifacts and transforms
        const relatedArtifacts = await this.getOutlineArtifacts(userId, sessionId);
        const userTransforms = await this.transformRepo.getUserTransforms(userId);

        const outlineTransforms = userTransforms.filter(t =>
            t.execution_context?.outline_session_id === sessionId
        );

        const nodes: LineageData['nodes'] = [];
        const edges: LineageData['edges'] = [];

        // Add artifact nodes
        relatedArtifacts.forEach((artifact, index) => {
            let label = artifact.type;
            if (artifact.type === 'brainstorm_idea') {
                label = `故事灵感: ${artifact.data.idea_title || ''}`;
            } else if (artifact.type === 'outline_title') {
                label = `标题: ${artifact.data.title || ''}`;
            } else if (artifact.type === 'outline_genre') {
                label = `类型: ${artifact.data.genre || ''}`;
            }

            nodes.push({
                id: artifact.id,
                type: 'artifact',
                data: artifact,
                level: index,
                label,
                timestamp: artifact.created_at
            });
        });

        // Add transform nodes and edges
        outlineTransforms.forEach((transform, index) => {
            const label = transform.type === 'llm' ? '大纲生成' : '手动编辑';

            nodes.push({
                id: transform.id,
                type: 'transform',
                data: transform,
                level: index + 1,
                label,
                timestamp: transform.created_at
            });

            // Add edges for inputs and outputs (simplified for now)
            // This would need more sophisticated logic for complex lineages
        });

        return { nodes, edges };
    }

    // Helper method to get user input for outline session
    private async getLatestUserInputForSession(
        userId: string,
        outlineSessionId: string
    ): Promise<{ data: { text: string } } | null> {
        try {
            // Get the outline session artifact to find the creation time
            const sessionArtifacts = await this.artifactRepo.getArtifactsByTypeForSession(
                userId,
                'outline_session',
                outlineSessionId
            );

            if (sessionArtifacts.length === 0) {
                return null;
            }

            // Get all user artifacts and find user_input or brainstorm_idea artifacts
            // created around the same time as the session
            const allArtifacts = await this.artifactRepo.getUserArtifacts(userId);
            const sessionCreationTime = new Date(sessionArtifacts[0].created_at).getTime();
            const timeWindow = 5 * 60 * 1000; // 5 minutes

            const inputArtifacts = allArtifacts.filter(artifact => {
                const artifactTime = new Date(artifact.created_at).getTime();
                const timeDiff = Math.abs(artifactTime - sessionCreationTime);

                return timeDiff <= timeWindow &&
                    (artifact.type === 'user_input' || artifact.type === 'brainstorm_idea');
            });

            // Sort by creation time and get the most recent
            inputArtifacts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            if (inputArtifacts.length === 0) {
                return null;
            }

            const inputArtifact = inputArtifacts[0];

            // Extract text based on artifact type
            const text = inputArtifact.data.text || inputArtifact.data.idea_text;

            return text ? { data: { text } } : null;

        } catch (error) {
            console.error('Error getting user input for session:', error);
            return null;
        }
    }

    async startOutlineGeneration(
        userId: string,
        sourceArtifactId: string,
        totalEpisodes?: number,
        episodeDuration?: number
    ): Promise<{ sessionId: string; transformId: string }> {
        try {
            console.log(`[OutlineService] Starting outline generation for user ${userId}, source artifact ${sourceArtifactId}`);

            // Extract parameters from source artifact if not provided
            let finalTotalEpisodes = totalEpisodes;
            let finalEpisodeDuration = episodeDuration;
            let workflowContext: any = {};

            if (!finalTotalEpisodes || !finalEpisodeDuration) {
                const sourceArtifact = await this.artifactRepo.getArtifact(sourceArtifactId, userId);
                if (sourceArtifact) {
                    // Try to extract from brainstorm idea data
                    if (sourceArtifact.type === 'brainstorm_idea' && sourceArtifact.data) {
                        finalTotalEpisodes = finalTotalEpisodes || sourceArtifact.data.totalEpisodes;
                        finalEpisodeDuration = finalEpisodeDuration || sourceArtifact.data.episodeDuration;

                        // Build workflow context from brainstorm data
                        workflowContext = {
                            totalEpisodes: finalTotalEpisodes,
                            episodeDuration: finalEpisodeDuration,
                            platform: sourceArtifact.data.platform,
                            genre: sourceArtifact.data.genre,
                            requirements: sourceArtifact.data.requirements
                        };
                    }

                    // Try to find related ideation run for additional context
                    if (sourceArtifact.type === 'brainstorm_idea') {
                        try {
                            // Note: We'll skip ideation run lookup for now since the method is private
                            // This can be enhanced later if needed
                            console.log('Skipping ideation run context lookup');
                        } catch (error) {
                            console.warn('Could not find ideation run context:', error);
                        }
                    }
                }
            } else {
                workflowContext = {
                    totalEpisodes: finalTotalEpisodes,
                    episodeDuration: finalEpisodeDuration
                };
            }

            // Create job parameters artifact
            const jobParams: OutlineJobParamsV1 = {
                sourceArtifactId,
                totalEpisodes: finalTotalEpisodes,
                episodeDuration: finalEpisodeDuration,
                requestedAt: new Date().toISOString(),
                workflowContext
            };

            const jobParamsArtifact = await this.artifactRepo.createArtifact(
                userId,
                'outline_job_params',
                jobParams
            );

            // Create transform for outline generation
            const sessionId = `outline-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const transform = await this.transformRepo.createTransform(
                userId,
                'llm',
                'outline_generation',
                'running',
                {
                    outline_session_id: sessionId,
                    totalEpisodes: finalTotalEpisodes,
                    episodeDuration: finalEpisodeDuration,
                    workflowContext
                }
            );

            // Add input artifacts
            await this.transformRepo.addTransformInputs(transform.id, [
                { artifactId: sourceArtifactId },
                { artifactId: jobParamsArtifact.id }
            ]);

            console.log(`[OutlineService] Created outline session ${sessionId} with transform ${transform.id}`);

            return {
                sessionId,
                transformId: transform.id
            };
        } catch (error) {
            console.error('[OutlineService] Error starting outline generation:', error);
            throw error;
        }
    }
} 