import { createUnifiedDiffTemplate } from './unifiedDiffBase';
import { IdeaSchema } from '../../../common/schemas/streaming';

export const brainstormEditPatchTemplate = createUnifiedDiffTemplate(
  {
    templateName: 'brainstorm_edit_diff',
    description: 'Brainstorm Idea Editing (Unified Diff)',
    outputJsondocType: '故事创意',
    targetTypeName: '故事创意',
    schema: IdeaSchema,
    additionalInstructions: [] // No additional specific principles for brainstorm
  }); 