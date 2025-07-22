import { describe, it, expect } from 'vitest';
import { checkParticleBasedAgentHealth } from '../ParticleBasedAgentService';

describe('ParticleBasedAgentService Integration', () => {
    describe('checkParticleBasedAgentHealth', () => {
        it('should check particle-based agent health status', async () => {
            const health = await checkParticleBasedAgentHealth();

            // Should return a valid health object
            expect(health).toHaveProperty('particleSystemAvailable');
            expect(health).toHaveProperty('unifiedSearchAvailable');
            expect(health).toHaveProperty('searchModes');
            expect(health).toHaveProperty('particleCount');

            expect(health.searchModes).toHaveProperty('stringSearchAvailable');
            expect(health.searchModes).toHaveProperty('embeddingSearchAvailable');

            // Values should be booleans
            expect(typeof health.particleSystemAvailable).toBe('boolean');
            expect(typeof health.unifiedSearchAvailable).toBe('boolean');
            expect(typeof health.searchModes.stringSearchAvailable).toBe('boolean');
            expect(typeof health.searchModes.embeddingSearchAvailable).toBe('boolean');

            // Particle count should be a number
            expect(typeof health.particleCount).toBe('number');
            expect(health.particleCount).toBeGreaterThanOrEqual(0);

            console.log('Particle-based agent health:', health);
        });
    });
}); 