import {
    buildLineageGraph,
    LineageGraph,
    LineageNode,
    LineageNodeJsonDoc,
    LineageNodeTransform
} from '../transform-jsonDoc-framework/lineageResolution';
import type {
    ElectricJsonDoc,
    ElectricTransform,
    ElectricHumanTransform,
    ElectricTransformInput,
    ElectricTransformOutput
} from '../types';

export interface ProjectDataForContext {
    jsonDocs: ElectricJsonDoc[];
    transforms: ElectricTransform[];
    humanTransforms: ElectricHumanTransform[];
    transformInputs: ElectricTransformInput[];
    transformOutputs: ElectricTransformOutput[];
}

interface NarrativeEvent {
    timestamp: string;
    type: 'initial_content' | 'ai_generation' | 'user_edit';
    description: string;
    details: string;
    jsonDoc?: LineageNodeJsonDoc;
    transform?: LineageNodeTransform;
}

/**
 * Convert an jsonDoc to a readable context string based on its type
 */
function jsonDocToContextString(jsonDoc: ElectricJsonDoc, maxLength: number = 200): string {
    try {
        const data = JSON.parse(jsonDoc.data);

        switch (jsonDoc.schema_type) {
            case 'brainstorm_collection':
                if (data.ideas && Array.isArray(data.ideas)) {
                    const ideaDescriptions = data.ideas.map((idea: any) => {
                        const title = idea.title || '无标题';
                        const content = idea.content || idea.body || '';
                        const truncatedContent = content.length > 200 ? content.substring(0, 200) + '...' : content;
                        return `    - "${title}": ${truncatedContent}`;
                    }).join('\n');
                    return `包含 ${data.ideas.length} 个创意想法:\n${ideaDescriptions}`;
                }
                break;

            case 'brainstorm_input_params':
                const parts = [];
                if (data.genre) parts.push(`题材: ${data.genre}`);
                if (data.platform) parts.push(`平台: ${data.platform}`);
                if (data.themes && data.themes.length > 0) parts.push(`主题: ${data.themes.join(', ')}`);
                if (data.requirements) parts.push(`要求: ${data.requirements}`);
                return parts.join('; ');


            case 'brainstorm_idea':
                const itemParts = [];
                if (data.title) itemParts.push(`标题: "${data.title}"`);
                if (data.content) {
                    const content = data.content.toString();
                    itemParts.push(`内容: ${content.length > maxLength ? content.substring(0, maxLength) + '...' : content}`);
                }
                if (data.body) {
                    const body = data.body.toString();
                    itemParts.push(`内容: ${body.length > maxLength ? body.substring(0, maxLength) + '...' : body}`);
                }
                return itemParts.join('; ');
            default:
                // For unknown types, try to extract meaningful fields
                if (data.title) return `标题: "${data.title}"`;
                if (data.name) return `名称: "${data.name}"`;
                if (data.content) {
                    const content = data.content.toString();
                    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
                }

                // Last resort: stringify the whole object
                const jsonStr = JSON.stringify(data);
                return jsonStr.length > maxLength ? jsonStr.substring(0, maxLength) + '...' : jsonStr;
        }

        // Fallback to JSON if no specific handler
        const jsonStr = JSON.stringify(data);
        return jsonStr.length > maxLength ? jsonStr.substring(0, maxLength) + '...' : jsonStr;

    } catch (error) {
        // If JSON parsing fails, return raw data (truncated)
        const rawData = jsonDoc.data.toString();
        return rawData.length > maxLength ? rawData.substring(0, maxLength) + '...' : rawData;
    }
}

/**
 * Generate a comprehensive narrative history based on the lineage graph
 */
export async function prepareAgentPromptContext(
    projectData: ProjectDataForContext,
    projectId: string
): Promise<string> {
    // Build the lineage graph
    const lineageGraph = buildLineageGraph(
        projectData.jsonDocs,
        projectData.transforms,
        projectData.humanTransforms,
        projectData.transformInputs,
        projectData.transformOutputs
    );

    // Convert lineage graph to chronological events
    const events: NarrativeEvent[] = [];

    // Process all nodes in the graph
    for (const [nodeId, node] of lineageGraph.nodes) {
        if (node.type === 'jsonDoc') {
            const jsonDocNode = node as LineageNodeJsonDoc;

            if (jsonDocNode.jsonDoc.origin_type === 'user_input') {
                // This is initial user input
                events.push({
                    timestamp: jsonDocNode.createdAt,
                    type: 'initial_content',
                    description: `项目开始：用户修改了${jsonDocNode.jsonDoc.schema_type}`,
                    details: jsonDocToContextString(jsonDocNode.jsonDoc),
                    jsonDoc: jsonDocNode
                });
            } else if (jsonDocNode.sourceTransform !== "none") {
                // This is AI-generated content
                const sourceTransform = jsonDocNode.sourceTransform as LineageNodeTransform;
                if (sourceTransform.transformType === 'llm') {
                    events.push({
                        timestamp: jsonDocNode.createdAt,
                        type: 'ai_generation',
                        description: `AI生成的${jsonDocNode.jsonDoc.schema_type}`,
                        details: jsonDocToContextString(jsonDocNode.jsonDoc),
                        jsonDoc: jsonDocNode,
                        transform: sourceTransform
                    });
                } else if (sourceTransform.transformType === 'human') {
                    events.push({
                        timestamp: jsonDocNode.createdAt,
                        type: 'user_edit',
                        description: `用户编辑${jsonDocNode.jsonDoc.schema_type}`,
                        details: jsonDocToContextString(jsonDocNode.jsonDoc),
                        jsonDoc: jsonDocNode,
                        transform: sourceTransform
                    });
                }
            }
        }
    }

    // Sort events chronologically
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Build narrative
    let narrative = '***项目历史记录：***\n\n';

    // Group events by type for better organization
    const initialEvents = events.filter(e => e.type === 'initial_content');
    const aiEvents = events.filter(e => e.type === 'ai_generation');
    const userEvents = events.filter(e => e.type === 'user_edit');

    // Start with initial content
    if (initialEvents.length > 0) {
        for (const event of initialEvents) {
            narrative += `• ${event.description}\n`;
            narrative += `  内容：${event.details}\n`;
            narrative += `  (JsonDoc ID: ${event.jsonDoc?.jsonDocId})\n\n`;
        }
    }

    // Add AI activities
    if (aiEvents.length > 0) {
        narrative += '**项目活动：**\n';
        for (const event of aiEvents) {
            let description = `• ${new Date(event.timestamp).toLocaleString('zh-CN')} - `;

            if (event.transform && event.transform.sourceJsonDocs.length > 0) {
                const sourceIds = event.transform.sourceJsonDocs.map(a => a.jsonDocId).join(', ');
                description += `AI根据[${sourceIds}]，生成了以下${event.jsonDoc?.jsonDoc.schema_type}`;
            } else {
                description += event.description;
            }

            narrative += description + '\n';
            narrative += `  内容：${event.details}\n`;
            narrative += `  (JsonDoc ID: ${event.jsonDoc?.jsonDocId})\n\n`;
        }
    }

    // Add user edits
    if (userEvents.length > 0) {
        narrative += '**用户编辑：**\n';
        for (const event of userEvents) {
            let description = `• ${new Date(event.timestamp).toLocaleString('zh-CN')} - `;

            if (event.transform && event.transform.sourceJsonDocs.length > 0) {
                const sourceIds = event.transform.sourceJsonDocs.map(a => a.jsonDocId).join(', ');
                description += `用户基于[${sourceIds}]，编辑了${event.jsonDoc?.jsonDoc.schema_type}`;
            } else {
                description += event.description;
            }

            narrative += description + '\n';
            narrative += `  内容：${event.details}\n`;
            narrative += `  (JsonDoc ID: ${event.jsonDoc?.jsonDocId})\n\n`;
        }
    }

    // Add current status
    narrative += '**当前状态：**\n';
    narrative += `项目目前有 ${lineageGraph.nodes.size} 个最新版本的内容：\n`;

    const leafNodes = Array.from(lineageGraph.nodes.values())
        .filter(node => node.type === 'jsonDoc' && node.isLeaf)
        .map(node => node as LineageNodeJsonDoc);

    for (const jsonDoc of leafNodes) {
        narrative += `• ${jsonDoc.jsonDoc.schema_type}[${jsonDoc.jsonDocId}] - ${jsonDocToContextString(jsonDoc.jsonDoc)}\n`;
    }

    return narrative;
} 