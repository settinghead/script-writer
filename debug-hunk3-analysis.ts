import * as fs from 'fs';
import { parseUnifiedDiff } from './src/common/contextDiff';

const rawDiff = fs.readFileSync('src/__tests__/fixtures/00001/1_raw_llm_diff.txt', 'utf8');
const hunks = parseUnifiedDiff(rawDiff);

const hunk3 = hunks[2];
console.log("=== HUNK 3 DETAILS ===");
console.log(`Old: ${hunk3.oldStart}, Count: ${hunk3.oldCount}`);
console.log(`New: ${hunk3.newStart}, Count: ${hunk3.newCount}`);
console.log("\nLines:");
hunk3.lines.forEach((line, i) => {
    const prefix = line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' ';
    console.log(`${i}: [${line.type}] ${prefix} "${line.content}"`);
});

console.log("\n=== ANALYSIS ===");
const contextLines = hunk3.lines.filter(l => l.type === 'context');
const deletionLines = hunk3.lines.filter(l => l.type === 'deletion');
const additionLines = hunk3.lines.filter(l => l.type === 'addition');

console.log(`Context lines: ${contextLines.length}`);
console.log(`Deletion lines: ${deletionLines.length}`);
console.log(`Addition lines: ${additionLines.length}`);

console.log("\n=== WHAT SHOULD HAPPEN ===");
console.log("1. Find the context line with 'description' (which is really 'core_setting_summary')");
console.log("2. Replace 'core_setting_summary' with 'description'");
console.log("3. Add the new key_scenes entries");
console.log("4. Add 'climactic_moment' field");
console.log("5. Keep the closing brace");

console.log("\n=== CURRENT ALGORITHM ===");
console.log("Leading context (before changes): kept");
console.log("Deletions: removed");
console.log("Additions: added");
console.log("Trailing context (after changes): NOT kept"); 