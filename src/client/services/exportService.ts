import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { deduceProjectTitle } from '../../common/utils/projectTitleDeduction';

export interface ExportableItem {
    id: string;
    name: string;
    content: any;
    type: 'brainstorm_input' | 'idea_collection' | 'chosen_idea' | 'outline_settings' | 'chronicles' | 'episode_planning';
    defaultSelected: boolean;
}

export interface ExportOptions {
    format: 'markdown' | 'docx';
    selectedItems: string[];
    filename: string;
}

/**
 * Generate exportable items from unified workflow state
 */
export function generateExportableItems(
    displayComponents: any[],
    lineageGraph: any,
    jsondocs: any[]
): ExportableItem[] {
    const items: ExportableItem[] = [];

    for (const component of displayComponents) {
        let item: ExportableItem | null = null;

        switch (component.id) {
            case 'brainstorm-input-editor':
                item = {
                    id: 'brainstorm-input-editor',
                    name: '创意输入',
                    content: component.props.jsondoc,
                    type: 'brainstorm_input',
                    defaultSelected: false
                };
                break;

            case 'idea-collection':
                item = {
                    id: 'idea-collection',
                    name: '创意集合',
                    content: component.props.ideas,
                    type: 'idea_collection',
                    defaultSelected: false
                };
                break;

            case 'single-idea-editor':
                item = {
                    id: 'single-idea-editor',
                    name: '选定创意',
                    content: component.props.brainstormIdea,
                    type: 'chosen_idea',
                    defaultSelected: true
                };
                break;

            case 'outline-settings-display':
                item = {
                    id: 'outline-settings-display',
                    name: '大纲设置',
                    content: component.props.outlineSettings,
                    type: 'outline_settings',
                    defaultSelected: true
                };
                break;

            case 'chronicles-display':
                item = {
                    id: 'chronicles-display',
                    name: '编年史',
                    content: component.props.chroniclesJsondoc,
                    type: 'chronicles',
                    defaultSelected: true
                };
                break;

            case 'episode-planning-display':
                item = {
                    id: 'episode-planning-display',
                    name: '剧集规划',
                    content: component.props.episodePlanningJsondoc,
                    type: 'episode_planning',
                    defaultSelected: true
                };
                break;
        }

        if (item) {
            items.push(item);
        }
    }

    return items;
}

/**
 * Generate filename from project data
 */
export function generateExportFilename(
    lineageGraph: any,
    jsondocs: any[],
    format: 'markdown' | 'docx'
): string {
    const title = deduceProjectTitle(lineageGraph, jsondocs);
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const extension = format === 'markdown' ? 'md' : 'docx';

    // Clean filename (remove invalid characters)
    const cleanTitle = title.replace(/[<>:"/\\|?*]/g, '_');

    return `${cleanTitle}_${timestamp}.${extension}`;
}

/**
 * Export to markdown format
 */
export function exportToMarkdown(
    items: ExportableItem[],
    selectedItemIds: string[],
    filename: string
): void {
    const selectedItems = items.filter(item => selectedItemIds.includes(item.id));

    let markdown = `# 项目导出\n\n`;
    markdown += `导出时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

    for (const item of selectedItems) {
        markdown += `## ${item.name}\n\n`;
        markdown += formatItemContent(item) + '\n\n';
    }

    downloadFile(markdown, filename, 'text/markdown');
}

/**
 * Export to docx format
 */
export async function exportToDocx(
    items: ExportableItem[],
    selectedItemIds: string[],
    filename: string
): Promise<void> {
    const selectedItems = items.filter(item => selectedItemIds.includes(item.id));

    const children: any[] = [];

    // Title
    children.push(
        new Paragraph({
            text: '项目导出',
            heading: HeadingLevel.HEADING_1,
        })
    );

    // Export time
    children.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: `导出时间: ${new Date().toLocaleString('zh-CN')}`,
                    italics: true,
                })
            ],
        })
    );

    children.push(new Paragraph({ text: '' })); // Empty line

    // Content sections
    for (const item of selectedItems) {
        // Section header
        children.push(
            new Paragraph({
                text: item.name,
                heading: HeadingLevel.HEADING_2,
            })
        );

        // Section content
        const contentLines = formatItemContent(item).split('\n');
        for (const line of contentLines) {
            if (line.trim()) {
                children.push(
                    new Paragraph({
                        children: [new TextRun({ text: line })],
                    })
                );
            } else {
                children.push(new Paragraph({ text: '' }));
            }
        }

        children.push(new Paragraph({ text: '' })); // Empty line after section
    }

    const doc = new Document({
        sections: [
            {
                children,
            },
        ],
    });

    const buffer = await Packer.toBuffer(doc);
    downloadFile(buffer, filename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

/**
 * Format item content for export
 */
function formatItemContent(item: ExportableItem): string {
    try {
        let data: any;

        if (item.type === 'idea_collection') {
            // Handle idea collection (array of ideas)
            const ideas = item.content;
            if (!Array.isArray(ideas)) return '无内容';

            let content = '';
            ideas.forEach((idea: any, index: number) => {
                content += `### 创意 ${index + 1}\n\n`;
                content += `**标题**: ${idea.title || '无标题'}\n\n`;
                content += `**内容**: ${idea.body || '无内容'}\n\n`;
            });
            return content;
        } else {
            // Handle single jsondoc
            const jsondoc = item.content;
            if (!jsondoc || !jsondoc.data) return '无内容';

            data = JSON.parse(jsondoc.data);
        }

        switch (item.type) {
            case 'brainstorm_input':
                return formatBrainstormInput(data);
            case 'chosen_idea':
                return formatChosenIdea(data);
            case 'outline_settings':
                return formatOutlineSettings(data);
            case 'chronicles':
                return formatChronicles(data);
            case 'episode_planning':
                return formatEpisodePlanning(data);
            default:
                return JSON.stringify(data, null, 2);
        }
    } catch (error) {
        return '内容解析错误';
    }
}

function formatBrainstormInput(data: any): string {
    let content = '';
    if (data.genre) content += `**类型**: ${data.genre}\n\n`;
    if (data.platform) content += `**平台**: ${data.platform}\n\n`;
    if (data.theme) content += `**主题**: ${data.theme}\n\n`;
    if (data.requirements) content += `**要求**: ${data.requirements}\n\n`;
    return content;
}

function formatChosenIdea(data: any): string {
    let content = '';
    if (data.title) content += `**标题**: ${data.title}\n\n`;
    if (data.body) content += `**内容**: ${data.body}\n\n`;
    return content;
}

function formatOutlineSettings(data: any): string {
    let content = '';
    if (data.title) content += `**标题**: ${data.title}\n\n`;
    if (data.genre) content += `**类型**: ${data.genre}\n\n`;
    if (data.target_platform) content += `**目标平台**: ${data.target_platform}\n\n`;
    if (data.target_episodes) content += `**目标集数**: ${data.target_episodes}\n\n`;
    if (data.core_themes && Array.isArray(data.core_themes)) {
        content += `**核心主题**: ${data.core_themes.join(', ')}\n\n`;
    }
    if (data.selling_points && Array.isArray(data.selling_points)) {
        content += `**卖点**: ${data.selling_points.join(', ')}\n\n`;
    }
    if (data.satisfaction_points && Array.isArray(data.satisfaction_points)) {
        content += `**爽点**: ${data.satisfaction_points.join(', ')}\n\n`;
    }
    return content;
}

function formatChronicles(data: any): string {
    let content = '';
    if (data.title) content += `**标题**: ${data.title}\n\n`;
    if (data.synopsis_stages && Array.isArray(data.synopsis_stages)) {
        content += `**故事梗概**:\n`;
        data.synopsis_stages.forEach((stage: string, index: number) => {
            content += `${index + 1}. ${stage}\n`;
        });
        content += '\n';
    }
    if (data.characters && Array.isArray(data.characters)) {
        content += `**角色设定**:\n`;
        data.characters.forEach((char: any) => {
            content += `- **${char.name}** (${char.type}): ${char.description}\n`;
        });
        content += '\n';
    }
    return content;
}

function formatEpisodePlanning(data: any): string {
    let content = '';
    if (data.title) content += `**标题**: ${data.title}\n\n`;
    if (data.total_episodes) content += `**总集数**: ${data.total_episodes}\n\n`;
    if (data.episodes && Array.isArray(data.episodes)) {
        content += `**分集规划**:\n`;
        data.episodes.forEach((episode: any, index: number) => {
            content += `### 第${index + 1}集\n`;
            if (episode.title) content += `**标题**: ${episode.title}\n`;
            if (episode.summary) content += `**概要**: ${episode.summary}\n`;
            if (episode.key_scenes && Array.isArray(episode.key_scenes)) {
                content += `**关键场景**: ${episode.key_scenes.join(', ')}\n`;
            }
            content += '\n';
        });
    }
    return content;
}

/**
 * Download file utility
 */
function downloadFile(content: string | ArrayBuffer, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
} 