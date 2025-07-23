#!/usr/bin/env node

/**
 * Analyze Context Diff Failures
 * 
 * This script analyzes why specific context diff operations failed
 * by parsing the raw LLM output and testing each operation individually.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
    try {
        console.log('🔍 Analyzing Context Diff Failures...\n');

        // Import our context diff functions
        const { parseContextDiff, applyContextDiffToJSON, smartMatch } = await import('../../common/contextDiff.js');

        // Read the debug files
        const originalJson = readFileSync(join(process.cwd(), 'debug-original.json'), 'utf8');
        const rawLLMOutput = readFileSync(join(process.cwd(), 'debug-raw-llm-output.txt'), 'utf8');

        console.log(`📄 Original JSON: ${originalJson.length} chars`);
        console.log(`🤖 Raw LLM output: ${rawLLMOutput.length} chars\n`);

        // Split the raw LLM output into individual context diffs
        const diffSections = rawLLMOutput.split(/(?=CONTEXT:)/g).filter(section => section.trim().length > 0);
        console.log(`📋 Found ${diffSections.length} diff sections\n`);

        let successCount = 0;
        let failureCount = 0;
        const failures: Array<{ index: number, section: string, error: string }> = [];

        // Test each diff section individually
        for (let i = 0; i < diffSections.length; i++) {
            const section = diffSections[i].trim();
            console.log(`\n--- Testing Diff ${i + 1} ---`);
            console.log(`Section preview: ${section.substring(0, 100)}...`);

            try {
                // Parse this individual diff
                const parsedDiff = parseContextDiff(section);

                if (!parsedDiff) {
                    console.log(`❌ Failed to parse diff ${i + 1}`);
                    failureCount++;
                    failures.push({ index: i + 1, section, error: 'Failed to parse' });
                    continue;
                }

                console.log(`✅ Parsed: ${parsedDiff.removals.length} removals, ${parsedDiff.additions.length} additions`);

                // Test if we can apply this diff
                const testResult = applyContextDiffToJSON(originalJson, section);

                if (testResult && testResult !== originalJson) {
                    console.log(`✅ Successfully applied diff ${i + 1}`);
                    successCount++;
                } else {
                    console.log(`❌ Failed to apply diff ${i + 1} - no changes made`);
                    failureCount++;
                    failures.push({ index: i + 1, section, error: 'No changes applied' });
                }

            } catch (error) {
                console.log(`❌ Error processing diff ${i + 1}: ${error}`);
                failureCount++;
                failures.push({ index: i + 1, section, error: String(error) });
            }
        }

        console.log('\n================================================================================');
        console.log('📊 ANALYSIS RESULTS');
        console.log('================================================================================');
        console.log(`✅ Successful diffs: ${successCount}`);
        console.log(`❌ Failed diffs: ${failureCount}`);
        console.log(`📈 Success rate: ${((successCount / diffSections.length) * 100).toFixed(1)}%\n`);

        if (failures.length > 0) {
            console.log('❌ FAILURE DETAILS:');
            failures.forEach(failure => {
                console.log(`\n${failure.index}. Error: ${failure.error}`);
                console.log(`   Section: ${failure.section.substring(0, 200)}...`);
            });

            // Save failure details for further analysis
            const failureReport = {
                totalDiffs: diffSections.length,
                successCount,
                failureCount,
                successRate: (successCount / diffSections.length) * 100,
                failures: failures.map(f => ({
                    index: f.index,
                    error: f.error,
                    sectionPreview: f.section.substring(0, 300)
                }))
            };

            writeFileSync(join(process.cwd(), 'debug-failure-analysis.json'), JSON.stringify(failureReport, null, 2), 'utf8');
            console.log('\n💾 Saved detailed failure analysis to: debug-failure-analysis.json');
        }

    } catch (error) {
        console.error('\n❌ SCRIPT ERROR:', error);
        throw error;
    } finally {
        process.exit(0);
    }
}

main(); 