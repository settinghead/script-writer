import { ProjectRepository } from '../repositories/ProjectRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { Project } from '../types/artifacts';
import { v4 as uuidv4 } from 'uuid';

export class ProjectService {
    constructor(
        private projectRepo: ProjectRepository,
        private artifactRepo: ArtifactRepository,
        private transformRepo: TransformRepository
    ) {}

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
                    const artifacts = await this.artifactRepo.getProjectArtifacts(project.id, 50);
                    const transforms = await this.transformRepo.getProjectTransforms(project.id, 10);

                    // Count different types of artifacts
                    const artifactCounts = {
                        ideations: artifacts.filter(a => a.type === 'ideation_session').length,
                        outlines: artifacts.filter(a => a.type === 'outline_session').length,
                        episodes: artifacts.filter(a => a.type === 'episode_generation_session').length,
                        scripts: artifacts.filter(a => a.type === 'episode_script').length,
                    };

                    // Determine project status and current phase
                    const latestTransform = transforms[0]; // Most recent
                    let status = 'active';
                    let currentPhase = 'brainstorming';
                    
                    if (latestTransform) {
                        status = latestTransform.status === 'failed' ? 'failed' : 'active';
                        
                        // Determine phase based on latest artifacts
                        if (artifactCounts.scripts > 0) {
                            currentPhase = 'scripts';
                        } else if (artifactCounts.episodes > 0) {
                            currentPhase = 'episodes';
                        } else if (artifactCounts.outlines > 0) {
                            currentPhase = 'outline';
                        } else {
                            currentPhase = 'brainstorming';
                        }
                    }

                    // Get some sample content for preview
                    let previewContent = '';
                    let platform = '';
                    let genre = '';
                    
                    // Try to get brainstorm params for metadata
                    const brainstormParams = artifacts.find(a => a.type === 'brainstorm_params');
                    if (brainstormParams) {
                        platform = brainstormParams.data.platform || '';
                        if (brainstormParams.data.genre_paths && brainstormParams.data.genre_paths.length > 0) {
                            genre = brainstormParams.data.genre_paths
                                .map((path: string[]) => path[path.length - 1])
                                .join(', ');
                        }
                    }

                    // Try to get some content for preview
                    const userInput = artifacts.find(a => a.type === 'user_input');
                    const brainstormIdea = artifacts.find(a => a.type === 'brainstorm_idea');
                    const outlineTitle = artifacts.find(a => a.type === 'outline_title');

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
                        artifactCounts
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
                        artifactCounts: {
                            ideations: 0,
                            outlines: 0,
                            episodes: 0,
                            scripts: 0
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
} 