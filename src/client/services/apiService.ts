import { OutlineSessionSummary, OutlineSessionData } from '../../server/services/OutlineService';
import { OutlineGenerateRequest, OutlineGenerateResponse } from '../../common/streaming/types';

class ApiService {
    private baseUrl = '/api';

    // Outline session management
    async getOutlineSessions(): Promise<OutlineSessionSummary[]> {
        const response = await fetch(`${this.baseUrl}/outlines`);
        if (!response.ok) {
            throw new Error(`Failed to fetch outline sessions: ${response.status}`);
        }
        return response.json();
    }

    async getOutlineSession(sessionId: string): Promise<OutlineSessionData> {
        const response = await fetch(`${this.baseUrl}/outlines/${sessionId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch outline session: ${response.status}`);
        }
        return response.json();
    }

    async deleteOutlineSession(sessionId: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/outlines/${sessionId}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            throw new Error(`Failed to delete outline session: ${response.status}`);
        }
    }

    async getOutlineLineage(sessionId: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/outlines/${sessionId}/lineage`);
        if (!response.ok) {
            throw new Error(`Failed to fetch outline lineage: ${response.status}`);
        }
        return response.json();
    }

    // Outline generation
    async generateOutline(params: OutlineGenerateRequest): Promise<OutlineGenerateResponse> {
        const response = await fetch(`${this.baseUrl}/outlines/create-job`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });
        if (!response.ok) {
            throw new Error(`Failed to generate outline: ${response.status}`);
        }
        return response.json();
    }

    async regenerateOutline(sessionId: string): Promise<OutlineGenerateResponse> {
        // For regeneration, we need to get the original parameters and create a new job
        const session = await this.getOutlineSession(sessionId);
        const params: OutlineGenerateRequest = {
            sourceArtifactId: session.sourceArtifact.id,
            totalEpisodes: session.totalEpisodes || 10,
            episodeDuration: session.episodeDuration || 30
        };

        const response = await fetch(`${this.baseUrl}/outlines/create-job`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });
        if (!response.ok) {
            throw new Error(`Failed to regenerate outline: ${response.status}`);
        }
        return response.json();
    }

    // Outline component updates
    async updateOutlineComponent(sessionId: string, componentType: string, newValue: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/outlines/${sessionId}/components/${componentType}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ value: newValue })
        });
        if (!response.ok) {
            throw new Error(`Failed to update outline component: ${response.status}`);
        }
    }

    // Get original outline data (without user edits)
    async getOriginalOutlineData(sessionId: string): Promise<OutlineSessionData> {
        const response = await fetch(`${this.baseUrl}/outlines/${sessionId}/original`);
        if (!response.ok) {
            throw new Error(`Failed to fetch original outline data: ${response.status}`);
        }
        return response.json();
    }

    // Clear all user edits for a session
    async clearOutlineEdits(sessionId: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/outlines/${sessionId}/edits`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            throw new Error(`Failed to clear outline edits: ${response.status}`);
        }
    }

    // Episode generation
    async generateEpisodes(params: {
        outlineSessionId: string;
        episode_count: number;
        episode_duration: number;
        generation_strategy: 'sequential' | 'batch';
        custom_requirements?: string;
        use_modified_outline: boolean;
        cascadedParams?: {
            platform: string;
            genre_paths: string[][];
            genre_proportions: number[];
            requirements: string;
            totalEpisodes?: number;
            episodeDuration?: number;
        };
    }): Promise<{ sessionId: string; transformId: string }> {
        const response = await fetch(`${this.baseUrl}/episodes/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });
        if (!response.ok) {
            throw new Error(`Failed to generate episodes: ${response.status}`);
        }
        return response.json();
    }

    async getEpisodeSession(sessionId: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/episodes/${sessionId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch episode session: ${response.status}`);
        }
        return response.json();
    }

    // New episode generation API methods
    async getAllEpisodeSessions(): Promise<any[]> {
        const response = await fetch(`${this.baseUrl}/episodes/sessions`);
        if (!response.ok) {
            throw new Error(`Failed to fetch episode sessions: ${response.status}`);
        }
        return response.json();
    }

    async getStageArtifacts(outlineSessionId: string): Promise<any[]> {
        const response = await fetch(`${this.baseUrl}/episodes/outlines/${outlineSessionId}/stages`);
        if (!response.ok) {
            throw new Error(`Failed to fetch stage artifacts: ${response.status}`);
        }
        return response.json();
    }

    async getStageArtifact(stageId: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/episodes/stages/${stageId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch stage artifact: ${response.status}`);
        }
        return response.json();
    }

    async startEpisodeGeneration(params: {
        stageArtifactId: string;
        numberOfEpisodes?: number;
        customRequirements?: string;
    }): Promise<{ sessionId: string; transformId: string }> {
        const response = await fetch(`${this.baseUrl}/episodes/stages/${params.stageArtifactId}/episodes/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                numberOfEpisodes: params.numberOfEpisodes,
                customRequirements: params.customRequirements
            })
        });
        if (!response.ok) {
            throw new Error(`Failed to start episode generation: ${response.status}`);
        }
        return response.json();
    }

    async getEpisodeGenerationSession(sessionId: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/episodes/episode-generation/${sessionId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch episode generation session: ${response.status}`);
        }
        return response.json();
    }

    async checkActiveEpisodeGeneration(stageId: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/episodes/stages/${stageId}/active-generation`);
        if (response.status === 404) {
            return null;
        }
        if (!response.ok) {
            throw new Error(`Failed to check active episode generation: ${response.status}`);
        }
        return response.json();
    }

    // Ideas/artifacts
    async getUserIdeas(): Promise<any[]> {
        const response = await fetch(`${this.baseUrl}/artifacts/ideas`);
        if (!response.ok) {
            throw new Error(`Failed to fetch user ideas: ${response.status}`);
        }
        return response.json();
    }

    // Streaming operations
    async checkActiveStreamingJob(sessionId: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/outlines/${sessionId}/active-job`);
        if (response.status === 404) {
            // 404 is expected for completed outlines
            return null;
        }
        if (!response.ok) {
            throw new Error(`Failed to check active streaming job: ${response.status}`);
        }
        return response.json();
    }

    async stopStreamingJob(transformId: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/transforms/${transformId}/stop`, {
            method: 'POST'
        });
        if (!response.ok) {
            throw new Error(`Failed to stop streaming job: ${response.status}`);
        }
    }

    // Artifacts - general
    async createArtifact(type: string, data: any): Promise<any> {
        const response = await fetch(`${this.baseUrl}/artifacts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type, data })
        });
        if (!response.ok) {
            throw new Error(`Failed to create artifact: ${response.status}`);
        }
        return response.json();
    }

    async createHumanTransform(inputArtifacts: any[], transformType: string, outputArtifacts: any[], metadata?: any): Promise<any> {
        const response = await fetch(`${this.baseUrl}/transforms/human`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input_artifacts: inputArtifacts,
                transform_type: transformType,
                output_artifacts: outputArtifacts,
                metadata
            })
        });
        if (!response.ok) {
            throw new Error(`Failed to create human transform: ${response.status}`);
        }
        return response.json();
    }

    // Ideation support
    async getIdeationRun(runId: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/ideations/${runId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch ideation run: ${response.status}`);
        }
        return response.json();
    }

    // Get outlines associated with ideas for an ideation session
    async getIdeaOutlines(ideationRunId: string): Promise<{ [ideaId: string]: any[] }> {
        const response = await fetch(`${this.baseUrl}/ideations/${ideationRunId}/idea-outlines`);
        if (!response.ok) {
            throw new Error(`Failed to fetch idea outlines: ${response.status}`);
        }
        return response.json();
    }
}

export const apiService = new ApiService(); 