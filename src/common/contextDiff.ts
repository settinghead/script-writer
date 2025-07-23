import { jsonrepair } from 'jsonrepair';
import { createPatch } from 'rfc6902';

/**
 * TypeScript types for parsed diff
 */
export interface ParsedDiff {
    context: string;
    removals: string[];
    additions: string[];
}

/**
 * Smart match result interface
 */
export interface SmartMatchResult {
    index: number;
    score: number;
    matchedText: string;
    method: string;
}

/**
 * Parse the context diff string into structured parts
 * @param contextDiff - The raw diff text
 * @returns ParsedDiff or null if failed
 */
export function parseContextDiff(contextDiff: string): ParsedDiff | null {
    try {
        const lines = contextDiff.split('\n');

        // Find context section (before any - or + lines)
        const contextLines: string[] = [];
        const removals: string[] = [];
        const additions: string[] = [];

        let inContext = true;
        let currentRemoval: string[] = [];
        let currentAddition: string[] = [];
        let collectingRemovals = false;
        let collectingAdditions = false;

        for (const line of lines) {
            if (line.startsWith('-')) {
                inContext = false;
                // If we were collecting additions, save them first
                if (collectingAdditions && currentAddition.length > 0) {
                    additions.push(currentAddition.join('\n'));
                    currentAddition = [];
                    collectingAdditions = false;
                }
                currentRemoval.push(line.substring(1)); // Remove the '-' prefix
                collectingRemovals = true;
            } else if (line.startsWith('+')) {
                inContext = false;
                // If we were collecting removals, save them first
                if (collectingRemovals && currentRemoval.length > 0) {
                    removals.push(currentRemoval.join('\n'));
                    currentRemoval = [];
                    collectingRemovals = false;
                }
                currentAddition.push(line.substring(1)); // Remove the '+' prefix
                collectingAdditions = true;
            } else if (inContext && line.trim()) {
                contextLines.push(line);
            } else if (!inContext) {
                // We're in a diff section - continue collecting lines for current block
                if (collectingRemovals) {
                    currentRemoval.push(line);
                } else if (collectingAdditions) {
                    currentAddition.push(line);

                    // Check if this line ends a JSON structure (ends with }, or ],)
                    const trimmedLine = line.trim();
                    if (trimmedLine.endsWith('},') || trimmedLine.endsWith('],') || trimmedLine.endsWith('}') || trimmedLine.endsWith(']')) {
                        // This might be the end of the addition block
                        // Let's finalize this addition and prepare for next block
                        additions.push(currentAddition.join('\n'));
                        currentAddition = [];
                        collectingAdditions = false;
                    }
                }

                // Check if this is an empty line that might indicate end of diff section
                if (line.trim() === '' && currentRemoval.length > 0 && currentAddition.length > 0) {
                    // We have both blocks and an empty line - this might be end of section
                    // But let's be conservative and only finalize at section boundaries
                }
            }
        }

        // Don't forget to save any remaining blocks
        if (currentRemoval.length > 0) {
            removals.push(currentRemoval.join('\n'));
        }
        if (currentAddition.length > 0) {
            additions.push(currentAddition.join('\n'));
        }

        const context = contextLines.join('\n');

        if (!context || removals.length === 0 || additions.length === 0) {
            console.log('[ParseDiff] Missing required sections:', {
                hasContext: !!context,
                removalsCount: removals.length,
                additionsCount: additions.length
            });
            return null;
        }

        return {
            context,
            removals,
            additions
        };
    } catch (error) {
        console.error('[ParseDiff] Error parsing context diff:', error);
        return null;
    }
}

/**
 * Smart match a substring in text using multiple strategies
 * @param needle - String to find
 * @param haystack - Text to search in
 * @param threshold - Minimum score threshold (default 0.7)
 * @returns Best match with index, score, and method or null
 */
export function smartMatch(needle: string, haystack: string, threshold = 0.7): SmartMatchResult | null {
    if (!needle || !haystack) return null;

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

    // Strategy 2: Normalized match (whitespace and case)
    const normalizedNeedle = needle.replace(/\s+/g, ' ').toLowerCase().trim();
    const normalizedHaystack = haystack.replace(/\s+/g, ' ').toLowerCase();
    const normalizedIndex = normalizedHaystack.indexOf(normalizedNeedle);
    if (normalizedIndex !== -1) {
        // Map back to original haystack position
        const originalIndex = mapNormalizedToOriginal(haystack, normalizedHaystack, normalizedIndex);
        console.log('[SmartMatch] Found normalized match at index:', originalIndex);
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
            const originalIndex = mapNormalizedToOriginal(haystack, aggressiveHaystack, aggressiveIndex);
            console.log('[SmartMatch] Found aggressive normalized match at index:', originalIndex);
            return {
                index: originalIndex,
                score: 0.9,
                matchedText: haystack.substring(originalIndex, originalIndex + needle.length),
                method: 'aggressive'
            };
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
                const absoluteIndex = searchStart + startIndex;
                return {
                    index: absoluteIndex,
                    score: 0.8,
                    matchedText: haystack.substring(absoluteIndex, absoluteIndex + needle.length),
                    method: 'partial'
                };
            }
        }
    }

    // Strategy 4: Quoted text matching for descriptions
    if (needle.includes('"') && needle.length > 50) {
        const quotedParts = needle.match(/"[^"]+"/g);
        if (quotedParts) {
            for (const quotedPart of quotedParts) {
                const quotedIndex = haystack.indexOf(quotedPart);
                if (quotedIndex !== -1) {
                    console.log('[SmartMatch] Found quoted text match at index:', quotedIndex);
                    // Try to find the full needle around this quoted part
                    const beforeQuoted = needle.substring(0, needle.indexOf(quotedPart));
                    const searchStart = Math.max(0, quotedIndex - beforeQuoted.length - 10);
                    const searchEnd = Math.min(haystack.length, quotedIndex + needle.length + 10);
                    const searchRegion = haystack.substring(searchStart, searchEnd);

                    const regionIndex = searchRegion.indexOf(beforeQuoted);
                    if (regionIndex !== -1) {
                        const absoluteIndex = searchStart + regionIndex;
                        return {
                            index: absoluteIndex,
                            score: 0.85,
                            matchedText: haystack.substring(absoluteIndex, absoluteIndex + needle.length),
                            method: 'quoted'
                        };
                    }
                }
            }
        }
    }

    // Strategy 5: Punctuation normalization
    const punctNeedle = needle.replace(/[。，！？]/g, match => {
        const map: Record<string, string> = { '。': '.', '，': ',', '！': '!', '？': '?' };
        return map[match] || match;
    });

    if (punctNeedle !== needle) {
        const punctIndex = haystack.indexOf(punctNeedle);
        if (punctIndex !== -1) {
            console.log('[SmartMatch] Found punctuation normalized match at index:', punctIndex);
            return {
                index: punctIndex,
                score: 0.9,
                matchedText: haystack.substring(punctIndex, punctIndex + punctNeedle.length),
                method: 'punctuation'
            };
        }
    }

    // Strategy 6: Try first and last lines
    const needleLines = needle.split('\n').filter(l => l.trim());
    if (needleLines.length > 2) {
        const firstLine = needleLines[0].trim();
        const lastLine = needleLines[needleLines.length - 1].trim();

        const firstIndex = haystack.indexOf(firstLine);
        const lastIndex = haystack.indexOf(lastLine);

        if (firstIndex !== -1 && lastIndex !== -1 && lastIndex > firstIndex) {
            console.log('[SmartMatch] Found first/last line match at index:', firstIndex);
            return {
                index: firstIndex,
                score: 0.75,
                matchedText: haystack.substring(firstIndex, lastIndex + lastLine.length),
                method: 'firstlast'
            };
        }
    }

    console.log('[SmartMatch] No suitable match found');
    return null;
}

/**
 * Map normalized string index back to original string index
 */
function mapNormalizedToOriginal(original: string, normalized: string, normalizedIndex: number): number {
    let originalIndex = 0;
    let normalizedPos = 0;

    while (normalizedPos < normalizedIndex && originalIndex < original.length) {
        const originalChar = original[originalIndex];
        const normalizedChar = normalized[normalizedPos];

        if (originalChar.toLowerCase() === normalizedChar) {
            normalizedPos++;
        }
        originalIndex++;
    }

    return Math.max(0, originalIndex - 1);
}

/**
 * Extract meaningful value from a multi-line diff block
 * @param diffBlock - A multi-line block from the diff
 * @returns Extracted value or null if no meaningful content
 */
export function extractValueFromDiffBlock(diffBlock: string): string | null {
    const lines = diffBlock.split('\n');

    // Look for field assignment pattern: "field": value
    const firstLine = lines[0].trim();
    const fieldMatch = firstLine.match(/^"([^"]+)":\s*(.*)$/);

    if (fieldMatch) {
        const fieldName = fieldMatch[1];
        const valueStart = fieldMatch[2];

        // For array or object values that span multiple lines
        if (valueStart.trim() === '[' || valueStart.trim() === '{') {
            // Find the matching closing bracket
            let depth = 0;
            let valueLines: string[] = [];
            let foundStart = false;

            for (const line of lines) {
                const trimmed = line.trim();

                if (!foundStart && (trimmed === '[' || trimmed === '{' || trimmed.endsWith('['))) {
                    foundStart = true;
                    if (trimmed === '[') {
                        valueLines.push('[');
                    } else if (trimmed === '{') {
                        valueLines.push('{');
                    } else {
                        // Line ends with [, extract just the bracket part
                        const bracketPart = trimmed.substring(trimmed.lastIndexOf('['));
                        valueLines.push(bracketPart);
                    }
                    depth = 1;
                } else if (foundStart) {
                    valueLines.push(line);

                    // Count brackets to find the end
                    for (const char of trimmed) {
                        if (char === '[' || char === '{') depth++;
                        if (char === ']' || char === '}') depth--;
                    }

                    if (depth === 0) {
                        // Remove trailing comma if present
                        let lastLine = valueLines[valueLines.length - 1];
                        if (lastLine.trim().endsWith(',')) {
                            lastLine = lastLine.trim().slice(0, -1);
                            valueLines[valueLines.length - 1] = lastLine;
                        }
                        break;
                    }
                }
            }

            if (valueLines.length > 0) {
                return valueLines.join('\n').trim();
            }
        }

        // For simple single-line values
        return valueStart.replace(/,$/, '').trim();
    }

    // If no field pattern, return the whole block
    return diffBlock.trim();
}

/**
 * Extract meaningful value from a diff line (removes JSON syntax)
 * @param diffLine - A line from the diff (removal or addition)
 * @returns Extracted value or null if no meaningful content
 */
export function extractValueFromDiffLine(diffLine: string): string | null {
    const trimmed = diffLine.trim();

    // Skip structural elements
    if (trimmed.match(/^[{}\[\],]$/) ||
        trimmed.match(/^"[^"]*":\s*[{\[]$/) ||
        trimmed.match(/^],?$/) ||
        trimmed.match(/^},?$/)) {
        return null;
    }

    // Extract quoted string values
    const quotedMatch = trimmed.match(/^"([^"]*)"[,]?$/);
    if (quotedMatch) {
        return quotedMatch[1];
    }

    // Extract field values like "field": "value"
    const fieldValueMatch = trimmed.match(/^"[^"]*":\s*"([^"]*)"[,]?$/);
    if (fieldValueMatch) {
        return fieldValueMatch[1];
    }

    // Extract multi-line string content (remove quotes and commas)
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed.slice(1, -1);
    }
    if (trimmed.startsWith('"') && trimmed.endsWith('",')) {
        return trimmed.slice(1, -2);
    }

    return trimmed;
}

/**
 * Apply context-based diff to JSON by parsing, modifying the object, and re-stringifying
 * @param originalText - The original JSON text string
 * @param contextDiff - The context-based diff string
 * @returns Modified JSON string or null if failed
 */
export function applyContextDiffToJSON(originalText: string, contextDiff: string): string | null {
    try {
        console.log('[JSONDiff] Starting JSON-aware diff application...');
        console.log('[JSONDiff] Original text length:', originalText.length);
        console.log('[JSONDiff] Context diff length:', contextDiff.length);

        // Step 1: Parse the context diff
        const parsedDiff = parseContextDiff(contextDiff);
        if (!parsedDiff) {
            console.log('[JSONDiff] Failed to parse context diff');
            return null;
        }

        console.log('[JSONDiff] Parsed diff:', {
            context_length: parsedDiff.context.length,
            removals_count: parsedDiff.removals.length,
            additions_count: parsedDiff.additions.length
        });

        // Step 2: Parse the original JSON
        let jsonObj: any;
        try {
            jsonObj = JSON.parse(originalText);
        } catch (parseError) {
            console.log('[JSONDiff] Original text is not valid JSON, attempting repair...');
            const repairedText = jsonrepair(originalText);
            jsonObj = JSON.parse(repairedText);
        }

        // Step 3: Apply changes to the JSON object
        let changesApplied = 0;
        for (let i = 0; i < Math.max(parsedDiff.removals.length, parsedDiff.additions.length); i++) {
            const removal = parsedDiff.removals[i] || '';
            const addition = parsedDiff.additions[i] || '';

            if (removal && addition) {
                console.log(`[JSONDiff] Processing change ${i + 1}:`);
                console.log(`[JSONDiff]   Remove: "${removal.substring(0, 50)}..."`);
                console.log(`[JSONDiff]   Add: "${addition.substring(0, 50)}..."`);

                // Skip identical operations (structural no-ops)
                if (removal.trim() === addition.trim()) {
                    console.log(`[JSONDiff]   SKIPPED: Identical removal and addition (no change needed)`);
                    console.log(`[JSONDiff]     Removal: "${removal}"`);
                    console.log(`[JSONDiff]     Addition: "${addition}"`);
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

        // Step 4: Convert back to JSON string
        const modifiedText = JSON.stringify(jsonObj, null, 2);
        console.log('[JSONDiff] Modified text length:', modifiedText.length);

        return modifiedText;

    } catch (error) {
        console.error('[JSONDiff] Error applying context diff:', error);
        return null;
    }
}

/**
 * Apply a single change to a JSON object
 */
function applyChangeToJSONObject(obj: any, removal: string, addition: string): boolean {
    // Extract the value from removal and addition strings (use block extractor for multi-line)
    const removalValue = removal.includes('\n') ? extractValueFromDiffBlock(removal) : extractValueFromDiffLine(removal);
    const additionValue = addition.includes('\n') ? extractValueFromDiffBlock(addition) : extractValueFromDiffLine(addition);

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

    // Try to find and replace the value in the object
    const replaced = replaceValueInObject(obj, removalValue, additionValue);

    if (!replaced) {
        console.log(`[JSONDiff]     Could not find removal value in JSON object`);
    }

    return replaced;
}

/**
 * Recursively find and replace a value in a JSON object
 */
function replaceValueInObject(obj: any, oldValue: string, newValue: string): boolean {
    let replaced = false;

    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            if (typeof obj[i] === 'string') {
                // Direct string match
                if (obj[i] === oldValue) {
                    obj[i] = newValue;
                    console.log(`[JSONDiff]       Replaced array item [${i}]: "${oldValue}" -> "${newValue}"`);
                    replaced = true;
                }
                // Partial string match for longer texts  
                else if (obj[i].includes(oldValue) && oldValue.length > 10) {
                    obj[i] = obj[i].replace(oldValue, newValue);
                    console.log(`[JSONDiff]       Partial replace in array item [${i}]`);
                    replaced = true;
                }
                // Fuzzy matching for similar strings (normalize punctuation and whitespace)
                else if (oldValue.length > 20) {
                    const normalizedValue = obj[i].replace(/[。，、；：！？]/g, '.').replace(/\s+/g, ' ').trim();
                    const normalizedOldValue = oldValue.replace(/[。，、；：！？]/g, '.').replace(/\s+/g, ' ').trim();

                    if (normalizedValue === normalizedOldValue) {
                        obj[i] = newValue;
                        console.log(`[JSONDiff]       Fuzzy replaced array item [${i}] (punctuation normalized)`);
                        replaced = true;
                    }
                    // Similarity check for very close matches
                    else if (normalizedValue.includes(normalizedOldValue.substring(0, 50)) &&
                        normalizedOldValue.includes(normalizedValue.substring(0, 50))) {
                        obj[i] = newValue;
                        console.log(`[JSONDiff]       Fuzzy replaced array item [${i}] (similarity match)`);
                        replaced = true;
                    }
                }
            } else if (typeof obj[i] === 'object' && obj[i] !== null) {
                if (replaceValueInObject(obj[i], oldValue, newValue)) {
                    replaced = true;
                }
            }
        }
    } else if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
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
            } else if (typeof value === 'object' && value !== null) {
                if (replaceValueInObject(value, oldValue, newValue)) {
                    replaced = true;
                }
            }
        }
    }

    return replaced;
}

/**
 * Normalize text for fuzzy comparison
 */
function normalizeForComparison(text: string): string {
    return text
        .replace(/[。，！？]/g, match => {
            const map: Record<string, string> = { '。': '.', '，': ',', '！': '!', '？': '?' };
            return map[match] || match;
        })
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Complete context diff pipeline: apply diff and generate RFC6902 patches
 * @param originalJsonString - Original JSON string
 * @param contextDiff - Context-based diff text
 * @returns Result with modified JSON and RFC6902 patches
 */
export function applyContextDiffAndGeneratePatches(
    originalJsonString: string,
    contextDiff: string
): {
    success: boolean;
    modifiedJson?: string;
    rfc6902Patches?: any[];
    appliedChanges?: number;
    totalChanges?: number;
    error?: string;
} {
    try {
        console.log('[ContextDiffPipeline] Starting complete pipeline...');

        // Step 1: Apply context diff
        const modifiedJson = applyContextDiffToJSON(originalJsonString, contextDiff);

        if (!modifiedJson) {
            return {
                success: false,
                error: 'Failed to apply context diff to JSON'
            };
        }

        // Step 2: Parse both JSONs
        const originalData = JSON.parse(originalJsonString);
        const modifiedData = JSON.parse(modifiedJson);

        // Step 3: Generate RFC6902 patches
        const rfc6902Patches = createPatch(originalData, modifiedData);

        console.log('[ContextDiffPipeline] Generated', rfc6902Patches.length, 'RFC6902 patches');

        // Extract success metrics from the diff application
        const parsedDiff = parseContextDiff(contextDiff);
        const totalChanges = parsedDiff ? parsedDiff.removals.length : 0;

        return {
            success: true,
            modifiedJson,
            rfc6902Patches,
            appliedChanges: rfc6902Patches.length,
            totalChanges,
        };

    } catch (error) {
        console.error('[ContextDiffPipeline] Pipeline failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
} 