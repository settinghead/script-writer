import * as fs from 'fs';

const expected = fs.readFileSync('src/__tests__/fixtures/00001/2_patched_raw_text.txt', 'utf8');

console.log("Does expected output have 'plot_structure'?", expected.includes('plot_structure'));
console.log("Does expected output have the '],' change?", expected.includes('    }\n  ],'));

// Check the end of the file
const lines = expected.split('\n');
console.log("\nLast 10 lines of expected output:");
for (let i = Math.max(0, lines.length - 10); i < lines.length; i++) {
    console.log(`${i + 1}: "${lines[i]}"`);
} 