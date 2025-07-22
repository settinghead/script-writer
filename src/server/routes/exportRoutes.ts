import { Router, Request, Response } from 'express';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { AuthMiddleware } from '../middleware/auth';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { ProjectRepository } from '../transform-jsondoc-framework/ProjectRepository';
import { deduceProjectTitle } from '../../common/utils/projectTitleDeduction';
import { computeCanonicalJsondocsFromLineage, extractCanonicalJsondocIds } from '../../common/canonicalJsondocLogic';
import { buildLineageGraph } from '../../common/transform-jsondoc-framework/lineageResolution';
import { db } from '../database/connection';

export const createExportRoutes = (authMiddleware: AuthMiddleware) => {
    const router = Router();

    // Initialize repositories
    const jsondocRepo = new JsondocRepository(db);
    const transformRepo = new TransformRepository(db);
    const projectRepo = new ProjectRepository(db);

    interface ExportRequest {
        format: 'markdown' | 'docx';
        selectedItems: string[];
        filename?: string;
    }

    interface ExportableItem {
        id: string;
        name: string;
        content: any;
        type: 'brainstorm_input' | 'idea_collection' | 'chosen_idea' | '剧本设定' | 'chronicles' | 'episode_planning';
    }

    /**
     * Fetch all project data needed for export
     */
    async function fetchProjectData(projectId: string, userId: string) {
        // Verify user has access to this project
        const hasAccess = await jsondocRepo.userHasProjectAccess(userId, projectId);
        if (!hasAccess) {
            throw new Error('Access denied to project');
        }

        // Fetch all project data needed for lineage computation
        let jsondocs, transforms, humanTransforms, transformInputs, transformOutputs;
        try {
            jsondocs = await jsondocRepo.getAllProjectJsondocsForLineage(projectId);
            transforms = await jsondocRepo.getAllProjectTransformsForLineage(projectId);
            humanTransforms = await jsondocRepo.getAllProjectHumanTransformsForLineage(projectId);
            transformInputs = await jsondocRepo.getAllProjectTransformInputsForLineage(projectId);
            transformOutputs = await jsondocRepo.getAllProjectTransformOutputsForLineage(projectId);
        } catch (error) {
            console.error('Error fetching project data:', error);
            throw error;
        }

        console.log('Fetched project data:', {
            jsondocs: jsondocs ? jsondocs.length : 'undefined',
            transforms: transforms ? transforms.length : 'undefined',
            humanTransforms: humanTransforms ? humanTransforms.length : 'undefined',
            transformInputs: transformInputs ? transformInputs.length : 'undefined',
            transformOutputs: transformOutputs ? transformOutputs.length : 'undefined'
        });

        return {
            jsondocs,
            transforms,
            humanTransforms,
            transformInputs,
            transformOutputs
        };
    }

    /**
     * Generate exportable items from project data using canonical jsondoc logic
     */
    function generateExportableItems(projectData: any): ExportableItem[] {
        const { jsondocs, transforms, humanTransforms, transformInputs, transformOutputs } = projectData;

        // Safety check for undefined data
        if (!jsondocs || !transforms || !humanTransforms || !transformInputs || !transformOutputs) {
            console.error('Missing project data:', {
                jsondocs: jsondocs ? jsondocs.length : 'undefined',
                transforms: transforms ? transforms.length : 'undefined',
                humanTransforms: humanTransforms ? humanTransforms.length : 'undefined',
                transformInputs: transformInputs ? transformInputs.length : 'undefined',
                transformOutputs: transformOutputs ? transformOutputs.length : 'undefined'
            });
            return [];
        }

        // Build lineage graph
        const lineageGraph = buildLineageGraph(
            jsondocs,
            transforms,
            humanTransforms,
            transformInputs,
            transformOutputs
        );

        // Get canonical jsondocs context
        const canonicalContext = computeCanonicalJsondocsFromLineage(
            lineageGraph,
            jsondocs,
            transforms,
            humanTransforms,
            transformInputs,
            transformOutputs
        );

        const items: ExportableItem[] = [];

        // Add brainstorm input if exists
        if (canonicalContext.canonicalBrainstormInput) {
            items.push({
                id: 'brainstorm-input-editor',
                name: '创意输入',
                content: canonicalContext.canonicalBrainstormInput,
                type: 'brainstorm_input'
            });
        }

        // Add brainstorm collection if exists
        if (canonicalContext.canonicalBrainstormCollection) {
            items.push({
                id: 'idea-collection',
                name: '创意集合',
                content: canonicalContext.canonicalBrainstormCollection,
                type: 'idea_collection'
            });
        }

        // Add brainstorm idea if exists
        if (canonicalContext.canonicalBrainstormIdea) {
            items.push({
                id: 'single-idea-editor',
                name: '选定创意',
                content: canonicalContext.canonicalBrainstormIdea,
                type: 'chosen_idea'
            });
        }

        // Add 剧本设定 if exists
        if (canonicalContext.canonicalOutlineSettings) {
            items.push({
                id: '剧本设定-display',
                name: '大纲设置',
                content: canonicalContext.canonicalOutlineSettings,
                type: '剧本设定'
            });
        }

        // Add chronicles if exists
        if (canonicalContext.canonicalChronicles) {
            items.push({
                id: 'chronicles-display',
                name: '时间顺序大纲',
                content: canonicalContext.canonicalChronicles,
                type: 'chronicles'
            });
        }

        // Add episode planning if exists
        if (canonicalContext.canonicalEpisodePlanning) {
            items.push({
                id: 'episode-planning-display',
                name: '剧集规划',
                content: canonicalContext.canonicalEpisodePlanning,
                type: 'episode_planning'
            });
        }

        return items;
    }

    /**
     * Format item content for export
     */
    function formatItemContent(item: ExportableItem): string {
        try {
            switch (item.type) {
                case 'brainstorm_input':
                    return formatBrainstormInput(item.content);
                case 'idea_collection':
                    return formatIdeaCollection(item.content);
                case 'chosen_idea':
                    return formatChosenIdea(item.content);
                case '剧本设定':
                    return formatOutlineSettings(item.content);
                case 'chronicles':
                    return formatChronicles(item.content);
                case 'episode_planning':
                    return formatEpisodePlanning(item.content);
                default:
                    return '无法识别的内容类型';
            }
        } catch (error) {
            console.error('Error formatting item content:', error);
            return '内容格式化错误';
        }
    }

    function formatBrainstormInput(jsondoc: any): string {
        if (!jsondoc || !jsondoc.data) return '无内容';

        try {
            const data = JSON.parse(jsondoc.data);
            let content = '';

            if (data.genre) content += `**类型**: ${data.genre}\n\n`;
            if (data.platform) content += `**平台**: ${data.platform}\n\n`;
            if (data.theme) content += `**主题**: ${data.theme}\n\n`;
            if (data.requirements) content += `**要求**: ${data.requirements}\n\n`;

            return content;
        } catch (error) {
            return '内容解析错误';
        }
    }

    function formatIdeaCollection(effectiveIdeas: any[]): string {
        if (!Array.isArray(effectiveIdeas) || effectiveIdeas.length === 0) return '无创意';

        let content = '';

        effectiveIdeas.forEach((idea, index) => {
            content += `### 创意 ${index + 1}\n\n`;

            // Extract idea data based on jsondocPath
            let ideaData: any = null;

            if (idea.jsondocPath === '$') {
                // Standalone idea - get from jsondoc directly
                // Note: We need to fetch the jsondoc separately since effectiveIdeas only contains metadata
                content += `**来源**: 独立创意\n`;
                content += `**ID**: ${idea.jsondocId}\n\n`;
            } else {
                // Idea from collection - extract from path
                content += `**来源**: 创意集合 (${idea.jsondocPath})\n`;
                content += `**索引**: ${idea.index}\n\n`;
            }
        });

        return content;
    }

    function formatChosenIdea(jsondoc: any): string {
        if (!jsondoc || !jsondoc.data) return '无内容';

        try {
            const data = JSON.parse(jsondoc.data);
            let content = '';

            if (data.title) content += `**标题**: ${data.title}\n\n`;
            if (data.body) content += `**内容**: ${data.body}\n\n`;

            return content;
        } catch (error) {
            return '内容解析错误';
        }
    }

    function formatOutlineSettings(jsondoc: any): string {
        if (!jsondoc || !jsondoc.data) return '无内容';

        try {
            const data = JSON.parse(jsondoc.data);
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
        } catch (error) {
            return '内容解析错误';
        }
    }

    function formatChronicles(jsondoc: any): string {
        if (!jsondoc || !jsondoc.data) return '无内容';

        try {
            const data = JSON.parse(jsondoc.data);
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
        } catch (error) {
            return '内容解析错误';
        }
    }

    function formatEpisodePlanning(jsondoc: any): string {
        if (!jsondoc || !jsondoc.data) return '无内容';

        try {
            const data = JSON.parse(jsondoc.data);
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
        } catch (error) {
            return '内容解析错误';
        }
    }

    /**
     * Generate markdown content
     */
    function generateMarkdown(items: ExportableItem[], selectedItemIds: string[]): string {
        const selectedItems = items.filter(item => selectedItemIds.includes(item.id));

        let markdown = `# 项目导出\n\n`;
        markdown += `导出时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

        for (const item of selectedItems) {
            markdown += `## ${item.name}\n\n`;
            markdown += formatItemContent(item) + '\n\n';
        }

        return markdown;
    }

    /**
     * Generate docx content
     */
    async function generateDocx(items: ExportableItem[], selectedItemIds: string[]): Promise<Buffer> {
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

        return await Packer.toBuffer(doc);
    }

    // GET /api/export/:projectId/items - Get exportable items for a project
    router.get('/:projectId/items', authMiddleware.authenticate, async (req: Request, res: Response) => {
        try {
            const { projectId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Verify user has access to the project
            const hasAccess = await jsondocRepo.userHasProjectAccess(userId, projectId);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied to this project' });
                return;
            }

            // Get all available items
            const allItems = await generateExportableItems(projectId);
            res.json(allItems);
        } catch (error) {
            console.error('Error getting exportable items:', error);
            res.status(500).json({ error: 'Failed to get exportable items' });
        }
    });

    // Preview export content in markdown format
    router.post('/:projectId/preview', authMiddleware.authenticate, async (req: Request, res: Response) => {
        try {
            const { projectId } = req.params;
            const { selectedItems } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Verify user has access to the project
            const hasAccess = await jsondocRepo.userHasProjectAccess(userId, projectId);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied to this project' });
                return;
            }

            // Get all available items
            const allItems = await generateExportableItems(projectId);

            // Filter to only selected items
            const itemsToExport = allItems.filter(item => selectedItems.includes(item.id));

            // Generate markdown content
            const markdownContent = generateMarkdown(itemsToExport, selectedItems);

            res.json({ content: markdownContent });
        } catch (error) {
            console.error('Error generating preview:', error);
            res.status(500).json({ error: 'Failed to generate preview' });
        }
    });

    // POST /api/export/:projectId - Export project content
    router.post('/:projectId', authMiddleware.authenticate, async (req: Request, res: Response) => {
        try {
            const { projectId } = req.params;
            const { format, selectedItems, filename }: ExportRequest = req.body;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            if (!format || !selectedItems || selectedItems.length === 0) {
                res.status(400).json({ error: 'Missing required parameters' });
                return;
            }

            // Fetch project data
            const projectData = await fetchProjectData(projectId, userId);

            // Generate exportable items
            const exportableItems = generateExportableItems(projectData);

            if (format === 'markdown') {
                const markdown = generateMarkdown(exportableItems, selectedItems);
                const finalFilename = filename || `项目导出_${new Date().toISOString().slice(0, 10)}.md`;

                res.setHeader('Content-Type', 'text/markdown');
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(finalFilename)}"`);
                res.send(markdown);
            } else if (format === 'docx') {
                const docxBuffer = await generateDocx(exportableItems, selectedItems);
                const finalFilename = filename || `项目导出_${new Date().toISOString().slice(0, 10)}.docx`;

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(finalFilename)}"`);
                res.send(docxBuffer);
            } else {
                res.status(400).json({ error: 'Invalid format' });
            }
        } catch (error) {
            console.error('Export failed:', error);

            if (error instanceof Error && error.message.includes('Access denied')) {
                res.status(403).json({ error: 'Access denied to project' });
                return;
            }

            res.status(500).json({ error: 'Export failed' });
        }
    });

    return router;
}; 