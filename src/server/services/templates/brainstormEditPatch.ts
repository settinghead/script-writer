import { createJsonPatchTemplate } from './jsonPatchBase';

export const brainstormEditPatchTemplate = createJsonPatchTemplate(
  'brainstorm_edit_patch',
  'Brainstorm Idea Editing (JSON Patch)',
  '故事创意',
  '故事创意',
  [], // No additional specific principles for brainstorm
  ['/title', '/body'] // Specific paths for brainstorm editing
); 