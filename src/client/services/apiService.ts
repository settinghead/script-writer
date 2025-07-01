

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
}

export const apiService = new ApiService(); 