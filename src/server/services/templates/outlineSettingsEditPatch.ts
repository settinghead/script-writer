import { createJsonPatchTemplate } from './jsonPatchBase';

export const outlineSettingsEditPatchTemplate = createJsonPatchTemplate(
    '剧本设定_edit_patch',
    'Outline Settings Editing (JSON Patch)',
    '剧本设定',
    '剧本设定设置',
    [
        '确保角色设定符合故事类型和平台特色',
        '保持卖点和爽点的商业价值',
        '维护故事设定的内在逻辑性',
        '**重要：所有JSON补丁必须应用到标记为"PATCH_TARGET"的剧本设定jsondoc，不要修改标记为"CONTEXT"的jsondoc**',
        '**查看参考数据时，找到role为"PATCH_TARGET"的剧本设定，这是你需要生成补丁的目标对象**',
        '**CONTEXT jsondocs仅用作参考信息，帮助理解用户需求，但补丁路径必须基于PATCH_TARGET的结构**',
        '如果提供了附加上下文（如更新后的故事创意），请整合这些变更到补丁中'
    ],
    [
        '/title',
        '/genre',
        '/target_audience/demographic',
        '/target_audience/core_themes/0',
        '/selling_points/0',
        '/satisfaction_points/1',
        '/setting/core_setting_summary',
        '/setting/key_scenes/0',
        '/characters/0/name',
        '/characters/0/description',
        '/characters/1/type',
        '/characters/2/personality'
    ]
); 