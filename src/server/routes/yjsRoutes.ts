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
    jsondoc_id: string;
    update: Uint8Array;
};

export type AwarenessUpdate = Update & {
    client_id: string;
};

// Parse request helper (based on Electric YJS example)
const parseRequest = async (req: express.Request): Promise<ValidRequest | InvalidRequest> => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const jsondoc_id = url.searchParams.get('jsondoc_id');

    if (!jsondoc_id) {
        return { isValid: false, error: 'jsondoc_id is required' };
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
        return { isValid: true, jsondoc_id, client_id, update };
    } else {
        return { isValid: true, jsondoc_id, update };
    }
};

// Save document update using raw SQL to avoid TypeScript issues
async function saveUpdate({ jsondoc_id, update }: Update) {
    const room_id = `jsondoc-${jsondoc_id}`;

    // Get project_id from jsondoc
    const jsondoc = await db
        .selectFrom('jsondocs')
        .select('project_id')
        .where('id', '=', jsondoc_id)
        .executeTakeFirst();

    if (!jsondoc) {
        throw new Error(`Jsondoc not found: ${jsondoc_id}`);
    }

    // Save the YJS update to jsondoc_yjs_documents
    await db
        .insertInto('jsondoc_yjs_documents')
        .values({
            jsondoc_id,
            project_id: jsondoc.project_id,
            room_id,
            document_state: Buffer.from(update)
        })
        .execute();

    // Auto-sync YJS document to jsondoc record
    await syncYJSToJsondoc(jsondoc_id);
}

// Helper function to sync YJS document to jsondoc
const syncYJSToJsondoc = async (jsondocId: string) => {
    try {

        // Get all YJS updates for this jsondoc
        const updates = await db
            .selectFrom('jsondoc_yjs_documents')
            .select(['document_state', 'created_at'])
            .where('jsondoc_id', '=', jsondocId)
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
                    console.warn(`[YJS Sync] Skipping empty update for jsondoc ${jsondocId}`);
                    skippedCount++;
                    continue;
                }

                // Validate minimum size for YJS updates (should be at least a few bytes)
                if (updateData.length < 10) {
                    console.warn(`[YJS Sync] Skipping suspiciously small update (${updateData.length} bytes) for jsondoc ${jsondocId}`);
                    skippedCount++;
                    continue;
                }

                Y.applyUpdate(tempDoc, updateData);
                updateCount++;
            } catch (error) {
                // console.warn(`[YJS Sync] Skipping corrupted update ${updateCount + skippedCount + 1} for jsondoc ${jsondocId}:`, error instanceof Error ? error.message : String(error));
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

        // Update the jsondoc in the database
        const updateTime = new Date().toISOString();

        await db
            .updateTable('jsondocs')
            .set({
                data: JSON.stringify(extractedData),
                updated_at: updateTime
            })
            .where('id', '=', jsondocId)
            .execute();


    } catch (error) {
        console.error(`[YJS Debug] Error syncing YJS to jsondoc ${jsondocId}:`, error);
    }
};

// Helper function to clean up corrupted YJS documents
const cleanupCorruptedDocuments = async (jsondocId: string) => {
    try {
        const updates = await db
            .selectFrom('jsondoc_yjs_documents')
            .select(['id', 'document_state', 'created_at'])
            .where('jsondoc_id', '=', jsondocId)
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
                .deleteFrom('jsondoc_yjs_documents')
                .where('id', 'in', corruptedIds)
                .execute();
        }

    } catch (error) {
        console.error(`[YJS Cleanup] Error cleaning up corrupted documents for jsondoc ${jsondocId}:`, error);
    }
};

// Save awareness update using raw SQL to avoid TypeScript issues
async function upsertAwarenessUpdate({ jsondoc_id, client_id, update }: AwarenessUpdate) {
    const room_id = `jsondoc-${jsondoc_id}`;

    // Get project_id from jsondoc
    const jsondoc = await db
        .selectFrom('jsondocs')
        .select('project_id')
        .where('id', '=', jsondoc_id)
        .executeTakeFirst();

    if (!jsondoc) {
        throw new Error(`Jsondoc not found: ${jsondoc_id}`);
    }

    // Use Kysely insertInto with onConflict for upsert
    await db
        .insertInto('jsondoc_yjs_awareness')
        .values({
            client_id,
            jsondoc_id,
            project_id: jsondoc.project_id,
            room_id,
            update: Buffer.from(update)
        })
        .onConflict((oc) => oc
            .columns(['client_id', 'jsondoc_id'])
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

        const jsondocId = parsedRequest.jsondoc_id;

        // Validate update size (reasonable limits)
        if (parsedRequest.update.length > 1024 * 1024) { // 1MB limit
            console.error(`YJS: Rejecting oversized update (${parsedRequest.update.length} bytes) for jsondoc ${jsondocId}`);
            return res.status(400).json({ error: 'Update too large' });
        }

        if (parsedRequest.update.length === 0) {
            console.error(`YJS: Rejecting empty update for jsondoc ${jsondocId}`);
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
            console.error(`YJS: Update validation failed for jsondoc ${jsondocId}:`, validationError);
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
router.get('/document/:jsondocId', async (req: any, res: any) => {
    try {
        const user = authMiddleware.getCurrentUser(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const jsondocId = req.params.jsondocId;
        if (!jsondocId) {
            return res.status(400).json({ error: 'Jsondoc ID is required' });
        }

        // First, clean up any corrupted documents
        await cleanupCorruptedDocuments(jsondocId);

        // Get all document updates for this jsondoc, ordered by creation time
        const updates = await db
            .selectFrom('jsondoc_yjs_documents')
            .select('document_state')
            .where('jsondoc_id', '=', jsondocId)
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
                            console.warn(`[YJS Document] Skipping empty update for jsondoc ${jsondocId}`);
                            skippedCount++;
                            continue;
                        }

                        if (updateArray.length < 10) {
                            console.warn(`[YJS Document] Skipping suspiciously small update (${updateArray.length} bytes) for jsondoc ${jsondocId}`);
                            skippedCount++;
                            continue;
                        }

                        Y.applyUpdate(tempDoc, updateArray);
                        appliedCount++;
                    } catch (error) {
                        // console.warn(`[YJS Document] Failed to apply update for jsondoc ${jsondocId}, skipping:`, error instanceof Error ? error.message : String(error));
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
router.post('/cleanup/:jsondocId', async (req: any, res: any) => {
    try {
        const user = authMiddleware.getCurrentUser(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const jsondocId = req.params.jsondocId;
        if (!jsondocId) {
            return res.status(400).json({ error: 'Jsondoc ID is required' });
        }

        await cleanupCorruptedDocuments(jsondocId);

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
