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
export const ColorUtils = {
    // Get appropriate color for transform/jsondoc type
    getTransformColor: (type: 'human' | 'llm') => {
        return type === 'human' ? AppColors.human.primary : AppColors.ai.primary;
    },

    // Get appropriate color for jsondoc based on origin
    getJsondocColor: (type: string, originType?: string) => {
        // Input params get purple color
        if (type === 'brainstorm_input_params' || type === 'brainstorm_input_params' || type === 'outline_input' || type.includes('input')) {
            return AppColors.ai.tertiary;
        }

        // Color based on origin type
        if (originType === 'human') {
            return AppColors.human.primary;
        } else if (originType === 'llm') {
            return AppColors.ai.primary;
        }

        // Fallback colors for specific types
        switch (type) {
            case 'user_input': return AppColors.human.primary;
            case 'brainstorm_idea': return AppColors.ai.primary;
            case 'outline_response': return AppColors.ai.primary;
            case 'chronicles': return AppColors.ai.primary;
            case 'json_patch': return AppColors.status.warning; // Orange for patch jsondocs
            default: return AppColors.text.muted;
        }
    }
}; 