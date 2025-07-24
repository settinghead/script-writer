import * as fs from 'fs';
import { parseUnifiedDiff } from './src/common/contextDiff';

const originalJson = fs.readFileSync('src/__tests__/fixtures/00001/0_original-jsondoc.json', 'utf8');
const rawDiff = fs.readFileSync('src/__tests__/fixtures/00001/1_raw_llm_diff.txt', 'utf8');
const originalLines = originalJson.split('\n');

const hunks = parseUnifiedDiff(rawDiff);
const hunk2 = hunks[1];

console.log("=== HUNK 2 CONTEXT ===");
console.log("Looking for these lines:");
hunk2.lines.forEach((line, i) => {
    if (line.type === 'context' || line.type === 'deletion') {
        console.log(`${i}: "${line.content}"`);
    }
});

console.log("\n=== PROBLEM ===");
console.log("The hunk is looking for:");
console.log('  "邵夫特·金": "希望来源→欺骗者"');
console.log('  }');
console.log('  }');
console.log('  "plot_structure": {');

console.log("\nBut 'plot_structure' doesn't exist in the original!");
console.log("The original has:");
// Find where the characters array ends
for (let i = 230; i < 240; i++) {
    if (i < originalLines.length) {
        console.log(`${i + 1}: "${originalLines[i]}"`);
    }
}

console.log("\n=== WHAT'S HAPPENING ===");
console.log("1. The LLM hallucinated that 'plot_structure' exists");
console.log("2. Our fuzzy matcher is finding the best match at line 251");
console.log("3. It's applying the change there, which adds the trailing context");
console.log("4. The trailing context includes 'plot_structure' which shouldn't be added"); 