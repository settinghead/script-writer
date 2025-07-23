#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { jsonrepair } from 'jsonrepair';
import { join } from 'path';

async function repairPatchedJson() {
    try {
        const inputPath = join(process.cwd(), 'debug-patched-output.txt');
        const outputPath = join(process.cwd(), 'debug-repaired.json');

        const brokenJson = readFileSync(inputPath, 'utf-8');

        console.log('Repairing JSON...');
        const repaired = jsonrepair(brokenJson);

        writeFileSync(outputPath, repaired, 'utf-8');

        console.log('✅ Repaired JSON saved to:', outputPath);

        // Validate
        try {
            JSON.parse(repaired);
            console.log('✅ Repaired JSON is valid');
        } catch (e) {
            console.log('❌ Repaired JSON is still invalid:', e);
        }

    } catch (error) {
        console.error('Error repairing JSON:', error);
    } finally {
        process.exit(0);
    }
}

repairPatchedJson(); 