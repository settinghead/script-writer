const fs = require('fs');
const path = require('path');
const { createPatch } = require('rfc6902');

// Read the original and expected final JSON files
const originalPath = path.join('patch-examples', '00001', '0_original-json.json');
const expectedFinalPath = path.join('patch-examples', '00001', '4_expected-final.json');
const outputPath = path.join('patch-examples', '00001', '5_rfc6902_patches.json');

try {
    // Read and parse JSON files
    const originalJson = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
    const expectedFinalJson = JSON.parse(fs.readFileSync(expectedFinalPath, 'utf8'));

    // Generate RFC6902 patches
    const patches = createPatch(originalJson, expectedFinalJson);

    // Write patches to output file
    fs.writeFileSync(outputPath, JSON.stringify(patches, null, 2), 'utf8');

    console.log(`Generated ${patches.length} RFC6902 patches`);
    console.log(`Patches written to: ${outputPath}`);
    
    // Show summary of patches
    patches.forEach((patch, index) => {
        console.log(`Patch ${index + 1}: ${patch.op} at ${patch.path}`);
    });

} catch (error) {
    console.error('Error generating patches:', error);
    process.exit(1);
} 