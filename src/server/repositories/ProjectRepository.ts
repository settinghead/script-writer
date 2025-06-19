import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { Project, ProjectUser } from '../types/artifacts';

export class ProjectRepository {
    constructor(private db: Knex) { }

    // Create a new project
    async createProject(
        name: string,
        ownerId: string,
        description?: string,
        projectType: string = 'script'
    ): Promise<Project> {
        const id = uuidv4();
        const now = new Date().toISOString();

        const projectData = {
            id,
            name,
            description,
            project_type: projectType,
            status: 'active',
            created_at: now,
            updated_at: now
        };

        await this.db.transaction(async (trx) => {
            // Create the project
            await trx('projects').insert(projectData);

            // Add the owner to the project
            await trx('projects_users').insert({
                project_id: id,
                user_id: ownerId,
                role: 'owner',
                joined_at: now
            });
        });

        return {
            id,
            name,
            description,
            project_type: projectType,
            status: 'active',
            created_at: now,
            updated_at: now
        };
    }

    // Get project by ID
    async getProject(projectId: string): Promise<Project | null> {
        const row = await this.db('projects')
            .where('id', projectId)
            .first();

        if (!row) {
            return null;
        }

        return row;
    }

    // Get projects for a user
    async getUserProjects(userId: string, limit?: number): Promise<Project[]> {
        let query = this.db('projects as p')
            .join('projects_users as pu', 'p.id', 'pu.project_id')
            .where('pu.user_id', userId)
            .where('p.status', 'active')
            .select('p.*')
            .orderBy('p.updated_at', 'desc');

        if (limit) {
            query = query.limit(limit);
        }

        const rows = await query;
        return rows;
    }

    // Update project
    async updateProject(
        projectId: string,
        updates: Partial<Omit<Project, 'id' | 'created_at'>>
    ): Promise<void> {
        const now = new Date().toISOString();

        await this.db('projects')
            .where('id', projectId)
            .update({
                ...updates,
                updated_at: now
            });
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
        const now = new Date().toISOString();

        const projectUserData = {
            project_id: projectId,
            user_id: userId,
            role,
            joined_at: now
        };

        const [id] = await this.db('projects_users').insert(projectUserData);

        return {
            id,
            project_id: projectId,
            user_id: userId,
            role,
            joined_at: now
        };
    }

    // Remove user from project
    async removeUserFromProject(projectId: string, userId: string): Promise<void> {
        await this.db('projects_users')
            .where('project_id', projectId)
            .where('user_id', userId)
            .del();
    }

    // Get project users
    async getProjectUsers(projectId: string): Promise<ProjectUser[]> {
        const rows = await this.db('projects_users')
            .where('project_id', projectId)
            .orderBy('joined_at', 'asc');

        return rows;
    }

    // Check if user has access to project
    async userHasAccess(projectId: string, userId: string): Promise<boolean> {
        const count = await this.db('projects_users')
            .where('project_id', projectId)
            .where('user_id', userId)
            .count('id as count')
            .first();

        return Number(count?.count ?? 0) > 0;
    }

    // Get user role in project
    async getUserRole(projectId: string, userId: string): Promise<string | null> {
        const row = await this.db('projects_users')
            .where('project_id', projectId)
            .where('user_id', userId)
            .select('role')
            .first();

        return row?.role || null;
    }

    // Check if user is owner of project
    async isOwner(projectId: string, userId: string): Promise<boolean> {
        const role = await this.getUserRole(projectId, userId);
        return role === 'owner';
    }
} 