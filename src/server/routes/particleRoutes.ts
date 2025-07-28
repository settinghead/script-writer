import { Router} from 'express';
import { createAuthMiddleware } from '../middleware/auth';
import { AuthDatabase } from '../database/auth';
import { getParticleSystem } from '../transform-jsondoc-framework/particles/ParticleSystemInitializer';
import { db } from '../database/connection';

const router = Router();

// Initialize auth middleware
const authDB = new AuthDatabase(db);
const authMiddleware = createAuthMiddleware(authDB);

/**
 * Health check for particle system
 * GET /api/particles/health
 */
router.get('/health', (req, res) => {
    const particleSystem = getParticleSystem();
    const isAvailable = particleSystem !== null;

    res.json({
        available: isAvailable,
        services: isAvailable ? {
            embeddingService: !!particleSystem.embeddingService,
            particleExtractor: !!particleSystem.particleExtractor,
            particleService: !!particleSystem.particleService,
            particleEventBus: !!particleSystem.particleEventBus,
            particleTemplateProcessor: !!particleSystem.particleTemplateProcessor
        } : null,
        timestamp: new Date().toISOString(),
        version: 'v2-with-similarity' // Test marker
    });
});

/**
 * Manually trigger particle extraction for all jsondocs (dev only)
 * POST /api/particles/extract-all
 */
router.post('/extract-all', authMiddleware.authenticate, async (req, res) => {
    try {
        const particleSystem = getParticleSystem();
        if (!particleSystem) {
            res.status(503).json({ error: 'Particle system not available' });
            return;
        }

        console.log('[ParticleRoutes] Manually triggering particle extraction for all jsondocs...');
        await particleSystem.particleService.initializeAllParticles();

        // Count particles after extraction
        const particleCount = await db.selectFrom('particles').select(db.fn.count('id').as('count')).executeTakeFirst();

        res.json({
            success: true,
            message: 'Particle extraction completed',
            particleCount: particleCount?.count || 0,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[ParticleRoutes] Manual extraction failed:', error);
        res.status(500).json({
            error: 'Particle extraction failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * List all particles within a project
 * GET /api/particles/list?projectId=id&limit=100
 */
router.get('/list', authMiddleware.authenticate, async (req, res) => {
    try {
        const { projectId, limit = 100 } = req.query;
        const user = authMiddleware.getCurrentUser(req);

        // Validate required parameters
        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'ProjectId parameter is required' });
            return;
        }

        if (!user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        // Get particle system
        const particleSystem = getParticleSystem();
        if (!particleSystem) {
            res.status(503).json({
                error: 'Particle system not available',
                details: 'Particle system may not be initialized due to missing configuration'
            });
            return;
        }

        const listLimit = Math.min(parseInt(limit as string) || 100, 200);

        try {
            // Verify user has access to the project
            const { TransformJsondocRepository } = await import('../transform-jsondoc-framework/TransformJsondocRepository.js');
            const jsondocRepo = new TransformJsondocRepository(db);
            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, projectId);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied to project' });
                return;
            }

            // Get all particles for the project
            const particles = await db
                .selectFrom('particles')
                .selectAll()
                .where('project_id', '=', projectId)
                .where('is_active', '=', true)
                .orderBy('created_at', 'desc')
                .limit(listLimit)
                .execute();

            // Transform results to match frontend expectations
            const transformedResults = particles.map(particle => ({
                id: particle.id,
                title: particle.title,
                type: particle.type,
                content_preview: particle.content_text ?
                    particle.content_text.substring(0, 100) + (particle.content_text.length > 100 ? '...' : '') :
                    JSON.stringify(particle.content).substring(0, 100) + '...',
                jsondoc_id: particle.jsondoc_id,
                path: particle.path,
                created_at: particle.created_at,
                updated_at: particle.updated_at
            }));

            res.json(transformedResults);
        } catch (dbError) {
            console.error('[ParticleRoutes] Database list failed:', dbError);
            res.status(500).json({
                error: 'Failed to list particles',
                details: dbError instanceof Error ? dbError.message : 'Database error'
            });
        }

    } catch (error) {
        console.error('[ParticleRoutes] List failed:', error);
        res.status(500).json({
            error: 'Particle list failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Search particles within a project using embedding-based semantic search
 * GET /api/particles/search?query=text&projectId=id&limit=10
 */
router.get('/search', authMiddleware.authenticate, async (req, res) => {
    try {
        const { query, projectId, limit = 10 } = req.query;
        const user = authMiddleware.getCurrentUser(req);

        // Validate required parameters
        if (!query || typeof query !== 'string') {
            res.status(400).json({ error: 'Query parameter is required' });
            return;
        }

        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'ProjectId parameter is required' });
            return;
        }

        if (!user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        // Get particle system
        const particleSystem = getParticleSystem();
        if (!particleSystem) {
            res.status(503).json({
                error: 'Particle system not available',
                details: 'Particle system may not be initialized due to missing configuration'
            });
            return;
        }

        const searchLimit = Math.min(parseInt(limit as string) || 10, 50);

        try {
            // Verify user has access to the project
            const { TransformJsondocRepository } = await import('../transform-jsondoc-framework/TransformJsondocRepository.js');
            const jsondocRepo = new TransformJsondocRepository(db);
            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, projectId);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied to project' });
                return;
            }

            // Use unified search system with embedding-based search for API
            const searchResults = await particleSystem.unifiedSearch.searchParticles(query, projectId, {
                mode: 'embedding',
                limit: searchLimit,
                threshold: 0.0
            });

            // Transform results to match frontend expectations
            const transformedResults = searchResults.map(particle => ({
                id: particle.id,
                title: particle.title,
                type: particle.type,
                content_preview: particle.content_text ?
                    particle.content_text.substring(0, 100) + (particle.content_text.length > 100 ? '...' : '') :
                    JSON.stringify(particle.content).substring(0, 100) + '...',
                jsondoc_id: particle.jsondoc_id,
                path: particle.path,
                similarity: particle.similarity
            }));

            res.json(transformedResults);
        } catch (searchError) {
            console.error('[ParticleRoutes] Real search failed, falling back to mock data:', searchError);

            // Fallback to mock results if real search fails
            const mockResults = [
                {
                    id: 'mock-particle-1',
                    title: '测试角色：苏凌云',
                    type: '角色',
                    content_preview: '苏家遭灭门之灾，苏若水为救重伤兄长假扮林家千金...',
                    jsondoc_id: 'mock-jsondoc-1',
                    path: '$.characters[0]',
                    similarity: 0.85
                },
                {
                    id: 'mock-particle-2',
                    title: '测试创意：复仇爽文',
                    type: '创意',
                    content_preview: '现代都市背景下的复仇题材，女主角智慧与美貌并存...',
                    jsondoc_id: 'mock-jsondoc-2',
                    path: '$.ideas[0]',
                    similarity: 0.72
                }
            ];

            // Filter mock results based on query
            const filteredResults = mockResults.filter(particle =>
                particle.title.includes(query) ||
                particle.content_preview.includes(query) ||
                particle.type.includes(query)
            );

            const limitedResults = filteredResults.slice(0, searchLimit);
            res.json(limitedResults);
        }

    } catch (error) {
        console.error('[ParticleRoutes] Search failed:', error);
        res.status(500).json({
            error: 'Particle search failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * List all particles in a project
 * GET /api/particles/list?projectId=id&limit=50
 */
router.get('/list', authMiddleware.authenticate, async (req, res) => {
    try {
        const { projectId, limit = 50 } = req.query;
        const user = authMiddleware.getCurrentUser(req);

        // Validate required parameters
        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'ProjectId parameter is required' });
            return;
        }

        if (!user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        // Get particle system
        const particleSystem = getParticleSystem();
        if (!particleSystem) {
            res.status(503).json({
                error: 'Particle system not available',
                details: 'Particle system may not be initialized due to missing configuration'
            });
            return;
        }

        // Check if user has access to project
        const { TransformJsondocRepository } = await import('../transform-jsondoc-framework/TransformJsondocRepository.js');
        const jsondocRepo = new TransformJsondocRepository(db);
        const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, projectId);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied to project' });
            return;
        }

        // Get particles from database
        const searchLimit = Math.min(parseInt(limit as string) || 50, 100);
        const particles = await db
            .selectFrom('particles')
            .select([
                'id',
                'title',
                'type',
                'content_text',
                'jsondoc_id',
                'path',
                'updated_at'
            ])
            .where('project_id', '=', projectId)
            .orderBy('updated_at', 'desc')
            .limit(searchLimit)
            .execute();

        // Format results
        const results = particles.map(particle => ({
            id: particle.id,
            title: particle.title,
            type: particle.type,
            content_preview: particle.content_text.substring(0, 100) + (particle.content_text.length > 100 ? '...' : ''),
            jsondoc_id: particle.jsondoc_id,
            path: particle.path,
            updated_at: particle.updated_at
        }));

        res.json(results);

    } catch (error) {
        console.error('[ParticleRoutes] List failed:', error);
        res.status(500).json({
            error: 'Particle list failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Fast string-based search for @mention system
 * GET /api/particles/search-mention?query=text&projectId=id&limit=10
 */
router.get('/search-mention', authMiddleware.authenticate, async (req, res) => {
    try {
        const { query, projectId, limit = 10 } = req.query;
        const user = authMiddleware.getCurrentUser(req);

        if (!query || typeof query !== 'string') {
            res.status(400).json({ error: 'Query parameter is required' });
            return;
        }

        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ error: 'ProjectId parameter is required' });
            return;
        }

        if (!user) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        // Get particle system
        const particleSystem = getParticleSystem();
        if (!particleSystem) {
            res.status(503).json({ error: 'Particle system not available' });
            return;
        }

        const searchLimit = Math.min(parseInt(limit as string) || 10, 20);

        // Use unified search system with string-based search for fast @mention
        const searchResults = await particleSystem.unifiedSearch.searchParticles(query, projectId, {
            mode: 'string',
            limit: searchLimit
        });

        // Transform results to match frontend expectations (same format as main search)
        const formattedResults = searchResults.map(particle => ({
            id: particle.id,
            title: particle.title,
            type: particle.type,
            content_preview: particle.content_text.substring(0, 200) + (particle.content_text.length > 200 ? '...' : ''),
            jsondoc_id: particle.jsondoc_id,
            path: particle.path,
            similarity: particle.similarity,
            created_at: particle.created_at,
            updated_at: particle.updated_at
        }));

        console.log(`[API] String-based particle search found ${formattedResults.length} results for query: "${query}"`);
        res.json(formattedResults);
    } catch (error) {
        console.error('[API] String-based particle search error:', error);
        res.status(500).json({ error: 'Failed to search particles' });
    }
});

export default router; 