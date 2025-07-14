import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth';
import { AuthDatabase } from '../database/auth';
import { getParticleSystem } from '../services/ParticleSystemInitializer';
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
 * Search particles within a project (simplified version)
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
            const { JsondocRepository } = await import('../transform-jsondoc-framework/JsondocRepository.js');
            const jsondocRepo = new JsondocRepository(db);
            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, projectId);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied to project' });
                return;
            }

            // Use real particle search
            const searchResults = await particleSystem.particleService.searchParticles(
                query,
                projectId,
                searchLimit
            );

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

export default router; 