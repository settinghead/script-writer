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
  EditableSynopsisStagesField,
  EditableEmotionDevelopmentsField,
  EditableRelationshipDevelopmentsField
} from './fieldComponents';

/**
 * Field registry for outline generation - Updated for new data structure
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

  // 4. Selling points - handle both string and array formats
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

  // 6. Setting - handle both string and object formats
  {
    path: "setting",
    component: AutoSaveTextAreaField,
    label: "故事设定",
    order: 7
  },

  // 7. Characters - now editable array with enhanced structure
  {
    path: "characters",
    component: EditableCharacterArrayField,
    label: "角色",
    order: 8
  },

  // 8. Enhanced stages structure with progressive streaming support
  {
    path: "stages",
    component: EditableSynopsisStagesField,
    label: "分段故事梗概",
    order: 9
  },

  // 8b. Legacy synopsis_stages for backward compatibility with streaming
  {
    path: "synopsis_stages",
    component: EditableSynopsisStagesField,
    label: "分段故事梗概",
    order: 9
  },

  // 8c. Individual synopsis stage fields for progressive streaming
  {
    path: "synopsis_stages[*].stageSynopsis",
    component: AutoSaveTextAreaField,
    label: "阶段梗概",
    order: 9.1
  },
  {
    path: "synopsis_stages[*].numberOfEpisodes",
    component: AutoSaveTextField,
    label: "集数",
    order: 9.2
  },
  {
    path: "synopsis_stages[*].timeframe",
    component: AutoSaveTextField,
    label: "时间跨度",
    order: 9.3
  },
  {
    path: "synopsis_stages[*].startingCondition",
    component: AutoSaveTextAreaField,
    label: "开始状态",
    order: 9.4
  },
  {
    path: "synopsis_stages[*].endingCondition",
    component: AutoSaveTextAreaField,
    label: "结束状态",
    order: 9.5
  },
  {
    path: "synopsis_stages[*].stageStartEvent",
    component: AutoSaveTextAreaField,
    label: "起始事件",
    order: 9.6
  },
  {
    path: "synopsis_stages[*].stageEndEvent",
    component: AutoSaveTextAreaField,
    label: "结束事件",
    order: 9.7
  },
  {
    path: "synopsis_stages[*].externalPressure",
    component: AutoSaveTextAreaField,
    label: "外部压力",
    order: 9.8
  }
];

/**
 * Field registry for episode generation streaming
 */
export const episodeFieldRegistry: FieldDefinition[] = [
  // 1. Episode Number
  {
    path: "episodeNumber",
    component: AutoSaveTextField,
    label: "集数",
    order: 1
  },

  // 2. Title
  {
    path: "title",
    component: AutoSaveTextField,
    label: "剧集标题",
    order: 2
  },

  // 3. Synopsis/Brief Summary
  {
    path: "briefSummary",
    component: AutoSaveTextAreaField,
    label: "剧情简介",
    order: 3
  },
  {
    path: "synopsis",
    component: AutoSaveTextAreaField,
    label: "详细剧情",
    order: 4
  },

  // 4. Key Events
  {
    path: "keyEvents",
    component: EditableTextListField,
    label: "关键事件",
    order: 5
  },

  // 5. End Hook
  {
    path: "hooks",
    component: AutoSaveTextAreaField,
    label: "结尾悬念",
    order: 6
  },
  {
    path: "endHook",
    component: AutoSaveTextAreaField,
    label: "集尾钩子",
    order: 7
  },

  // 6. 🔥 NEW: Emotion Developments
  {
    path: "emotionDevelopments",
    component: EditableEmotionDevelopmentsField,
    label: "情感发展",
    order: 8
  },

  // 7. 🔥 NEW: Relationship Developments
  {
    path: "relationshipDevelopments",
    component: EditableRelationshipDevelopmentsField,
    label: "关系发展",
    order: 9
  }
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
export function getFieldRegistry(contentType: 'outline' | 'brainstorm' | 'episode'): FieldDefinition[] {
  switch (contentType) {
    case 'outline':
      return outlineFieldRegistry;
    case 'brainstorm':
      return brainstormFieldRegistry;
    case 'episode':
      return episodeFieldRegistry;
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