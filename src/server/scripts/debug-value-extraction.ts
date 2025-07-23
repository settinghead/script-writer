#!/usr/bin/env node

/**
 * Debug Value Extraction
 * 
 * This script tests the extractValueFromDiffBlock function with failing inputs
 */

import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
    try {
        console.log('🔍 Testing Value Extraction...\\n');

        // Import our context diff functions
        const { extractValueFromDiffBlock } = await import('../../common/contextDiff.js');

        // Test the failing case
        const failingRemoval = `"personality_traits": [`;
        const failingAddition = `"personality_traits": [
            "冷静理性",
            "善于伪装",
            "内心矛盾",
            "情感觉醒",
            "道德困境中挣扎"
          ],`;

        console.log('🧪 Testing failing removal:');
        console.log(`Input: "${failingRemoval}"`);
        const removalResult = extractValueFromDiffBlock(failingRemoval);
        console.log(`Result: "${removalResult}"`);
        console.log(`Type: ${typeof removalResult}\\n`);

        console.log('🧪 Testing failing addition:');
        console.log(`Input: "${failingAddition}"`);
        const additionResult = extractValueFromDiffBlock(failingAddition);
        console.log(`Result: "${additionResult}"`);
        console.log(`Type: ${typeof additionResult}\\n`);

        // Test a working case for comparison
        const workingCase = `"occupation": "外卖骑手",`;
        console.log('🧪 Testing working case:');
        console.log(`Input: "${workingCase}"`);
        const workingResult = extractValueFromDiffBlock(workingCase);
        console.log(`Result: "${workingResult}"`);
        console.log(`Type: ${typeof workingResult}\\n`);

        // Test the complete multi-line array case
        const completeArrayCase = `"personality_traits": [
            "冷静理性",
            "善于伪装", 
            "内心矛盾",
            "情感觉醒",
            "道德困境中挣扎"
          ]`;

        console.log('🧪 Testing complete array case:');
        console.log(`Input: "${completeArrayCase}"`);
        const arrayResult = extractValueFromDiffBlock(completeArrayCase);
        console.log(`Result: "${arrayResult}"`);
        console.log(`Type: ${typeof arrayResult}\\n`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit(0);
    }
}

main().catch(console.error); 