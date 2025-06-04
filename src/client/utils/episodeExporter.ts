import { EpisodeSynopsisV1 } from '../../common/types';
import { EpisodeSynopsis } from '../services/implementations/EpisodeStreamingService';

interface EpisodeExportData {
    sessionId: string;
    stageData: {
        stageNumber: number;
        stageSynopsis: string;
        numberOfEpisodes: number;
        artifactId: string;
    };
    episodes: (EpisodeSynopsisV1 | EpisodeSynopsis)[];
    generatedAt: string;
}

// Helper function to repeat characters
function repeatChar(char: string, count: number): string {
    return Array(count + 1).join(char);
}

export function formatEpisodesForExport(data: EpisodeExportData): string {
    const sections: string[] = [];

    // Header
    sections.push(repeatChar("=", 60));
    sections.push("剧集大纲");
    sections.push(repeatChar("=", 60));
    sections.push("");

    // Basic Information
    sections.push("📋 基本信息");
    sections.push(repeatChar("-", 30));
    sections.push(`阶段：第${data.stageData.stageNumber}阶段`);
    sections.push(`计划集数：${data.stageData.numberOfEpisodes}集`);
    sections.push(`实际生成：${data.episodes.length}集`);
    sections.push(`生成时间：${new Date(data.generatedAt).toLocaleString('zh-CN')}`);
    sections.push(`会话ID：${data.sessionId}`);
    sections.push("");

    // Stage Synopsis
    sections.push("🎬 阶段简介");
    sections.push(repeatChar("-", 30));
    sections.push(data.stageData.stageSynopsis);
    sections.push("");

    // Episodes
    if (data.episodes.length > 0) {
        sections.push("📺 剧集详情");
        sections.push(repeatChar("-", 30));

        data.episodes.forEach((episode, index) => {
            sections.push(`第${episode.episodeNumber}集：${episode.title}`);
            sections.push(repeatChar("·", 40));

            // Synopsis/Brief Summary
            const synopsis = ('briefSummary' in episode ? episode.briefSummary : episode.synopsis) ||
                ('synopsis' in episode ? episode.synopsis : '');
            if (synopsis) {
                sections.push("📖 剧集简介：");
                sections.push(synopsis);
                sections.push("");
            }

            // Key Events
            if (episode.keyEvents && episode.keyEvents.length > 0) {
                sections.push("🔑 关键事件：");
                episode.keyEvents.forEach((event, eventIndex) => {
                    sections.push(`   ${eventIndex + 1}. ${event}`);
                });
                sections.push("");
            }

            // Episode Hook
            const hook = ('hooks' in episode ? episode.hooks : episode.endHook) ||
                ('endHook' in episode ? episode.endHook : '');
            if (hook) {
                sections.push("🎣 剧集钩子：");
                sections.push(hook);
                sections.push("");
            }

            // 🔥 NEW: Emotion Developments
            if ('emotionDevelopments' in episode && episode.emotionDevelopments && episode.emotionDevelopments.length > 0) {
                sections.push("💚 情感发展：");
                episode.emotionDevelopments.forEach((dev, devIndex) => {
                    sections.push(`   ${devIndex + 1}. 角色：${dev.characters.join(', ')}`);
                    sections.push(`      发展：${dev.content}`);
                });
                sections.push("");
            }

            // 🔥 NEW: Relationship Developments
            if ('relationshipDevelopments' in episode && episode.relationshipDevelopments && episode.relationshipDevelopments.length > 0) {
                sections.push("💙 关系发展：");
                episode.relationshipDevelopments.forEach((dev, devIndex) => {
                    sections.push(`   ${devIndex + 1}. 角色：${dev.characters.join(', ')}`);
                    sections.push(`      发展：${dev.content}`);
                });
                sections.push("");
            }

            // Separator between episodes
            if (index < data.episodes.length - 1) {
                sections.push("");
            }
        });
    } else {
        sections.push("📺 剧集详情");
        sections.push(repeatChar("-", 30));
        sections.push("暂无剧集内容");
        sections.push("");
    }

    // Statistics
    sections.push("📊 生成统计");
    sections.push(repeatChar("-", 30));
    sections.push(`总集数：${data.episodes.length}集`);

    const episodesWithEvents = data.episodes.filter(ep => ep.keyEvents && ep.keyEvents.length > 0).length;
    sections.push(`包含关键事件的剧集：${episodesWithEvents}集`);

    const episodesWithHooks = data.episodes.filter(ep => {
        const hook = ('hooks' in ep ? ep.hooks : ep.endHook) || ('endHook' in ep ? ep.endHook : '');
        return hook && hook.trim().length > 0;
    }).length;
    sections.push(`包含剧集钩子的剧集：${episodesWithHooks}集`);

    // 🔥 NEW: Statistics for emotion and relationship developments
    const episodesWithEmotions = data.episodes.filter(ep => 
        'emotionDevelopments' in ep && ep.emotionDevelopments && ep.emotionDevelopments.length > 0
    ).length;
    sections.push(`包含情感发展的剧集：${episodesWithEmotions}集`);

    const episodesWithRelationships = data.episodes.filter(ep => 
        'relationshipDevelopments' in ep && ep.relationshipDevelopments && ep.relationshipDevelopments.length > 0
    ).length;
    sections.push(`包含关系发展的剧集：${episodesWithRelationships}集`);

    const totalEvents = data.episodes.reduce((sum, ep) => sum + (ep.keyEvents?.length || 0), 0);
    sections.push(`总关键事件数：${totalEvents}个`);

    const totalEmotionDevelopments = data.episodes.reduce((sum, ep) => 
        sum + (('emotionDevelopments' in ep && ep.emotionDevelopments) ? ep.emotionDevelopments.length : 0), 0
    );
    sections.push(`总情感发展数：${totalEmotionDevelopments}个`);

    const totalRelationshipDevelopments = data.episodes.reduce((sum, ep) => 
        sum + (('relationshipDevelopments' in ep && ep.relationshipDevelopments) ? ep.relationshipDevelopments.length : 0), 0
    );
    sections.push(`总关系发展数：${totalRelationshipDevelopments}个`);
    sections.push("");

    // Footer
    sections.push(repeatChar("=", 60));
    sections.push("导出完成");
    sections.push(`导出时间：${new Date().toLocaleString('zh-CN')}`);
    sections.push(repeatChar("=", 60));

    return sections.join("\n");
}

export type { EpisodeExportData }; 