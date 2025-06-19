import { Router, Request, Response } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { AuthDatabase } from '../database/auth';

export function createElectricProxyRoutes(authDB: AuthDatabase) {
    const router = Router();
    const authMiddleware = new AuthMiddleware(authDB);

    // Electric proxy endpoint with authentication
    router.get('/v1/shape', authMiddleware.authenticate, async (req: Request, res: Response) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: 'Authentication required' });
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
            const allowedProjectIds = await req.authDB.getProjectIdsForUser(user.id);

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
                    // All these tables/views are scoped by project_id.
                    finalWhereClause = existingWhere
                        ? `(${existingWhere}) AND (${userScopedWhere})`
                        : userScopedWhere;
                    break;
                default:
                    return res.status(400).json({ error: `Table ${table} not authorized for Electric sync` });
            }
            
            electricUrl.searchParams.set('where', finalWhereClause);

            // console.log(`[Electric Proxy] User ${user.id} requesting table ${table}`);
            // console.log(`[Electric Proxy] Final URL: ${electricUrl.toString()}`);

            // Forward the request to Electric
            const response = await fetch(electricUrl.toString());

            if (!response.ok) {
                console.error('Electric request failed:', response.status, response.statusText);
                return res.status(response.status).json({ 
                    error: 'Electric sync failed',
                    details: response.statusText 
                });
            }

            // Copy response headers, but remove problematic ones
            const headers = new Headers(response.headers);
            headers.delete('content-encoding');
            headers.delete('content-length');

            // Set response headers
            headers.forEach((value, key) => {
                res.setHeader(key, value);
            });

            // Stream the response body back to the client
            if (response.body) {
                const reader = response.body.getReader();
                
                const pump = async () => {
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            
                            res.write(value);
                        }
                        res.end();
                    } catch (error) {
                        console.error('Stream error:', error);
                        res.end();
                    }
                };
                
                pump();
            } else {
                res.end();
            }

        } catch (error) {
            console.error('Electric proxy error:', error);
            res.status(500).json({ error: 'Electric proxy failed' });
        }
    });

    return router;
} 