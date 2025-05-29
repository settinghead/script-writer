import { v4 as uuidv4 } from 'uuid';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { TransformExecutor } from './TransformExecutor';
import {
    Artifact,
    IdeationSessionV1,
    BrainstormParamsV1,
    BrainstormIdeaV1,
    UserInputV1,
    PlotOutlineV1
} from '../types/artifacts';
import { CacheService } from './CacheService';

export class IdeationService {
    constructor(
        private artifactRepo: ArtifactRepository,
        private transformRepo: TransformRepository,
        private transformExecutor: TransformExecutor,
        private cacheService: CacheService
    ) { }

    // Create ideation run with initial ideas (maps to /api/ideations/create_run_with_ideas)
    async createRunWithIdeas(
        userId: string,
        selectedPlatform: string,
        genrePaths: string[][],
        genreProportions: number[],
        initialIdeas: string[],
        initialIdeaTitles: string[] = [],
        requirements: string
    ): Promise<{ runId: string; initialIdeaArtifacts: Array<{ id: string, text: string, title?: string, orderIndex: number }> }> {
        // Create ideation session artifact
        const sessionId = uuidv4();
        const sessionArtifact = await this.artifactRepo.createArtifact(
            userId,
            'ideation_session',
            {
                id: sessionId,
                status: 'active',
                created_at: new Date().toISOString()
            } as IdeationSessionV1
        );

        // Create brainstorm parameters artifact
        const paramsArtifact = await this.artifactRepo.createArtifact(
            userId,
            'brainstorm_params',
            {
                platform: selectedPlatform,
                genre_paths: genrePaths,
                genre_proportions: genreProportions,
                requirements
            } as BrainstormParamsV1
        );

        // Create individual idea artifacts
        const ideaArtifacts: Artifact[] = [];
        const initialIdeaArtifacts: Array<{ id: string, text: string, title?: string, orderIndex: number }> = [];
        for (let i = 0; i < initialIdeas.length; i++) {
            const ideaArtifact = await this.artifactRepo.createArtifact(
                userId,
                'brainstorm_idea',
                {
                    idea_text: initialIdeas[i],
                    idea_title: initialIdeaTitles[i] || undefined,
                    order_index: i
                } as BrainstormIdeaV1
            );
            ideaArtifacts.push(ideaArtifact);
            initialIdeaArtifacts.push({
                id: ideaArtifact.id,
                text: initialIdeas[i],
                title: initialIdeaTitles[i] || undefined,
                orderIndex: i
            });
        }

        // Create human transform linking the session creation
        await this.transformExecutor.executeHumanTransform(
            userId,
            [], // No inputs for session creation
            'create_session',
            [sessionArtifact, paramsArtifact, ...ideaArtifacts],
            {
                interface: 'brainstorming_panel',
                form_data: {
                    selectedPlatform,
                    genrePaths,
                    genreProportions,
                    requirements
                }
            },
            'User created ideation session with brainstorm parameters and initial ideas'
        );

        // Invalidate relevant caches
        this.cacheService.delete(`ideation_list:${userId}`);

        return { runId: sessionId, initialIdeaArtifacts };
    }

    // Create ideation run and generate plot (maps to /api/ideations/create_run_and_generate_plot)
    async createRunAndGeneratePlot(
        userId: string,
        userInput: string,
        selectedPlatform: string,
        genrePaths: string[][],
        genreProportions: number[],
        initialIdeas: string[],
        requirements: string,
        ideationTemplate: string
    ): Promise<{ runId: string; result: any }> {
        // Create ideation session and brainstorm params
        const sessionId = uuidv4();
        const sessionArtifact = await this.artifactRepo.createArtifact(
            userId,
            'ideation_session',
            {
                id: sessionId,
                status: 'active',
                created_at: new Date().toISOString()
            } as IdeationSessionV1
        );

        const paramsArtifact = await this.artifactRepo.createArtifact(
            userId,
            'brainstorm_params',
            {
                platform: selectedPlatform,
                genre_paths: genrePaths,
                genre_proportions: genreProportions,
                requirements
            } as BrainstormParamsV1
        );

        // Create initial ideas if provided
        const ideaArtifacts: Artifact[] = [];
        if (initialIdeas && initialIdeas.length > 0) {
            for (let i = 0; i < initialIdeas.length; i++) {
                const ideaArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'brainstorm_idea',
                    {
                        idea_text: initialIdeas[i],
                        order_index: i
                    } as BrainstormIdeaV1
                );
                ideaArtifacts.push(ideaArtifact);
            }
        }

        // Create user input artifact
        const userInputArtifact = await this.artifactRepo.createArtifact(
            userId,
            'user_input',
            {
                text: userInput,
                source: 'manual'
            } as UserInputV1
        );

        // Build genre string for prompt
        const buildGenrePromptString = (): string => {
            if (!genrePaths || genrePaths.length === 0) return '未指定';
            return genrePaths.map((path: string[], index: number) => {
                const proportion = genreProportions && genreProportions[index] !== undefined
                    ? genreProportions[index]
                    : (100 / genrePaths.length);
                const pathString = path.join(' > ');
                return genrePaths.length > 1
                    ? `${pathString} (${proportion.toFixed(0)}%)`
                    : pathString;
            }).join(', ');
        };

        const genrePromptString = buildGenrePromptString();

        // Execute LLM transform to generate plot
        const { outputArtifacts } = await this.transformExecutor.executeLLMTransform(
            userId,
            [paramsArtifact, userInputArtifact],
            ideationTemplate,
            {
                user_input: userInput,
                platform: selectedPlatform || '未指定',
                genre: genrePromptString || '未指定'
            },
            'deepseek-chat',
            'plot_outline'
        );

        const plotArtifact = outputArtifacts[0];
        const plotData = plotArtifact.data as PlotOutlineV1;

        return {
            runId: sessionId,
            result: {
                mediaType: plotData.media_type,
                platform: plotData.platform,
                plotOutline: plotData.plot_outline,
                analysis: plotData.analysis
            }
        };
    }

    // Validate session ownership helper
    private async validateSessionOwnership(userId: string, sessionId: string): Promise<any> {
        const sessionArtifacts = await this.artifactRepo.getArtifactsByType(userId, 'ideation_session');
        const sessionArtifact = sessionArtifacts.find(a => a.data.id === sessionId);

        if (!sessionArtifact) {
            throw new Error(`Ideation session ${sessionId} not found or not accessible by user ${userId}`);
        }

        return sessionArtifact;
    }

    // Helper to find related artifacts for a session
    private async getSessionRelatedArtifacts(userId: string, sessionArtifact: any): Promise<any[]> {
        const userTransforms = await this.transformRepo.getUserTransforms(userId);
        const relatedArtifactIds = new Set<string>();
        relatedArtifactIds.add(sessionArtifact.id);

        for (const transform of userTransforms) {
            const outputs = await this.transformRepo.getTransformOutputs(transform.id);
            const inputs = await this.transformRepo.getTransformInputs(transform.id);

            if (outputs.some(o => o.artifact_id === sessionArtifact.id)) {
                inputs.forEach(i => relatedArtifactIds.add(i.artifact_id));
                outputs.forEach(o => relatedArtifactIds.add(o.artifact_id));
            }

            if (inputs.some(i => relatedArtifactIds.has(i.artifact_id))) {
                outputs.forEach(o => relatedArtifactIds.add(o.artifact_id));
            }
        }

        return await this.artifactRepo.getArtifactsByIds([...relatedArtifactIds], userId);
    }

    // Get ideation run by ID (maps to /api/ideations/:id)
    async getIdeationRun(userId: string, sessionId: string): Promise<any | null> {
        // Check cache first
        const cacheKey = CacheService.ideationRunKey(userId, sessionId);
        const cached = this.cacheService.get<any>(cacheKey);

        if (cached) {
            return cached;
        }

        try {
            // Validate session ownership
            const sessionArtifact = await this.validateSessionOwnership(userId, sessionId);

            // Get related artifacts
            const relatedArtifacts = await this.getSessionRelatedArtifacts(userId, sessionArtifact);

            // Parse artifacts by type
            const brainstormParams = relatedArtifacts.find(a => a.type === 'brainstorm_params');
            const brainstormIdeas = relatedArtifacts
                .filter(a => a.type === 'brainstorm_idea')
                .sort((a, b) => a.data.order_index - b.data.order_index);
            const userInput = relatedArtifacts.find(a => a.type === 'user_input');
            const plotOutline = relatedArtifacts.find(a => a.type === 'plot_outline');

            // Reconstruct the original API response format
            const result = {
                id: sessionId,
                userInput: userInput?.data.text || '',
                selectedPlatform: brainstormParams?.data.platform || '',
                genrePaths: brainstormParams?.data.genre_paths || [],
                genreProportions: brainstormParams?.data.genre_proportions || [],
                initialIdeas: brainstormIdeas.map(idea => ({
                    title: idea.data.idea_title || '',
                    body: idea.data.idea_text
                })),
                initialIdeaArtifacts: brainstormIdeas.map(idea => ({
                    id: idea.id,
                    text: idea.data.idea_text,
                    title: idea.data.idea_title,
                    orderIndex: idea.data.order_index
                })),
                requirements: brainstormParams?.data.requirements || '',
                result: plotOutline ? {
                    mediaType: plotOutline.data.media_type,
                    platform: plotOutline.data.platform,
                    plotOutline: plotOutline.data.plot_outline,
                    analysis: plotOutline.data.analysis
                } : null,
                createdAt: sessionArtifact.created_at
            };

            // Cache the result (shorter TTL since data might change)
            this.cacheService.set(cacheKey, result, 2 * 60 * 1000); // 2 minutes

            return result;

        } catch (error) {
            if (error instanceof Error && error.message.includes('not found or not accessible')) {
                return null; // Return null for not found, let caller handle 404
            }
            throw error; // Re-throw other errors
        }
    }

    // List all ideation runs for a user (maps to /api/ideations)
    async listIdeationRuns(userId: string): Promise<any[]> {
        // Check cache first
        const cacheKey = `ideation_list:${userId}`;
        const cached = this.cacheService.get<any[]>(cacheKey);

        if (cached) {
            return cached;
        }

        // Get all session artifacts for the user
        const sessionArtifacts = await this.artifactRepo.getArtifactsByType(userId, 'ideation_session');

        const runs: any[] = [];

        for (const sessionArtifact of sessionArtifacts) {
            const sessionId = sessionArtifact.data.id;

            // Get minimal data for listing (just first 3 ideas, basic info)
            const userTransforms = await this.transformRepo.getUserTransforms(userId);
            const relatedArtifactIds = new Set<string>();
            relatedArtifactIds.add(sessionArtifact.id);

            // Find related artifacts (simplified for listing)
            for (const transform of userTransforms) {
                const outputs = await this.transformRepo.getTransformOutputs(transform.id);
                if (outputs.some(o => o.artifact_id === sessionArtifact.id)) {
                    const inputs = await this.transformRepo.getTransformInputs(transform.id);
                    inputs.forEach(i => relatedArtifactIds.add(i.artifact_id));
                    outputs.forEach(o => relatedArtifactIds.add(o.artifact_id));
                }
            }

            const relatedArtifacts = await this.artifactRepo.getArtifactsByIds([...relatedArtifactIds], userId);

            const brainstormParams = relatedArtifacts.find(a => a.type === 'brainstorm_params');
            const brainstormIdeas = relatedArtifacts.filter(a => a.type === 'brainstorm_idea')
                .sort((a, b) => a.data.order_index - b.data.order_index)
                .slice(0, 3); // Limit to first 3 for listing
            const userInput = relatedArtifacts.find(a => a.type === 'user_input');

            // Build genre prompt string
            const buildGenrePromptString = (params: any): string => {
                if (!params?.genre_paths || params.genre_paths.length === 0) return '未指定';
                return params.genre_paths.map((path: string[], index: number) => {
                    const proportion = params.genre_proportions && params.genre_proportions[index] !== undefined
                        ? params.genre_proportions[index]
                        : (100 / params.genre_paths.length);
                    const pathString = path.join(' > ');
                    return params.genre_paths.length > 1
                        ? `${pathString} (${proportion.toFixed(0)}%)`
                        : pathString;
                }).join(', ');
            };

            runs.push({
                id: sessionId,
                user_input: userInput?.data.text || '',
                selected_platform: brainstormParams?.data.platform || '',
                genre_prompt_string: buildGenrePromptString(brainstormParams?.data),
                genre_paths: brainstormParams?.data.genre_paths || [],
                genre_proportions: brainstormParams?.data.genre_proportions || [],
                initial_ideas: brainstormIdeas.map(idea => idea.data.idea_text),
                initial_idea_titles: brainstormIdeas.map(idea => idea.data.idea_title || ''),
                created_at: sessionArtifact.created_at
            });
        }

        const sortedRuns = runs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Cache the result (shorter TTL for listing)
        this.cacheService.set(cacheKey, sortedRuns, 1 * 60 * 1000); // 1 minute

        return sortedRuns;
    }

    // Delete ideation run (maps to /api/ideations/:id)
    async deleteIdeationRun(userId: string, sessionId: string): Promise<boolean> {
        // Find the session artifact
        const sessionArtifacts = await this.artifactRepo.getArtifactsByType(userId, 'ideation_session');
        const sessionArtifact = sessionArtifacts.find(a => a.data.id === sessionId);

        if (!sessionArtifact) {
            return false;
        }

        // Note: In a production system, we might want to mark artifacts as deleted rather than actually deleting them
        // For now, we'll delete the session artifact (related artifacts will remain for traceability)
        return await this.artifactRepo.deleteArtifact(sessionArtifact.id, userId);
    }

    // Generate plot for existing run (maps to /api/ideations/:id/generate_plot)
    async generatePlotForRun(
        userId: string,
        sessionId: string,
        userInput: string,
        ideationTemplate: string
    ): Promise<any> {
        // Validate inputs
        if (!userInput.trim()) {
            throw new Error('User input cannot be empty');
        }
        if (!ideationTemplate.trim()) {
            throw new Error('Ideation template cannot be empty');
        }

        try {
            // Validate session ownership
            const sessionArtifact = await this.validateSessionOwnership(userId, sessionId);

            // Get related artifacts to find brainstorm params
            const relatedArtifacts = await this.getSessionRelatedArtifacts(userId, sessionArtifact);
            const brainstormParams = relatedArtifacts.find(a => a.type === 'brainstorm_params');

            if (!brainstormParams) {
                throw new Error('Brainstorm parameters not found for this session');
            }

            // Create new user input artifact
            const userInputArtifact = await this.artifactRepo.createArtifact(
                userId,
                'user_input',
                {
                    text: userInput,
                    source: 'manual'
                } as UserInputV1
            );

            // Build genre string for prompt
            const buildGenrePromptString = (): string => {
                const params = brainstormParams.data;
                if (!params.genre_paths || params.genre_paths.length === 0) return '未指定';
                return params.genre_paths.map((path: string[], index: number) => {
                    const proportion = params.genre_proportions && params.genre_proportions[index] !== undefined
                        ? params.genre_proportions[index]
                        : (100 / params.genre_paths.length);
                    const pathString = path.join(' > ');
                    return params.genre_paths.length > 1
                        ? `${pathString} (${proportion.toFixed(0)}%)`
                        : pathString;
                }).join(', ');
            };

            const genrePromptString = buildGenrePromptString();

            // Execute LLM transform to generate plot
            const { outputArtifacts } = await this.transformExecutor.executeLLMTransform(
                userId,
                [brainstormParams, userInputArtifact],
                ideationTemplate,
                {
                    user_input: userInput,
                    platform: brainstormParams.data.platform || '未指定',
                    genre: genrePromptString || '未指定'
                },
                'deepseek-chat',
                'plot_outline'
            );

            const plotArtifact = outputArtifacts[0];
            const plotData = plotArtifact.data as PlotOutlineV1;

            return {
                result: {
                    mediaType: plotData.media_type,
                    platform: plotData.platform,
                    plotOutline: plotData.plot_outline,
                    analysis: plotData.analysis
                }
            };

        } catch (error) {
            console.error(`Error generating plot for session ${sessionId}:`, error);
            throw error;
        }
    }

    // Streaming version for plot generation
    async generatePlotForRunStream(
        userId: string,
        sessionId: string,
        userInput: string,
        ideationTemplate: string
    ) {
        // Validate inputs
        if (!userInput.trim()) {
            throw new Error('User input cannot be empty');
        }
        if (!ideationTemplate.trim()) {
            throw new Error('Ideation template cannot be empty');
        }

        // Validate session ownership
        const sessionArtifact = await this.validateSessionOwnership(userId, sessionId);

        // Get related artifacts to find brainstorm params
        const relatedArtifacts = await this.getSessionRelatedArtifacts(userId, sessionArtifact);
        const brainstormParams = relatedArtifacts.find(a => a.type === 'brainstorm_params');

        if (!brainstormParams) {
            throw new Error('Brainstorm parameters not found for this session');
        }

        // Create new user input artifact
        const userInputArtifact = await this.artifactRepo.createArtifact(
            userId,
            'user_input',
            {
                text: userInput,
                source: 'manual'
            } as UserInputV1
        );

        // Build genre string for prompt
        const buildGenrePromptString = (): string => {
            const params = brainstormParams.data;
            if (!params.genre_paths || params.genre_paths.length === 0) return '未指定';
            return params.genre_paths.map((path: string[], index: number) => {
                const proportion = params.genre_proportions && params.genre_proportions[index] !== undefined
                    ? params.genre_proportions[index]
                    : (100 / params.genre_paths.length);
                const pathString = path.join(' > ');
                return params.genre_paths.length > 1
                    ? `${pathString} (${proportion.toFixed(0)}%)`
                    : pathString;
            }).join(', ');
        };

        const genrePromptString = buildGenrePromptString();

        // Execute streaming LLM transform to generate plot
        return this.transformExecutor.executeLLMTransformStream(
            userId,
            [brainstormParams, userInputArtifact],
            ideationTemplate,
            {
                user_input: userInput,
                platform: brainstormParams.data.platform || '未指定',
                genre: genrePromptString || '未指定'
            },
            'deepseek-chat',
            'plot_outline'
        );
    }
} 