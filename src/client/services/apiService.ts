import { TypedArtifact } from "@/common/types";


class ApiService {
    private baseUrl = '/api';


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


    async getProject(projectId: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/projects/${projectId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch project: ${response.status}`);
        }
        return response.json();
    }

    // Unified Project Context API methods
    async createTransform(request: {
        projectId: string;
        type: 'llm' | 'human';
        typeVersion?: string;
        status?: string;
        executionContext?: any;
    }): Promise<any> {
        const response = await fetch(`${this.baseUrl}/transforms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(request)
        });
        if (!response.ok) {
            throw new Error(`Failed to create transform: ${response.status}`);
        }
        return response.json();
    }

    async updateArtifact(request: {
        artifactId: string;
        data?: any;
        text?: string;
        metadata?: any;
    }): Promise<any> {
        const response = await fetch(`${this.baseUrl}/artifacts/${request.artifactId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                ...(request.data && { data: request.data }),
                ...(request.text && { text: request.text }),
                ...(request.metadata && { metadata: request.metadata })
            })
        });
        if (!response.ok) {
            throw new Error(`Failed to update artifact: ${response.status}`);
        }
        return response.json();
    }

    async getArtifact(artifactId: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/artifacts/${artifactId}`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch artifact: ${response.status}`);
        }
        return response.json();
    }

    async getTransform(transformId: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/transforms/${transformId}`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch transform: ${response.status}`);
        }
        return response.json();
    }

    async getHumanTransform(artifactId: string, path?: string): Promise<any> {
        const url = new URL(`${this.baseUrl}/artifacts/${artifactId}/human-transform`, window.location.origin);
        if (path) {
            url.searchParams.set('path', path);
        }

        const response = await fetch(url.toString(), {
            credentials: 'include'
        });

        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            throw new Error(`Failed to fetch human transform: ${response.status}`);
        }
        return response.json();
    }

    // ============================================================================
    // Action-specific API methods (for action components)
    // ============================================================================

    async createBrainstormInput(projectId: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/artifacts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer debug-auth-token-script-writer-dev'
            },
            body: JSON.stringify({
                projectId,
                type: 'brainstorm_input_params' as TypedArtifact['schema_type'],
                data: {
                    initialInput: true // Explicitly mark as initial input to bypass validation
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to create brainstorm input: ${response.status}`);
        }

        return response.json();
    }

    async createManualBrainstormIdea(projectId: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/artifacts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer debug-auth-token-script-writer-dev'
            },
            body: JSON.stringify({
                projectId,
                type: 'brainstorm_idea' as TypedArtifact['schema_type'],
                data: {
                    title: '新创意',
                    body: ''
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to create manual brainstorm idea: ${response.status}`);
        }

        return response.json();
    }

    async deleteBrainstormInput(artifactId: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/artifacts/${artifactId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer debug-auth-token-script-writer-dev'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to delete brainstorm input: ${response.status}`);
        }
    }

    async sendChatMessage(projectId: string, content: string, metadata: any = {}): Promise<any> {
        const response = await fetch(`${this.baseUrl}/chat/${projectId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer debug-auth-token-script-writer-dev'
            },
            credentials: 'include',
            body: JSON.stringify({
                content,
                metadata
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to send chat message: ${response.status}`);
        }

        return response.json();
    }

    async clearChat(projectId: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/chat/${projectId}/messages`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer debug-auth-token-script-writer-dev'
            },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Failed to clear chat: ${response.status}`);
        }

        return response.json();
    }

    async generateOutlineFromIdea(projectId: string, ideaArtifactId: string, title: string, requirements: string = ''): Promise<any> {
        const content = `请基于创意生成剧本框架。源创意ID: ${ideaArtifactId}，标题: ${title}，要求: ${requirements || '无特殊要求'}`;

        return this.sendChatMessage(projectId, content, {
            sourceArtifactId: ideaArtifactId,
            action: 'outline_generation',
            title,
            requirements
        });
    }

    async generateChroniclesFromOutline(projectId: string, outlineArtifactId: string): Promise<any> {
        const content = `请基于剧本框架生成时间顺序大纲。源剧本框架ID: ${outlineArtifactId}`;

        return this.sendChatMessage(projectId, content, {
            sourceArtifactId: outlineArtifactId,
            action: 'chronicles_generation'
        });
    }

    async generateEpisodesFromChronicles(projectId: string, chroniclesArtifactId: string): Promise<any> {
        const content = `请基于时间顺序大纲生成剧本。源时间顺序大纲ID: ${chroniclesArtifactId}`;

        return this.sendChatMessage(projectId, content, {
            sourceArtifactId: chroniclesArtifactId,
            action: 'episode_generation'
        });
    }
}

export const apiService = new ApiService(); 