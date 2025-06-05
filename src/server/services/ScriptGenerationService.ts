import { ArtifactRepository } from '../repositories/ArtifactRepository.js';
import { TransformRepository } from '../repositories/TransformRepository.js';
import { StreamingTransformExecutor } from './streaming/StreamingTransformExecutor.js';
import { TemplateService } from './templates/TemplateService.js';
import { EpisodeSynopsisV1, PlotOutlineV1, BrainstormParamsV1, OutlineJobParamsV1 } from '../types/artifacts.js';
import { EpisodeScriptV1 } from '../../common/streaming/types.js';

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
        // Get episode synopsis artifact that matches the episodeId and stageId
        const episodeSynopsisArtifacts = await this.artifactRepo.getArtifactsByType(
            userId,
            'episode_synopsis'
        );

        // Filter by episodeId (episodeNumber) and find the one that belongs to the correct stage
        const matchingEpisode = episodeSynopsisArtifacts.find(artifact => {
            const synopsisData = artifact.data as EpisodeSynopsisV1;
            return synopsisData.episodeNumber.toString() === episodeId;
        });

        if (!matchingEpisode) {
            throw new Error(`Episode synopsis not found for episode ${episodeId}`);
        }

        const latestSynopsis = matchingEpisode;

        // Get cascaded parameters
        const cascadedParams = await this.getCascadedParams(userId, stageId);

        // Get outline character information  
        const characterArtifacts = await this.artifactRepo.getArtifactsByType(
            userId,
            'outline_characters'
        );

        let charactersInfo = '';
        if (characterArtifacts.length > 0) {
            const latestCharacters = characterArtifacts
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            
            // Import the type from common/types
            const charactersData = latestCharacters.data as any;
            
            if (charactersData.characters && charactersData.characters.length > 0) {
                charactersInfo = charactersData.characters.map((char: any) => 
                    `**${char.name}** (${char.type}): ${char.description}`
                ).join('\n');
            }
        }

        // Prepare template parameters
        const templateParams = {
            ...cascadedParams,
            episode_synopsis: JSON.stringify(latestSynopsis.data),
            characters_info: charactersInfo,
            user_requirements: userRequirements || '无特殊要求',
            episode_number: parseInt(episodeId)
        };

        // Generate session ID
        const sessionId = `script-${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

        // Execute streaming script generation job
        const result = await this.streamingExecutor.startScriptGenerationJob(
            userId,
            templateParams
        );

        return {
            transformId: result.transformId,
            sessionId: result.scriptSessionId
        };
    }

    async getGeneratedScript(
        userId: string,
        episodeId: string,
        stageId: string
    ): Promise<EpisodeScriptV1 | null> {
        const scriptArtifacts = await this.artifactRepo.getArtifactsByType(
            userId,
            'episode_script'
        );

        // Filter by episodeNumber to find the script for this specific episode
        const matchingScript = scriptArtifacts.find(artifact => {
            const scriptData = artifact.data as EpisodeScriptV1;
            return scriptData.episodeNumber.toString() === episodeId;
        });

        if (!matchingScript) {
            return null;
        }

        return matchingScript.data as EpisodeScriptV1;
    }

    async checkScriptExists(
        userId: string,
        episodeId: string,
        stageId: string
    ): Promise<boolean> {
        const scriptArtifacts = await this.artifactRepo.getArtifactsByType(
            userId,
            'episode_script'
        );

        // Check if there's a script for this specific episode
        const matchingScript = scriptArtifacts.find(artifact => {
            const scriptData = artifact.data as EpisodeScriptV1;
            return scriptData.episodeNumber.toString() === episodeId;
        });

        return !!matchingScript;
    }

    private async getCascadedParams(userId: string, stageId: string) {
        // Get brainstorm params
        const brainstormParamsArtifacts = await this.artifactRepo.getArtifactsByType(userId, 'brainstorm_params');
        let brainstormParams: BrainstormParamsV1 | null = null;
        
        if (brainstormParamsArtifacts.length > 0) {
            const latest = brainstormParamsArtifacts
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            brainstormParams = latest.data as BrainstormParamsV1;
        }

        // Get outline job params
        const outlineJobParamsArtifacts = await this.artifactRepo.getArtifactsByType(
            userId,
            'outline_job_params'
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