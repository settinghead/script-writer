import { createJsonPatchTemplate } from './jsonPatchBase';

export const chroniclesEditPatchTemplate = createJsonPatchTemplate(
    'chronicles_edit_patch',
    'Chronicles Editing (JSON Patch)',
    '时间顺序大纲',
    '时间顺序大纲',
    [
        '确保时间线逻辑清晰，事件发展自然',
        '保持角色发展轨迹的连贯性',
        '维护情节推进的戏剧张力',
        '确保每个阶段都有明确的戏剧目的',
        '如果提供了附加上下文（如更新后的大纲设置），请整合这些变更到补丁中'
    ],
    [
        '/stages/0/title',
        '/stages/0/stageSynopsis',
        '/stages/0/event',
        '/stages/1/emotionArcs/0/characters/0',
        '/stages/1/emotionArcs/0/content',
        '/stages/2/relationshipDevelopments/0/characters/0',
        '/stages/2/relationshipDevelopments/0/content',
        '/stages/0/insights/0',
        '/stages/1/insights/1',
        '/stages/2/title',
        '/stages/3/event',
        '/stages/4/stageSynopsis'
    ]
); 