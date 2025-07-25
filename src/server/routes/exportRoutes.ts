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
        type: 'brainstorm_input' | 'idea_collection' | 'chosen_idea' | '剧本设定' | 'chronicles' | 'episode_planning' | 'episode_group';
        defaultSelected: boolean;
        // For episode groups
        episodeNumber?: number;
        hasSynopsis?: boolean;
        hasScript?: boolean;
        synopsisContent?: any;
        scriptContent?: any;
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
                type: 'brainstorm_input',
                defaultSelected: false
            });
        }

        // Add brainstorm collection if exists
        if (canonicalContext.canonicalBrainstormCollection) {
            items.push({
                id: 'idea-collection',
                name: '创意集合',
                content: canonicalContext.canonicalBrainstormCollection,
                type: 'idea_collection',
                defaultSelected: false
            });
        }

        // Add brainstorm idea if exists
        if (canonicalContext.canonicalBrainstormIdea) {
            items.push({
                id: 'single-idea-editor',
                name: '选定创意',
                content: canonicalContext.canonicalBrainstormIdea,
                type: 'chosen_idea',
                defaultSelected: true
            });
        }

        // Add 剧本设定 if exists
        if (canonicalContext.canonicalOutlineSettings) {
            items.push({
                id: '剧本设定-display',
                name: '大纲设置',
                content: canonicalContext.canonicalOutlineSettings,
                type: '剧本设定',
                defaultSelected: true
            });
        }

        // Add chronicles if exists
        if (canonicalContext.canonicalChronicles) {
            items.push({
                id: 'chronicles-display',
                name: '时间顺序大纲',
                content: canonicalContext.canonicalChronicles,
                type: 'chronicles',
                defaultSelected: true
            });
        }

        // Add episode planning if exists
        if (canonicalContext.canonicalEpisodePlanning) {
            items.push({
                id: 'episode-planning-display',
                name: '剧集规划',
                content: canonicalContext.canonicalEpisodePlanning,
                type: 'episode_planning',
                defaultSelected: true
            });
        }

        // Group episodes by number and create combined items
        const episodeGroups = new Map<number, {
            synopsis?: any;
            script?: any;
        }>();

        // Add synopsis jsondocs to groups
        canonicalContext.canonicalEpisodeSynopsisList.forEach((episodeSynopsis) => {
            try {
                const data = typeof episodeSynopsis.data === 'string' ? JSON.parse(episodeSynopsis.data) : episodeSynopsis.data;
                const episodeNumber = data.episodeNumber || 1;

                if (!episodeGroups.has(episodeNumber)) {
                    episodeGroups.set(episodeNumber, {});
                }
                episodeGroups.get(episodeNumber)!.synopsis = episodeSynopsis;
            } catch (error) {
                console.warn('Failed to parse episode synopsis data:', error);
            }
        });

        // Add script jsondocs to groups
        canonicalContext.canonicalEpisodeScriptsList.forEach((episodeScript) => {
            try {
                const data = typeof episodeScript.data === 'string' ? JSON.parse(episodeScript.data) : episodeScript.data;
                const episodeNumber = data.episodeNumber || 1;

                if (!episodeGroups.has(episodeNumber)) {
                    episodeGroups.set(episodeNumber, {});
                }
                episodeGroups.get(episodeNumber)!.script = episodeScript;
            } catch (error) {
                console.warn('Failed to parse episode script data:', error);
            }
        });

        // Create combined episode items
        const sortedEpisodeNumbers = Array.from(episodeGroups.keys()).sort((a, b) => a - b);
        sortedEpisodeNumbers.forEach(episodeNumber => {
            const group = episodeGroups.get(episodeNumber)!;
            const hasSynopsis = !!group.synopsis;
            const hasScript = !!group.script;

            if (hasSynopsis || hasScript) {
                items.push({
                    id: `episode-group-${episodeNumber}`,
                    name: `第${episodeNumber}集`,
                    content: group, // Contains both synopsis and script
                    type: 'episode_group',
                    defaultSelected: true,
                    episodeNumber,
                    hasSynopsis,
                    hasScript,
                    synopsisContent: group.synopsis,
                    scriptContent: group.script
                });
            }
        });

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
                case 'episode_group':
                    return formatEpisodeGroup(item.content);
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
            const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
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

    function formatIdeaCollection(jsondoc: any): string {
        if (!jsondoc || !jsondoc.data) return '无内容';

        try {
            const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
            let content = '';

            if (data.ideas && Array.isArray(data.ideas)) {
                data.ideas.forEach((idea: any, index: number) => {
                    content += `### 创意 ${index + 1}\n\n`;
                    if (idea.title) content += `**标题**: ${idea.title}\n\n`;
                    if (idea.body) content += `**内容**: ${idea.body}\n\n`;
                });
            }

            return content;
        } catch (error) {
            return '内容解析错误';
        }
    }

    function formatChosenIdea(jsondoc: any): string {
        if (!jsondoc || !jsondoc.data) return '无内容';

        try {
            const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
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
            const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
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
            const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
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
            const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
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

    function formatEpisodeGroup(group: { synopsis?: any; script?: any }): string {
        let content = '';
        const hasSynopsis = !!group.synopsis;
        const hasScript = !!group.script;

        if (hasSynopsis) {
            content += `**大纲**: \n\n`;
            content += formatEpisodeSynopsis(group.synopsis);
            content += '\n\n';
        }

        if (hasScript) {
            content += `**剧本**: \n\n`;
            content += formatEpisodeScript(group.script);
            content += '\n\n';
        }

        return content;
    }

    function formatEpisodeSynopsis(jsondoc: any): string {
        if (!jsondoc || !jsondoc.data) return '无内容';

        try {
            const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
            let content = '';

            if (data.episodeNumber) content += `**集数**: 第${data.episodeNumber}集\n\n`;
            if (data.title) content += `**标题**: ${data.title}\n\n`;
            if (data.summary) content += `**概要**: ${data.summary}\n\n`;

            if (data.key_scenes && Array.isArray(data.key_scenes)) {
                content += `**关键场景**:\n`;
                data.key_scenes.forEach((scene: string, index: number) => {
                    content += `${index + 1}. ${scene}\n`;
                });
                content += '\n';
            }

            if (data.character_development) {
                content += `**角色发展**: ${data.character_development}\n\n`;
            }

            if (data.emotional_arc) {
                content += `**情感线**: ${data.emotional_arc}\n\n`;
            }

            return content;
        } catch (error) {
            return '内容解析错误';
        }
    }

    function formatEpisodeScript(jsondoc: any): string {
        if (!jsondoc || !jsondoc.data) return '无内容';

        try {
            const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
            let content = '';

            if (data.episodeNumber) content += `**集数**: 第${data.episodeNumber}集\n\n`;
            if (data.title) content += `**标题**: ${data.title}\n\n`;

            if (data.scenes && Array.isArray(data.scenes)) {
                content += `**场景**:\n\n`;
                data.scenes.forEach((scene: any, index: number) => {
                    content += `### 场景 ${index + 1}\n`;
                    if (scene.location) content += `**地点**: ${scene.location}\n`;
                    if (scene.time) content += `**时间**: ${scene.time}\n`;
                    if (scene.characters && Array.isArray(scene.characters)) {
                        content += `**角色**: ${scene.characters.join(', ')}\n`;
                    }
                    if (scene.action) content += `**动作**: ${scene.action}\n`;
                    if (scene.dialogue && Array.isArray(scene.dialogue)) {
                        content += `**对话**:\n`;
                        scene.dialogue.forEach((line: any) => {
                            if (line.character && line.text) {
                                content += `${line.character}: ${line.text}\n`;
                            }
                        });
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

            // Fetch project data and generate exportable items
            const projectData = await fetchProjectData(projectId, userId);
            const allItems = generateExportableItems(projectData);

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

            // Fetch project data and generate exportable items
            const projectData = await fetchProjectData(projectId, userId);
            const allItems = generateExportableItems(projectData);

            // Generate markdown content
            const markdownContent = generateMarkdown(allItems, selectedItems);

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