import { createPatch, } from 'rfc6902';
import { repairJsonSync } from '../server/utils/jsonRepair';

/**
 * Custom LLM-Tolerant Diff System
 * 
 * Philosophy: "Semantic Intent Over Syntactic Precision"
 * Designed to handle LLM output imperfections gracefully
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================



/**
 * Legacy interface for compatibility
 */
export interface ParsedDiff {
    context: string;
    removals: string[];
    additions: string[];
}

/**
 * Parsed unified diff hunk
 */
export interface UnifiedDiffHunk {
    oldStart: number;
    oldCount: number;
    newStart: number;
    newCount: number;
    lines: Array<{
        type: 'context' | 'addition' | 'deletion';
        content: string;
        originalLine?: string;
    }>;
}

// ============================================================================
// UNIFIED DIFF EXTRACTION AND PARSING FUNCTIONS
// ============================================================================

/**
 * Extract only the unified diff portion from mixed content that may contain
 * additional non-diff text after the diff
 */
export function extractUnifiedDiffOnly(content: string): string {
    if (!content?.trim()) return content;

    const lines = content.split('\n');
    const diffLines: string[] = [];
    let inDiff = false;

    for (const line of lines) {
        // Start of diff: file headers
        if (line.startsWith('---') || line.startsWith('+++')) {
            inDiff = true;
            diffLines.push(line);
            continue;
        }

        // If we're in a diff, continue collecting valid diff lines
        if (inDiff) {
            // Valid diff line types: hunk headers, context, additions, deletions
            if (line.startsWith('@@') ||
                line.startsWith(' ') ||
                line.startsWith('+') ||
                line.startsWith('-') ||
                line.trim() === '') {  // Empty lines within hunks are valid
                diffLines.push(line);
            } else {
                // Non-diff content encountered - stop processing
                break;
            }
        }
    }

    // If no diff structure was found, return original content
    if (!inDiff || diffLines.length === 0) {
        return content;
    }

    return diffLines.join('\n');
}

// ============================================================================
// UNIFIED DIFF PARSING FUNCTIONS
// ============================================================================

/**
 * Parse unified diff format into structured hunks
 */
export function parseUnifiedDiff(diffText: string): UnifiedDiffHunk[] {
    const lines = diffText.split('\n');
    const hunks: UnifiedDiffHunk[] = [];
    let currentHunk: UnifiedDiffHunk | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip file headers
        if (line.startsWith('---') || line.startsWith('+++')) {
            continue;
        }

        // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
        if (line.startsWith('@@')) {
            if (currentHunk) {
                hunks.push(currentHunk);
            }

            const hunkMatch = line.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
            if (hunkMatch) {
                currentHunk = {
                    oldStart: parseInt(hunkMatch[1]),
                    oldCount: parseInt(hunkMatch[2]),
                    newStart: parseInt(hunkMatch[3]),
                    newCount: parseInt(hunkMatch[4]),
                    lines: []
                };
            }
            continue;
        }

        // Parse hunk content lines
        if (currentHunk) {
            if (line.startsWith(' ')) {
                // Context line (unchanged)
                currentHunk.lines.push({
                    type: 'context',
                    content: line.substring(1),
                    originalLine: line
                });
            } else if (line.startsWith('+')) {
                // Addition
                currentHunk.lines.push({
                    type: 'addition',
                    content: line.substring(1),
                    originalLine: line
                });
            } else if (line.startsWith('-')) {
                // Deletion
                currentHunk.lines.push({
                    type: 'deletion',
                    content: line.substring(1),
                    originalLine: line
                });
            }
        }
    }

    // Add the last hunk
    if (currentHunk) {
        hunks.push(currentHunk);
    }

    return hunks;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];

    // Initialize the matrix
    for (let i = 0; i <= a.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
        matrix[0][j] = j;
    }

    // Fill the matrix
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return matrix[a.length][b.length];
}

/**
 * Calculate normalized similarity score between two strings (0-1, where 1 is identical)
 */
function lineSimilarity(a: string, b: string): number {
    // Trim both strings for comparison
    const aTrimmed = a.trim();
    const bTrimmed = b.trim();

    if (aTrimmed === bTrimmed) return 1.0;

    const dist = levenshtein(aTrimmed, bTrimmed);
    const maxLen = Math.max(aTrimmed.length, bTrimmed.length);

    return maxLen === 0 ? 1.0 : 1.0 - (dist / maxLen);
}

/**
 * Applies structured hunks to a text string using fuzzy matching.
 * This tolerates minor differences in whitespace, formatting, etc.
 */
export function applyHunksToText(originalText: string, hunks: UnifiedDiffHunk[]): string {
    let currentLines = originalText.split('\n');
    const sortedHunks = [...hunks].sort((a, b) => a.oldStart - b.oldStart);

    // console.log(`[DEBUG] Starting fuzzy matching with ${sortedHunks.length} hunks`);

    for (const hunk of sortedHunks) {
        const hunkOldLines = hunk.lines
            .filter(l => l.type === 'context' || l.type === 'deletion')
            .map(l => l.content);

        if (hunkOldLines.length === 0) continue;

        // console.log(`[DEBUG] Processing hunk at original line ${hunk.oldStart} with ${hunkOldLines.length} context/deletion lines`);

        // Log what we're looking for
        if (hunkOldLines.length > 0) {
            // console.log(`[DEBUG] Looking for context (first line): "${hunkOldLines[0].substring(0, 60)}..."`);
        }

        let bestMatch = { index: -1, score: 0 };
        let exactMatch = -1;

        // First, try exact matching (trimmed)
        for (let i = 0; i <= currentLines.length - hunkOldLines.length; i++) {
            let isExact = true;
            for (let j = 0; j < hunkOldLines.length; j++) {
                if (currentLines[i + j].trim() !== hunkOldLines[j].trim()) {
                    isExact = false;
                    break;
                }
            }
            if (isExact) {
                exactMatch = i;
                break;
            }
        }

        if (exactMatch >= 0) {
            // console.log(`[DEBUG] Found exact match at line ${exactMatch + 1}`);
            bestMatch = { index: exactMatch, score: 1.0 };
        } else {
            // Fall back to fuzzy matching with sliding window
            // Try different strategies to find the best match

            // Strategy 1: Match with full context
            for (let i = 0; i <= currentLines.length - 1; i++) {  // Changed from currentLines.length - hunkOldLines.length
                let totalScore = 0;
                let perfectMatches = 0;
                let validLines = 0;
                let contextMismatches = 0;

                for (let j = 0; j < hunkOldLines.length; j++) {
                    if (i + j < currentLines.length) {
                        const similarity = lineSimilarity(currentLines[i + j], hunkOldLines[j]);
                        totalScore += similarity;
                        if (similarity === 1.0) perfectMatches++;
                        if (similarity < 0.3) contextMismatches++; // Very poor match
                        validLines++;
                    }
                }

                // Only consider matches with at least 3 valid lines
                if (validLines >= Math.min(3, hunkOldLines.length)) {
                    const avgScore = totalScore / validLines;
                    const perfectMatchRatio = perfectMatches / validLines;
                    const mismatchRatio = contextMismatches / validLines;

                    // Penalize matches with many context mismatches
                    let adjustedScore = avgScore * (1 + perfectMatchRatio * 0.2);
                    if (mismatchRatio > 0.3) {
                        adjustedScore *= (1 - mismatchRatio * 0.5);
                    }

                    if (adjustedScore > bestMatch.score) {
                        bestMatch = { index: i, score: adjustedScore };
                    }
                }
            }

            // Strategy 2: If score is low, try matching with partial context
            // This helps when some context lines don't exist due to previous changes
            if (bestMatch.score < 0.7) {
                // console.log(`[DEBUG] Strategy 1 score too low (${bestMatch.score.toFixed(3)}), trying partial context matching`);

                // Try to find the most distinctive line in the context
                let mostDistinctiveLine = '';
                let maxDistinctiveness = 0;
                let distinctiveIndex = -1;

                for (let i = 0; i < hunkOldLines.length; i++) {
                    const line = hunkOldLines[i];
                    // Lines with more specific content are more distinctive
                    const distinctiveness = line.trim().length *
                        (line.includes('"') ? 1.5 : 1) * // JSON keys/values are distinctive
                        (line.match(/[a-zA-Z0-9]/g)?.length || 0) / Math.max(1, line.length); // Alphanumeric density

                    if (distinctiveness > maxDistinctiveness) {
                        maxDistinctiveness = distinctiveness;
                        mostDistinctiveLine = line;
                        distinctiveIndex = i;
                    }
                }

                // Search for the distinctive line and build context around it
                if (mostDistinctiveLine && distinctiveIndex >= 0) {
                    // console.log(`[DEBUG] Most distinctive line: "${mostDistinctiveLine.substring(0, 60)}..."`);

                    for (let i = 0; i < currentLines.length; i++) {
                        const similarity = lineSimilarity(currentLines[i], mostDistinctiveLine);
                        if (similarity > 0.85) {
                            // console.log(`[DEBUG] Found distinctive line at ${i + 1} with similarity ${similarity.toFixed(3)}`);

                            // Found the distinctive line, now check surrounding context
                            const startIdx = i - distinctiveIndex;
                            if (startIdx >= 0 && startIdx + hunkOldLines.length <= currentLines.length) {
                                let contextScore = 0;
                                let validContextLines = 0;

                                for (let j = 0; j < hunkOldLines.length; j++) {
                                    if (startIdx + j < currentLines.length) {
                                        const lineSim = lineSimilarity(currentLines[startIdx + j], hunkOldLines[j]);
                                        contextScore += lineSim;
                                        validContextLines++;
                                    }
                                }

                                const avgContextScore = validContextLines > 0 ? contextScore / validContextLines : 0;
                                if (avgContextScore > bestMatch.score) {
                                    bestMatch = { index: startIdx, score: avgContextScore };
                                }
                            }
                        }
                    }
                }

                // Strategy 3: If still no good match, try finding ANY subset of lines that match well
                if (bestMatch.score < 0.5) {
                    // console.log(`[DEBUG] Trying strategy 3: partial line matching`);

                    // Try to find any window where at least some lines match well
                    const minMatchingLines = Math.max(2, Math.floor(hunkOldLines.length * 0.3));

                    for (let i = 0; i <= currentLines.length - minMatchingLines; i++) {
                        let matchingLines = 0;
                        let totalScore = 0;

                        // Check how many lines in the hunk match at this position
                        for (let j = 0; j < hunkOldLines.length; j++) {
                            if (i + j < currentLines.length) {
                                const similarity = lineSimilarity(currentLines[i + j], hunkOldLines[j]);
                                if (similarity > 0.7) {
                                    matchingLines++;
                                    totalScore += similarity;
                                }
                            }
                        }

                        if (matchingLines >= minMatchingLines) {
                            const partialScore = (totalScore / hunkOldLines.length) * (matchingLines / hunkOldLines.length);
                            if (partialScore > bestMatch.score) {
                                bestMatch = { index: i, score: partialScore };
                            }
                        }
                    }
                }

                // Strategy 4: For very low scores, try to find just the first distinctive context line
                // and apply the hunk there, trusting that it's the right location
                if (bestMatch.score < 0.4 && hunkOldLines.length > 0) {
                    // console.log(`[DEBUG] Trying strategy 4: first line anchor matching`);

                    // Find the first context line and look for it
                    const firstContextLine = hunkOldLines[0];
                    for (let i = 0; i < currentLines.length; i++) {
                        const similarity = lineSimilarity(currentLines[i], firstContextLine);
                        if (similarity > 0.9) {
                            // Found a very good match for the first line
                            // Check if at least one more line matches reasonably well
                            let additionalMatches = 0;
                            for (let j = 1; j < Math.min(3, hunkOldLines.length); j++) {
                                if (i + j < currentLines.length) {
                                    const sim = lineSimilarity(currentLines[i + j], hunkOldLines[j]);
                                    if (sim > 0.6) additionalMatches++;
                                }
                            }

                            if (additionalMatches > 0) {
                                const anchorScore = 0.4 + (additionalMatches * 0.1);
                                if (anchorScore > bestMatch.score) {
                                    bestMatch = { index: i, score: anchorScore };
                                    // console.log(`[DEBUG] Found anchor at line ${i + 1} with score ${anchorScore.toFixed(3)}`);
                                }
                            }
                        }
                    }
                }
            }
        }

        // console.log(`[DEBUG] Best match: index=${bestMatch.index}, score=${bestMatch.score.toFixed(3)}`);

        if (bestMatch.index >= 0) {
            // console.log(`[DEBUG] Applying hunk at line ${bestMatch.index + 1} (1-indexed)`);

            // Build the replacement segment
            const newSegment: string[] = [];
            let oldLineIndex = bestMatch.index;

            // Process each line in the hunk
            for (const line of hunk.lines) {
                if (line.type === 'context') {
                    // For context lines, use the actual line from the original file
                    // This prevents outputting hallucinated context
                    if (oldLineIndex < currentLines.length) {
                        newSegment.push(currentLines[oldLineIndex]);
                    }
                    oldLineIndex++;
                } else if (line.type === 'addition') {
                    // Additions are always included
                    newSegment.push(line.content);
                } else if (line.type === 'deletion') {
                    // Deletions skip a line in the original
                    oldLineIndex++;
                }
            }

            // Calculate how many lines to replace
            const oldCount = hunk.lines.filter(l => l.type === 'context' || l.type === 'deletion').length;

            // Apply the change
            currentLines.splice(bestMatch.index, oldCount, ...newSegment);
            // console.log(`[DEBUG] Replaced ${oldCount} lines with ${newSegment.length} lines`);
        } else {
            // console.log(`[WARN] No valid location found for hunk - skipping`);
        }
    }

    return currentLines.join('\n');
}







// ============================================================================
// LEGACY COMPATIBILITY FUNCTIONS
// ============================================================================

/**
 * Legacy function for compatibility with existing code
 */
export function parseContextDiff(diffText: string): ParsedDiff | null {
    // Simple implementation - just return null for now
    // This function is kept for compatibility but the LLMTolerantDiffProcessor was removed
    return null;
}



/**
 * Generate RFC6902 patches from unified diff
 * Uses the two-step approach: diff → hunks → patches
 */
/**
 * Apply context diff to JSON and return the modified JSON string
 * Uses robust JSON repair for handling malformed output
 */
export function applyContextDiffToJSON(originalJson: string, diffText: string): string {
    try {
        // Step 1: Parse unified diff into structured hunks
        const hunks = parseUnifiedDiff(diffText);

        if (hunks.length === 0) {
            return originalJson;
        }

        // Step 2: Apply hunks to get modified JSON
        const modifiedJson = applyHunksToText(originalJson, hunks);

        if (modifiedJson === originalJson) {
            return originalJson;
        }

        // Step 3: Parse and repair the modified JSON if needed
        try {
            // First try to parse as-is
            JSON.parse(modifiedJson);
            return modifiedJson;
        } catch (parseError) {
            // console.log('[ContextDiff] JSON parsing failed, attempting repair...');
            const repairedJson = repairJsonSync(modifiedJson, {
                ensureAscii: false,
                indent: 2
            });
            // Validate the repair worked
            JSON.parse(repairedJson);
            return repairedJson;
        }

    } catch (error) {
        // console.error('[ContextDiff] Error applying context diff:', error);
        return originalJson;
    }
}

export function applyContextDiffAndGeneratePatches(originalJson: string, diffText: string): any[] {
    try {
        const original = JSON.parse(originalJson);

        // Step 1: Parse unified diff into structured hunks
        const hunks = parseUnifiedDiff(diffText);

        if (hunks.length === 0) {
            return [];
        }

        // Step 2: Apply hunks to get modified JSON
        const modifiedJson = applyHunksToText(originalJson, hunks);

        if (modifiedJson === originalJson) {
            return [];
        }

        // Step 3: Parse the modified JSON with robust repair if needed
        let modified;
        try {
            modified = JSON.parse(modifiedJson);
        } catch (parseError) {
            // console.log('[ContextDiff] JSON parsing failed, attempting repair...');
            const repairedJson = repairJsonSync(modifiedJson, {
                ensureAscii: false,
                indent: 2
            });
            modified = JSON.parse(repairedJson);
        }

        // Generate RFC6902 patches using proper diff algorithm
        const patches = createPatch(original, modified);
        // console.log(`[ContextDiff] Generated ${patches.length} RFC6902 patches`);

        return patches;

    } catch (error) {
        // console.error('[ContextDiff] Error generating patches:', error);
        return [];
    }
}

// Legacy compatibility exports - simplified implementations
export function smartMatch(text: string, candidates: string[]): any[] {
    // Simplified implementation for compatibility
    return candidates.map((candidate, index) => ({
        index,
        score: text === candidate ? 1.0 : 0.5,
        matchedText: candidate,
        method: 'exact_or_fallback',
        confidence: text === candidate ? 1.0 : 0.5
    }));
}

export function extractValueFromDiffLine(line: string): string {
    return line.trim();
}

export function extractValueFromDiffBlock(block: string): string {
    return block.trim();
}

// NOTE: addLineNumbers and removeLineNumbers functions have been moved to
// src/common/jsonFormatting.ts for consistent usage across the codebase 
// src/common/jsonFormatting.ts for consistent usage across the codebase 