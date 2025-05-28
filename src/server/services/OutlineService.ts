import { v4 as uuidv4 } from 'uuid';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformExecutor } from './TransformExecutor';
import { CacheService } from './CacheService';
import {
    Artifact,
    OutlineSessionV1,
    OutlineTitleV1,
    OutlineGenreV1,
    OutlineSellingPointsV1,
    OutlineSettingV1,
    OutlineSynopsisV1,
    UserInputV1
} from '../types/artifacts';

// Response interfaces
export interface OutlineSessionData {
    sessionId: string;
    ideationSessionId: string;
    status: 'active' | 'completed';
    userInput?: string;
    outline?: {
        title: string;
        genre: string;
        sellingPoints: string;
        setting: string;
        synopsis: string;
    };
    createdAt: string;
}

export interface OutlineSessionSummary {
    id: string;
    ideationSessionId: string;
    status: 'active' | 'completed';
    title?: string;
    createdAt: string;
}

export class OutlineService {
    constructor(
        private artifactRepo: ArtifactRepository,
        private transformExecutor: TransformExecutor,
        private cacheService: CacheService
    ) { }

    // Generate outline from story inspiration artifact
    async generateOutlineFromArtifact(
        userId: string,
        sourceArtifactId: string,
        totalEpisodes?: number,
        episodeDuration?: number
    ): Promise<{ outlineSessionId: string; artifacts: Artifact[] }> {
        // Get and validate source artifact (either brainstorm_idea or user_input)
        const sourceArtifact = await this.artifactRepo.getArtifact(sourceArtifactId, userId);

        if (!sourceArtifact) {
            throw new Error('Source artifact not found or access denied');
        }

        // Validate artifact type
        if (!['brainstorm_idea', 'user_input'].includes(sourceArtifact.type)) {
            throw new Error('Invalid source artifact type. Must be brainstorm_idea or user_input');
        }

        // Extract user input text from artifact
        const userInput = sourceArtifact.data.text || sourceArtifact.data.idea_text;
        if (!userInput || !userInput.trim()) {
            throw new Error('Source artifact contains no text content');
        }

        // Create outline session
        const outlineSessionId = uuidv4();
        const outlineSessionArtifact = await this.artifactRepo.createArtifact(
            userId,
            'outline_session',
            {
                id: outlineSessionId,
                ideation_session_id: 'artifact-based', // Legacy field, not used in new flow
                status: 'active',
                created_at: new Date().toISOString()
            } as OutlineSessionV1
        );

        // Use the source artifact directly as input for the transform

        // Design LLM prompt for outline generation
        const outlinePrompt = this.buildOutlinePrompt(userInput, totalEpisodes, episodeDuration);

        // Execute LLM transform to generate outline
        const { outputArtifacts } = await this.transformExecutor.executeLLMTransform(
            userId,
            [outlineSessionArtifact, sourceArtifact],
            outlinePrompt,
            {
                user_input: userInput,
                source_artifact_id: sourceArtifactId
            },
            'deepseek-chat',
            'outline_components'
        );

        // The transform executor now creates individual component artifacts
        // We just need to update the outline session status to completed
        await this.artifactRepo.createArtifact(
            userId,
            'outline_session',
            {
                id: outlineSessionId,
                ideation_session_id: 'artifact-based', // Legacy field, not used in new flow
                status: 'completed',
                created_at: new Date().toISOString()
            } as OutlineSessionV1
        );

        return {
            outlineSessionId,
            artifacts: outputArtifacts
        };
    }

    // Get outline session data
    async getOutlineSession(
        userId: string,
        outlineSessionId: string
    ): Promise<OutlineSessionData | null> {
        // Check cache first
        const cacheKey = `outline_session:${userId}:${outlineSessionId}`;
        const cached = this.cacheService.get<OutlineSessionData>(cacheKey);
        if (cached) {
            return cached;
        }

        // Get outline session artifact
        const sessionArtifacts = await this.artifactRepo.getArtifactsByTypeForSession(
            userId,
            'outline_session',
            outlineSessionId
        );

        if (!sessionArtifacts || sessionArtifacts.length === 0) {
            return null;
        }

        // Get the latest session artifact (completed status if available)
        const sessionArtifact = sessionArtifacts
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        const sessionData = sessionArtifact.data as OutlineSessionV1;

        // Get user input for this session
        const userInputArtifacts = await this.getLatestUserInputForSession(
            userId,
            outlineSessionId
        );
        const userInput = userInputArtifacts?.data?.text;

        // Get outline components
        const outline = await this.getOutlineComponents(userId, outlineSessionId);

        const result: OutlineSessionData = {
            sessionId: outlineSessionId,
            ideationSessionId: sessionData.ideation_session_id,
            status: sessionData.status,
            userInput,
            outline,
            createdAt: sessionData.created_at
        };

        // Cache for 5 minutes
        this.cacheService.set(cacheKey, result, 5 * 60 * 1000);
        return result;
    }

    // List user's outline sessions
    async listOutlineSessions(userId: string): Promise<OutlineSessionSummary[]> {
        const sessionArtifacts = await this.artifactRepo.getArtifactsByType(
            userId,
            'outline_session'
        );

        // Group by session ID and get latest status for each
        const sessionMap = new Map<string, OutlineSessionV1>();
        sessionArtifacts.forEach(artifact => {
            const data = artifact.data as OutlineSessionV1;
            const existing = sessionMap.get(data.id);
            if (!existing || new Date(artifact.created_at) > new Date(existing.created_at)) {
                sessionMap.set(data.id, data);
            }
        });

        // Convert to summary format
        const summaries: OutlineSessionSummary[] = [];

        // Get all user artifacts once for efficiency
        const allArtifacts = await this.artifactRepo.getUserArtifacts(userId);

        for (const [sessionId, sessionData] of sessionMap) {
            // Get title from outline components using time-based approach
            let title: string | undefined = undefined;

            try {
                const sessionCreationTime = new Date(sessionData.created_at).getTime();
                const timeWindow = 5 * 60 * 1000; // 5 minutes

                // Find outline title created around the same time as the session
                const titleArtifact = allArtifacts.find(artifact => {
                    const artifactTime = new Date(artifact.created_at).getTime();
                    const timeDiff = Math.abs(artifactTime - sessionCreationTime);

                    return timeDiff <= timeWindow && artifact.type === 'outline_title';
                });

                if (titleArtifact) {
                    title = (titleArtifact.data as OutlineTitleV1).title;
                }
            } catch (error) {
                console.error(`Error getting title for session ${sessionId}:`, error);
            }

            summaries.push({
                id: sessionId,
                ideationSessionId: sessionData.ideation_session_id,
                status: sessionData.status,
                title,
                createdAt: sessionData.created_at
            });
        }

        // Sort by creation date (newest first)
        return summaries.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
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

    // Private helper methods
    private buildOutlinePrompt(userInput: string, totalEpisodes?: number, episodeDuration?: number): string {
        const episodeInfo = (totalEpisodes && episodeDuration)
            ? `\n\n剧集信息：\n- 总集数：${totalEpisodes}集\n- 每集时长：约${episodeDuration}分钟`
            : '';

        return `你是一位深耕短剧创作的资深编剧，尤其擅长创作引人入胜、节奏明快、反转强烈的爆款短剧。
根据用户提供的故事灵感，请创作一个**单集完结**的短剧大纲。${episodeInfo}

故事灵感：${userInput}

请严格按照以下要求和JSON格式输出：

1.  **剧名 (title)**: 一个极具吸引力、能瞬间抓住眼球的短剧标题，精准概括核心看点。
2.  **题材类型 (genre)**: 明确的短剧类型（例如：都市爽文、逆袭复仇、甜宠虐恋、战神归来、古装宫斗等常见短剧热门题材）。
3.  **核心看点/爽点 (selling_points)**: 列出3-5个最能激发观众情绪、构成"爽点"的核心情节或元素。例如：身份反转、打脸虐渣、绝境逢生、意外获得超能力、关键时刻英雄救美/美救英雄等。
4.  **故事设定 (setting)**:
    *   **一句话核心设定**: 用一句话概括故事发生的核心背景和主要人物关系。
    *   **关键场景**: 2-3个推动剧情发展的核心场景。
5.  **主要人物 (main_characters)**:
    *   **主角**: 姓名，一句话性格特征及核心目标/困境。
    *   **核心对手/情感对象**: 姓名，一句话性格特征及与主角的关系。
    *   *(可选) 其他关键配角 (1名以内)*: 姓名，及其对剧情的关键作用。
6.  **完整故事梗概 (synopsis)**: **一个详细且连贯的故事梗概**，描述主要情节、关键事件、核心冲突的发展，以及故事的最终结局。请用自然流畅的段落撰写，体现故事的吸引力。

**短剧创作核心要求 (非常重要！):**
-   **节奏极快**: 剧情推进迅速，不拖沓，每一分钟都要有信息量或情绪点。
-   **冲突强烈**: 核心矛盾要直接、尖锐，能迅速抓住观众。
-   **反转惊人**: 设计至少1-2个出人意料的情节反转。
-   **情绪到位**: 准确拿捏观众的情绪，如愤怒、喜悦、紧张、同情等，并快速给予满足（如"打脸"情节）。
-   **人物鲜明**: 主角和核心对手的人物性格和动机要清晰、极致。
-   **结局爽快**: 结局要干脆利落，给观众明确的情感释放。
-   **紧扣灵感**: 所有设计必须围绕原始故事灵感展开，并将其特点放大。
-   **避免"电影感"**: 不要追求复杂的叙事结构、过多的角色内心戏或宏大的世界观。专注于简单直接、冲击力强的单集故事。

请以JSON格式返回，字段如下：
{
  "title": "[string] 剧名",
  "genre": "[string] 题材类型",
  "selling_points": ["[string] 核心看点1", "[string] 核心看点2", "[string] 核心看点3"],
  "setting": {
    "core_setting_summary": "[string] 一句话核心设定",
    "key_scenes": ["[string] 关键场景1", "[string] 关键场景2"]
  },
  "main_characters": {
    "protagonist": { "name": "[string]", "description": "[string] 性格特征及核心目标/困境" },
    "antagonist_or_love_interest": { "name": "[string]", "description": "[string] 性格特征及与主角的关系" },
    "other_key_character": { "name": "[string, 可选]", "role": "[string, 可选]" }
  },
  "synopsis": "[string] 详细的、包含主要情节/关键事件/核心冲突发展和结局的故事梗概。"
}`;
    }

    private parseOutlineResponse(rawData: any): any {
        // Handle both direct JSON response and nested response formats
        let outlineData = rawData;

        if (typeof rawData === 'string') {
            try {
                outlineData = JSON.parse(rawData);
            } catch (e) {
                throw new Error('Invalid JSON response from LLM');
            }
        }

        // Validate required fields based on the new structure
        if (!outlineData.title || typeof outlineData.title !== 'string') {
            throw new Error('Missing or invalid field: title');
        }
        if (!outlineData.genre || typeof outlineData.genre !== 'string') {
            throw new Error('Missing or invalid field: genre');
        }
        if (!outlineData.selling_points || !Array.isArray(outlineData.selling_points) || !outlineData.selling_points.every((sp: any) => typeof sp === 'string')) {
            throw new Error('Missing or invalid field: selling_points');
        }
        if (!outlineData.setting || typeof outlineData.setting !== 'object' ||
            !outlineData.setting.core_setting_summary || typeof outlineData.setting.core_setting_summary !== 'string' ||
            !outlineData.setting.key_scenes || !Array.isArray(outlineData.setting.key_scenes) || !outlineData.setting.key_scenes.every((ks: any) => typeof ks === 'string')) {
            throw new Error('Missing or invalid field: setting');
        }

        // Validate main_characters object and its primary fields
        if (!outlineData.main_characters || typeof outlineData.main_characters !== 'object' ||
            !outlineData.main_characters.protagonist || typeof outlineData.main_characters.protagonist !== 'object' ||
            !outlineData.main_characters.protagonist.name || typeof outlineData.main_characters.protagonist.name !== 'string' ||
            !outlineData.main_characters.protagonist.description || typeof outlineData.main_characters.protagonist.description !== 'string' ||
            !outlineData.main_characters.antagonist_or_love_interest || typeof outlineData.main_characters.antagonist_or_love_interest !== 'object' ||
            !outlineData.main_characters.antagonist_or_love_interest.name || typeof outlineData.main_characters.antagonist_or_love_interest.name !== 'string' ||
            !outlineData.main_characters.antagonist_or_love_interest.description || typeof outlineData.main_characters.antagonist_or_love_interest.description !== 'string') {
            throw new Error('Missing or invalid field in main_characters: protagonist or antagonist_or_love_interest structure is invalid.');
        }

        // Validate optional other_key_character if it exists
        if (outlineData.main_characters.other_key_character) {
            const otherChar = outlineData.main_characters.other_key_character;

            // It must be an object if it exists
            if (typeof otherChar !== 'object' || otherChar === null) {
                throw new Error('Invalid field: main_characters.other_key_character must be an object if present.');
            }

            const hasName = otherChar.hasOwnProperty('name');
            const hasRole = otherChar.hasOwnProperty('role');

            // If name or role is undefined (but key exists), or if they are not strings, and not the placeholder/null values, it's an error.
            const nameIsPlaceholder = otherChar.name === '[string, 可选]';
            const roleIsPlaceholder = otherChar.role === '[string, 可选]';
            const nameIsNull = otherChar.name === null;
            const roleIsNull = otherChar.role === null;

            const nameIsValidString = typeof otherChar.name === 'string';
            const roleIsValidString = typeof otherChar.role === 'string';

            // Valid states for otherChar: 
            // 1. name and role are valid strings.
            // 2. name/role are the placeholder strings.
            // 3. name/role are explicitly null.
            // 4. The entire other_key_character field is absent (handled by the outer if).

            let isValidOtherChar = false;
            if (nameIsValidString && roleIsValidString && !nameIsPlaceholder && !roleIsPlaceholder && !nameIsNull && !roleIsNull) {
                isValidOtherChar = true; // Actual values provided
            } else if (nameIsPlaceholder && roleIsPlaceholder) {
                isValidOtherChar = true; // Both are placeholders
            } else if (nameIsNull && roleIsNull) {
                isValidOtherChar = true; // Both are null
            }

            if (!isValidOtherChar) {
                // This will catch cases like: one is placeholder/null and other is not, or types are wrong and not placeholder/null.
                // Or if one property is missing entirely.
                if (!hasName || !hasRole) {
                    throw new Error('Invalid field: main_characters.other_key_character must have both name and role properties if the object exists.');
                }
                throw new Error('Invalid field: main_characters.other_key_character has invalid name/role. They must be strings, or both be placeholder values, or both be null.');
            }
        }

        if (!outlineData.synopsis || typeof outlineData.synopsis !== 'string' || !outlineData.synopsis.trim()) {
            throw new Error('Missing or invalid field: synopsis must be a non-empty string.');
        }

        // Return the structured data directly. Consumers will adapt.
        return outlineData;
    }

    private async getOutlineComponents(
        userId: string,
        outlineSessionId: string
    ): Promise<{
        title: string;
        genre: string;
        sellingPoints: string;
        setting: string;
        synopsis: string;
    } | undefined> {
        try {
            // Find outline components by looking at transforms that have the outline session as input
            // and produced outline component artifacts as output

            // First, get the outline session artifact
            const sessionArtifacts = await this.artifactRepo.getArtifactsByTypeForSession(
                userId,
                'outline_session',
                outlineSessionId
            );

            if (sessionArtifacts.length === 0) {
                return undefined;
            }

            // Get all user artifacts and filter for outline components created around the same time
            const allArtifacts = await this.artifactRepo.getUserArtifacts(userId);

            // Find the session creation time
            const sessionCreationTime = new Date(sessionArtifacts[0].created_at).getTime();

            // Look for outline components created within a reasonable time window (5 minutes)
            const timeWindow = 5 * 60 * 1000; // 5 minutes in milliseconds

            const outlineComponents = allArtifacts.filter(artifact => {
                const artifactTime = new Date(artifact.created_at).getTime();
                const timeDiff = Math.abs(artifactTime - sessionCreationTime);

                return timeDiff <= timeWindow && [
                    'outline_title',
                    'outline_genre',
                    'outline_selling_points',
                    'outline_setting',
                    'outline_synopsis'
                ].includes(artifact.type);
            });

            // Group by type
            const componentsByType = outlineComponents.reduce((acc, artifact) => {
                acc[artifact.type] = artifact;
                return acc;
            }, {} as Record<string, any>);

            // Check if we have all required components
            const requiredTypes = ['outline_title', 'outline_genre', 'outline_selling_points', 'outline_setting', 'outline_synopsis'];
            const hasAllComponents = requiredTypes.every(type => componentsByType[type]);

            if (!hasAllComponents) {
                console.log('Missing outline components:', requiredTypes.filter(type => !componentsByType[type]));
                return undefined;
            }

            return {
                title: (componentsByType['outline_title'].data as OutlineTitleV1).title,
                genre: (componentsByType['outline_genre'].data as OutlineGenreV1).genre,
                sellingPoints: (componentsByType['outline_selling_points'].data as OutlineSellingPointsV1).selling_points,
                setting: (componentsByType['outline_setting'].data as OutlineSettingV1).setting,
                synopsis: (componentsByType['outline_synopsis'].data as OutlineSynopsisV1).synopsis
            };
        } catch (error) {
            console.error('Error fetching outline components:', error);
            return undefined;
        }
    }
} 