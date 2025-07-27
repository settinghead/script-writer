import { EventEmitter } from 'events';
import { Kysely } from 'kysely';
import { DB } from '../../database/types';
import { ParticleService } from './ParticleService';
import { Client } from 'pg';

export interface JsondocChangeEvent {
    jsondoc_id: string;
    project_id: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    timestamp: number;
}

export interface TransformChangeEvent {
    transform_id: string;
    project_id: string;
    type: string;
    status: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    timestamp: number;
}

export class ParticleEventBus extends EventEmitter {
    private dbConnection: Kysely<DB>;
    private particleService: ParticleService;
    private isListening: boolean = false;
    private debouncedUpdates: Map<string, NodeJS.Timeout> = new Map();
    private notificationClient: Client | null = null;

    // Configuration
    private static readonly DEBOUNCE_DELAY_MS = 5000; // 5 seconds to reduce expensive embedding calls

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
            return;
        }

        try {
            // Create a dedicated client for notifications
            this.notificationClient = new Client({
                host: process.env.DATABASE_HOST || 'localhost',
                port: parseInt(process.env.DATABASE_PORT || '5432'),
                database: process.env.DATABASE_NAME || 'script_writer',
                user: process.env.DATABASE_USER || 'postgres',
                password: process.env.DATABASE_PASSWORD || 'password',
            });

            await this.notificationClient.connect();

            // Listen for jsondoc and transform change notifications
            await this.notificationClient.query('LISTEN jsondoc_changed');
            await this.notificationClient.query('LISTEN transform_changed');

            // Set up notification handler
            this.notificationClient.on('notification', (msg: any) => {
                if (msg.channel === 'jsondoc_changed') {
                    try {
                        const data: JsondocChangeEvent = JSON.parse(msg.payload);
                        this.handleJsondocChange(data);
                    } catch (error) {
                        console.error('[ParticleEventBus] Failed to parse jsondoc notification payload:', error);
                    }
                } else if (msg.channel === 'transform_changed') {
                    try {
                        const data: TransformChangeEvent = JSON.parse(msg.payload);
                        this.handleTransformChange(data);
                    } catch (error) {
                        console.error('[ParticleEventBus] Failed to parse transform notification payload:', error);
                    }
                }
            });

            this.isListening = true;
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
            if (this.notificationClient) {
                await this.notificationClient.query('UNLISTEN jsondoc_changed');
                await this.notificationClient.query('UNLISTEN transform_changed');
                await this.notificationClient.end();
                this.notificationClient = null;
            }

            // Clear any pending debounced updates
            for (const timeout of this.debouncedUpdates.values()) {
                clearTimeout(timeout);
            }
            this.debouncedUpdates.clear();

            this.isListening = false;
        } catch (error) {
            console.error('[ParticleEventBus] Failed to stop listening:', error);
        }
    }

    /**
     * Handle jsondoc change notifications with debouncing
     */
    private handleJsondocChange(data: JsondocChangeEvent): void {
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
        }, ParticleEventBus.DEBOUNCE_DELAY_MS);

        this.debouncedUpdates.set(key, timeout);
    }

    /**
     * Handle transform change notifications with debouncing
     * When transforms change, canonicality might change, so we need to sync particle active status
     */
    private handleTransformChange(data: TransformChangeEvent): void {
        const key = `project-${data.project_id}`;

        // Clear existing timeout for this project
        const existingTimeout = this.debouncedUpdates.get(key);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Set new debounced update - sync entire project's particle active status
        const timeout = setTimeout(async () => {
            try {
                console.log(`[ParticleEventBus] Transform change detected, syncing particle active status for project ${data.project_id}`);
                await this.particleService.syncParticleActiveStatus(data.project_id);
                this.debouncedUpdates.delete(key);
                this.emit('particles_canonicality_synced', { projectId: data.project_id, operation: data.operation });
            } catch (error) {
                console.error(`[ParticleEventBus] Failed to sync particle active status for project ${data.project_id}:`, error);
                this.debouncedUpdates.delete(key);
            }
        }, ParticleEventBus.DEBOUNCE_DELAY_MS);

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
            } else {
                // For INSERT and UPDATE operations
                await this.particleService.updateParticlesForJsondoc(jsondoc_id, project_id);
            }

            // Emit event for any listeners
            this.emit('particles_updated', { jsondocId: jsondoc_id, projectId: project_id, operation });
        } catch (error) {
            console.error(`[ParticleEventBus] Failed to update particles for jsondoc ${jsondoc_id}:`, error);
            this.emit('particles_error', { jsondocId: jsondoc_id, projectId: project_id, operation, error });
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