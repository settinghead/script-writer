import { createUnifiedDiffTemplate } from './unifiedDiffBase';

export const brainstormEditPatchTemplate = createUnifiedDiffTemplate(
  {
    templateName: 'brainstorm_edit_diff', description: 'Brainstorm Idea Editing (Unified Diff)', outputJsondocType: '故事创意', targetTypeName: '故事创意', additionalInstructions: [] // No additional specific principles for brainstorm
  }); 