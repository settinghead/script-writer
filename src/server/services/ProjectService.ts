import { ProjectRepository } from '../transform-jsondoc-framework/ProjectRepository';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { Project } from '../../common/jsondocs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/connection';
import type { Kysely } from 'kysely';
import type { DB } from '../database/types';
import { ChatMessageRepository } from '../transform-jsondoc-framework/ChatMessageRepository';

export class ProjectService {
    private db: Kysely<DB>;
    private projectRepo: ProjectRepository;
    private jsondocRepo: JsondocRepository;
    private transformRepo: TransformRepository;
    private chatMessageRepo: ChatMessageRepository;

    constructor(database: Kysely<DB>) {
        this.db = database;
        this.projectRepo = new ProjectRepository(database);
        this.jsondocRepo = new JsondocRepository(database);
        this.transformRepo = new TransformRepository(database);
        this.chatMessageRepo = new ChatMessageRepository(database);
    }

    // Create a new project
    async createProject(
        userId: string,
        name: string,
        description?: string,
        projectType: string = 'script'
    ): Promise<Project> {
        return await this.projectRepo.createProject(name, userId, description, projectType);
    }

    // Get projects for a user with summary information
    async listUserProjects(userId: string): Promise<any[]> {
        const projects = await this.projectRepo.getUserProjects(userId);

        const projectsWithSummary = await Promise.all(
            projects.map(async (project) => {
                try {
                    // Get project statistics
                    const jsondocs = await this.jsondocRepo.getProjectJsondocs(project.id, 50);
                    const transforms = await this.transformRepo.getProjectTransforms(project.id, 10);

                    // Count different types of jsondocs
                    const jsondocCounts = {
                        ideations: jsondocs.filter(a => a.schema_type === 'brainstorm_collection').length,
                        剧本设定: jsondocs.filter(a => a.schema_type === '剧本设定').length,
                        chronicles: jsondocs.filter(a => a.schema_type === 'chronicles').length,
                    };

                    // Determine project status and current phase
                    const latestTransform = transforms[0]; // Most recent
                    let status = 'active';
                    let currentPhase = 'brainstorming';

                    if (latestTransform) {
                        status = latestTransform.status === 'failed' ? 'failed' : 'active';

                        // Determine phase based on latest jsondocs
                        if (jsondocCounts.chronicles > 0) {
                            currentPhase = 'chronicles';
                        } else if (jsondocCounts.剧本设定 > 0) {
                            currentPhase = '剧本设定';
                        } else {
                            currentPhase = 'brainstorming';
                        }
                    }

                    // Get some sample content for preview
                    let previewContent = '';
                    let platform = '';
                    let genre = '';

                    // Try to get brainstorm params for metadata
                    const brainstormParams = jsondocs.find(a => a.schema_type === 'brainstorm_input_params');
                    if (brainstormParams) {
                        platform = brainstormParams.data.platform || '';
                        if (brainstormParams.data.genre_paths && brainstormParams.data.genre_paths.length > 0) {
                            genre = brainstormParams.data.genre_paths
                                .map((path: string[]) => path[path.length - 1])
                                .join(', ');
                        }
                    }

                    // Try to get some content for preview
                    const userInput = jsondocs.find(a => a.schema_type === '灵感创意');
                    const brainstormIdea = jsondocs.find(a => a.schema_type === '灵感创意');
                    const outlineTitle = jsondocs.find(a => a.schema_type === '剧本设定');

                    if (outlineTitle) {
                        previewContent = outlineTitle.data.title;
                    } else if (brainstormIdea) {
                        previewContent = brainstormIdea.data.idea_title || brainstormIdea.data.idea_text || '';
                    } else if (userInput) {
                        previewContent = userInput.data.text || '';
                    }

                    return {
                        id: project.id,
                        name: project.name,
                        description: project.description || previewContent,
                        currentPhase,
                        status,
                        platform,
                        genre,
                        createdAt: project.created_at,
                        updatedAt: project.updated_at,
                        jsondocCounts
                    };
                } catch (error) {
                    console.error(`Error getting project summary for ${project.id}:`, error);
                    return {
                        id: project.id,
                        name: project.name,
                        description: project.description || '',
                        currentPhase: 'brainstorming',
                        status: 'active',
                        platform: '',
                        genre: '',
                        createdAt: project.created_at,
                        updatedAt: project.updated_at,
                        jsondocCounts: {
                            ideations: 0,
                            剧本设定: 0,
                            chronicles: 0,
                        }
                    };
                }
            })
        );

        return projectsWithSummary;
    }

    // Get project by ID
    async getProject(projectId: string, userId: string): Promise<Project | null> {
        const project = await this.projectRepo.getProject(projectId);
        if (!project) return null;

        // Check if user has access
        const hasAccess = await this.projectRepo.userHasAccess(projectId, userId);
        if (!hasAccess) return null;

        return project;
    }

    // Update project
    async updateProject(
        projectId: string,
        userId: string,
        updates: Partial<Pick<Project, 'name' | 'description' | 'status'>>
    ): Promise<void> {
        // Check if user has access
        const hasAccess = await this.projectRepo.userHasAccess(projectId, userId);
        if (!hasAccess) {
            throw new Error('Project not found or access denied');
        }

        await this.projectRepo.updateProject(projectId, updates);
    }

    // Delete project
    async deleteProject(projectId: string, userId: string): Promise<boolean> {
        // Check if user is owner
        const isOwner = await this.projectRepo.isOwner(projectId, userId);
        if (!isOwner) {
            throw new Error('Only project owners can delete projects');
        }

        await this.projectRepo.deleteProject(projectId);
        return true;
    }

    /**
     * Completely wipe a project and all associated data
     * This includes: jsondocs, transforms, chat messages, project membership, and the project itself
     * 
     * @param projectId - The project ID to wipe
     * @returns Promise<void>
     */
    async wipeProject(projectId: string): Promise<void> {
        console.log(`[ProjectService] Starting complete wipe of project ${projectId}`);

        try {
            // 1. Delete all transform inputs/outputs for this project
            await this.db
                .deleteFrom('transform_inputs')
                .where('project_id', '=', projectId)
                .execute();
            console.log(`[ProjectService] Deleted transform inputs for project ${projectId}`);

            await this.db
                .deleteFrom('transform_outputs')
                .where('project_id', '=', projectId)
                .execute();
            console.log(`[ProjectService] Deleted transform outputs for project ${projectId}`);

            // 2. Delete all LLM transforms for this project
            await this.db
                .deleteFrom('llm_transforms')
                .where('project_id', '=', projectId)
                .execute();
            console.log(`[ProjectService] Deleted LLM transforms for project ${projectId}`);

            // 3. Delete all human transforms for this project
            await this.db
                .deleteFrom('human_transforms')
                .where('project_id', '=', projectId)
                .execute();
            console.log(`[ProjectService] Deleted human transforms for project ${projectId}`);

            // 4. Delete all LLM prompts for transforms in this project
            const transformIds = await this.db
                .selectFrom('transforms')
                .select('id')
                .where('project_id', '=', projectId)
                .execute();

            if (transformIds.length > 0) {
                const transformIdList = transformIds.map((t: { id: string }) => t.id);
                await this.db
                    .deleteFrom('llm_prompts')
                    .where('transform_id', 'in', transformIdList)
                    .execute();
                console.log(`[ProjectService] Deleted LLM prompts for ${transformIds.length} transforms`);
            }

            // 5. Delete all transforms for this project
            await this.db
                .deleteFrom('transforms')
                .where('project_id', '=', projectId)
                .execute();
            console.log(`[ProjectService] Deleted transforms for project ${projectId}`);

            // 6. Delete all jsondocs for this project
            await this.db
                .deleteFrom('jsondocs')
                .where('project_id', '=', projectId)
                .execute();
            console.log(`[ProjectService] Deleted jsondocs for project ${projectId}`);

            // 7. Delete all chat messages for this project
            await this.db
                .deleteFrom('chat_messages_display')
                .where('project_id', '=', projectId)
                .execute();
            await this.db
                .deleteFrom('chat_messages_raw')
                .where('project_id', '=', projectId)
                .execute();
            console.log(`[ProjectService] Deleted chat messages for project ${projectId}`);

            // 8. Delete project membership
            await this.db
                .deleteFrom('projects_users')
                .where('project_id', '=', projectId)
                .execute();
            console.log(`[ProjectService] Deleted project membership for project ${projectId}`);

            // 9. Finally, delete the project itself
            await this.db
                .deleteFrom('projects')
                .where('id', '=', projectId)
                .execute();
            console.log(`[ProjectService] Deleted project ${projectId}`);

            console.log(`[ProjectService] ✅ Successfully wiped project ${projectId} and all associated data`);

        } catch (error) {
            console.error(`[ProjectService] ❌ Failed to wipe project ${projectId}:`, error);
            throw error;
        }
    }

    /**
     * Create a test project with proper setup
     */
    async createTestProject(projectId: string, userId: string, title?: string): Promise<void> {
        try {
            // Create project
            await this.db
                .insertInto('projects')
                .values({
                    id: projectId,
                    name: title || `Test Project ${Date.now()}`,
                    description: 'Integration test project',
                    created_at: new Date(),
                    updated_at: new Date()
                })
                .execute();

            // Add user membership
            await this.db
                .insertInto('projects_users')
                .values({
                    project_id: projectId,
                    user_id: userId,
                    role: 'owner'
                })
                .execute();

            console.log(`[ProjectService] ✅ Created test project ${projectId} for user ${userId}`);

        } catch (error) {
            console.error(`[ProjectService] ❌ Failed to create test project ${projectId}:`, error);
            throw error;
        }
    }
} 