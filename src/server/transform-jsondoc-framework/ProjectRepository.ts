import { Kysely } from 'kysely';
import { v4 as uuidv4 } from 'uuid';
import { Project, ProjectUser } from '../../common/transform-jsondoc-types';
import type { DB } from '../database/types';

export class ProjectRepository {
    constructor(private db: Kysely<DB>) { }

    // Compute the last updated time for a project based on jsondocs and transforms activity
    async getProjectLastUpdated(projectId: string): Promise<Date> {
        // Get the most recent timestamp from jsondocs and transforms
        const jsondocResult = await this.db
            .selectFrom('jsondocs')
            .select(['updated_at', 'created_at'])
            .where('project_id', '=', projectId)
            .orderBy('updated_at', 'desc')
            .orderBy('created_at', 'desc')
            .limit(1)
            .executeTakeFirst();

        const transformResult = await this.db
            .selectFrom('transforms')
            .select(['updated_at', 'created_at'])
            .where('project_id', '=', projectId)
            .orderBy('updated_at', 'desc')
            .orderBy('created_at', 'desc')
            .limit(1)
            .executeTakeFirst();

        // Find the most recent timestamp
        let lastUpdated: Date | null = null;

        if (jsondocResult?.updated_at) {
            lastUpdated = new Date(jsondocResult.updated_at);
        }

        if (transformResult?.updated_at) {
            const transformDate = new Date(transformResult.updated_at);
            if (!lastUpdated || transformDate > lastUpdated) {
                lastUpdated = transformDate;
            }
        }

        // If no jsondocs or transforms exist, fall back to project creation time
        if (!lastUpdated) {
            const projectResult = await this.db
                .selectFrom('projects')
                .select('created_at')
                .where('id', '=', projectId)
                .executeTakeFirst();

            lastUpdated = projectResult?.created_at ? new Date(projectResult.created_at) : new Date();
        }

        return lastUpdated;
    }

    // Get project by ID with computed last updated time
    async getProjectWithLastUpdated(projectId: string): Promise<(Project & { lastUpdated: string }) | null> {
        const project = await this.getProject(projectId);
        if (!project) {
            return null;
        }

        const lastUpdated = await this.getProjectLastUpdated(projectId);
        return {
            ...project,
            lastUpdated: lastUpdated.toISOString()
        };
    }

    // Create a new project
    async createProject(
        title: string,
        ownerId: string,
        description?: string,
        projectType: string = 'script'
    ): Promise<Project> {
        const id = uuidv4();
        const now = new Date();

        const projectData = {
            id,
            title,
            project_title_manual_override: false,
            description: description || null,
            project_type: projectType,
            status: 'active',
            created_at: now
        };

        await this.db.transaction().execute(async (trx) => {
            // Create the project
            await trx
                .insertInto('projects')
                .values(projectData)
                .execute();

            // Add the owner to the project
            await trx
                .insertInto('projects_users')
                .values({
                    project_id: id,
                    user_id: ownerId,
                    role: 'owner',
                    joined_at: now
                })
                .execute();
        });

        return {
            id,
            title,
            project_title_manual_override: false,
            description,
            project_type: projectType,
            status: 'active',
            created_at: now.toISOString()
        };
    }

    // Get project by ID
    async getProject(projectId: string): Promise<Project | null> {
        const row = await this.db
            .selectFrom('projects')
            .selectAll()
            .where('id', '=', projectId)
            .executeTakeFirst();

        if (!row) {
            return null;
        }

        return {
            id: row.id,
            title: (row as any).title,
            project_title_manual_override: Boolean((row as any).project_title_manual_override ?? false),
            description: row.description || undefined,
            project_type: row.project_type || 'default',
            status: (row.status as 'active' | 'archived' | 'deleted') || 'active',
            created_at: row.created_at?.toISOString() || new Date().toISOString()
        };
    }

    // Get projects for a user
    async getUserProjects(userId: string, limit?: number): Promise<Project[]> {
        // First get the basic project data
        let query = this.db
            .selectFrom('projects as p')
            .innerJoin('projects_users as pu', 'p.id', 'pu.project_id')
            .selectAll('p')
            .where('pu.user_id', '=', userId)
            .where('p.status', '=', 'active');

        const rows = await query.execute();

        // Create projects with computed last updated time
        const projectsWithLastUpdated = await Promise.all(
            rows.map(async row => {
                const lastUpdated = await this.getProjectLastUpdated(row.id);
                return {
                    id: String(row.id),
                    title: (row as any).title,
                    project_title_manual_override: Boolean((row as any).project_title_manual_override ?? false),
                    description: row.description || undefined,
                    project_type: row.project_type || 'default',
                    status: (row.status as 'active' | 'archived' | 'deleted') || 'active',
                    created_at: row.created_at?.toISOString() || new Date().toISOString(),
                    lastUpdated // Keep for sorting
                };
            })
        );

        // Sort by computed last updated time (descending)
        projectsWithLastUpdated.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());

        // Apply limit if specified
        const limitedProjects = limit ? projectsWithLastUpdated.slice(0, limit) : projectsWithLastUpdated;

        // Remove the temporary lastUpdated field and return
        return limitedProjects.map(project => {
            const { lastUpdated, ...projectWithoutLastUpdated } = project;
            return projectWithoutLastUpdated;
        });
    }

    // Update project
    async updateProject(
        projectId: string,
        updates: Partial<Omit<Project, 'id' | 'created_at'>>
    ): Promise<void> {
        await this.db
            .updateTable('projects')
            .set(updates)
            .where('id', '=', projectId)
            .execute();
    }

    // Delete project (soft delete)
    async deleteProject(projectId: string): Promise<void> {
        await this.updateProject(projectId, { status: 'deleted' });
    }

    // Add user to project
    async addUserToProject(
        projectId: string,
        userId: string,
        role: 'owner' | 'collaborator' | 'viewer' = 'collaborator'
    ): Promise<ProjectUser> {
        const now = new Date();

        const projectUserData = {
            project_id: projectId,
            user_id: userId,
            role,
            joined_at: now
        };

        const result = await this.db
            .insertInto('projects_users')
            .values(projectUserData)
            .returning('id')
            .execute();

        const id = result[0]?.id || 0;

        return {
            id,
            project_id: projectId,
            user_id: userId,
            role,
            joined_at: now.toISOString()
        };
    }

    // Remove user from project
    async removeUserFromProject(projectId: string, userId: string): Promise<void> {
        await this.db
            .deleteFrom('projects_users')
            .where('project_id', '=', projectId)
            .where('user_id', '=', userId)
            .execute();
    }

    // Get project users
    async getProjectUsers(projectId: string): Promise<ProjectUser[]> {
        const rows = await this.db
            .selectFrom('projects_users')
            .selectAll()
            .where('project_id', '=', projectId)
            .orderBy('joined_at', 'asc')
            .execute();

        return rows.map(row => ({
            id: row.id,
            project_id: row.project_id,
            user_id: row.user_id,
            role: (row.role as 'owner' | 'collaborator' | 'viewer') || 'collaborator',
            joined_at: row.joined_at?.toISOString() || new Date().toISOString()
        }));
    }

    // Check if user has access to project
    async userHasAccess(projectId: string, userId: string): Promise<boolean> {
        const result = await this.db
            .selectFrom('projects_users')
            .select(this.db.fn.count('id').as('count'))
            .where('project_id', '=', projectId)
            .where('user_id', '=', userId)
            .executeTakeFirst();

        return Number(result?.count ?? 0) > 0;
    }

    // Get user role in project
    async getUserRole(projectId: string, userId: string): Promise<string | null> {
        const row = await this.db
            .selectFrom('projects_users')
            .select('role')
            .where('project_id', '=', projectId)
            .where('user_id', '=', userId)
            .executeTakeFirst();

        return row?.role || null;
    }

    // Check if user is owner of project
    async isOwner(projectId: string, userId: string): Promise<boolean> {
        const role = await this.getUserRole(projectId, userId);
        return role === 'owner';
    }
} 