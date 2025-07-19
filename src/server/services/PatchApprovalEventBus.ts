import { EventEmitter } from 'events';
import { Kysely } from 'kysely';
import { DB } from '../database/types';
import { Client } from 'pg';

export interface TransformChangeEvent {
    transform_id: string;
    project_id: string;
    type: string;
    status: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    timestamp: number;
}

export interface TransformOutputsChangeEvent {
    transform_id: string;
    jsondoc_id: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    timestamp: number;
}

export interface WaitingTool {
    transformId: string;
    resolve: (result: 'approved' | 'rejected') => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
    startTime: number;
}

export class PatchApprovalEventBus extends EventEmitter {
    private dbConnection: Kysely<DB>;
    private isListening: boolean = false;
    private notificationClient: Client | null = null;
    private waitingTools: Map<string, WaitingTool> = new Map();

    // Configuration
    private static readonly APPROVAL_TIMEOUT_MS = 10 * 24 * 60 * 60 * 1000; // 10 days

    constructor(db: Kysely<DB>) {
        super();
        this.dbConnection = db;
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

            // Listen for transform and transform_outputs change notifications
            await this.notificationClient.query('LISTEN transform_changed');
            await this.notificationClient.query('LISTEN transform_outputs_changed');

            // Set up notification handler
            this.notificationClient.on('notification', (msg: any) => {
                try {
                    if (msg.channel === 'transform_changed') {
                        const data: TransformChangeEvent = JSON.parse(msg.payload);
                        this.handleTransformChange(data);
                    } else if (msg.channel === 'transform_outputs_changed') {
                        const data: TransformOutputsChangeEvent = JSON.parse(msg.payload);
                        this.handleTransformOutputsChange(data);
                    }
                } catch (error) {
                    console.error('[PatchApprovalEventBus] Failed to parse notification payload:', error);
                }
            });

            this.isListening = true;
            console.log('[PatchApprovalEventBus] Started listening for patch approval notifications');

            // Recover any waiting tools from database on startup
            await this.recoverWaitingTools();

        } catch (error) {
            console.error('[PatchApprovalEventBus] Failed to start listening:', error);
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
                await this.notificationClient.query('UNLISTEN transform_changed');
                await this.notificationClient.query('UNLISTEN transform_outputs_changed');
                await this.notificationClient.end();
                this.notificationClient = null;
            }

            // Clear any pending timeouts
            for (const waitingTool of this.waitingTools.values()) {
                clearTimeout(waitingTool.timeout);
                waitingTool.reject(new Error('PatchApprovalEventBus stopped'));
            }
            this.waitingTools.clear();

            this.isListening = false;
            console.log('[PatchApprovalEventBus] Stopped listening for patch approval notifications');
        } catch (error) {
            console.error('[PatchApprovalEventBus] Failed to stop listening:', error);
        }
    }

    /**
     * Wait for patch approval for a specific ai_patch transform
     */
    async waitForPatchApproval(transformId: string): Promise<'approved' | 'rejected'> {
        // Check if already resolved
        const existingResult = await this.checkExistingApprovalStatus(transformId);
        if (existingResult) {
            return existingResult;
        }

        return new Promise((resolve, reject) => {

            // Set 10-day timeout
            const timeout = setTimeout(() => {
                this.waitingTools.delete(transformId);
                reject(new Error('Patch approval timeout after 10 days'));
            }, PatchApprovalEventBus.APPROVAL_TIMEOUT_MS);

            const waitingTool: WaitingTool = {
                transformId,
                resolve,
                reject,
                timeout,
                startTime: Date.now()
            };

            this.waitingTools.set(transformId, waitingTool);
            console.log(`[PatchApprovalEventBus] Waiting for approval of transform ${transformId}`);
        });
    }

    /**
     * Handle transform change notifications
     */
    private handleTransformChange(data: TransformChangeEvent): void {
        const { transform_id, type, status, operation } = data;

        // Check if this affects any waiting tools
        if (type === 'ai_patch' && operation === 'DELETE') {
            // Transform was deleted - this means rejection
            this.resolveWaitingTool(transform_id, 'rejected');
        } else if (type === 'human_patch_approval' && status === 'completed') {
            // Human approval transform completed - this means approval
            this.findAndResolveApprovedTransform(transform_id, 'approved');
        }
    }

    /**
     * Handle transform outputs change notifications
     */
    private handleTransformOutputsChange(data: TransformOutputsChangeEvent): void {
        const { transform_id, operation } = data;

        // Check if this is a human_patch_approval transform getting outputs
        this.checkForApprovalCompletion(transform_id);
    }

    /**
     * Resolve a waiting tool with the given result
     */
    private resolveWaitingTool(transformId: string, result: 'approved' | 'rejected'): void {
        const waitingTool = this.waitingTools.get(transformId);
        if (waitingTool) {
            clearTimeout(waitingTool.timeout);
            waitingTool.resolve(result);
            this.waitingTools.delete(transformId);
            console.log(`[PatchApprovalEventBus] Resolved transform ${transformId} with result: ${result}`);
        }
    }

    /**
     * Find and resolve approved transform by looking for human_patch_approval transforms
     */
    private async findAndResolveApprovedTransform(approvalTransformId: string, result: 'approved' | 'rejected'): Promise<void> {
        try {
            console.log(`[PatchApprovalEventBus] Processing human_patch_approval transform: ${approvalTransformId}`);

            // Get the inputs of the approval transform to find the patch jsondoc
            const approvalInputs = await this.dbConnection
                .selectFrom('transform_inputs')
                .select(['jsondoc_id'])
                .where('transform_id', '=', approvalTransformId)
                .execute();

            if (approvalInputs.length === 0) {
                console.log(`[PatchApprovalEventBus] No inputs found for human_patch_approval transform ${approvalTransformId}`);
                return;
            }

            // For each patch jsondoc, find the original ai_patch transform that created it
            for (const input of approvalInputs) {
                const patchJsondocId = input.jsondoc_id;
                console.log(`[PatchApprovalEventBus] Tracing patch jsondoc: ${patchJsondocId}`);

                // Find the ai_patch transform that created this patch jsondoc
                const originalTransform = await this.dbConnection
                    .selectFrom('transform_outputs as to')
                    .innerJoin('transforms as t', 't.id', 'to.transform_id')
                    .select(['t.id', 't.type', 't.status', 't.project_id'])
                    .where('to.jsondoc_id', '=', patchJsondocId)
                    .where('t.type', '=', 'ai_patch')
                    .executeTakeFirst();

                if (originalTransform) {
                    console.log(`[PatchApprovalEventBus] Found original ai_patch transform: ${originalTransform.id}`);

                    // Resolve the waiting tool for the original transform
                    this.resolveWaitingTool(originalTransform.id, result);
                } else {
                    console.log(`[PatchApprovalEventBus] No original ai_patch transform found for patch jsondoc: ${patchJsondocId}`);
                }
            }

            // Also emit an event for any other listeners
            this.emit('approval_completed', { approvalTransformId, result });
        } catch (error) {
            console.error('[PatchApprovalEventBus] Error finding approved transform:', error);
        }
    }

    /**
     * Check for approval completion by examining transform outputs
     */
    private async checkForApprovalCompletion(transformId: string): Promise<void> {
        try {
            // Query database to check if this is a human_patch_approval transform
            // and if it has outputs, which would indicate completion
            // Implementation would depend on the specific database structure
            this.emit('approval_check', { transformId });
        } catch (error) {
            console.error('[PatchApprovalEventBus] Error checking approval completion:', error);
        }
    }

    /**
     * Check existing approval status from database
     */
    private async checkExistingApprovalStatus(transformId: string): Promise<'approved' | 'rejected' | null> {
        try {
            // Query database to check if transform is already approved/rejected
            const transform = await this.dbConnection
                .selectFrom('transforms')
                .select(['status', 'type'])
                .where('id', '=', transformId)
                .executeTakeFirst();

            if (!transform) {
                return 'rejected'; // Transform doesn't exist = rejected
            }

            if (transform.type === 'ai_patch' && transform.status === 'completed') {
                // Check if there's a corresponding human_patch_approval transform
                // For now, return null to indicate we need to wait
                return null;
            }

            return null; // Still pending
        } catch (error) {
            console.error('[PatchApprovalEventBus] Error checking existing approval status:', error);
            return null;
        }
    }

    /**
     * Recover waiting tools after server restart
     */
    private async recoverWaitingTools(): Promise<void> {
        try {
            // Find all ai_patch transforms that are still running and might need approval
            const pendingTransforms = await this.dbConnection
                .selectFrom('transforms')
                .select(['id', 'created_at'])
                .where('type', '=', 'ai_patch')
                .where('status', '=', 'running')
                .execute();

            console.log(`[PatchApprovalEventBus] Found ${pendingTransforms.length} pending ai_patch transforms for recovery`);

            // Note: We don't automatically recreate waiting promises after restart
            // The tools that were waiting will need to be re-invoked
            // This is by design to avoid orphaned promises
        } catch (error) {
            console.error('[PatchApprovalEventBus] Error recovering waiting tools:', error);
        }
    }

    /**
     * Manually approve a transform (for testing)
     */
    async manuallyApprove(transformId: string): Promise<void> {
        this.resolveWaitingTool(transformId, 'approved');
    }

    /**
     * Manually reject a transform (for testing)
     */
    async manuallyReject(transformId: string): Promise<void> {
        this.resolveWaitingTool(transformId, 'rejected');
    }

    /**
     * Get current status
     */
    getStatus(): { isListening: boolean; waitingTools: number; waitingTransforms: string[] } {
        return {
            isListening: this.isListening,
            waitingTools: this.waitingTools.size,
            waitingTransforms: Array.from(this.waitingTools.keys())
        };
    }
} 