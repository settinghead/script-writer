import { FIELD_CONFIGS } from './fieldConfigs';

// Convenience exports for commonly used configurations

export const BRAINSTORM_IDEA_FIELDS = FIELD_CONFIGS.TITLE_BODY;
export const USER_INPUT_FIELDS = FIELD_CONFIGS.TITLE_BODY;
export const OUTLINE_FIELDS = FIELD_CONFIGS.OUTLINE;
export const SCRIPT_FIELDS = FIELD_CONFIGS.SCRIPT;

// Chronicle stage fields for editing individual stages
export const CHRONICLE_STAGE_FIELDS = [
    { field: 'title', component: 'input' as const, maxLength: 100, placeholder: '阶段标题...' },
    { field: 'stageSynopsis', component: 'textarea' as const, rows: 4, placeholder: '阶段概要...' },
    { field: 'event', component: 'textarea' as const, rows: 3, placeholder: '关键事件...' }
];
