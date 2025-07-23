#!/usr/bin/env node

/**
 * Test Parser Debug
 * 
 * This script tests the parseContextDiff function with the actual LLM output
 * to see exactly what it's parsing.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
    try {
        console.log('🔍 Testing Context Diff Parser...\n');

        // Import our context diff functions
        const { parseContextDiff } = await import('../../common/contextDiff.js');

        // Read the raw LLM output
        const rawLLMOutput = readFileSync(join(process.cwd(), 'debug-raw-llm-output.txt'), 'utf8');

        console.log(`📄 Raw LLM output: ${rawLLMOutput.length} chars\n`);

        // Split into individual sections and test each one
        const diffSections = rawLLMOutput.split(/(?=CONTEXT:)/g).filter(section => section.trim().length > 0);
        console.log(`📋 Found ${diffSections.length} diff sections\n`);

        // Test the first section in detail
        const firstSection = diffSections[0].trim();
        console.log('🎯 Testing first section:');
        console.log('================================================================================');
        console.log(firstSection);
        console.log('================================================================================\n');

        const parsed = parseContextDiff(firstSection);
        if (parsed) {
            console.log('✅ Successfully parsed!');
            console.log(`Context (${parsed.context.length} chars):`);
            console.log(parsed.context);
            console.log('\n' + '='.repeat(80));

            console.log(`\nRemovals (${parsed.removals.length} items):`);
            parsed.removals.forEach((removal, i) => {
                console.log(`${i + 1}. "${removal}"`);
                console.log(`   Length: ${removal.length} chars`);
                console.log(`   Lines: ${removal.split('\n').length}`);
                console.log('');
            });

            console.log(`Additions (${parsed.additions.length} items):`);
            parsed.additions.forEach((addition, i) => {
                console.log(`${i + 1}. "${addition}"`);
                console.log(`   Length: ${addition.length} chars`);
                console.log(`   Lines: ${addition.split('\n').length}`);
                console.log('');
            });
        } else {
            console.log('❌ Failed to parse');
        }

    } catch (error) {
        console.error('\n❌ SCRIPT ERROR:', error);
        throw error;
    } finally {
        process.exit(0);
    }
}

main(); 