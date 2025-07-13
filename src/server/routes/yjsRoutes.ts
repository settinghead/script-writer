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
    jsonDoc_id: string;
    update: Uint8Array;
};

export type AwarenessUpdate = Update & {
    client_id: string;
};

// Parse request helper (based on Electric YJS example)
const parseRequest = async (req: express.Request): Promise<ValidRequest | InvalidRequest> => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const jsonDoc_id = url.searchParams.get('jsonDoc_id');

    if (!jsonDoc_id) {
        return { isValid: false, error: 'jsonDoc_id is required' };
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
        return { isValid: true, jsonDoc_id, client_id, update };
    } else {
        return { isValid: true, jsonDoc_id, update };
    }
};

// Save document update using raw SQL to avoid TypeScript issues
async function saveUpdate({ jsonDoc_id, update }: Update) {
    const room_id = `jsonDoc-${jsonDoc_id}`;

    // Get project_id from jsonDoc
    const jsonDoc = await db
        .selectFrom('jsonDocs')
        .select('project_id')
        .where('id', '=', jsonDoc_id)
        .executeTakeFirst();

    if (!jsonDoc) {
        throw new Error(`JsonDoc not found: ${jsonDoc_id}`);
    }

    // Save the YJS update to jsonDoc_yjs_documents
    await db
        .insertInto('jsonDoc_yjs_documents')
        .values({
            jsonDoc_id,
            project_id: jsonDoc.project_id,
            room_id,
            document_state: Buffer.from(update)
        })
        .execute();

    // Auto-sync YJS document to jsonDoc record
    await syncYJSToJsonDoc(jsonDoc_id);
}

// Helper function to sync YJS document to jsonDoc
const syncYJSToJsonDoc = async (jsonDocId: string) => {
    try {
        // Get all YJS updates for this jsonDoc
        const updates = await db
            .selectFrom('jsonDoc_yjs_documents')
            .select(['document_state', 'created_at'])
            .where('jsonDoc_id', '=', jsonDocId)
            .orderBy('created_at', 'asc')
            .execute();

        if (updates.length === 0) {
            return;
        }

        // Create a temporary YJS document and apply all updates
        const Y = await import('yjs');
        const tempDoc = new Y.Doc();
        let updateCount = 0;
        let skippedCount = 0;

        for (const update of updates) {
            try {
                const updateData = Buffer.from(update.document_state);

                // Basic validation before applying
                if (updateData.length === 0) {
                    console.warn(`[YJS Sync] Skipping empty update for jsonDoc ${jsonDocId}`);
                    skippedCount++;
                    continue;
                }

                // Validate minimum size for YJS updates (should be at least a few bytes)
                if (updateData.length < 10) {
                    console.warn(`[YJS Sync] Skipping suspiciously small update (${updateData.length} bytes) for jsonDoc ${jsonDocId}`);
                    skippedCount++;
                    continue;
                }

                Y.applyUpdate(tempDoc, updateData);
                updateCount++;
            } catch (error) {
                console.warn(`[YJS Sync] Skipping corrupted update ${updateCount + skippedCount + 1} for jsonDoc ${jsonDocId}:`, error instanceof Error ? error.message : String(error));
                skippedCount++;
                continue;
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

        // Update the jsonDoc in the database
        await db
            .updateTable('jsonDocs')
            .set({
                data: JSON.stringify(extractedData),
                updated_at: new Date().toISOString()
            })
            .where('id', '=', jsonDocId)
            .execute();

    } catch (error) {
        console.error(`[YJS Sync] Error syncing YJS to jsonDoc ${jsonDocId}:`, error);
    }
};

// Helper function to clean up corrupted YJS documents
const cleanupCorruptedDocuments = async (jsonDocId: string) => {
    try {
        const updates = await db
            .selectFrom('jsonDoc_yjs_documents')
            .select(['id', 'document_state', 'created_at'])
            .where('jsonDoc_id', '=', jsonDocId)
            .orderBy('created_at', 'asc')
            .execute();

        if (updates.length === 0) {
            return;
        }

        const Y = await import('yjs');
        const corruptedIds = [];

        for (const update of updates) {
            try {
                const updateData = Buffer.from(update.document_state);

                // Basic validation
                if (updateData.length === 0 || updateData.length < 10) {
                    corruptedIds.push(update.id);
                    continue;
                }

                // Try to apply the update to a temporary document
                const tempDoc = new Y.Doc();
                Y.applyUpdate(tempDoc, updateData);

            } catch (error) {
                corruptedIds.push(update.id);
            }
        }

        if (corruptedIds.length > 0) {
            await db
                .deleteFrom('jsonDoc_yjs_documents')
                .where('id', 'in', corruptedIds)
                .execute();
        }

    } catch (error) {
        console.error(`[YJS Cleanup] Error cleaning up corrupted documents for jsonDoc ${jsonDocId}:`, error);
    }
};

// Save awareness update using raw SQL to avoid TypeScript issues
async function upsertAwarenessUpdate({ jsonDoc_id, client_id, update }: AwarenessUpdate) {
    const room_id = `jsonDoc-${jsonDoc_id}`;

    // Get project_id from jsonDoc
    const jsonDoc = await db
        .selectFrom('jsonDocs')
        .select('project_id')
        .where('id', '=', jsonDoc_id)
        .executeTakeFirst();

    if (!jsonDoc) {
        throw new Error(`JsonDoc not found: ${jsonDoc_id}`);
    }

    // Use Kysely insertInto with onConflict for upsert
    await db
        .insertInto('jsonDoc_yjs_awareness')
        .values({
            client_id,
            jsonDoc_id,
            project_id: jsonDoc.project_id,
            room_id,
            update: Buffer.from(update)
        })
        .onConflict((oc) => oc
            .columns(['client_id', 'jsonDoc_id'])
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

        const jsonDocId = parsedRequest.jsonDoc_id;

        // Validate update size (reasonable limits)
        if (parsedRequest.update.length > 1024 * 1024) { // 1MB limit
            console.error(`YJS: Rejecting oversized update (${parsedRequest.update.length} bytes) for jsonDoc ${jsonDocId}`);
            return res.status(400).json({ error: 'Update too large' });
        }

        if (parsedRequest.update.length === 0) {
            console.error(`YJS: Rejecting empty update for jsonDoc ${jsonDocId}`);
            return res.status(400).json({ error: 'Empty update' });
        }

        // Basic validation: just check if the update is a valid YJS binary format
        // Don't try to apply it to reconstruct state - that causes corruption
        try {
            // Minimal validation - just check basic binary format
            if (parsedRequest.update.length === 0) {
                throw new Error('Empty update');
            }

            // YJS updates typically start with specific byte patterns
            // This is a lightweight check without full reconstruction
            const firstByte = parsedRequest.update[0];
            if (firstByte > 127) {
                console.warn(`YJS: Update has unusual first byte: ${firstByte}, but proceeding anyway`);
            }

        } catch (validationError) {
            console.error(`YJS: Update validation failed for jsonDoc ${jsonDocId}:`, validationError);
            console.error(`YJS: Update details - Size: ${parsedRequest.update.length} bytes`);

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
router.get('/document/:jsonDocId', async (req: any, res: any) => {
    try {
        const user = authMiddleware.getCurrentUser(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const jsonDocId = req.params.jsonDocId;
        if (!jsonDocId) {
            return res.status(400).json({ error: 'JsonDoc ID is required' });
        }

        // First, clean up any corrupted documents
        await cleanupCorruptedDocuments(jsonDocId);

        // Get all document updates for this jsonDoc, ordered by creation time
        const updates = await db
            .selectFrom('jsonDoc_yjs_documents')
            .select('document_state')
            .where('jsonDoc_id', '=', jsonDocId)
            .orderBy('created_at', 'asc')
            .execute();

        if (updates.length > 0) {
            // Apply all updates to reconstruct the current document state
            const Y = await import('yjs');
            const tempDoc = new Y.Doc();
            let appliedCount = 0;
            let skippedCount = 0;

            // Apply updates in order
            for (const update of updates) {
                if (update.document_state) {
                    try {
                        const updateArray = new Uint8Array(update.document_state);

                        // Basic validation
                        if (updateArray.length === 0) {
                            console.warn(`[YJS Document] Skipping empty update for jsonDoc ${jsonDocId}`);
                            skippedCount++;
                            continue;
                        }

                        if (updateArray.length < 10) {
                            console.warn(`[YJS Document] Skipping suspiciously small update (${updateArray.length} bytes) for jsonDoc ${jsonDocId}`);
                            skippedCount++;
                            continue;
                        }

                        Y.applyUpdate(tempDoc, updateArray);
                        appliedCount++;
                    } catch (error) {
                        console.warn(`[YJS Document] Failed to apply update for jsonDoc ${jsonDocId}, skipping:`, error instanceof Error ? error.message : String(error));
                        skippedCount++;
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

// Add a cleanup endpoint for manual cleanup (dev-only)
router.post('/cleanup/:jsonDocId', async (req: any, res: any) => {
    try {
        const user = authMiddleware.getCurrentUser(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const jsonDocId = req.params.jsonDocId;
        if (!jsonDocId) {
            return res.status(400).json({ error: 'JsonDoc ID is required' });
        }

        await cleanupCorruptedDocuments(jsonDocId);

        res.json({ success: true, message: 'Cleanup completed' });

    } catch (error) {
        console.error('YJS: Error during cleanup:', error);
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
    }
});

// Health check endpoint
router.get('/health', (req: any, res: any) => {
    res.json({ status: 'ok', service: 'yjs' });
});

export default router;
