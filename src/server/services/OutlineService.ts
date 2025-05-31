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

    // Delete outline session
    async deleteOutlineSession(userId: string, sessionId: string): Promise<boolean> {
        // Find the session artifact
        const sessionArtifacts = await this.artifactRepo.getArtifactsByType(userId, 'outline_session');
        const sessionArtifact = sessionArtifacts.find(a => a.data.id === sessionId);

        if (!sessionArtifact) {
            return false;
        }

        // No cache to invalidate

        // Note: In a production system, we might want to mark artifacts as deleted rather than actually deleting them
        // For now, we'll delete the session artifact (related artifacts will remain for traceability)
        return await this.artifactRepo.deleteArtifact(sessionArtifact.id, userId);
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
} 