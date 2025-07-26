/**
 * Single source of truth for all available agent tools
 * This file defines the complete list of tools and their metadata
 */

export interface ToolDefinition {
    name: string;
    category: 'particle_search' | 'brainstorm' | 'outline' | 'chronicles' | 'episode_planning' | '单集大纲';
    description: string;
    alwaysAvailable?: boolean; // Tools that are always available when their system is ready
}

/**
 * Complete registry of all available agent tools
 * This is the single source of truth - all other tool lists should derive from this
 */
export const ALL_AGENT_TOOLS: ToolDefinition[] = [
    // === PARTICLE SEARCH TOOLS ===
    {
        name: 'queryJsondocs',
        category: 'particle_search',
        description: '语义搜索项目中的相关信息',
        alwaysAvailable: true // Available when particle system is initialized
    },
    {
        name: 'getJsondocContent',
        category: 'particle_search',
        description: '获取指定jsondoc的完整内容',
        alwaysAvailable: true // Available when particle system is initialized
    },

    // === BRAINSTORM TOOLS ===
    {
        name: 'generate_灵感创意s',
        category: 'brainstorm',
        description: '生成多个故事创意'
    },
    {
        name: 'edit_灵感创意',
        category: 'brainstorm',
        description: '编辑现有故事创意'
    },

    // === OUTLINE TOOLS ===
    {
        name: 'generate_剧本设定',
        category: 'outline',
        description: '生成剧本设定和角色背景'
    },
    {
        name: 'edit_剧本设定',
        category: 'outline',
        description: '编辑剧本设定，包含角色设定、基本信息、目标观众、主题、卖点、故事设定等等'
    },

    // === CHRONICLES TOOLS ===
    {
        name: 'generate_chronicles',
        category: 'chronicles',
        description: '生成时间顺序大纲'
    },
    {
        name: 'edit_chronicles',
        category: 'chronicles',
        description: '编辑时间顺序大纲'
    },

    // === EPISODE PLANNING TOOLS ===
    {
        name: 'generate_episode_planning',
        category: 'episode_planning',
        description: '生成分集结构'
    },
    {
        name: 'edit_episode_planning',
        category: 'episode_planning',
        description: '编辑分集结构'
    },

    // === EPISODE SYNOPSIS TOOLS ===
    {
        name: 'generate_单集大纲',
        category: '单集大纲',
        description: '生成分集大纲'
    }
];

/**
 * Get all tool names as a simple array
 */
export const getAllToolNames = (): string[] => {
    return ALL_AGENT_TOOLS.map(tool => tool.name);
};

/**
 * Get tools by category
 */
export const getToolsByCategory = (category: ToolDefinition['category']): ToolDefinition[] => {
    return ALL_AGENT_TOOLS.filter(tool => tool.category === category);
};

/**
 * Get tools that are always available when their system is ready
 */
export const getAlwaysAvailableTools = (): ToolDefinition[] => {
    return ALL_AGENT_TOOLS.filter(tool => tool.alwaysAvailable);
};

/**
 * Get particle search tool names
 */
export const getParticleSearchToolNames = (): string[] => {
    return getToolsByCategory('particle_search').map(tool => tool.name);
};

/**
 * Check if a tool is a particle search tool
 */
export const isParticleSearchTool = (toolName: string): boolean => {
    return getParticleSearchToolNames().includes(toolName);
};

/**
 * Get workflow tools (non-particle search tools) by workflow stage
 * This encodes the business logic about which tools are available at each stage
 */
export interface WorkflowStage {
    hasBrainstormResult?: boolean;
    hasOutlineSettings?: boolean;
    hasChronicles?: boolean;
    hasEpisodePlanning?: boolean;
    hasBrainstormIdea?: boolean; // Specific for single idea vs collection
    hasEpisodeSynopsis?: boolean;
}

export const getWorkflowTools = (stage: WorkflowStage): string[] => {
    const tools: string[] = [];

    // === BRAINSTORM STAGE ===
    // Show generate tool if:
    // 1. No brainstorm result at all, OR
    // 2. Have brainstorm result but no committed idea (i.e., only have collection)
    if (!stage.hasBrainstormResult || (stage.hasBrainstormResult && !stage.hasBrainstormIdea)) {
        tools.push('generate_灵感创意s');
    }

    // Show edit tool only when we have a committed idea
    if (stage.hasBrainstormIdea) {
        tools.push('edit_灵感创意');
    }

    // === 剧本设定 STAGE ===
    if (stage.hasBrainstormIdea && !stage.hasOutlineSettings) {
        tools.push('generate_剧本设定');
    }

    if (stage.hasOutlineSettings) {
        // Add edit tools for previous stages
        if (stage.hasBrainstormIdea) {
            tools.push('edit_灵感创意');
        }
        tools.push('edit_剧本设定');

        // Add next generation tool
        if (!stage.hasChronicles) {
            tools.push('generate_chronicles');
        }
    }

    if (stage.hasChronicles) {
        // Add edit tools for previous stages
        if (stage.hasBrainstormIdea) {
            tools.push('edit_灵感创意');
        }
        if (stage.hasOutlineSettings) {
            tools.push('edit_剧本设定');
        }
        tools.push('edit_chronicles');

        // Add next generation tool
        if (!stage.hasEpisodePlanning) {
            tools.push('generate_episode_planning');
        }
    }

    if (stage.hasEpisodePlanning) {
        // Add edit tools for all previous stages
        if (stage.hasBrainstormIdea) {
            tools.push('edit_灵感创意');
        }
        if (stage.hasOutlineSettings) {
            tools.push('edit_剧本设定');
        }
        if (stage.hasChronicles) {
            tools.push('edit_chronicles');
        }
        tools.push('edit_episode_planning');

        // Episode synopsis can be generated multiple times
        tools.push('generate_单集大纲');
    }

    // Episode script generation - after episode synopsis exists
    if (stage.hasEpisodeSynopsis) {
        // Add edit tools for all previous stages
        if (stage.hasBrainstormIdea) {
            tools.push('edit_灵感创意');
        }
        if (stage.hasOutlineSettings) {
            tools.push('edit_剧本设定');
        }
        if (stage.hasChronicles) {
            tools.push('edit_chronicles');
        }
        if (stage.hasEpisodePlanning) {
            tools.push('edit_episode_planning');
        }

        // Episode script generation (sequential, one at a time)
        tools.push('generate_episode_script');
    }

    // Remove duplicates and return
    return [...new Set(tools)];
}; 