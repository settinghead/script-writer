import { EventEmitter } from 'events';
import { Kysely } from 'kysely';
import { DB } from '../database/types';
import { ParticleService } from './ParticleService';

export interface JsondocChangeEvent {
    jsondoc_id: string;
    project_id: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    timestamp: number;
}

export class ParticleEventBus extends EventEmitter {
    private dbConnection: any;
    private particleService: ParticleService;
    private isListening: boolean = false;
    private debouncedUpdates: Map<string, NodeJS.Timeout> = new Map();

    constructor(db: Kysely<DB>, particleService: ParticleService) {
        super();
        this.dbConnection = db;
        this.particleService = particleService;
    }

    /**
     * Start listening for PostgreSQL notifications
     */
    async startListening(): Promise<void> {
        if (this.isListening) {
            console.log('[ParticleEventBus] Already listening for notifications');
            return;
        }

        try {
            // Get the underlying connection for listening to notifications
            const connection = await this.getUnderlyingConnection();

            // Listen for jsondoc change notifications
            await connection.query('LISTEN jsondoc_changed');

            // Set up notification handler
            connection.on('notification', (msg: any) => {
                if (msg.channel === 'jsondoc_changed') {
                    try {
                        const data: JsondocChangeEvent = JSON.parse(msg.payload);
                        this.handleJsondocChange(data);
                    } catch (error) {
                        console.error('[ParticleEventBus] Failed to parse notification payload:', error);
                    }
                }
            });

            this.isListening = true;
            console.log('[ParticleEventBus] Started listening for jsondoc changes');
        } catch (error) {
            console.error('[ParticleEventBus] Failed to start listening:', error);
            throw error;
        }
    }

    /**
     * Stop listening for PostgreSQL notifications
     */
    async stopListening(): Promise<void> {
        if (!this.isListening) {
            return;
        }

        try {
            const connection = await this.getUnderlyingConnection();
            await connection.query('UNLISTEN jsondoc_changed');

            // Clear any pending debounced updates
            for (const timeout of this.debouncedUpdates.values()) {
                clearTimeout(timeout);
            }
            this.debouncedUpdates.clear();

            this.isListening = false;
            console.log('[ParticleEventBus] Stopped listening for jsondoc changes');
        } catch (error) {
            console.error('[ParticleEventBus] Failed to stop listening:', error);
        }
    }

    /**
     * Handle jsondoc change notifications with debouncing
     */
    private handleJsondocChange(data: JsondocChangeEvent): void {
        console.log(`[ParticleEventBus] Received jsondoc change: ${data.operation} for ${data.jsondoc_id}`);

        const key = data.jsondoc_id;

        // Clear existing timeout for this jsondoc
        const existingTimeout = this.debouncedUpdates.get(key);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Set new debounced update
        const timeout = setTimeout(async () => {
            try {
                await this.processJsondocChange(data);
                this.debouncedUpdates.delete(key);
            } catch (error) {
                console.error(`[ParticleEventBus] Failed to process change for jsondoc ${data.jsondoc_id}:`, error);
                this.debouncedUpdates.delete(key);
            }
        }, 2000); // 2-second debounce

        this.debouncedUpdates.set(key, timeout);
    }

    /**
     * Process the actual particle updates
     */
    private async processJsondocChange(data: JsondocChangeEvent): Promise<void> {
        const { jsondoc_id, project_id, operation } = data;

        try {
            if (operation === 'DELETE') {
                await this.particleService.deleteParticlesByJsondoc(jsondoc_id);
                console.log(`[ParticleEventBus] Deleted particles for jsondoc ${jsondoc_id}`);
            } else {
                // For INSERT and UPDATE operations
                await this.particleService.updateParticlesForJsondoc(jsondoc_id, project_id);
                console.log(`[ParticleEventBus] Updated particles for jsondoc ${jsondoc_id}`);
            }

            // Emit event for any listeners
            this.emit('particles_updated', { jsondocId: jsondoc_id, projectId: project_id, operation });
        } catch (error) {
            console.error(`[ParticleEventBus] Failed to update particles for jsondoc ${jsondoc_id}:`, error);
            this.emit('particles_error', { jsondocId: jsondoc_id, projectId: project_id, operation, error });
        }
    }

    /**
     * Get the underlying PostgreSQL connection for notifications
     * This is a simplified version - in production, you'd want proper connection pooling
     */
    private async getUnderlyingConnection(): Promise<any> {
        // For Kysely with PostgreSQL, we need to access the underlying connection
        // This is a simplified approach - in production you'd need to properly access the pg connection
        try {
            // Execute a simple query to get access to the connection
            const result = await this.dbConnection.executeQuery({
                sql: 'SELECT 1',
                parameters: []
            });

            // Return the connection (this is a simplified approach)
            // In a real implementation, you'd need to properly access the pg connection
            return (this.dbConnection as any).getExecutor().adapter.connectionProvider.connection;
        } catch (error) {
            console.error('[ParticleEventBus] Failed to get underlying connection:', error);
            throw error;
        }
    }

    /**
     * Manually trigger particle update for a jsondoc (for testing)
     */
    async triggerParticleUpdate(jsondocId: string, projectId: string): Promise<void> {
        await this.particleService.updateParticlesForJsondoc(jsondocId, projectId);
        this.emit('particles_updated', { jsondocId, projectId, operation: 'UPDATE' });
    }

    /**
     * Get current status
     */
    getStatus(): { isListening: boolean; pendingUpdates: number } {
        return {
            isListening: this.isListening,
            pendingUpdates: this.debouncedUpdates.size
        };
    }
} 