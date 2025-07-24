import * as fs from 'fs';
import { createPatch } from 'rfc6902';
import { parseUnifiedDiff, applyHunksToText } from './src/common/contextDiff';
import { repairJsonSync } from './src/server/utils/jsonRepair';

// Read the fixture files
const originalJson = fs.readFileSync('src/__tests__/fixtures/00001/0_original-jsondoc.json', 'utf8');
const rawDiff = fs.readFileSync('src/__tests__/fixtures/00001/1_raw_llm_diff.txt', 'utf8');

console.log('Generating correct RFC6902 patches...');

// Step 1: Parse the original JSON
const originalJsondoc = JSON.parse(originalJson);

// Step 2: Apply the diff to get the patched raw text
const hunks = parseUnifiedDiff(rawDiff);
const patchedRawText = applyHunksToText(originalJson, hunks);

// Step 3: Repair the patched JSON using our robust system
let patchedJsondoc;
try {
    patchedJsondoc = JSON.parse(patchedRawText);
} catch (parseError) {
    console.log('JSON parsing failed, using robust repair...');
    const repairedJson = repairJsonSync(patchedRawText, {
        ensureAscii: false,
        indent: 2
    });
    patchedJsondoc = JSON.parse(repairedJson);
}

// Step 4: Generate RFC6902 patches
const patches = createPatch(originalJsondoc, patchedJsondoc);

// Step 5: Save the patches to the fixture file
const patchesJson = JSON.stringify(patches, null, 2);
fs.writeFileSync('src/__tests__/fixtures/00001/4_rfc6902_patches.json', patchesJson);

console.log('RFC6902 patches generated and saved to 4_rfc6902_patches.json');
console.log(`Generated ${patches.length} patches`);

// Show the first few patches for verification
console.log('\nFirst few patches:');
patches.slice(0, 3).forEach((patch, i) => {
    const valueStr = patch.value !== undefined ? JSON.stringify(patch.value) : 'undefined';
    const displayValue = valueStr.length > 100 ? valueStr.substring(0, 100) + '...' : valueStr;
    console.log(`${i + 1}. ${patch.op} at ${patch.path}: ${displayValue}`);
}); 