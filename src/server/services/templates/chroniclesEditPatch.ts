import { createUnifiedDiffTemplate } from './unifiedDiffBase';

export const chroniclesEditPatchTemplate = createUnifiedDiffTemplate({
    templateName: 'chronicles_edit_diff',
    description: 'Chronicles Editing (Unified Diff)',
    outputJsondocType: '故事宇宙编年史',
    targetTypeName: '故事宇宙编年史',
    additionalInstructions: [
        '记住编年史是故事宇宙的历史记录，不仅仅是情节大纲',
        '可以大胆扩展和丰富背景事件，添加原始想法中没有的角色、事件、背景',
        '确保时间跨度足够广泛，从远古背景到故事结束',
        '深化因果关系，解释角色动机和历史联系',
        '保持去脸谱化原则，避免刻板印象，创造复杂多面的角色',
        '使用绝对年份标记时间（现代剧用公历年份如2024年，古装剧用朝代年号如大昭39年），避相对时间如"三年前"',
        '如果提供了附加上下文（如更新后的大纲设置），请整合这些变更到修改提议中，同时保持编年史的丰富性和扩展性'
    ]
}); 