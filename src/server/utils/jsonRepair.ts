import { jsonrepair } from 'jsonrepair';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Robust JSON repair utility that tries multiple approaches:
 * 1. First tries the JavaScript jsonrepair library
 * 2. Falls back to Python json_repair library if JS version fails
 * 
 * @param malformedJson - The malformed JSON string to repair
 * @param options - Repair options
 * @returns Promise<string> - The repaired JSON string
 */
export async function repairJson(
    malformedJson: string,
    options: {
        ensureAscii?: boolean;
        indent?: number;
    } = {}
): Promise<string> {
    const { ensureAscii = false, indent = 2 } = options;

    // Step 1: Try JavaScript jsonrepair first (faster)
    try {
        // console.log('[JSON Repair] Attempting JavaScript jsonrepair...');
        const repairedJson = jsonrepair(malformedJson);

        // Validate that it's actually valid JSON
        JSON.parse(repairedJson);

        // Re-format with proper indentation if needed
        if (indent > 0) {
            const parsed = JSON.parse(repairedJson);
            return JSON.stringify(parsed, null, indent);
        }

        // console.log('[JSON Repair] JavaScript jsonrepair succeeded');
        return repairedJson;
    } catch (jsError) {
        // console.log(`[JSON Repair] JavaScript jsonrepair failed: ${jsError instanceof Error ? jsError.message : String(jsError)}`);
    }

    // Step 2: Fall back to Python json_repair
    try {
        // console.log('[JSON Repair] Attempting Python json_repair fallback...');

        // Find the Python repair script (assume it's in project root)
        const projectRoot = process.cwd();
        const pythonScriptPath = path.join(projectRoot, 'repair_json.py');

        if (!fs.existsSync(pythonScriptPath)) {
            throw new Error(`Python repair script not found at ${pythonScriptPath}`);
        }

        // Create a temporary file for the malformed JSON
        const tempInputFile = path.join(projectRoot, `temp_malformed_${Date.now()}.json`);
        fs.writeFileSync(tempInputFile, malformedJson, 'utf8');

        try {
            // Build the Python command
            const pythonArgs = [
                pythonScriptPath,
                tempInputFile,
                '--indent', indent.toString()
            ];

            if (ensureAscii) {
                pythonArgs.push('--ensure-ascii');
            }

            const pythonCommand = `python ${pythonArgs.join(' ')}`;
            // console.log(`[JSON Repair] Running: ${pythonCommand}`);

            // Execute the Python script
            const repairedJson = execSync(pythonCommand, {
                encoding: 'utf8',
                timeout: 30000, // 30 second timeout
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer
            });

            // Validate the result
            JSON.parse(repairedJson);

            // console.log('[JSON Repair] Python json_repair succeeded');
            return repairedJson.trim();
        } finally {
            // Clean up temporary file
            if (fs.existsSync(tempInputFile)) {
                fs.unlinkSync(tempInputFile);
            }
        }
    } catch (pythonError) {
        // console.error(`[JSON Repair] Python json_repair failed: ${pythonError instanceof Error ? pythonError.message : String(pythonError)}`);
        throw new Error(`Both JavaScript and Python JSON repair methods failed. JS Error: ${pythonError instanceof Error ? pythonError.message : String(pythonError)}`);
    }
}

/**
 * Synchronous version of repairJson for cases where async is not suitable
 */
export function repairJsonSync(
    malformedJson: string,
    options: {
        ensureAscii?: boolean;
        indent?: number;
    } = {}
): string {
    const { ensureAscii = false, indent = 2 } = options;

    // Step 1: Try JavaScript jsonrepair first
    try {
        // console.log('[JSON Repair Sync] Attempting JavaScript jsonrepair...');
        const repairedJson = jsonrepair(malformedJson);

        // Validate that it's actually valid JSON
        JSON.parse(repairedJson);

        // Re-format with proper indentation if needed
        if (indent > 0) {
            const parsed = JSON.parse(repairedJson);
            return JSON.stringify(parsed, null, indent);
        }

        // console.log('[JSON Repair Sync] JavaScript jsonrepair succeeded');
        return repairedJson;
    } catch (jsError) {
        // console.log(`[JSON Repair Sync] JavaScript jsonrepair failed: ${jsError instanceof Error ? jsError.message : String(jsError)}`);
    }

    // Step 2: Fall back to Python json_repair (synchronous)
    try {
        console.log('[JSON Repair Sync] Attempting Python json_repair fallback...');

        const projectRoot = process.cwd();
        const pythonScriptPath = path.join(projectRoot, 'repair_json.py');

        if (!fs.existsSync(pythonScriptPath)) {
            throw new Error(`Python repair script not found at ${pythonScriptPath}`);
        }

        // Create a temporary file for the malformed JSON
        const tempInputFile = path.join(projectRoot, `temp_malformed_sync_${Date.now()}.json`);
        fs.writeFileSync(tempInputFile, malformedJson, 'utf8');

        try {
            // Build the Python command
            const pythonArgs = [
                pythonScriptPath,
                tempInputFile,
                '--indent', indent.toString()
            ];

            if (ensureAscii) {
                pythonArgs.push('--ensure-ascii');
            }

            const pythonCommand = `python ${pythonArgs.join(' ')}`;
            console.log(`[JSON Repair Sync] Running: ${pythonCommand}`);

            // Execute the Python script synchronously
            const repairedJson = execSync(pythonCommand, {
                encoding: 'utf8',
                timeout: 30000, // 30 second timeout
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer
            });

            // Validate the result
            JSON.parse(repairedJson);

            console.log('[JSON Repair Sync] Python json_repair succeeded');
            return repairedJson.trim();
        } finally {
            // Clean up temporary file
            if (fs.existsSync(tempInputFile)) {
                fs.unlinkSync(tempInputFile);
            }
        }
    } catch (pythonError) {
        console.error(`[JSON Repair Sync] Python json_repair failed: ${pythonError instanceof Error ? pythonError.message : String(pythonError)}`);
        throw new Error(`Both JavaScript and Python JSON repair methods failed. Python Error: ${pythonError instanceof Error ? pythonError.message : String(pythonError)}`);
    }
} 