import { createUnifiedDiffTemplate } from './unifiedDiffBase';

export const outlineSettingsEditPatchTemplate = createUnifiedDiffTemplate(
    {
        templateName: '剧本设定_edit_diff',
        description: 'Outline Settings Editing (Unified Diff)',
        outputJsondocType: '剧本设定',
        targetTypeName: '剧本设定设置',
        additionalInstructions: [
            '确保角色设定符合故事类型和平台特色',
            '保持卖点和爽点的商业价值',
            '维护故事设定的内在逻辑性',
            '**重要：所有修改必须应用到标记为"PATCH_TARGET"的剧本设定jsondoc，不要修改标记为"CONTEXT"的jsondoc**',
            '**查看参考数据时，找到role为"PATCH_TARGET"的剧本设定，这是你需要生成差异补丁的目标对象**',
            '**CONTEXT jsondocs仅用作参考信息，帮助理解用户需求，但差异补丁必须基于PATCH_TARGET的内容**',
            '如果提供了附加上下文（如更新后的故事创意），请整合这些变更到修改中'
        ]
    }); 