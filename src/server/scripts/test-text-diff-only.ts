#!/usr/bin/env node

/**
 * Test ONLY the text diff application function
 * Input: original text string + context diff string
 * Output: modified text string
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { jsonrepair } from 'jsonrepair';

/**
 * Apply context-based diff to JSON by parsing, modifying the object, and re-stringifying
 * @param originalText - The original JSON text string
 * @param contextDiff - The context-based diff string
 * @returns Modified JSON string or null if failed
 */
function applyContextDiffToJSON(originalText: string, contextDiff: string): string | null {
    try {
        console.log('[JSONDiff] Starting JSON-aware diff application...');
        console.log('[JSONDiff] Original text length:', originalText.length);
        console.log('[JSONDiff] Context diff length:', contextDiff.length);

        // Parse the original JSON
        let jsonObj;
        try {
            jsonObj = JSON.parse(originalText);
        } catch (parseError) {
            console.log('[JSONDiff] Original text is not valid JSON, trying to repair first...');
            const repairedText = jsonrepair(originalText);
            jsonObj = JSON.parse(repairedText);
        }

        // Parse the diff to extract the changes
        const parsedDiff = parseContextDiff(contextDiff);
        if (!parsedDiff) {
            console.log('[JSONDiff] Failed to parse diff');
            return null;
        }
        console.log('[JSONDiff] Parsed diff:', {
            context_length: parsedDiff.context.length,
            removals_count: parsedDiff.removals.length,
            additions_count: parsedDiff.additions.length
        });

        // Apply changes to the JSON object
        let changesApplied = 0;
        for (let i = 0; i < Math.max(parsedDiff.removals.length, parsedDiff.additions.length); i++) {
            const removal = parsedDiff.removals[i] || '';
            const addition = parsedDiff.additions[i] || '';

            if (removal && addition) {
                console.log(`[JSONDiff] Processing change ${i + 1}:`);
                console.log(`[JSONDiff]   Remove: "${removal.substring(0, 50)}..."`);
                console.log(`[JSONDiff]   Add: "${addition.substring(0, 50)}..."`);

                // Skip if removal and addition are identical (no actual change)
                if (removal.trim() === addition.trim()) {
                    console.log(`[JSONDiff]   SKIPPED: Removal and addition are identical (no change needed)`);
                    changesApplied++; // Count as successful since no change was needed
                    continue;
                }

                // Try to apply the change to the JSON object
                if (applyChangeToJSONObject(jsonObj, removal, addition)) {
                    changesApplied++;
                    console.log(`[JSONDiff]   SUCCESS: Applied change ${i + 1}`);
                } else {
                    console.log(`[JSONDiff]   WARNING: Could not apply change ${i + 1}`);
                }
            }
        }

        console.log(`[JSONDiff] Applied ${changesApplied} out of ${parsedDiff.removals.length} changes`);

        // Convert back to JSON string with pretty formatting
        const modifiedText = JSON.stringify(jsonObj, null, 2);
        console.log('[JSONDiff] Final modified text length:', modifiedText.length);
        console.log('[JSONDiff] JSON-aware diff application completed');

        return modifiedText;

    } catch (error) {
        console.error('[JSONDiff] Error applying JSON-aware diff:', error);
        return null;
    }
}

/**
 * Apply a single change to a JSON object by finding and replacing values
 * @param obj - The JSON object to modify
 * @param removal - The text to remove
 * @param addition - The text to add
 * @returns true if change was applied, false otherwise
 */
function applyChangeToJSONObject(obj: any, removal: string, addition: string): boolean {
    // Extract the value from removal and addition strings
    const removalValue = extractValueFromDiffLine(removal);
    const additionValue = extractValueFromDiffLine(addition);

    console.log(`[JSONDiff]     Raw removal: "${removal.trim()}"`);
    console.log(`[JSONDiff]     Raw addition: "${addition.trim()}"`);
    console.log(`[JSONDiff]     Extracted removal value: "${removalValue}"`);
    console.log(`[JSONDiff]     Extracted addition value: "${additionValue}"`);

    if (!removalValue || !additionValue) {
        console.log(`[JSONDiff]     Skipping: Could not extract values from diff lines`);
        return false;
    }

    console.log(`[JSONDiff]     Looking for value: "${removalValue}"`);
    console.log(`[JSONDiff]     Replacing with: "${additionValue}"`);

    // Recursively search and replace in the JSON object
    return replaceValueInObject(obj, removalValue, additionValue);
}

/**
 * Extract the actual value from a diff line (remove quotes, commas, etc.)
 * @param diffLine - A line from the diff
 * @returns The extracted value or null
 */
function extractValueFromDiffLine(diffLine: string): string | null {
    // Remove leading/trailing whitespace
    const trimmed = diffLine.trim();

    // Handle quoted strings
    const quotedMatch = trimmed.match(/^"([^"]*)"[,]?$/);
    if (quotedMatch) {
        return quotedMatch[1];
    }

    // Handle field: value patterns
    const fieldValueMatch = trimmed.match(/^"(\w+)":\s*"([^"]*)"[,]?$/);
    if (fieldValueMatch) {
        return fieldValueMatch[2]; // Return just the value part
    }

    // Handle array elements
    const arrayElementMatch = trimmed.match(/^"([^"]*)"[,]?$/);
    if (arrayElementMatch) {
        return arrayElementMatch[1];
    }

    return null;
}

/**
 * Recursively search and replace a value in a JSON object
 * @param obj - The object to search in
 * @param oldValue - The value to find
 * @param newValue - The value to replace with
 * @returns true if replacement was made, false otherwise
 */
function replaceValueInObject(obj: any, oldValue: string, newValue: string): boolean {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }

    let replaced = false;

    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];

            if (typeof value === 'string') {
                // Direct string match
                if (value === oldValue) {
                    obj[key] = newValue;
                    console.log(`[JSONDiff]       Replaced field "${key}": "${oldValue}" -> "${newValue}"`);
                    replaced = true;
                }
                // Partial string match for longer texts
                else if (value.includes(oldValue) && oldValue.length > 10) {
                    obj[key] = value.replace(oldValue, newValue);
                    console.log(`[JSONDiff]       Partial replace in field "${key}"`);
                    replaced = true;
                }
                // Fuzzy matching for similar strings (normalize punctuation and whitespace)
                else if (oldValue.length > 20) {
                    const normalizedValue = value.replace(/[。，、；：！？]/g, '.').replace(/\s+/g, ' ').trim();
                    const normalizedOldValue = oldValue.replace(/[。，、；：！？]/g, '.').replace(/\s+/g, ' ').trim();

                    if (normalizedValue === normalizedOldValue) {
                        obj[key] = newValue;
                        console.log(`[JSONDiff]       Fuzzy replaced field "${key}" (punctuation normalized)`);
                        replaced = true;
                    }
                    // Similarity check for very close matches
                    else if (normalizedValue.includes(normalizedOldValue.substring(0, 50)) &&
                        normalizedOldValue.includes(normalizedValue.substring(0, 50))) {
                        obj[key] = newValue;
                        console.log(`[JSONDiff]       Fuzzy replaced field "${key}" (similarity match)`);
                        replaced = true;
                    }
                }
            } else if (Array.isArray(value)) {
                // Handle arrays
                for (let i = 0; i < value.length; i++) {
                    if (typeof value[i] === 'string' && value[i] === oldValue) {
                        value[i] = newValue;
                        console.log(`[JSONDiff]       Replaced array element [${i}]: "${oldValue}" -> "${newValue}"`);
                        replaced = true;
                    }
                }
                // Recursively search in array objects
                for (const item of value) {
                    if (replaceValueInObject(item, oldValue, newValue)) {
                        replaced = true;
                    }
                }
            } else if (typeof value === 'object') {
                // Recursively search in nested objects
                if (replaceValueInObject(value, oldValue, newValue)) {
                    replaced = true;
                }
            }
        }
    }

    return replaced;
}

/**
 * TypeScript types for parsed diff
 */
interface ParsedDiff {
    context: string;
    removals: string[];
    additions: string[];
}

/**
 * Parse the context diff string into structured parts
 * @param contextDiff - The raw diff text
 * @returns ParsedDiff or null if failed
 */
function parseContextDiff(contextDiff: string): ParsedDiff | null {
    const lines = contextDiff.split('\n');
    let context = '';
    const removals: string[] = [];
    const additions: string[] = [];
    let inContext = false;

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('CONTEXT:')) {
            inContext = true;
            context = trimmed.substring(8).trim() + '\n';
            continue;
        }

        if (inContext && !trimmed.startsWith('-') && !trimmed.startsWith('+') && trimmed) {
            context += line + '\n';
            continue;
        }

        if (trimmed.startsWith('-')) {
            inContext = false;
            removals.push(line.substring(line.indexOf('-') + 1));
            continue;
        }

        if (trimmed.startsWith('+')) {
            inContext = false;
            additions.push(line.substring(line.indexOf('+') + 1));
            continue;
        }
    }

    // Clean up
    context = context.trim();

    if (!context) {
        console.log('[ParseDiff] No context found');
        return null;
    }

    return { context, removals, additions };
}

/**
 * Simple Levenshtein distance for fuzzy matching
 * @param s1 - String 1
 * @param s2 - String 2
 * @returns Distance score
 */
function levenshteinDistance(s1: string, s2: string): number {
    const matrix = Array.from({ length: s1.length + 1 }, () => Array(s2.length + 1).fill(0));

    for (let i = 0; i <= s1.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= s1.length; i++) {
        for (let j = 1; j <= s2.length; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    return matrix[s1.length][s2.length];
}

/**
 * Smart match result interface
 */
interface SmartMatchResult {
    index: number;
    score: number;
    matchedText: string;
    method: string;
}

/**
 * Smart matching that tries multiple strategies efficiently
 * @param needle - String to find
 * @param haystack - Text to search in
 * @returns Best match result or null
 */
function smartMatch(needle: string, haystack: string): SmartMatchResult | null {
    if (!needle) return null;

    console.log(`[SmartMatch] Searching for needle (${needle.length} chars) in haystack (${haystack.length} chars)`);

    // Strategy 1: Exact match
    const exactIndex = haystack.indexOf(needle);
    if (exactIndex !== -1) {
        console.log('[SmartMatch] Found exact match at index:', exactIndex);
        return {
            index: exactIndex,
            score: 1.0,
            matchedText: needle,
            method: 'exact'
        };
    }

    // Strategy 2: Normalize whitespace and try again
    const normalizedNeedle = needle.replace(/\s+/g, ' ').trim();
    const normalizedHaystack = haystack.replace(/\s+/g, ' ');
    const normalizedIndex = normalizedHaystack.indexOf(normalizedNeedle);
    if (normalizedIndex !== -1) {
        console.log('[SmartMatch] Found normalized match at index:', normalizedIndex);
        // Find the corresponding index in original text
        let charCount = 0;
        let originalIndex = 0;
        for (let i = 0; i < haystack.length && charCount < normalizedIndex; i++) {
            if (haystack[i].match(/\S/) || charCount === 0 || haystack[i - 1].match(/\S/)) {
                charCount++;
            }
            originalIndex = i;
        }
        return {
            index: originalIndex,
            score: 0.95,
            matchedText: haystack.substring(originalIndex, originalIndex + needle.length),
            method: 'normalized'
        };
    }

    // Strategy 2b: Aggressive normalization for long text blocks
    if (needle.length > 100) {
        const aggressiveNeedle = needle.replace(/[\s\n\r]+/g, ' ').replace(/[""]/g, '"').trim();
        const aggressiveHaystack = haystack.replace(/[\s\n\r]+/g, ' ').replace(/[""]/g, '"');
        const aggressiveIndex = aggressiveHaystack.indexOf(aggressiveNeedle);
        if (aggressiveIndex !== -1) {
            console.log('[SmartMatch] Found aggressive normalized match at index:', aggressiveIndex);
            // Find approximate position in original text
            const ratio = aggressiveIndex / aggressiveHaystack.length;
            const approxIndex = Math.floor(ratio * haystack.length);

            // Search around the approximate position
            const searchRadius = 200;
            const searchStart = Math.max(0, approxIndex - searchRadius);
            const searchEnd = Math.min(haystack.length, approxIndex + searchRadius);

            // Look for a good starting point (like a field name)
            const needleStart = needle.substring(0, Math.min(30, needle.length)).trim();
            const localArea = haystack.substring(searchStart, searchEnd);
            const localMatch = localArea.indexOf(needleStart);

            if (localMatch !== -1) {
                const actualIndex = searchStart + localMatch;
                return {
                    index: actualIndex,
                    score: 0.85,
                    matchedText: haystack.substring(actualIndex, actualIndex + needle.length),
                    method: 'aggressive-normalized'
                };
            }
        }
    }

    // Strategy 3: Find significant unique substrings
    const significantParts = needle.split(/[\n\r]/).filter(line => line.trim().length > 20);
    for (const part of significantParts) {
        const trimmedPart = part.trim();
        const partIndex = haystack.indexOf(trimmedPart);
        if (partIndex !== -1) {
            console.log('[SmartMatch] Found significant part match at index:', partIndex);
            // Try to find the start of the full needle around this position
            const searchStart = Math.max(0, partIndex - needle.length);
            const searchEnd = Math.min(haystack.length, partIndex + needle.length);
            const searchRegion = haystack.substring(searchStart, searchEnd);

            // Look for the beginning of our needle pattern
            const needleStart = needle.substring(0, Math.min(50, needle.length));
            const startIndex = searchRegion.indexOf(needleStart);
            if (startIndex !== -1) {
                const actualIndex = searchStart + startIndex;
                return {
                    index: actualIndex,
                    score: 0.8,
                    matchedText: haystack.substring(actualIndex, actualIndex + needle.length),
                    method: 'partial'
                };
            }

            // Fall back to the part index
            return {
                index: partIndex,
                score: 0.7,
                matchedText: haystack.substring(partIndex, partIndex + needle.length),
                method: 'substring'
            };
        }
    }

    // Strategy 4: Try to match key quoted strings or field patterns
    const quotedMatches = needle.match(/"[^"]{10,}"/g);
    if (quotedMatches) {
        for (const quotedText of quotedMatches) {
            const quotedIndex = haystack.indexOf(quotedText);
            if (quotedIndex !== -1) {
                console.log('[SmartMatch] Found quoted text match at index:', quotedIndex);
                // Try to find the field start (look backwards for field name)
                const beforeQuote = haystack.substring(Math.max(0, quotedIndex - 100), quotedIndex);
                const fieldMatch = beforeQuote.match(/"(\w+)":\s*$/);
                if (fieldMatch) {
                    const fieldStart = quotedIndex - (beforeQuote.length - beforeQuote.lastIndexOf(`"${fieldMatch[1]}":`));
                    return {
                        index: fieldStart,
                        score: 0.75,
                        matchedText: haystack.substring(fieldStart, fieldStart + needle.length),
                        method: 'quoted-field'
                    };
                }
                return {
                    index: quotedIndex,
                    score: 0.65,
                    matchedText: haystack.substring(quotedIndex, quotedIndex + needle.length),
                    method: 'quoted'
                };
            }
        }
    }

    // Strategy 5: For JSON fields, try to match the field name and value pattern
    const fieldMatch = needle.match(/"(\w+)":\s*"([^"]{20,})"/);
    if (fieldMatch) {
        const fieldName = fieldMatch[1];
        const fieldValue = fieldMatch[2];

        // Look for the field name in haystack
        const fieldPattern = new RegExp(`"${fieldName}":\\s*"([^"]*)"`, 'g');
        let match;
        while ((match = fieldPattern.exec(haystack)) !== null) {
            const existingValue = match[1];
            // Check if the existing value is similar to what we're looking for
            if (existingValue.length > 20 && (
                existingValue.includes(fieldValue.substring(0, 20)) ||
                fieldValue.includes(existingValue.substring(0, 20))
            )) {
                console.log('[SmartMatch] Found field pattern match at index:', match.index);
                return {
                    index: match.index,
                    score: 0.7,
                    matchedText: haystack.substring(match.index, match.index + needle.length),
                    method: 'field-pattern'
                };
            }
        }
    }

    // Strategy 6: Try first and last lines
    const needleLines = needle.split('\n').filter(l => l.trim());
    if (needleLines.length > 1) {
        const firstLine = needleLines[0].trim();
        const lastLine = needleLines[needleLines.length - 1].trim();

        const firstIndex = haystack.indexOf(firstLine);
        const lastIndex = haystack.indexOf(lastLine);

        if (firstIndex !== -1 && lastIndex !== -1 && lastIndex > firstIndex) {
            console.log('[SmartMatch] Found first/last line match, first at:', firstIndex, 'last at:', lastIndex);
            return {
                index: firstIndex,
                score: 0.6,
                matchedText: haystack.substring(firstIndex, lastIndex + lastLine.length),
                method: 'boundary'
            };
        }
    }

    console.log('[SmartMatch] No match found using any strategy');
    return null;
}

async function testTextDiffOnly(): Promise<void> {
    try {
        console.log('================================================================================');
        console.log('🧪 TEXT DIFF ONLY TEST');
        console.log('================================================================================\n');

        // Load the captured files
        console.log('📂 Step 1: Loading captured debug files...');

        const originalJsonPath = join(process.cwd(), 'debug-original.json');
        const rawDiffPath = join(process.cwd(), 'debug-raw-llm-output.txt');

        const originalText = readFileSync(originalJsonPath, 'utf-8');
        const contextDiff = readFileSync(rawDiffPath, 'utf-8');

        console.log('[Debug] Original text loaded:', {
            length: originalText.length,
            preview: originalText.substring(0, 200) + '...'
        });

        console.log('[Debug] Context diff loaded:', {
            length: contextDiff.length,
            has_context: contextDiff.includes('CONTEXT:'),
            has_removals: contextDiff.includes('-'),
            has_additions: contextDiff.includes('+')
        });

        // Apply text diff
        console.log('\n🔧 Step 2: Applying text diff...');
        const modifiedText = applyContextDiffToJSON(originalText, contextDiff);

        if (modifiedText) {
            console.log('\n✅ SUCCESS: Text diff applied successfully!');

            // Save the modified text to a file
            const outputPath = join(process.cwd(), 'debug-patched-output.txt');
            writeFileSync(outputPath, modifiedText, 'utf-8');
            console.log(`📁 Patched text saved to: ${outputPath}`);

            // Compare results
            console.log('\n📊 Step 3: Comparing results...');
            console.log(`Original text length: ${originalText.length}`);
            console.log(`Modified text length: ${modifiedText.length}`);
            console.log(`Difference: ${modifiedText.length - originalText.length} chars`);

            // Check if text actually changed
            if (originalText === modifiedText) {
                console.log('⚠️  WARNING: Text is identical - no changes were made');
            } else {
                console.log('✅ Text was successfully modified');

                // Show first difference
                for (let i = 0; i < Math.min(originalText.length, modifiedText.length); i++) {
                    if (originalText[i] !== modifiedText[i]) {
                        console.log(`First difference at character ${i}:`);
                        console.log(`  Original: "${originalText.substring(i, i + 50)}..."`);
                        console.log(`  Modified: "${modifiedText.substring(i, i + 50)}..."`);
                        break;
                    }
                }
            }

            // Test JSON validity
            console.log('\n🔍 Step 4: Testing JSON validity...');
            try {
                JSON.parse(modifiedText);
                console.log('✅ Modified text is valid JSON');
            } catch (jsonError) {
                console.log('❌ Modified text is NOT valid JSON:', jsonError);

                // Find the error position and show context
                if (jsonError instanceof Error) {
                    const errorMatch = jsonError.message.match(/position (\d+)/);
                    if (errorMatch) {
                        const errorPos = parseInt(errorMatch[1]);
                        const start = Math.max(0, errorPos - 100);
                        const end = Math.min(modifiedText.length, errorPos + 100);
                        console.log('\n🔍 Error context around position', errorPos, ':');
                        console.log('...' + modifiedText.substring(start, end) + '...');
                        console.log(' '.repeat(errorPos - start + 3) + '^-- ERROR HERE');
                    }
                }
            }

        } else {
            console.log('\n❌ FAILED: Text diff application failed');
        }

    } catch (error) {
        console.error('\n💥 ERROR in text diff test:', error);
    } finally {
        process.exit(0);
    }
}

// Run the test
testTextDiffOnly().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
}); 