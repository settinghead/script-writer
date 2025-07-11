import { Kysely } from 'kysely';
import { v4 as uuidv4 } from 'uuid';
import { Project, ProjectUser } from '../../common/artifacts';
import type { DB } from '../database/types';

export class ProjectRepository {
    constructor(private db: Kysely<DB>) { }

    // Create a new project
    async createProject(
        name: string,
        ownerId: string,
        description?: string,
        projectType: string = 'script'
    ): Promise<Project> {
        const id = uuidv4();
        const now = new Date();

        const projectData = {
            id,
            name,
            description: description || null,
            project_type: projectType,
            status: 'active',
            created_at: now,
            updated_at: now
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
            name,
            description,
            project_type: projectType,
            status: 'active',
            created_at: now.toISOString(),
            updated_at: now.toISOString()
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
            name: row.name,
            description: row.description || undefined,
            project_type: row.project_type || 'default',
            status: (row.status as 'active' | 'archived' | 'deleted') || 'active',
            created_at: row.created_at?.toISOString() || new Date().toISOString(),
            updated_at: row.updated_at?.toISOString() || new Date().toISOString()
        };
    }

    // Get projects for a user
    async getUserProjects(userId: string, limit?: number): Promise<Project[]> {
        let query = this.db
            .selectFrom('projects as p')
            .innerJoin('projects_users as pu', 'p.id', 'pu.project_id')
            .select(['p.id', 'p.name', 'p.description', 'p.project_type', 'p.status', 'p.created_at', 'p.updated_at'])
            .where('pu.user_id', '=', userId)
            .where('p.status', '=', 'active')
            .orderBy('p.updated_at', 'desc');

        if (limit) {
            query = query.limit(limit);
        }

        const rows = await query.execute();

        return rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description || undefined,
            project_type: row.project_type || 'default',
            status: (row.status as 'active' | 'archived' | 'deleted') || 'active',
            created_at: row.created_at?.toISOString() || new Date().toISOString(),
            updated_at: row.updated_at?.toISOString() || new Date().toISOString()
        }));
    }

    // Update project
    async updateProject(
        projectId: string,
        updates: Partial<Omit<Project, 'id' | 'created_at'>>
    ): Promise<void> {
        const now = new Date();

        await this.db
            .updateTable('projects')
            .set({
                ...updates,
                updated_at: now
            })
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