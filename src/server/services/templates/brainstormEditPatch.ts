import { createUnifiedDiffTemplate } from './unifiedDiffBase';
import { IdeaSchema } from '../../../common/schemas/streaming';

export const brainstormEditPatchTemplate = createUnifiedDiffTemplate(
  {
    templateName: 'brainstorm_edit_diff',
    description: 'Brainstorm Idea Editing (Unified Diff)',
    outputJsondocType: '故事创意',
    targetTypeName: '故事创意',
    schema: IdeaSchema,
    additionalInstructions: [
      '确保修改后的创意符合去脸谱化原则，避免刻板印象',
      '保持故事的核心吸引力和商业价值',
      '维护故事逻辑的连贯性和合理性',
      '**重要：生成的差异补丁必须基于提供的故事创意内容**',
      '**只修改需要改变的字段，保持其他内容不变**',
      '**确保修改后的内容符合IdeaSchema的数据结构要求**'
    ]
  }); 