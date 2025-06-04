import { ArtifactRepository } from '../repositories/ArtifactRepository.js';
import { TransformRepository } from '../repositories/TransformRepository.js';
import { StreamingTransformExecutor } from './streaming/StreamingTransformExecutor.js';
import { TemplateService } from './templates/TemplateService.js';
import { EpisodeSynopsisV1, OutlineV1, BrainstormParamsV1, OutlineJobParamsV1, EpisodeScriptV1 } from '../../common/streaming/types.js';

export class ScriptGenerationService {
    constructor(
        private artifactRepo: ArtifactRepository,
        private transformRepo: TransformRepository,
        private streamingExecutor: StreamingTransformExecutor,
        private templateService: TemplateService
    ) {}

    async generateScript(
        userId: string,
        episodeId: string,
        stageId: string,
        userRequirements?: string
    ): Promise<{ transformId: string; sessionId: string }> {
        // Get episode synopsis artifact
        const episodeSynopsisArtifacts = await this.artifactRepo.findByContext(
            userId,
            'episode_synopsis',
            { episodeId, stageId }
        );

        if (episodeSynopsisArtifacts.length === 0) {
            throw new Error('Episode synopsis not found');
        }

        const latestSynopsis = episodeSynopsisArtifacts
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        // Get cascaded parameters
        const cascadedParams = await this.getCascadedParams(userId, stageId);

        // Get outline for character information
        const outlineArtifacts = await this.artifactRepo.findByContext(
            userId,
            'outline',
            { stageId }
        );

        let charactersInfo = '';
        if (outlineArtifacts.length > 0) {
            const latestOutline = outlineArtifacts
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            const outlineData = latestOutline.data as OutlineV1;
            
            if (outlineData.characters && outlineData.characters.length > 0) {
                charactersInfo = outlineData.characters.map(char => 
                    `**${char.name}** (${char.type}): ${char.description}`
                ).join('\n');
            }
        }

        // Prepare template parameters
        const templateParams = {
            ...cascadedParams,
            episode_synopsis: JSON.stringify(latestSynopsis.data),
            characters_info: charactersInfo,
            user_requirements: userRequirements || '无特殊要求'
        };

        // Generate session ID
        const sessionId = `script-${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

        // Execute streaming transform
        const result = await this.streamingExecutor.executeStreamingTransform({
            userId,
            templateId: 'script_generation',
            inputArtifactIds: [latestSynopsis.id],
            outputType: 'episode_script',
            outputContext: {
                episodeId,
                stageId,
                sessionId,
                episodeSynopsisArtifactId: latestSynopsis.id
            },
            templateParams,
            sessionId
        });

        return {
            transformId: result.transformId,
            sessionId
        };
    }

    async getGeneratedScript(
        userId: string,
        episodeId: string,
        stageId: string
    ): Promise<EpisodeScriptV1 | null> {
        const scriptArtifacts = await this.artifactRepo.findByContext(
            userId,
            'episode_script',
            { episodeId, stageId }
        );

        if (scriptArtifacts.length === 0) {
            return null;
        }

        // Get the latest script
        const latestScript = scriptArtifacts
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        return latestScript.data as EpisodeScriptV1;
    }

    async checkScriptExists(
        userId: string,
        episodeId: string,
        stageId: string
    ): Promise<boolean> {
        const scriptArtifacts = await this.artifactRepo.findByContext(
            userId,
            'episode_script',
            { episodeId, stageId }
        );

        return scriptArtifacts.length > 0;
    }

    private async getCascadedParams(userId: string, stageId: string) {
        // Get brainstorm params
        const brainstormParamsArtifacts = await this.artifactRepo.findByType(userId, 'brainstorm_params');
        let brainstormParams: BrainstormParamsV1 | null = null;
        
        if (brainstormParamsArtifacts.length > 0) {
            const latest = brainstormParamsArtifacts
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            brainstormParams = latest.data as BrainstormParamsV1;
        }

        // Get outline job params
        const outlineJobParamsArtifacts = await this.artifactRepo.findByContext(
            userId,
            'outline_job_params',
            { stageId }
        );
        let outlineJobParams: OutlineJobParamsV1 | null = null;

        if (outlineJobParamsArtifacts.length > 0) {
            const latest = outlineJobParamsArtifacts
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            outlineJobParams = latest.data as OutlineJobParamsV1;
        }

        // Combine parameters
        const cascadedParams = {
            platform: brainstormParams?.platform || 'unknown',
            genre_paths: brainstormParams?.genre_paths || [],
            genre_proportions: brainstormParams?.genre_proportions || [],
            requirements: brainstormParams?.requirements || '',
            totalEpisodes: outlineJobParams?.totalEpisodes || 10,
            episodeDuration: outlineJobParams?.episodeDuration || 3
        };

        return cascadedParams;
    }
} 