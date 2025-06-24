import type { FieldConfig } from './ArtifactEditor';

// Common field configurations for different artifact types
export const FIELD_CONFIGS = {
    // Standard title + body configuration for brainstorm ideas, user input, etc.
    TITLE_BODY: [
        { field: 'title', component: 'input' as const, maxLength: 50, placeholder: '标题...' },
        { field: 'body', component: 'textarea' as const, rows: 6, placeholder: '内容...' }
    ] as FieldConfig[],

    // Title only configuration
    TITLE_ONLY: [
        { field: 'title', component: 'input' as const, maxLength: 100, placeholder: '标题...' }
    ] as FieldConfig[],

    // Body only configuration  
    BODY_ONLY: [
        { field: 'body', component: 'textarea' as const, rows: 8, placeholder: '内容...' }
    ] as FieldConfig[],

    // Configuration for outline artifacts
    OUTLINE: [
        { field: 'title', component: 'input' as const, maxLength: 50, placeholder: '大纲标题...' },
        { field: 'synopsis', component: 'textarea' as const, rows: 4, placeholder: '故事梗概...' },
        { field: 'characters', component: 'textarea' as const, rows: 6, placeholder: '角色设定...' }
    ] as FieldConfig[],

    // Configuration for script artifacts
    SCRIPT: [
        { field: 'title', component: 'input' as const, maxLength: 50, placeholder: '剧本标题...' },
        { field: 'content', component: 'textarea' as const, rows: 12, placeholder: '剧本内容...' }
    ] as FieldConfig[]
};

// Convenience exports for commonly used configurations
export const BRAINSTORM_IDEA_FIELDS = FIELD_CONFIGS.TITLE_BODY;
export const USER_INPUT_FIELDS = FIELD_CONFIGS.TITLE_BODY;
export const OUTLINE_FIELDS = FIELD_CONFIGS.OUTLINE;
export const SCRIPT_FIELDS = FIELD_CONFIGS.SCRIPT; 