import { Response } from 'express';

interface Client {
    res: Response;
}

export class JobBroadcaster {
    private static instance: JobBroadcaster;
    private clients: Map<string, Response[]> = new Map(); // Key: projectId

    private constructor() { }

    public static getInstance(): JobBroadcaster {
        if (!JobBroadcaster.instance) {
            JobBroadcaster.instance = new JobBroadcaster();
        }
        return JobBroadcaster.instance;
    }

    public addClient(projectId: string, res: Response): void {
        if (!this.clients.has(projectId)) {
            this.clients.set(projectId, []);
        }
        this.clients.get(projectId)!.push(res);
        console.log(`[JobBroadcaster] Client added for project ${projectId}. Total clients: ${this.clients.get(projectId)!.length}`);

        res.on('close', () => {
            this.removeClient(projectId, res);
        });
    }

    public removeClient(projectId: string, res: Response): void {
        const projectClients = this.clients.get(projectId);
        if (projectClients) {
            const filteredClients = projectClients.filter(clientRes => clientRes !== res);
            if (filteredClients.length > 0) {
                this.clients.set(projectId, filteredClients);
            } else {
                this.clients.delete(projectId);
            }
            console.log(`[JobBroadcaster] Client removed for project ${projectId}. Remaining clients: ${filteredClients.length}`);
        }
    }

    public broadcastChunk(projectId: string, chunk: string): void {
        const projectClients = this.clients.get(projectId);
        if (projectClients) {
            console.log(`[JobBroadcaster] Broadcasting chunk to ${projectClients.length} clients for project ${projectId}`);
            projectClients.forEach(clientRes => {
                clientRes.write(`data: ${chunk}\n\n`);
            });
        }
    }

    public closeConnection(projectId: string, finalData: any): void {
        const projectClients = this.clients.get(projectId);
        if (projectClients) {
            console.log(`[JobBroadcaster] Closing connection for ${projectClients.length} clients for project ${projectId}`);
            projectClients.forEach(clientRes => {
                clientRes.write(`data: ${JSON.stringify(finalData)}\n\n`);
                clientRes.write(`event: done\ndata: ${JSON.stringify({ status: 'completed' })}\n\n`);
                clientRes.end();
            });
            this.clients.delete(projectId);
        }
    }
} 