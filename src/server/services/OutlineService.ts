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

    // Generate outline from ideation session
    async generateOutlineFromIdeation(
        userId: string,
        ideationSessionId: string,
        userInput: string
    ): Promise<{ outlineSessionId: string; artifacts: Artifact[] }> {
        // Validate ideation session exists and belongs to user
        const ideationSession = await this.artifactRepo.getArtifactsByTypeForSession(
            userId,
            'ideation_session',
            ideationSessionId
        );

        if (!ideationSession || ideationSession.length === 0) {
            throw new Error('Ideation session not found or access denied');
        }

        // Create outline session
        const outlineSessionId = uuidv4();
        const outlineSessionArtifact = await this.artifactRepo.createArtifact(
            userId,
            'outline_session',
            {
                id: outlineSessionId,
                ideation_session_id: ideationSessionId,
                status: 'active',
                created_at: new Date().toISOString()
            } as OutlineSessionV1
        );

        // Create or get user input artifact for this user input
        const userInputArtifact = await this.artifactRepo.createArtifact(
            userId,
            'user_input',
            {
                text: userInput,
                source: 'manual'
            } as UserInputV1
        );

        // Design LLM prompt for outline generation
        const outlinePrompt = this.buildOutlinePrompt(userInput);

        // Execute LLM transform to generate outline
        const { outputArtifacts } = await this.transformExecutor.executeLLMTransform(
            userId,
            [outlineSessionArtifact, userInputArtifact],
            outlinePrompt,
            {
                user_input: userInput,
                ideation_session_id: ideationSessionId
            },
            'deepseek-chat',
            'outline_components'
        );

        // Parse and create the 5 outline artifacts
        const llmResponse = outputArtifacts[0];
        const outlineData = this.parseOutlineResponse(llmResponse.data);

        // Create individual outline component artifacts
        const titleArtifact = await this.artifactRepo.createArtifact(
            userId,
            'outline_title',
            { title: outlineData.title } as OutlineTitleV1
        );

        const genreArtifact = await this.artifactRepo.createArtifact(
            userId,
            'outline_genre',
            { genre: outlineData.genre } as OutlineGenreV1
        );

        const sellingPointsArtifact = await this.artifactRepo.createArtifact(
            userId,
            'outline_selling_points',
            { selling_points: outlineData.selling_points } as OutlineSellingPointsV1
        );

        const settingArtifact = await this.artifactRepo.createArtifact(
            userId,
            'outline_setting',
            { setting: outlineData.setting } as OutlineSettingV1
        );

        const synopsisArtifact = await this.artifactRepo.createArtifact(
            userId,
            'outline_synopsis',
            { synopsis: outlineData.synopsis } as OutlineSynopsisV1
        );

        // Update outline session status to completed
        await this.artifactRepo.createArtifact(
            userId,
            'outline_session',
            {
                id: outlineSessionId,
                ideation_session_id: ideationSessionId,
                status: 'completed',
                created_at: new Date().toISOString()
            } as OutlineSessionV1
        );

        return {
            outlineSessionId,
            artifacts: [
                titleArtifact,
                genreArtifact,
                sellingPointsArtifact,
                settingArtifact,
                synopsisArtifact
            ]
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
        const userInputArtifacts = await this.artifactRepo.getLatestUserInputForSession(
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
            const [titleArtifacts, genreArtifacts, sellingPointsArtifacts, settingArtifacts, synopsisArtifacts] =
                await Promise.all([
                    this.artifactRepo.getArtifactsByTypeForSession(userId, 'outline_title', outlineSessionId),
                    this.artifactRepo.getArtifactsByTypeForSession(userId, 'outline_genre', outlineSessionId),
                    this.artifactRepo.getArtifactsByTypeForSession(userId, 'outline_selling_points', outlineSessionId),
                    this.artifactRepo.getArtifactsByTypeForSession(userId, 'outline_setting', outlineSessionId),
                    this.artifactRepo.getArtifactsByTypeForSession(userId, 'outline_synopsis', outlineSessionId)
                ]);

            if (titleArtifacts.length === 0) {
                return undefined; // Outline not generated yet
            }

            return {
                title: (titleArtifacts[0].data as OutlineTitleV1).title,
                genre: (genreArtifacts[0].data as OutlineGenreV1).genre,
                sellingPoints: (sellingPointsArtifacts[0].data as OutlineSellingPointsV1).selling_points,
                setting: (settingArtifacts[0].data as OutlineSettingV1).setting,
                synopsis: (synopsisArtifacts[0].data as OutlineSynopsisV1).synopsis
            };
        } catch (error) {
            console.error('Error fetching outline components:', error);
            return undefined;
        }
    }
} 