/**
 * Deduce project title from lineage graph by finding the most relevant title
 * Priority order: episode_planning > chronicles > 剧本设定 > chosen_idea > brainstorm_idea
 */
export function deduceProjectTitle(lineageGraph: any, jsondocs: any[]): string {
    if (!lineageGraph || !jsondocs || jsondocs.length === 0) {
        return '未命名项目';
    }

    // Priority order for title extraction
    const titlePriority = [
        'episode_planning',
        'chronicles',
        '剧本设定',
        'brainstorm_idea'
    ];

    // Find jsondocs by schema type with leaf node preference
    const jsondocsByType: { [key: string]: any[] } = {};

    for (const jsondoc of jsondocs) {
        const schemaType = jsondoc.schema_type;
        if (!jsondocsByType[schemaType]) {
            jsondocsByType[schemaType] = [];
        }
        jsondocsByType[schemaType].push(jsondoc);
    }

    // Check each type in priority order
    for (const schemaType of titlePriority) {
        const candidates = jsondocsByType[schemaType];
        if (!candidates || candidates.length === 0) continue;

        // Find leaf nodes first (preferred)
        const leafCandidates = candidates.filter(jsondoc => {
            const lineageNode = lineageGraph.nodes?.get(jsondoc.id);
            return lineageNode && lineageNode.isLeaf;
        });

        const finalCandidates = leafCandidates.length > 0 ? leafCandidates : candidates;

        // Sort by user_input first, then by most recent
        finalCandidates.sort((a, b) => {
            if (a.origin_type === 'user_input' && b.origin_type !== 'user_input') return -1;
            if (b.origin_type === 'user_input' && a.origin_type !== 'user_input') return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        // Extract title from the best candidate
        const bestCandidate = finalCandidates[0];
        const title = extractTitleFromJsondoc(bestCandidate);
        if (title) {
            return title;
        }
    }

    return '未命名项目';
}

/**
 * Extract title from a jsondoc based on its schema type
 */
function extractTitleFromJsondoc(jsondoc: any): string | null {
    try {
        const data = JSON.parse(jsondoc.data);

        switch (jsondoc.schema_type) {
            case 'episode_planning':
                return data.title || data.project_title || null;

            case 'chronicles':
                return data.title || data.project_title || null;

            case '剧本设定':
                return data.title || data.project_title || null;

            case 'brainstorm_idea':
                return data.title || null;

            default:
                return null;
        }
    } catch (error) {
        return null;
    }
} 