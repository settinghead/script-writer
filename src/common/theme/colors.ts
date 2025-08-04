// Global color theme for the application
export const AppColors = {
    // AI/Bot theme - Purple gradients
    ai: {
        primary: '#6d28d9',
        secondary: '#5b21b6',
        tertiary: '#4c1d95',
        gradient: 'linear-gradient(135deg, #6d28d9 0%, #5b21b6 50%, #4c1d95 100%)',
        gradientDark: 'linear-gradient(135deg, #4c1d95 0%, #3730a3 50%, #312e81 100%)',
        gradientAnimated: 'linear-gradient(135deg, #6d28d9, #5b21b6, #4c1d95, #6d28d9)',
        gradientAnimatedHover: 'linear-gradient(135deg, #4c1d95, #6d28d9, #5b21b6, #4c1d95)',
        shadow: 'rgba(76, 29, 149, 0.3)',
        shadowHover: 'rgba(76, 29, 149, 0.5)',
        avatar: '#6d28d9'
    },

    // Human/User theme - Blue and dark green
    human: {
        primary: '#237804', // Dark green for human actions
        secondary: '#4f46e5', // Blue for user messages
        avatar: '#4f46e5',
        background: '#2a2a2a'
    },

    // Status colors
    status: {
        latest: '#fadb14', // Yellow for latest items
        success: '#52c41a',
        error: '#f5222d',
        warning: '#fa8c16',
        processing: '#1890ff'
    },

    // Background colors
    background: {
        primary: '#1a1a1a',
        secondary: '#2a2a2a',
        tertiary: '#1e1e1e',
        card: '#262626'
    },

    // Text colors
    text: {
        primary: '#e0e0e0',
        secondary: '#ccc',
        tertiary: '#aaa',
        muted: '#888',
        white: '#ffffff'
    },

    // Border colors
    border: {
        primary: '#333',
        secondary: '#444',
        tertiary: '#555'
    }
};

// Utility functions for common color operations
import { match, P } from 'ts-pattern';

export const ColorUtils = {
    // Get appropriate color for transform/jsondoc type
    getTransformColor: (type: 'human' | 'llm' | 'ai_patch' | 'human_patch_approval') => {
        return match(type)
            .with(P.union('human', 'human_patch_approval'), () => AppColors.human.primary)
            .with(P.union('llm', 'ai_patch'), () => AppColors.ai.primary)
            .exhaustive();
    },

    // Get appropriate color for jsondoc based on origin
    getJsondocColor: (type: string, originType?: string) => {
        return match({ type, originType })
            // Input params get purple color (highest priority)
            .when(({ type }) =>
                type === 'brainstorm_input_params' ||
                type === 'outline_input' ||
                type.includes('input'),
                () => AppColors.ai.tertiary
            )

            // Color based on origin type
            .with({ originType: 'human' }, () => AppColors.human.primary)
            .with({ originType: 'llm' }, () => AppColors.ai.primary)

            // Specific type-based colors
            .with({ type: 'user_input' }, () => AppColors.human.primary)
            .with({ type: '灵感创意' }, () => AppColors.ai.primary)
            .with({ type: 'outline_response' }, () => AppColors.ai.primary)
            .with({ type: 'chronicles' }, () => AppColors.ai.primary)
            .with({ type: 'json_patch' }, () => AppColors.status.warning) // Orange for patch jsondocs

            // Default fallback
            .otherwise(() => AppColors.text.muted);
    },

    // Get appropriate icon name for jsondoc schema type
    getSchemaTypeIcon: (type: string): string => {
        return match(type)
            .with('灵感创意', () => 'BulbOutlined')
            .with('brainstorm_collection', () => 'BulbOutlined')
            .with('brainstorm_input_params', () => 'UserOutlined')
            .with('剧本设定', () => 'FileTextOutlined')
            .with('chronicles', () => 'HistoryOutlined')
            .with('分集结构', () => 'VideoCameraOutlined')
            .with('单集大纲', () => 'PlayCircleOutlined')
            .with('单集剧本', () => 'FileTextOutlined')
            .with('json_patch', () => 'EditOutlined')
            .with('outline_input', () => 'UserOutlined')
            .with('outline_response', () => 'FileTextOutlined')
            .with('user_input', () => 'UserOutlined')
            .otherwise(() => 'DatabaseOutlined');
    },

    // Get human-readable display name for schema type
    getSchemaTypeDisplayName: (type: string): string => {
        return match(type)
            .with('灵感创意', () => '灵感创意')
            .with('brainstorm_collection', () => '创意集合')
            .with('brainstorm_input_params', () => '头脑风暴参数')
            .with('剧本设定', () => '剧本设定')
            .with('chronicles', () => '故事编年史')
            .with('分集结构', () => '分集结构')
            .with('单集大纲', () => '单集大纲')
            .with('单集剧本', () => '单集剧本')
            .with('json_patch', () => '修改提议')
            .with('outline_input', () => '大纲输入')
            .with('outline_response', () => '大纲响应')
            .with('user_input', () => '用户输入')
            .otherwise(() => type);
    }
}; 