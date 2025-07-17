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
                    name: '时间顺序大纲',
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

export const exportService = {
    async getExportableItems(projectId: string): Promise<ExportableItem[]> {
        const response = await fetch(`/api/export/${projectId}/items`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer debug-auth-token-script-writer-dev`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to get exportable items');
        }

        return response.json();
    },

    async previewExport(projectId: string, selectedItems: string[]): Promise<string> {
        const response = await fetch(`/api/export/${projectId}/preview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer debug-auth-token-script-writer-dev`
            },
            body: JSON.stringify({ selectedItems })
        });

        if (!response.ok) {
            throw new Error('Failed to generate preview');
        }

        const result = await response.json();
        return result.content;
    },

    async exportProject(projectId: string, format: 'markdown' | 'docx', selectedItems: string[], filename?: string): Promise<void> {
        const response = await fetch(`/api/export/${projectId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer debug-auth-token-script-writer-dev`
            },
            body: JSON.stringify({
                format,
                selectedItems,
                filename
            })
        });

        if (!response.ok) {
            throw new Error(`Export failed: ${response.statusText}`);
        }

        // Get the filename from the response headers
        const contentDisposition = response.headers.get('Content-Disposition');
        const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/);
        const downloadFilename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : (filename || `export_${Date.now()}`);

        // Download the file
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = downloadFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    }
};

// All formatting and download functionality is now handled by the backend 