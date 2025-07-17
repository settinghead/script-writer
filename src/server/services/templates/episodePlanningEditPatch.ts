import { createJsonPatchTemplate } from './jsonPatchBase';

export const episodePlanningEditPatchTemplate = createJsonPatchTemplate(
    'episode_planning_edit_patch',
    'Episode Planning Editing (JSON Patch)',
    '剧集框架',
    '剧集框架',
    [
        '确保剧集分组逻辑合理，每组集数安排恰当',
        '保持关键事件的戏剧张力和观众吸引力',
        '维护悬念钩子的连贯性和有效性',
        '确保情感节拍符合短剧观众的期待',
        '如果提供了附加上下文（如更新后的时间顺序大纲），请整合这些变更到补丁中'
    ],
    [
        '/totalEpisodes',
        '/overallStrategy',
        '/episodeGroups/0/groupTitle',
        '/episodeGroups/0/episodes',
        '/episodeGroups/0/keyEvents/0',
        '/episodeGroups/0/hooks/0',
        '/episodeGroups/0/emotionalBeats/0',
        '/episodeGroups/1/groupTitle',
        '/episodeGroups/1/keyEvents/1',
        '/episodeGroups/1/hooks/1',
        '/episodeGroups/2/emotionalBeats/0',
        '/episodeGroups/2/keyEvents/0'
    ]
); 