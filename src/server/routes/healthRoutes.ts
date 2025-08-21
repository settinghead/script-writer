import { Router, Request, Response } from 'express';

const router = Router();

// Health check endpoint - simple ping to verify server is responsive
router.get('/', (req: Request, res: Response) => {
    // Access particleSystemInitialized from app.locals
    const particleSystemInitialized = req.app.locals.particleSystemInitialized || false;

    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        particleSystem: particleSystemInitialized
    });
});

export default router;
