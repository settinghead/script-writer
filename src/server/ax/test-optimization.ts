#!/usr/bin/env tsx

import { optimizeBrainstormProgram } from './ax-optimize-brainstorm';

async function main() {
    console.log('🧪 Testing brainstorm optimization...');

    try {
        const result = await optimizeBrainstormProgram({
            numTrials: 5, // Small number for testing
            auto: 'light',
            metricType: 'quality',
            verbose: true,
            outputPath: './test-optimized-brainstorm.json'
        });

        console.log('✅ Test completed successfully!');
        console.log(`📊 Generated ${result.demos.length} optimized demonstrations`);
        console.log(`📁 Saved to: ${result.outputPath}`);

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
main().catch(console.error); 