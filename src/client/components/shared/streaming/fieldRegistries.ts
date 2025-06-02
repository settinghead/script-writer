import { FieldDefinition } from './types';
import {
  TextField,
  TextAreaField,
  TagListField,
  TextListField,
  CharacterCard,
  IdeaCard,
  AutoSaveTextField,
  AutoSaveTextAreaField,
  AutoSaveSelectField,
  EditableTextListField,
  EditableTagListField,
  EditableCharacterCard,
  EditableCharacterArrayField,
  EditableSynopsisStagesField
} from './fieldComponents';

/**
 * Field registry for outline generation
 */
export const outlineFieldRegistry: FieldDefinition[] = [
  // 1. Title (matches LLM streaming order)
  {
    path: "title",
    component: AutoSaveTextField,
    label: "剧本标题",
    order: 1
  },

  // 2. Genre 
  {
    path: "genre",
    component: AutoSaveTextField,
    label: "剧本类型",
    order: 2
  },

  // 3. Target audience
  {
    path: "target_audience.demographic",
    component: AutoSaveTextField,
    label: "目标受众",
    group: "target_audience",
    order: 3
  },
  {
    path: "target_audience.core_themes",
    component: EditableTagListField,
    label: "核心主题",
    group: "target_audience",
    order: 4
  },

  // 4. Selling points
  {
    path: "selling_points",
    component: AutoSaveTextAreaField,
    label: "产品卖点",
    order: 5
  },

  // 5. Satisfaction points - now editable
  {
    path: "satisfaction_points",
    component: EditableTextListField,
    label: "情感爽点",
    order: 6
  },

  // 6. Setting
  {
    path: "setting.core_setting_summary",
    component: AutoSaveTextAreaField,
    label: "核心设定",
    order: 7
  },
  {
    path: "setting.key_scenes",
    component: EditableTextListField,
    label: "关键场景",
    order: 8
  },

  // 7. Characters - now editable array
  {
    path: "characters",
    component: EditableCharacterArrayField,
    label: "角色",
    order: 9
  },

  // 8. Synopsis stages - now editable
  {
    path: "synopsis_stages",
    component: EditableSynopsisStagesField,
    label: "分段故事梗概",
    order: 10
  },


];

/**
 * Field registry for brainstorming (ideas array)
 */
export const brainstormFieldRegistry: FieldDefinition[] = [
  {
    path: "[*]",
    component: IdeaCard,
    containerType: 'card',
    extractKey: (idea) => idea?.title ? `${idea.title}-${idea.body?.substring(0, 20)}` : `idea-${Date.now()}`
  },

  // Individual idea fields (for progressive enhancement)
  {
    path: "[*].title",
    component: TextField,
    label: "标题",
    group: "ideas"
  },
  {
    path: "[*].body",
    component: TextAreaField,
    label: "内容",
    group: "ideas"
  }
];

/**
 * Helper function to get the appropriate registry based on content type
 */
export function getFieldRegistry(contentType: 'outline' | 'brainstorm'): FieldDefinition[] {
  switch (contentType) {
    case 'outline':
      return outlineFieldRegistry;
    case 'brainstorm':
      return brainstormFieldRegistry;
    default:
      return [];
  }
}

/**
 * Helper to validate registry definitions
 */
export function validateFieldRegistry(registry: FieldDefinition[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  registry.forEach((def, index) => {
    if (!def.path) {
      errors.push(`Field definition at index ${index} missing path`);
    }
    if (!def.component) {
      errors.push(`Field definition at index ${index} missing component`);
    }

    // Check for duplicate paths
    const duplicates = registry.filter(d => d.path === def.path);
    if (duplicates.length > 1) {
      errors.push(`Duplicate path found: ${def.path}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
} 