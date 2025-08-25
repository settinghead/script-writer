import type { CanonicalJsondocContext } from '../../common/canonicalJsondocLogic';
import type { ElectricJsondoc } from '@/common/transform-jsondoc-types';

/**
 * Core function that generates canonical jsondoc content structure from canonical context
 * Optimized for both human readability and LLM token efficiency
 * 
 * This function is pure and can be used by scripts, services, or other utilities
 */
export function generateCanonicalContentStructure(
    canonicalContext: CanonicalJsondocContext,
    projectId: string
): string {
    const lines: string[] = [];

    // Header
    lines.push(`CANONICAL JSONDOCS - Project: ${projectId}`);
    lines.push('='.repeat(50));
    lines.push('');

    // Helper function to extract field paths from data structure
    function extractFieldPaths(schemaType: string, data: any, basePath: string = '$'): string[] {
        const paths: string[] = [];

        if (!data || typeof data !== 'object') {
            return [basePath];
        }

        if (Array.isArray(data)) {
            paths.push(`${basePath}[*]`);
            // Sample first item for structure if available
            if (data.length > 0) {
                const subPaths = extractFieldPaths(schemaType, data[0], `${basePath}[*]`);
                paths.push(...subPaths.filter(p => p !== `${basePath}[*]`));
            }
        } else {
            for (const [key, value] of Object.entries(data)) {
                const currentPath = basePath === '$' ? `$.${key}` : `${basePath}.${key}`;

                if (value && typeof value === 'object') {
                    if (Array.isArray(value)) {
                        paths.push(`${currentPath}[*]`);
                        // Sample first item for nested structure
                        if (value.length > 0 && typeof value[0] === 'object') {
                            const subPaths = extractFieldPaths(schemaType, value[0], `${currentPath}[*]`);
                            paths.push(...subPaths.filter(p => p !== `${currentPath}[*]`));
                        }
                    } else {
                        const subPaths = extractFieldPaths(schemaType, value, currentPath);
                        paths.push(...subPaths);
                    }
                } else {
                    paths.push(currentPath);
                }
            }
        }

        return paths;
    }

    // Process each canonical jsondoc type
    const canonicalTypes = [
        { key: 'canonicalBrainstormInput', name: 'brainstorm_input_params', desc: '头脑风暴输入' },
        { key: 'canonicalBrainstormIdea', name: '灵感创意', desc: '选中创意' },
        { key: 'canonicalBrainstormCollection', name: 'brainstorm_collection', desc: '创意集合' },
        { key: 'canonicalOutlineSettings', name: '故事设定', desc: '故事框架' },
        { key: 'canonicalChronicles', name: 'chronicles', desc: '时间顺序大纲' },
        { key: 'canonicalEpisodePlanning', name: '分集结构', desc: '分集结构' }
    ];

    for (const type of canonicalTypes) {
        const jsondoc = canonicalContext[type.key as keyof CanonicalJsondocContext] as ElectricJsondoc | null;

        if (jsondoc) {
            lines.push(`jsondoc type:${type.name} (ID: ${jsondoc.id}):`);
            lines.push("文档结构：")
            try {
                const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
                const paths = extractFieldPaths(type.name, data);

                // Sort paths for consistent output
                paths.sort((a, b) => {
                    // Sort by depth first (fewer dots = higher priority)
                    const aDepth = (a.match(/\./g) || []).length;
                    const bDepth = (b.match(/\./g) || []).length;
                    if (aDepth !== bDepth) return aDepth - bDepth;
                    return a.localeCompare(b);
                });

                for (const path of paths) {
                    lines.push(`  ${path}`);
                }
            } catch (error) {
                lines.push(`  [Error parsing data: ${error}]`);
            }

            lines.push('');
        }
    }

    // Handle episode synopsis list separately
    if (canonicalContext.canonicalEpisodeSynopsisList.length > 0) {
        lines.push('单集大纲 (multiple):');
        canonicalContext.canonicalEpisodeSynopsisList.forEach((synopsis, index) => {
            try {
                const data = typeof synopsis.data === 'string' ? JSON.parse(synopsis.data) : synopsis.data;
                const episodeRange = data.episodes ?
                    `${data.episodes[0]?.episodeNumber || 'unknown'}-${data.episodes[data.episodes.length - 1]?.episodeNumber || 'unknown'}` :
                    'unknown';
                lines.push(`  [${index}] ${synopsis.id} (episodes ${episodeRange}):`);

                const paths = extractFieldPaths('单集大纲', data);
                paths.sort();
                for (const path of paths) {
                    lines.push(`    ${path}`);
                }
            } catch (error) {
                lines.push(`    [Error parsing data: ${error}]`);
            }
        });
        lines.push('');
    }


    return lines.join('\n');
}

/**
 * Helper function to extract just the field paths from a jsondoc's data
 * Useful for getting structured field information without full formatting
 */
export function extractJsondocFieldPaths(jsondoc: ElectricJsondoc): string[] {
    try {
        const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
        return extractFieldPathsFromData(data);
    } catch (error) {
        return [`[Error parsing jsondoc ${jsondoc.id}: ${error}]`];
    }
}

/**
 * Helper function to recursively extract field paths from any data structure
 * Returns JSONPath-style paths for all fields
 */
export function extractFieldPathsFromData(data: any, basePath: string = '$'): string[] {
    const paths: string[] = [];

    if (!data || typeof data !== 'object') {
        return [basePath];
    }

    if (Array.isArray(data)) {
        paths.push(`${basePath}[*]`);
        // Sample first item for structure if available
        if (data.length > 0) {
            const subPaths = extractFieldPathsFromData(data[0], `${basePath}[*]`);
            paths.push(...subPaths.filter(p => p !== `${basePath}[*]`));
        }
    } else {
        for (const [key, value] of Object.entries(data)) {
            const currentPath = basePath === '$' ? `$.${key}` : `${basePath}.${key}`;

            if (value && typeof value === 'object') {
                if (Array.isArray(value)) {
                    paths.push(`${currentPath}[*]`);
                    // Sample first item for nested structure
                    if (value.length > 0 && typeof value[0] === 'object') {
                        const subPaths = extractFieldPathsFromData(value[0], `${currentPath}[*]`);
                        paths.push(...subPaths.filter(p => p !== `${currentPath}[*]`));
                    }
                } else {
                    const subPaths = extractFieldPathsFromData(value, currentPath);
                    paths.push(...subPaths);
                }
            } else {
                paths.push(currentPath);
            }
        }
    }

    return paths;
} 