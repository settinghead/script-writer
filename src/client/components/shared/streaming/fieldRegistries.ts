import { FieldDefinition } from './types';
import { 
  TextField, 
  TextAreaField, 
  TagListField, 
  TextListField, 
  CharacterCard, 
  IdeaCard 
} from './fieldComponents';

/**
 * Field registry for outline generation
 */
export const outlineFieldRegistry: FieldDefinition[] = [
  // Basic info fields
  { 
    path: "title", 
    component: TextField, 
    label: "剧本标题",
    order: 1
  },
  { 
    path: "genre", 
    component: TextField, 
    label: "剧本类型",
    order: 2
  },
  
  // Target audience section
  { 
    path: "target_audience.demographic", 
    component: TextField, 
    label: "目标受众",
    group: "target_audience",
    order: 3
  },
  { 
    path: "target_audience.core_themes", 
    component: TagListField, 
    label: "核心主题",
    group: "target_audience",
    order: 4
  },
  
  // Selling and satisfaction points
  { 
    path: "selling_points", 
    component: TextListField, 
    label: "产品卖点",
    order: 5
  },
  { 
    path: "satisfaction_points", 
    component: TextListField, 
    label: "情感爽点",
    order: 6
  },
  
  // Setting
  { 
    path: "setting.core_setting_summary", 
    component: TextAreaField, 
    label: "核心设定",
    order: 7
  },
  { 
    path: "setting.key_scenes", 
    component: TextListField, 
    label: "关键场景",
    order: 8
  },
  
  // Characters array - each character as a card
  { 
    path: "characters[*]", 
    component: CharacterCard,
    containerType: 'card',
    extractKey: (char) => char?.name || `char-${Date.now()}`,
    order: 9
  },
  
  // Individual character fields (for progressive enhancement within cards)
  { 
    path: "characters[*].name", 
    component: TextField, 
    label: "姓名",
    group: "characters"
  },
  { 
    path: "characters[*].type", 
    component: TextField, 
    label: "角色类型",
    group: "characters"
  },
  { 
    path: "characters[*].description", 
    component: TextAreaField, 
    label: "角色描述",
    group: "characters"
  },
  { 
    path: "characters[*].age", 
    component: TextField, 
    label: "年龄",
    group: "characters"
  },
  { 
    path: "characters[*].gender", 
    component: TextField, 
    label: "性别",
    group: "characters"
  },
  { 
    path: "characters[*].occupation", 
    component: TextField, 
    label: "职业",
    group: "characters"
  },
  { 
    path: "characters[*].personality_traits", 
    component: TagListField, 
    label: "性格特点",
    group: "characters"
  },
  { 
    path: "characters[*].character_arc", 
    component: TextAreaField, 
    label: "人物成长轨迹",
    group: "characters"
  },
  
  // Synopsis stages
  { 
    path: "synopsis_stages", 
    component: TextListField, 
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