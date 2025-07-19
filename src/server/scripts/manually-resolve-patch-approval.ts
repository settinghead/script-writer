#!/usr/bin/env node

import getDatabase from '../database/connection';
import { getPatchApprovalEventBus } from '../services/ParticleSystemInitializer';

async function manuallyResolvePatchApproval() {
    const db = getDatabase;
    const projectId = '839d9d37-7af4-4678-b0c0-1be07acb26eb';
    const originalTransformId = 'df016caa-ebd8-4a6c-adaf-fa9d455f96b5';

    console.log(`🔧 Manually resolving patch approval for transform: ${originalTransformId}\n`);

    try {
        // Get the patch approval event bus
        const patchApprovalEventBus = getPatchApprovalEventBus();
        if (!patchApprovalEventBus) {
            console.log('❌ PatchApprovalEventBus not available');
            return;
        }

        // Check current status
        const status = patchApprovalEventBus.getStatus();
        console.log('📊 Current PatchApprovalEventBus status:');
        console.log(`   - Is listening: ${status.isListening}`);
        console.log(`   - Waiting tools: ${status.waitingTools}`);
        console.log(`   - Waiting transforms: ${status.waitingTransforms.join(', ')}`);

        // Check if our transform is in the waiting list
        if (status.waitingTransforms.includes(originalTransformId)) {
            console.log(`\n✅ Transform ${originalTransformId} is in waiting list`);

            // Manually approve it
            console.log('🚀 Manually approving the transform...');
            await patchApprovalEventBus.manuallyApprove(originalTransformId);
            console.log('✅ Manual approval sent');

            // Check status again
            const newStatus = patchApprovalEventBus.getStatus();
            console.log('\n📊 Updated status:');
            console.log(`   - Waiting tools: ${newStatus.waitingTools}`);
            console.log(`   - Waiting transforms: ${newStatus.waitingTransforms.join(', ')}`);

        } else {
            console.log(`\n⚠️ Transform ${originalTransformId} is not in waiting list`);
            console.log('   This might mean:');
            console.log('   1. The approval already completed');
            console.log('   2. The transform was never registered for approval');
            console.log('   3. There was an error in the approval system');

            // Try to manually approve anyway
            console.log('\n🔄 Attempting manual approval anyway...');
            await patchApprovalEventBus.manuallyApprove(originalTransformId);
            console.log('✅ Manual approval attempt completed');
        }

        // Check the transform status in database
        console.log('\n🔍 Checking transform status in database...');
        const transform = await db.selectFrom('transforms')
            .selectAll()
            .where('id', '=', originalTransformId)
            .executeTakeFirst();

        if (transform) {
            console.log(`   Transform status: ${transform.status}`);
            console.log(`   Transform type: ${transform.type}`);

            if (transform.status === 'running') {
                console.log('\n⏳ Transform is still running - the approval process should complete shortly');
            } else {
                console.log(`\n✅ Transform is in ${transform.status} status`);
            }
        }

    } catch (error) {
        console.error('❌ Error manually resolving patch approval:', error);
    }
}

manuallyResolvePatchApproval().catch(console.error); 