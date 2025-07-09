import express, { Request, Response } from 'express';
import { createAuthMiddleware } from '../middleware/auth';
import { db } from '../database/connection';
import { AuthDatabase } from '../database/auth';
import { sql } from 'kysely';

const router = express.Router();

// Initialize auth middleware
const authDB = new AuthDatabase(db);
const authMiddleware = createAuthMiddleware(authDB);

// Apply authentication middleware to all YJS routes
router.use(authMiddleware.authenticate);

// Types for request validation
type InvalidRequest = { isValid: false; error?: string };
type ValidRequest = (Update | AwarenessUpdate) & { isValid: true };

export type Update = {
    artifact_id: string;
    update: Uint8Array;
};

export type AwarenessUpdate = Update & {
    client_id: string;
};

// Parse request helper (based on Electric YJS example)
const parseRequest = async (req: express.Request): Promise<ValidRequest | InvalidRequest> => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const artifact_id = url.searchParams.get('artifact_id');

    if (!artifact_id) {
        return { isValid: false, error: 'artifact_id is required' };
    }

    const client_id = url.searchParams.get('client_id') ?? undefined;

    // Get update binary from request body
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => {
            chunks.push(chunk);
        });
        req.on('end', () => {
            const finalBuffer = Buffer.concat(chunks);
            // Create a new ArrayBuffer with exact size to avoid leftover data
            const arrayBuffer = new ArrayBuffer(finalBuffer.length);
            const uint8View = new Uint8Array(arrayBuffer);
            uint8View.set(finalBuffer);
            resolve(arrayBuffer);
        });
        req.on('error', reject);
    });

    const update = new Uint8Array(arrayBuffer);

    if (update.length === 0) {
        return { isValid: false, error: 'No update provided' };
    }

    if (client_id) {
        return { isValid: true, artifact_id, client_id, update };
    } else {
        return { isValid: true, artifact_id, update };
    }
};

// Save document update using raw SQL to avoid TypeScript issues
async function saveUpdate({ artifact_id, update }: Update) {
    const room_id = `artifact-${artifact_id}`;

    // Get project_id from artifact
    const artifact = await db
        .selectFrom('artifacts')
        .select('project_id')
        .where('id', '=', artifact_id)
        .executeTakeFirst();

    if (!artifact) {
        throw new Error(`Artifact not found: ${artifact_id}`);
    }

    // Save the YJS update to artifact_yjs_documents
    await db
        .insertInto('artifact_yjs_documents')
        .values({
            artifact_id,
            project_id: artifact.project_id,
            room_id,
            document_state: Buffer.from(update)
        })
        .execute();

    // Auto-sync YJS document to artifact record
    await syncYJSToArtifact(artifact_id);
}

// Helper function to sync YJS document to artifact
const syncYJSToArtifact = async (artifactId: string) => {
    try {
        // Get all YJS updates for this artifact
        const updates = await db
            .selectFrom('artifact_yjs_documents')
            .select(['document_state', 'created_at'])
            .where('artifact_id', '=', artifactId)
            .orderBy('created_at', 'asc')
            .execute();

        if (updates.length === 0) {
            return;
        }

        // Create a temporary YJS document and apply all updates
        const Y = await import('yjs');
        const tempDoc = new Y.Doc();
        let updateCount = 0;

        for (const update of updates) {
            try {
                const updateData = Buffer.from(update.document_state);
                Y.applyUpdate(tempDoc, updateData);
                updateCount++;
            } catch (error) {
                console.error(`[YJS Sync] Failed to apply update ${updateCount + 1} for artifact ${artifactId}:`, error);

                // Check if this is a corruption error
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes('contentRefs') ||
                    errorMessage.includes('Invalid typed array length') ||
                    errorMessage.includes('is not valid JSON') ||
                    errorMessage.includes('Unexpected token')) {
                    console.error(`[YJS Sync] Detected corrupted YJS data for artifact ${artifactId}`);
                    console.error(`[YJS Sync] Consider running: ./run-ts src/server/scripts/clean-corrupted-yjs.ts`);
                    console.error(`[YJS Sync] Update ${updateCount + 1} will be skipped to prevent further corruption`);
                    continue; // Skip this corrupted update and try the next one
                }

                // For other errors, stop processing to avoid corrupted state
                console.error(`[YJS Sync] Stopping sync due to unrecoverable error`);
                return;
            }
        }

        // Extract data from the YJS document
        const contentMap = tempDoc.getMap('content');

        // Extract field data
        const extractedData: any = {};
        contentMap.forEach((value: any, key: string) => {
            if (value && typeof value.toArray === 'function') {
                // Handle YJS Arrays first (before toString check)
                const arrayItems = value.toArray();
                extractedData[key] = arrayItems.map((item: any) => {
                    if (item && typeof item.toString === 'function') {
                        // Handle YText items in arrays
                        const stringValue = item.toString();
                        // Try to parse as JSON for object arrays (like characters)
                        try {
                            return JSON.parse(stringValue);
                        } catch {
                            // If not JSON, return as string (for string arrays like selling_points)
                            return stringValue;
                        }
                    }
                    return item;
                });
            } else if (value && typeof value.toString === 'function') {
                // Handle YJS Text
                const stringValue = value.toString();
                // Try to parse as JSON for nested objects
                try {
                    extractedData[key] = JSON.parse(stringValue);
                } catch {
                    // If not JSON, return as string
                    extractedData[key] = stringValue;
                }
            } else {
                // Handle primitive values
                extractedData[key] = value;
            }
        });

        if (Object.keys(extractedData).length === 0) {
            return;
        }

        // Update the artifact in the database
        await db
            .updateTable('artifacts')
            .set({
                data: JSON.stringify(extractedData),
                updated_at: new Date().toISOString()
            })
            .where('id', '=', artifactId)
            .execute();

    } catch (error) {
        console.error(`[YJS Sync] Error syncing YJS to artifact ${artifactId}:`, error);
    }
};

// Save awareness update using raw SQL to avoid TypeScript issues
async function upsertAwarenessUpdate({ artifact_id, client_id, update }: AwarenessUpdate) {
    const room_id = `artifact-${artifact_id}`;

    // Get project_id from artifact
    const artifact = await db
        .selectFrom('artifacts')
        .select('project_id')
        .where('id', '=', artifact_id)
        .executeTakeFirst();

    if (!artifact) {
        throw new Error(`Artifact not found: ${artifact_id}`);
    }

    // Use Kysely insertInto with onConflict for upsert
    await db
        .insertInto('artifact_yjs_awareness')
        .values({
            client_id,
            artifact_id,
            project_id: artifact.project_id,
            room_id,
            update: Buffer.from(update)
        })
        .onConflict((oc) => oc
            .columns(['client_id', 'artifact_id'])
            .doUpdateSet({
                update: Buffer.from(update),
                updated_at: sql`CURRENT_TIMESTAMP`
            })
        )
        .execute();
}

// Main update endpoint (based on Electric YJS example)
router.put('/update', async (req: any, res: any) => {
    try {
        const user = authMiddleware.getCurrentUser(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const parsedRequest = await parseRequest(req);
        if (!parsedRequest.isValid) {
            return res.status(400).json({ error: parsedRequest.error || 'Invalid request' });
        }

        const artifactId = parsedRequest.artifact_id;

        // Validate update size (reasonable limits)
        if (parsedRequest.update.length > 1024 * 1024) { // 1MB limit
            console.error(`YJS: Rejecting oversized update (${parsedRequest.update.length} bytes) for artifact ${artifactId}`);
            return res.status(400).json({ error: 'Update too large' });
        }

        if (parsedRequest.update.length === 0) {
            console.error(`YJS: Rejecting empty update for artifact ${artifactId}`);
            return res.status(400).json({ error: 'Empty update' });
        }

        // Basic corruption check: validate the update can be applied to a test document
        try {
            const Y = await import('yjs');
            const testDoc = new Y.Doc();
            Y.applyUpdate(testDoc, parsedRequest.update);
        } catch (validationError) {
            console.error(`YJS: Update validation failed for artifact ${artifactId}:`, validationError);

            // If validation fails, it might be due to corrupted existing data
            // Log additional context for debugging
            console.error(`YJS: Update details - Size: ${parsedRequest.update.length} bytes`);
            console.error(`YJS: Consider cleaning YJS data for artifact ${artifactId} if errors persist`);

            // Return a more specific error message
            const errorMessage = validationError instanceof Error ? validationError.message : String(validationError);
            if (errorMessage.includes('contentRefs') ||
                errorMessage.includes('Invalid typed array length') ||
                errorMessage.includes('is not valid JSON') ||
                errorMessage.includes('Unexpected token')) {
                return res.status(400).json({
                    error: 'YJS update validation failed - possible data corruption. Try refreshing the page.',
                    details: 'The YJS document may contain corrupted data. Please refresh and try again.'
                });
            }

            return res.status(400).json({ error: 'Invalid YJS update format' });
        }

        if ('client_id' in parsedRequest) {
            await upsertAwarenessUpdate(parsedRequest);
        } else {
            await saveUpdate(parsedRequest);
        }

        res.status(200).json({ success: true });

    } catch (error) {
        console.error('YJS: Error handling update:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Load document endpoint - returns the current YJS document state
router.get('/document/:artifactId', async (req: any, res: any) => {
    try {
        const user = authMiddleware.getCurrentUser(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const artifactId = req.params.artifactId;
        if (!artifactId) {
            return res.status(400).json({ error: 'Artifact ID is required' });
        }

        // Get all document updates for this artifact, ordered by creation time
        const updates = await db
            .selectFrom('artifact_yjs_documents')
            .select('document_state')
            .where('artifact_id', '=', artifactId)
            .orderBy('created_at', 'asc')
            .execute();

        if (updates.length > 0) {
            // Apply all updates to reconstruct the current document state
            const Y = await import('yjs');
            const tempDoc = new Y.Doc();

            // Apply updates in order
            for (const update of updates) {
                if (update.document_state) {
                    try {
                        const updateArray = new Uint8Array(update.document_state);
                        Y.applyUpdate(tempDoc, updateArray);
                    } catch (error) {
                        console.warn('YJS: Failed to apply update, skipping:', error);
                    }
                }
            }

            // Get the final document state
            const finalState = Y.encodeStateAsUpdate(tempDoc);

            res.setHeader('Content-Type', 'application/octet-stream');
            res.send(Buffer.from(finalState));
        } else {
            // Return empty buffer if no updates exist
            res.setHeader('Content-Type', 'application/octet-stream');
            res.send(Buffer.alloc(0));
        }

    } catch (error) {
        console.error('YJS: Error loading document:', error);
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
    }
});

// Health check endpoint
router.get('/health', (req: any, res: any) => {
    res.json({ status: 'ok', service: 'yjs' });
});

export default router;
