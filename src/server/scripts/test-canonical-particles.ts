#!/usr/bin/env node

/**
 * Test script to verify that the new canonical particle system works correctly
 * This script will:
 * 1. Get all canonical jsondocs for a project using the new service
 * 2. Compare with current particle system
 * 3. Update particles to match canonical jsondocs
 * 4. Verify the results
 */

import { db } from '../database/connection';
import { getParticleSystem } from '../services/ParticleSystemInitializer';

async function testCanonicalParticles(projectId: string) {
    console.log(`\n=== Testing Canonical Particle System for Project ${projectId} ===\n`);

    try {
        // Initialize particle system
        const particleSystem = getParticleSystem();
        if (!particleSystem) {
            throw new Error('Particle system not available');
        }

        // 1. Get canonical jsondocs using the new service
        console.log('1. Getting canonical jsondocs...');
        const canonicalIds = await particleSystem.particleService.canonicalJsondocService.getCanonicalJsondocIds(projectId);
        console.log(`   Found ${canonicalIds.size} canonical jsondocs:`, Array.from(canonicalIds));

        // 2. Get current particles
        console.log('\n2. Getting current particles...');
        const currentParticles = await particleSystem.particleService.getProjectParticles(projectId, 1000);
        const currentParticlesByJsondoc = new Map<string, number>();

        for (const particle of currentParticles) {
            const count = currentParticlesByJsondoc.get(particle.jsondoc_id) || 0;
            currentParticlesByJsondoc.set(particle.jsondoc_id, count + 1);
        }

        console.log(`   Found ${currentParticles.length} total particles across ${currentParticlesByJsondoc.size} jsondocs`);

        // Show current distribution
        for (const [jsondocId, count] of currentParticlesByJsondoc) {
            const isCanonical = canonicalIds.has(jsondocId);
            const status = isCanonical ? '✅ CANONICAL' : '❌ NON-CANONICAL';
            console.log(`   - ${jsondocId}: ${count} particles ${status}`);
        }

        // 3. Identify mismatches
        console.log('\n3. Identifying mismatches...');
        const nonCanonicalWithParticles = [];
        const canonicalWithoutParticles = [];

        for (const [jsondocId, count] of currentParticlesByJsondoc) {
            if (!canonicalIds.has(jsondocId)) {
                nonCanonicalWithParticles.push({ jsondocId, count });
            }
        }

        for (const canonicalId of canonicalIds) {
            if (!currentParticlesByJsondoc.has(canonicalId)) {
                canonicalWithoutParticles.push(canonicalId);
            }
        }

        console.log(`   Non-canonical jsondocs with particles: ${nonCanonicalWithParticles.length}`);
        for (const { jsondocId, count } of nonCanonicalWithParticles) {
            console.log(`     - ${jsondocId}: ${count} particles (should be 0)`);
        }

        console.log(`   Canonical jsondocs without particles: ${canonicalWithoutParticles.length}`);
        for (const jsondocId of canonicalWithoutParticles) {
            console.log(`     - ${jsondocId}: 0 particles (should have particles)`);
        }

        // 4. Update particles if there are mismatches
        const hasMismatches = nonCanonicalWithParticles.length > 0 || canonicalWithoutParticles.length > 0;

        if (hasMismatches) {
            console.log('\n4. Updating particles to fix mismatches...');
            await particleSystem.particleService.updateProjectParticles(projectId);

            // 5. Verify results
            console.log('\n5. Verifying results...');
            const updatedParticles = await particleSystem.particleService.getProjectParticles(projectId, 1000);
            const updatedParticlesByJsondoc = new Map<string, number>();

            for (const particle of updatedParticles) {
                const count = updatedParticlesByJsondoc.get(particle.jsondoc_id) || 0;
                updatedParticlesByJsondoc.set(particle.jsondoc_id, count + 1);
            }

            console.log(`   After update: ${updatedParticles.length} total particles across ${updatedParticlesByJsondoc.size} jsondocs`);

            let allCorrect = true;

            // Check that all canonical jsondocs have particles
            for (const canonicalId of canonicalIds) {
                const count = updatedParticlesByJsondoc.get(canonicalId) || 0;
                if (count === 0) {
                    console.log(`   ❌ Canonical jsondoc ${canonicalId} still has no particles`);
                    allCorrect = false;
                } else {
                    console.log(`   ✅ Canonical jsondoc ${canonicalId} has ${count} particles`);
                }
            }

            // Check that no non-canonical jsondocs have particles
            for (const [jsondocId, count] of updatedParticlesByJsondoc) {
                if (!canonicalIds.has(jsondocId)) {
                    console.log(`   ❌ Non-canonical jsondoc ${jsondocId} still has ${count} particles`);
                    allCorrect = false;
                }
            }

            if (allCorrect) {
                console.log('\n✅ SUCCESS: All particles are now correctly aligned with canonical jsondocs!');
            } else {
                console.log('\n❌ FAILURE: Some mismatches still exist after update');
            }
        } else {
            console.log('\n✅ SUCCESS: No mismatches found - particles are already correctly aligned!');
        }

        // 6. Show final summary
        console.log('\n=== Final Summary ===');
        console.log(`Canonical jsondocs: ${canonicalIds.size}`);
        console.log(`Total particles: ${currentParticles.length}`);
        console.log(`Jsondocs with particles: ${currentParticlesByJsondoc.size}`);

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

async function main() {
    const projectId = process.argv[2];

    if (!projectId) {
        console.error('Usage: ./run-ts src/server/scripts/test-canonical-particles.ts <project-id>');
        process.exit(1);
    }

    try {
        await testCanonicalParticles(projectId);
        console.log('\n🎉 Test completed successfully!');
    } catch (error) {
        console.error('\n💥 Test failed:', error);
        process.exit(1);
    } finally {
        await db.destroy();
    }
}

if (require.main === module) {
    main();
} 