import { Kysely } from 'kysely';
import { EmbeddingService } from './EmbeddingService';
import { ParticleExtractor } from './ParticleExtractor';
import { ParticleService } from './ParticleService';
import { ParticleEventBus } from './ParticleEventBus';
import { ParticleTemplateProcessor } from './ParticleTemplateProcessor';
import { UnifiedParticleSearch } from './UnifiedParticleSearch';

import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
import { DB } from '../database/types';

export interface ParticleSystemServices {
    embeddingService: EmbeddingService;
    particleExtractor: ParticleExtractor;
    particleService: ParticleService;
    particleEventBus: ParticleEventBus;
    particleTemplateProcessor: ParticleTemplateProcessor;
    unifiedSearch: UnifiedParticleSearch;
}

let globalParticleSystem: ParticleSystemServices | null = null;

/**
 * Initialize the particle system with all required services
 */
export async function initializeParticleSystem(db: Kysely<DB>): Promise<ParticleSystemServices> {
    console.log('[ParticleSystem] Initializing particle system...');

    try {
        // Initialize services in dependency order
        const embeddingService = new EmbeddingService();
        const particleExtractor = new ParticleExtractor(embeddingService);
        const jsondocRepo = new TransformJsondocRepository(db);
        const transformRepo = new TransformJsondocRepository(db);
        const particleService = new ParticleService(db, embeddingService, particleExtractor, jsondocRepo, transformRepo);
        const particleTemplateProcessor = new ParticleTemplateProcessor(particleService);

        // Setup unified search system
        const unifiedSearch = new UnifiedParticleSearch(db, embeddingService, particleService);

        // Setup event bus for real-time updates
        const particleEventBus = new ParticleEventBus(db, particleService);

        // Store global instance
        globalParticleSystem = {
            embeddingService,
            particleExtractor,
            particleService,
            particleEventBus,
            particleTemplateProcessor,
            unifiedSearch
        };

        // Try to start listening for jsondoc changes, but don't fail if it doesn't work
        try {
            await particleEventBus.startListening();
            console.log('[ParticleSystem] ✅ Particle event bus started successfully');
        } catch (error) {
            console.warn('[ParticleSystem] ⚠️ Particle event bus failed to start, will use manual updates:', error instanceof Error ? error.message : String(error));
        }



        console.log('[ParticleSystem] ✅ Particle system initialized successfully');

        // Initialize particles for existing jsondocs
        await particleService.initializeAllParticles();

        return globalParticleSystem;
    } catch (error) {
        console.error('[ParticleSystem] ❌ Failed to initialize particle system:', error);
        throw error;
    }
}

/**
 * Get the global particle system instance
 * Returns null if not initialized
 */
export function getParticleSystem(): ParticleSystemServices | null {
    return globalParticleSystem;
}

/**
 * Get the global particle template processor
 * Returns null if particle system is not initialized
 */
export function getParticleTemplateProcessor(): ParticleTemplateProcessor | null {
    return globalParticleSystem?.particleTemplateProcessor || null;
}



/**
 * Check if particle system is initialized
 */
export function isParticleSystemInitialized(): boolean {
    return globalParticleSystem !== null;
}

/**
 * Cleanup particle system (useful for testing)
 */
export function cleanupParticleSystem(): void {
    if (globalParticleSystem?.particleEventBus) {
        // Stop event bus if it has cleanup methods
        globalParticleSystem.particleEventBus.removeAllListeners();
    }
    globalParticleSystem = null;
    console.log('[ParticleSystem] Particle system cleaned up');
} 