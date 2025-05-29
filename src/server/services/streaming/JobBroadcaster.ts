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

        // Clean up on connection close
        res.on('close', () => {
            this.removeClient(transformId, res);
        });
    }

    broadcast(transformId: string, data: any): void {
        const clients = this.activeJobs.get(transformId);
        if (!clients || clients.length === 0) {
            console.log(`[JobBroadcaster] No clients connected for transform ${transformId}`);
            return;
        }

        console.log(`[JobBroadcaster] Broadcasting to ${clients.length} clients for transform ${transformId}`);

        // Format as SSE data if not already formatted
        let message = typeof data === 'string' ? data : JSON.stringify(data);

        // If the message doesn't start with "data: " and doesn't look like a streaming format (0:, e:, etc.)
        // then wrap it as SSE data
        if (!message.startsWith('data: ') && !message.match(/^[0-9a-z]+:/)) {
            message = `data: ${message}\n\n`;
        } else if (!message.endsWith('\n\n') && !message.endsWith('\n')) {
            // Ensure proper line endings for SSE
            message = message + '\n';
        }

        // Send to all connected clients
        clients.forEach((client, index) => {
            try {
                if (!client.res.writableEnded && client.res.writable) {
                    client.res.write(message);
                    console.log(`[JobBroadcaster] Sent message to client ${index + 1}/${clients.length} for transform ${transformId}`);
                } else {
                    console.log(`[JobBroadcaster] Client ${index + 1} not writable for transform ${transformId}`);
                }
            } catch (error) {
                console.warn(`[JobBroadcaster] Failed to send to client ${index + 1} for transform ${transformId}:`, error);
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
        }

        // Clean up empty job entries
        if (clients.length === 0) {
            this.activeJobs.delete(transformId);
        }
    }

    cleanup(transformId: string): void {
        this.activeJobs.delete(transformId);
    }
} 