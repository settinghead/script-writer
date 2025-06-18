import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { ProjectFlow } from '../../common/types';

export class FlowService {
    constructor(
        private artifactRepo: ArtifactRepository,
        private transformRepo: TransformRepository
    ) { }

    async getProjectFlows(userId: string): Promise<ProjectFlow[]> {
        console.log(`[FlowService] Getting flows for user ${userId}`);

        // Get all user transforms and artifacts
        const transforms = await this.transformRepo.getUserTransforms(userId);
        const artifacts = await this.artifactRepo.getUserArtifacts(userId);

        console.log(`[FlowService] Found ${transforms.length} transforms and ${artifacts.length} artifacts`);

        // Group transforms by session/flow
        const flowGroups = new Map<string, any[]>();
        const sessionInfo = new Map<string, any>();

        // First pass: identify all sessions and group transforms
        for (const transform of transforms) {
            const executionContext = transform.execution_context || {};

            // Check for ideation session (brainstorm flows)
            if (executionContext.ideation_session_id && executionContext.ideation_session_id !== 'job-based') {
                const sessionId = executionContext.ideation_session_id;
                if (!flowGroups.has(sessionId)) {
                    flowGroups.set(sessionId, []);
                    sessionInfo.set(sessionId, { type: 'brainstorm', sessionId });
                }
                flowGroups.get(sessionId)!.push(transform);
            }

            // Check for outline session (both brainstorm-derived and direct)
            if (executionContext.outline_session_id) {
                const sessionId = executionContext.outline_session_id;
                if (!flowGroups.has(sessionId)) {
                    flowGroups.set(sessionId, []);
                    sessionInfo.set(sessionId, { type: 'direct_outline', sessionId });
                }
                flowGroups.get(sessionId)!.push(transform);
            }

            // Check for episode session
            if (executionContext.episode_generation_session_id) {
                const sessionId = executionContext.episode_generation_session_id;
                if (!flowGroups.has(sessionId)) {
                    flowGroups.set(sessionId, []);
                    sessionInfo.set(sessionId, { type: 'episodes', sessionId });
                }
                flowGroups.get(sessionId)!.push(transform);
            }
        }

        console.log(`[FlowService] Found ${flowGroups.size} flow groups:`, Array.from(flowGroups.keys()));

        const flows: ProjectFlow[] = [];

        // Process each flow
        for (const [sessionId, flowTransforms] of flowGroups) {
            try {
                const flow = await this.buildFlowFromTransforms(sessionId, flowTransforms, artifacts);
                if (flow) {
                    flows.push(flow);
                }
            } catch (error) {
                console.error(`[FlowService] Error building flow ${sessionId}:`, error);
            }
        }

        // Sort by most recent update
        flows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        console.log(`[FlowService] Returning ${flows.length} flows`);
        return flows;
    }

    private async buildFlowFromTransforms(
        sessionId: string,
        transforms: any[],
        allArtifacts: any[]
    ): Promise<ProjectFlow | null> {
        // Sort transforms by creation date
        transforms.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const earliestTransform = transforms[0];
        const latestTransform = transforms[transforms.length - 1];

        // Determine source type and get related artifacts
        let sourceType: 'brainstorm' | 'direct_outline' = 'direct_outline';
        let title = '';
        let description = '';
        let platform = '';
        let genre = '';
        let totalEpisodes: number | undefined;
        let episodeDuration: number | undefined;

        // Get all artifact IDs from this flow's transforms
        const flowArtifactIds = new Set<string>();
        for (const transform of transforms) {
            const inputs = await this.transformRepo.getTransformInputs(transform.id);
            const outputs = await this.transformRepo.getTransformOutputs(transform.id);
            inputs.forEach(i => flowArtifactIds.add(i.artifact_id));
            outputs.forEach(o => flowArtifactIds.add(o.artifact_id));
        }

        // Filter artifacts to only those in this flow
        const flowArtifacts = allArtifacts.filter(a => flowArtifactIds.has(a.id));

        // Determine source type and extract metadata
        const hasIdeationSession = transforms.some(t =>
            t.execution_context?.ideation_session_id &&
            t.execution_context.ideation_session_id !== 'job-based'
        );

        if (hasIdeationSession) {
            sourceType = 'brainstorm';

            // Get brainstorm metadata
            const brainstormIdea = flowArtifacts.find(a => a.type === 'brainstorm_idea');
            const brainstormParams = flowArtifacts.find(a => a.type === 'brainstorm_params' || a.type === 'brainstorming_job_params');

            if (brainstormIdea) {
                title = brainstormIdea.data.idea_title || '';
                description = brainstormIdea.data.idea_text || '';
            }

            if (brainstormParams) {
                platform = brainstormParams.data.platform || '';
                if (brainstormParams.data.genre_paths && brainstormParams.data.genre_paths.length > 0) {
                    genre = brainstormParams.data.genre_paths.map((path: string[]) => path[path.length - 1]).join(', ');
                }
            }
        } else {
            // Direct outline - get info from outline artifacts
            const outlineTitle = flowArtifacts.find(a => a.type === 'outline_title');
            const outlineGenre = flowArtifacts.find(a => a.type === 'outline_genre');
            const userInput = flowArtifacts.find(a => a.type === 'user_input');
            const outlineParams = flowArtifacts.find(a => a.type === 'outline_job_params');

            if (outlineTitle) {
                title = outlineTitle.data.title || '';
            }

            if (outlineGenre) {
                genre = outlineGenre.data.genre || '';
            }

            if (userInput) {
                description = userInput.data.text || '';
            }

            if (outlineParams) {
                totalEpisodes = outlineParams.data.totalEpisodes;
                episodeDuration = outlineParams.data.episodeDuration;
                if (outlineParams.data.workflowContext) {
                    platform = outlineParams.data.workflowContext.platform || '';
                }
            }
        }

        // Count artifacts by type
        const artifactCounts = {
            ideas: flowArtifacts.filter(a => a.type === 'brainstorm_idea').length,
            outlines: flowArtifacts.filter(a => a.type.startsWith('outline_')).length,
            episodes: flowArtifacts.filter(a => a.type === 'episode_synopsis').length,
            scripts: flowArtifacts.filter(a => a.type === 'episode_script').length
        };

        // Determine current phase
        let currentPhase: 'brainstorming' | 'outline' | 'episodes' | 'scripts' = 'brainstorming';
        if (artifactCounts.scripts > 0) {
            currentPhase = 'scripts';
        } else if (artifactCounts.episodes > 0) {
            currentPhase = 'episodes';
        } else if (artifactCounts.outlines > 0) {
            currentPhase = 'outline';
        }

        // Determine status
        const hasRunningTransform = transforms.some(t => t.status === 'running');
        const hasFailedTransform = transforms.some(t => t.status === 'failed');
        const status = hasRunningTransform ? 'active' : hasFailedTransform ? 'failed' : 'completed';

        // Generate fallback title if empty
        if (!title) {
            if (genre && platform) {
                title = `${platform} ${genre}项目`;
            } else if (platform) {
                title = `${platform}项目`;
            } else {
                title = '未命名项目';
            }
        }

        // Truncate title and description for display
        title = title.length > 40 ? title.substring(0, 40) + '...' : title;
        description = description.length > 100 ? description.substring(0, 100) + '...' : description;

        return {
            id: sessionId,
            title,
            description,
            currentPhase,
            status,
            platform,
            genre,
            totalEpisodes,
            episodeDuration,
            createdAt: earliestTransform.created_at,
            updatedAt: latestTransform.created_at,
            sourceType,
            artifactCounts
        };
    }
} 