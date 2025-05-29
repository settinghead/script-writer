import { Response } from 'express';

interface StreamingClient {
    res: Response;
    userId: string;
}

export class JobBroadcaster {
    private static instance: JobBroadcaster;
    private activeJobs = new Map<string, StreamingClient[]>();

    private constructor() { }

    static getInstance(): JobBroadcaster {
        if (!JobBroadcaster.instance) {
            JobBroadcaster.instance = new JobBroadcaster();
        }
        return JobBroadcaster.instance;
    }

    addClient(transformId: string, userId: string, res: Response): void {
        if (!this.activeJobs.has(transformId)) {
            this.activeJobs.set(transformId, []);
        }

        const clients = this.activeJobs.get(transformId)!;
        clients.push({ res, userId });

        console.log(`[JobBroadcaster] Added client for transform ${transformId}, total clients: ${clients.length}`);

        // Clean up on connection close
        res.on('close', () => {
            console.log(`[JobBroadcaster] Client disconnected from transform ${transformId}`);
            this.removeClient(transformId, res);
        });
    }

    broadcast(transformId: string, message: string): void {
        const clients = this.activeJobs.get(transformId) || [];
        console.log(`[JobBroadcaster] Broadcasting to ${clients.length} clients for transform ${transformId}`);

        clients.forEach((client, index) => {
            try {
                // Ensure message is in SSE format with proper termination
                if (!message.startsWith('data: ')) {
                    message = `data: ${message}`;
                }
                // Ensure message ends with double newline
                if (!message.endsWith('\n\n')) {
                    message = message.trimEnd() + '\n\n';
                }
                client.res.write(message);
                console.log(`[JobBroadcaster] Sent message to client ${index + 1}/${clients.length} for transform ${transformId}`);
            } catch (error) {
                console.error(`[JobBroadcaster] Failed to send to client:`, error);
                // Remove failed client
                this.removeClient(transformId, client.res);
            }
        });
    }

    hasClients(transformId: string): boolean {
        const clients = this.activeJobs.get(transformId);
        return clients ? clients.length > 0 : false;
    }

    getClientCount(transformId: string): number {
        const clients = this.activeJobs.get(transformId);
        return clients ? clients.length : 0;
    }

    private removeClient(transformId: string, res: Response): void {
        const clients = this.activeJobs.get(transformId);
        if (!clients) return;

        const index = clients.findIndex(client => client.res === res);
        if (index !== -1) {
            clients.splice(index, 1);
            console.log(`[JobBroadcaster] Removed client from transform ${transformId}, remaining clients: ${clients.length}`);
        }

        // Clean up empty job entries
        if (clients.length === 0) {
            this.activeJobs.delete(transformId);
            console.log(`[JobBroadcaster] No more clients for transform ${transformId}, cleaning up`);
        }
    }

    cleanup(transformId: string): void {
        this.activeJobs.delete(transformId);
    }
} 