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
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).buffer));
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

    // Use Kysely insertInto with proper SQL template for bytea
    await db
        .insertInto('artifact_yjs_documents')
        .values({
            artifact_id,
            project_id: artifact.project_id,
            room_id,
            document_state: Buffer.from(update)
        })
        .execute();
}

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

        const requestParams = await parseRequest(req);
        if (!requestParams.isValid) {
            return res.status(400).json({ error: requestParams.error });
        }

        // TODO: Add access control - verify user has access to this artifact
        // For now, we'll rely on the Electric proxy's project-based filtering

        if ('client_id' in requestParams) {
            console.log('YJS: Saving awareness update for artifact:', requestParams.artifact_id, 'client:', requestParams.client_id);
            await upsertAwarenessUpdate(requestParams);
        } else {
            console.log('YJS: Saving document update for artifact:', requestParams.artifact_id);
            await saveUpdate(requestParams);
        }

        res.json({});

    } catch (error) {
        console.error('YJS: Error handling update:', error);
        const message = error instanceof Error ? error.message : String(error);
        res.status(400).json({ error: message });
    }
});

// Health check endpoint
router.get('/health', (req: any, res: any) => {
    res.json({ status: 'ok', service: 'yjs' });
});

export default router;
