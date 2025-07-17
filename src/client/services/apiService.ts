import { TypedJsondoc } from "@/common/types";


class ApiService {
    private baseUrl = '/api';


    // Jsondocs - general
    async createJsondoc(type: string, data: any): Promise<any> {
        const response = await fetch(`${this.baseUrl}/jsondocs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type, data })
        });
        if (!response.ok) {
            throw new Error(`Failed to create jsondoc: ${response.status}`);
        }
        return response.json();
    }

    async createHumanTransform(inputJsondocs: any[], transformType: string, outputJsondocs: any[], metadata?: any): Promise<any> {
        const response = await fetch(`${this.baseUrl}/transforms/human`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input_jsondocs: inputJsondocs,
                transform_type: transformType,
                output_jsondocs: outputJsondocs,
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
            if (response.status === 404) {
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(errorData.error || 'Project not found');
                (error as any).status = 404;
                (error as any).code = 'PROJECT_NOT_FOUND';
                throw error;
            } else if (response.status === 403) {
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(errorData.error || 'Access denied');
                (error as any).status = 403;
                (error as any).code = 'ACCESS_DENIED';
                throw error;
            } else {
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(errorData.error || `Failed to fetch project: ${response.status}`);
                (error as any).status = response.status;
                throw error;
            }
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

    async updateJsondoc(request: {
        jsondocId: string;
        data?: any;
        text?: string;
        metadata?: any;
    }): Promise<any> {
        const response = await fetch(`${this.baseUrl}/jsondocs/${request.jsondocId}`, {
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
            throw new Error(`Failed to update jsondoc: ${response.status}`);
        }
        return response.json();
    }

    async getJsondoc(jsondocId: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/jsondocs/${jsondocId}`, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch jsondoc: ${response.status}`);
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

    async getHumanTransform(jsondocId: string, path?: string): Promise<any> {
        const url = new URL(`${this.baseUrl}/jsondocs/${jsondocId}/human-transform`, window.location.origin);
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
        const response = await fetch(`${this.baseUrl}/jsondocs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer debug-auth-token-script-writer-dev'
            },
            body: JSON.stringify({
                projectId,
                schemaType: 'brainstorm_input_params' as TypedJsondoc['schema_type'],
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
        const response = await fetch(`${this.baseUrl}/jsondocs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer debug-auth-token-script-writer-dev'
            },
            body: JSON.stringify({
                projectId,
                schemaType: 'brainstorm_idea' as TypedJsondoc['schema_type'],
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

    async deleteBrainstormInput(jsondocId: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/jsondocs/${jsondocId}`, {
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

    async generateOutlineFromIdea(projectId: string, ideaJsondocId: string, title: string, requirements: string = ''): Promise<any> {
        const content = `请基于创意生成剧本框架。源创意ID: ${ideaJsondocId}，标题: ${title}，要求: ${requirements || '无特殊要求'}`;

        return this.sendChatMessage(projectId, content, {
            sourceJsondocId: ideaJsondocId,
            action: 'outline_generation',
            title,
            requirements
        });
    }

    async generateChroniclesFromOutline(projectId: string, outlineJsondocId: string): Promise<any> {
        const content = `请基于剧本框架生成时间顺序大纲。源剧本框架ID: ${outlineJsondocId}`;

        return this.sendChatMessage(projectId, content, {
            sourceJsondocId: outlineJsondocId,
            action: 'chronicles_generation'
        });
    }

    async generateEpisodePlanningFromChronicles(projectId: string, chroniclesJsondocId: string, numberOfEpisodes: number): Promise<any> {
        const content = `请基于时间顺序大纲生成剧集规划。源时间顺序大纲ID: ${chroniclesJsondocId}，总集数: ${numberOfEpisodes}`;

        return this.sendChatMessage(projectId, content, {
            sourceJsondocId: chroniclesJsondocId,
            action: 'episode_planning_generation',
            numberOfEpisodes
        });
    }

    async generateEpisodesFromChronicles(projectId: string, chroniclesJsondocId: string): Promise<any> {
        const content = `请基于时间顺序大纲生成剧本。源时间顺序大纲ID: ${chroniclesJsondocId}`;

        return this.sendChatMessage(projectId, content, {
            sourceJsondocId: chroniclesJsondocId,
            action: 'episode_generation'
        });
    }
}

export const apiService = new ApiService(); 