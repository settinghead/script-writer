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
        '**重要：所有JSON修改提议必须应用到标记为"PATCH_TARGET"的剧本设定jsondoc，不要修改标记为"CONTEXT"的jsondoc**',
        '**查看参考数据时，找到role为"PATCH_TARGET"的剧本设定，这是你需要生成修改提议的目标对象**',
        '**CONTEXT jsondocs仅用作参考信息，帮助理解用户需求，但修改提议路径必须基于PATCH_TARGET的结构**',
        '如果提供了附加上下文（如更新后的故事创意），请整合这些变更到修改提议中',
        '**数组操作重要规则：**',
        '- 要修改现有数组元素，使用 "op": "replace", "path": "/arrayName/index"',
        '- 要在数组末尾添加新元素，使用 "op": "add", "path": "/arrayName/-"',
        '- 要在数组特定位置插入元素，使用 "op": "add", "path": "/arrayName/index"',
        '- **绝对不要用 "op": "add", "path": "/arrayName" 来修改数组 - 这会替换整个数组！**',
        '- characters数组示例：修改第一个角色用"/characters/0"，添加新角色用"/characters/-"'
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
        '/characters/2/personality',
        '/characters/-'  // Example for adding new character
    ]
); 