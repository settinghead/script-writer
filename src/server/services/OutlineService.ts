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
        sourceArtifactId: string
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
        const outlinePrompt = this.buildOutlinePrompt(userInput);

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
        for (const [sessionId, sessionData] of sessionMap) {
            // Get title from outline components if available
            const titleArtifacts = await this.artifactRepo.getArtifactsByTypeForSession(
                userId,
                'outline_title',
                sessionId
            );
            const title = titleArtifacts.length > 0 ?
                (titleArtifacts[0].data as OutlineTitleV1).title : undefined;

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
    private buildOutlinePrompt(userInput: string): string {
        return `你是一个专业的编剧和故事开发专家。根据用户提供的故事灵感，请生成一个完整的故事大纲，包含以下5个组成部分：

故事灵感：${userInput}

请生成以下内容：
1. 剧名：一个吸引人的标题，体现故事的核心主题
2. 题材类型：明确的类型分类（如悬疑、爱情、职场、古装等）
3. 项目卖点/爽点：这个故事最吸引观众的地方，能让人产生情感共鸣的核心卖点
4. 故事设定：时间、地点、背景环境等基本设定
5. 故事梗概：完整的故事梗概，包含起承转合，主要人物，核心冲突和结局

要求：
- 内容要具体、详细，避免空洞的描述
- 每个部分都要紧密围绕原始灵感展开
- 故事要有完整的逻辑链条和情感弧线
- 适合短视频/短剧的制作需求

请以JSON格式返回，字段如下：
{
  "title": "剧名",
  "genre": "题材类型",
  "selling_points": "项目卖点/爽点",
  "setting": "故事设定", 
  "synopsis": "故事梗概"
}`;
    }

    private parseOutlineResponse(rawData: any): {
        title: string;
        genre: string;
        selling_points: string;
        setting: string;
        synopsis: string;
    } {
        // Handle both direct JSON response and nested response formats
        let outlineData = rawData;

        if (typeof rawData === 'string') {
            try {
                outlineData = JSON.parse(rawData);
            } catch (e) {
                throw new Error('Invalid JSON response from LLM');
            }
        }

        // Validate required fields
        const requiredFields = ['title', 'genre', 'selling_points', 'setting', 'synopsis'];
        for (const field of requiredFields) {
            if (!outlineData[field] || typeof outlineData[field] !== 'string') {
                throw new Error(`Missing or invalid field: ${field}`);
            }
        }

        return {
            title: outlineData.title.trim(),
            genre: outlineData.genre.trim(),
            selling_points: outlineData.selling_points.trim(),
            setting: outlineData.setting.trim(),
            synopsis: outlineData.synopsis.trim()
        };
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