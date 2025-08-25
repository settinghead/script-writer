import { deduceProjectTitle } from '../../common/utils/projectTitleDeduction';

export interface ExportableItem {
    id: string;
    name: string;
    content: any;
    type:
    | 'brainstorm_input'
    | 'idea_collection'
    | 'chosen_idea'
    | '故事设定'
    | 'chronicles'
    | '分集结构'
    | 'episode_group'
    | '单集大纲'
    | '单集剧本';
    defaultSelected: boolean;
    // For episode groups
    episodeNumber?: number;
    hasSynopsis?: boolean;
    hasScript?: boolean;
    synopsisContent?: any;
    scriptContent?: any;
}

export interface ExportOptions {
    format: 'markdown' | 'docx';
    selectedItems: string[];
    filename: string;
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