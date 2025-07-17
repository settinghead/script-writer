import { EventEmitter } from 'events';
import { Kysely } from 'kysely';
import { DB } from '../database/types';
import { ParticleService } from './ParticleService';
import { Client } from 'pg';

export interface JsondocChangeEvent {
    jsondoc_id: string;
    project_id: string;
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

            // Listen for jsondoc change notifications
            await this.notificationClient.query('LISTEN jsondoc_changed');

            // Set up notification handler
            this.notificationClient.on('notification', (msg: any) => {
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