/**
 * Particle Paths Registry
 * 
 * Defines which JSONPath patterns should be extracted as particles for each schema type.
 * If no paths are defined for a schema_type (empty array or missing), defaults to root '$'.
 * 
 * Uses jsonpath-plus syntax: https://www.npmjs.com/package/jsonpath-plus
 */

export interface ParticlePathDefinition {
    path: string;
    type: string;  // Particle type name (e.g., '人物', '创意', '卖点')
    titlePath?: string;  // Optional JSONPath to extract title from matched content
    titleDefault?: string;  // Default title pattern if titlePath not found
}

export const particlePathsRegistry: Record<string, ParticlePathDefinition[]> = {
    'brainstorm_collection': [
        {
            path: '$.ideas[*]',
            type: '创意',
            titlePath: '$.title',
            titleDefault: '创意'
        }
    ],

    'brainstorm_input_params': [
        // Empty array means default to root '$' as single particle
    ],

    '灵感创意': [
        // Empty array means default to root '$' as single particle  
    ],

    '剧本设定': [
        {
            path: '$.characters[*]',
            type: '人物',
            titlePath: '$.name',
            titleDefault: '角色'
        },
        {
            path: '$.selling_points[*]',
            type: '卖点',
            titleDefault: '卖点'
        },
        {
            path: '$.satisfaction_points[*]',
            type: '爽点',
            titleDefault: '爽点'
        },
        {
            path: '$.setting.key_scenes[*]',
            type: '场景',
            titleDefault: '场景'
        }
    ],

    'chronicles': [
        {
            path: '$.stages[*]',
            type: '阶段',
            titlePath: '$.title',
            titleDefault: '阶段'
        }
    ],

    '分集结构': [
        {
            path: '$.episodeGroups[*]',
            type: '剧集组',
            titlePath: '$.groupTitle',
            titleDefault: '剧集组'
        }
    ],

    '单集大纲': [
        {
            path: '$',
            type: '单集大纲',
            titlePath: '$.title',
            titleDefault: '单集大纲'
        }
    ]
};

/**
 * Get particle path definitions for a schema type
 * Returns default root definition if none specified
 */
export function getParticlePathsForSchemaType(schemaType: string): ParticlePathDefinition[] {
    const definitions = particlePathsRegistry[schemaType];

    // If no definitions or empty array, default to root
    if (!definitions || definitions.length === 0) {
        return [{
            path: '$',
            type: getDefaultParticleType(schemaType),
            titleDefault: getDefaultParticleTitle(schemaType)
        }];
    }

    return definitions;
}

/**
 * Get default particle type for schema types without specific definitions
 */
function getDefaultParticleType(schemaType: string): string {
    const typeMap: Record<string, string> = {
        'brainstorm_input_params': '头脑风暴参数',
        '灵感创意': '创意',
        'brainstorm_collection': '创意集合',
        '剧本设定': '剧本设定',
        'chronicles': '时间顺序大纲',
        '分集结构': '分集结构',
        '单集大纲': '单集大纲'
    };

    return typeMap[schemaType] || schemaType;
}

/**
 * Get default particle title for schema types without specific definitions
 */
function getDefaultParticleTitle(schemaType: string): string {
    const titleMap: Record<string, string> = {
        'brainstorm_input_params': '头脑风暴参数',
        '灵感创意': '创意',
        'brainstorm_collection': '创意集合',
        '剧本设定': '剧本设定',
        'chronicles': '时间顺序大纲',
        '分集结构': '分集结构',
        '单集大纲': '单集大纲'
    };

    return titleMap[schemaType] || schemaType;
} 