import { createJsonPatchTemplate } from './jsonPatchBase';

export const outlineSettingsEditPatchTemplate = createJsonPatchTemplate(
    'outline_settings_edit_patch',
    'Outline Settings Editing (JSON Patch)',
    '剧本框架',
    '剧本框架设置',
    [
        '确保角色设定符合故事类型和平台特色',
        '保持卖点和爽点的商业价值',
        '维护故事设定的内在逻辑性'
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