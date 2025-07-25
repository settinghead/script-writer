import { createUnifiedDiffTemplate } from './unifiedDiffBase';
import { EpisodePlanningOutputSchema } from '../../../common/schemas/outlineSchemas';

export const episodePlanningEditPatchTemplate = createUnifiedDiffTemplate({
    templateName: 'episode_planning_edit_diff',
    description: 'Episode Planning Editing (Unified Diff)',
    outputJsondocType: '分集结构',
    targetTypeName: '分集结构',
    schema: EpisodePlanningOutputSchema,
    additionalInstructions: [
        '确保剧集分组逻辑合理，每组集数安排恰当',
        '保持关键事件的戏剧张力和观众吸引力',
        '维护悬念钩子的连贯性和有效性',
        '确保情感节拍符合短剧观众的期待',
        '如果提供了附加上下文（如更新后的时间顺序大纲），请整合这些变更到修改提议中'
    ]
}); 