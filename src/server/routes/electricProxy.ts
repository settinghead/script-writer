import { Router, Request, Response } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { AuthDatabase } from '../database/auth';

export function createElectricProxyRoutes(authDB: AuthDatabase) {
    const router = Router();
    const authMiddleware = new AuthMiddleware(authDB);

    // Electric proxy endpoint with authentication
    router.get('/v1/shape', authMiddleware.authenticate, async (req: Request, res: Response): Promise<void> => {
        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }

            // Construct the upstream Electric URL
            const electricUrl = new URL(`${process.env.ELECTRIC_URL || 'http://localhost:3000'}/v1/shape`);

            // Copy over Electric's query params
            const url = new URL(req.url, `http://${req.headers.host}`);
            url.searchParams.forEach((value, key) => {
                if (['live', 'table', 'handle', 'offset', 'cursor', 'columns'].includes(key)) {
                    electricUrl.searchParams.set(key, value);
                }
            });

            // Get the table being requested
            const table = url.searchParams.get('table');

            // 1. Get all project IDs the user has access to.
            const allowedProjectIds = await req.authDB!.getProjectIdsForUser(user.id);

            if (allowedProjectIds.length === 0) {
                // If user has no projects, return an empty result set immediately.
                // This prevents any data leakage and is more efficient.
                res.status(200).json([]);
                return;
            }

            // 2. Construct a user-scoping WHERE clause.
            const projectIdsInClause = allowedProjectIds.map(id => `'${id}'`).join(',');
            const userScopedWhere = `project_id IN (${projectIdsInClause})`;

            // 3. Apply user-scoped WHERE clauses based on table
            const existingWhere = url.searchParams.get('where');
            let finalWhereClause = '';

            switch (table) {
                case 'brainstorm_flows':
                case 'projects':
                case 'artifacts':
                case 'transforms':
                case 'human_transforms':
                case 'llm_transforms':
                case 'transform_inputs':
                case 'transform_outputs':
                case 'llm_prompts':
                    // All these tables/views are scoped by project_id.
                    finalWhereClause = existingWhere
                        ? `(${existingWhere}) AND (${userScopedWhere})`
                        : userScopedWhere;
                    break;
                default:
                    res.status(400).json({ error: `Table ${table} not authorized for Electric sync` });
                    return;
            }

            electricUrl.searchParams.set('where', finalWhereClause);

            // console.log(`[Electric Proxy] User ${user.id} requesting table ${table}`);
            // console.log(`[Electric Proxy] Final URL: ${electricUrl.toString()}`);

            // Forward the request to Electric with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

            const response = await fetch(electricUrl.toString(), {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                console.error(`[Electric Proxy] Electric request failed: ${response.status} ${response.statusText}`);

                // Handle specific Electric errors
                if (response.status === 409) {
                    // Pass through 409 conflicts with proper headers for client retry
                    const electricHandle = response.headers.get('electric-handle');
                    if (electricHandle) {
                        res.setHeader('electric-handle', electricHandle);
                    }

                    // Try to get the response body for 409 errors
                    try {
                        const errorBody = await response.text();
                        res.status(409).send(errorBody);
                    } catch {
                        res.status(409).json([{ headers: { control: 'must-refetch' } }]);
                    }
                    return;
                }

                res.status(response.status).json({
                    error: 'Electric sync failed',
                    details: response.statusText
                });
                return;
            }

            // Copy response headers, but remove problematic ones
            const headers = new Headers(response.headers);
            headers.delete('content-encoding');
            headers.delete('content-length');

            // Set response headers
            headers.forEach((value, key) => {
                res.setHeader(key, value);
            });

            // Stream the response body back to the client with error handling
            if (response.body) {
                reader = response.body.getReader();

                const pump = async () => {
                    try {
                        while (true) {
                            const { done, value } = await reader!.read();
                            if (done) break;

                            // Validate that we have valid data before writing
                            if (value && value.length > 0) {
                                if (!res.destroyed && res.writable) {
                                    res.write(value);
                                } else {
                                    // console.log('[Electric Proxy] Response stream closed by client');
                                    break;
                                }
                            }
                        }
                        res.end();
                    } catch (error) {
                        console.error('[Electric Proxy] Stream error:', error);
                        if (!res.destroyed && res.writable) {
                            res.status(500).json({ error: 'Stream interrupted' });
                        }
                    } finally {
                        // Clean up reader
                        if (reader) {
                            try {
                                await reader.cancel();
                            } catch {
                                // Ignore cleanup errors
                            }
                        }
                    }
                };

                // Handle client disconnect
                req.on('close', () => {
                    if (reader) {
                        reader.cancel().catch(() => { });
                    }
                });

                pump();
            } else {
                res.end();
            }

        } catch (error) {
            console.error('[Electric Proxy] Proxy error:', error);

            // Clean up reader on error
            if (reader) {
                try {
                    await reader.cancel();
                } catch {
                    // Ignore cleanup errors
                }
            }

            if (!res.headersSent) {
                res.status(500).json({ error: 'Electric proxy failed' });
            }
        }
    });

    return router;
} 