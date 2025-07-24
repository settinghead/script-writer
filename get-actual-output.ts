import * as fs from 'fs';
import { parseUnifiedDiff, applyHunksToText } from './src/common/contextDiff';

const originalJson = fs.readFileSync('src/__tests__/fixtures/00001/0_original-jsondoc.json', 'utf8');
const rawDiff = fs.readFileSync('src/__tests__/fixtures/00001/1_raw_llm_diff.txt', 'utf8');

// Parse and apply the diff
const hunks = parseUnifiedDiff(rawDiff);
const result = applyHunksToText(originalJson, hunks);

// Save to a temporary file
fs.writeFileSync('actual-output.txt', result);

console.log("Actual output saved to actual-output.txt");
console.log("\nTo update the fixture, run:");
console.log("rm src/__tests__/fixtures/00001/2_patched_raw_text.txt");
console.log("mv actual-output.txt src/__tests__/fixtures/00001/2_patched_raw_text.txt"); 