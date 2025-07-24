import { jsonrepair } from 'jsonrepair';
import { createPatch, applyPatch } from 'rfc6902';

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
 * Apply structured hunks to text using proper unified diff logic
 * Hunks must be applied cumulatively - each hunk applies to the result of previous hunks
 */
export function applyHunksToText(originalText: string, hunks: UnifiedDiffHunk[]): string {
    if (hunks.length === 0) {
        return originalText;
    }

    let currentText = originalText;

    // Apply hunks in forward order (earliest first)
    // Each hunk is applied to the cumulative result of previous hunks
    const sortedHunks = [...hunks].sort((a, b) => a.oldStart - b.oldStart);

    for (const hunk of sortedHunks) {
        currentText = applySingleHunkToText(currentText, hunk);
    }

    return currentText;
}

/**
 * Apply a single hunk to text using context-based matching
 * This is more robust than line-number-based application
 */
function applySingleHunkToText(text: string, hunk: UnifiedDiffHunk): string {
    const lines = text.split('\n');

    // Extract context lines from the beginning of the hunk to find the right position
    const contextLines: string[] = [];
    const replacementLines: string[] = [];

    // First pass: collect context lines from the start to find our position
    let foundContext = false;
    for (const hunkLine of hunk.lines) {
        if (hunkLine.type === 'context' && !foundContext) {
            contextLines.push(hunkLine.content);
        } else {
            foundContext = true;
            break;
        }
    }

    // Second pass: build the replacement section
    for (const hunkLine of hunk.lines) {
        switch (hunkLine.type) {
            case 'context':
                replacementLines.push(hunkLine.content);
                break;
            case 'addition':
                replacementLines.push(hunkLine.content);
                break;
            case 'deletion':
                // Skip deletions
                break;
        }
    }

    // Find the position in current text using context matching
    let matchPosition = -1;

    if (contextLines.length > 0) {
        // Try to find the context lines in the current text
        for (let i = 0; i <= lines.length - contextLines.length; i++) {
            let matches = true;
            for (let j = 0; j < contextLines.length; j++) {
                if (lines[i + j] !== contextLines[j]) {
                    matches = false;
                    break;
                }
            }
            if (matches) {
                matchPosition = i;
                break;
            }
        }
    }

    // If context matching failed, fall back to line number (with bounds checking)
    if (matchPosition === -1) {
        matchPosition = Math.max(0, Math.min(hunk.oldStart - 1, lines.length - hunk.oldCount));
    }

    // Apply the replacement
    const result = [...lines];
    result.splice(matchPosition, hunk.oldCount, ...replacementLines);

    return result.join('\n');
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

        const modified = JSON.parse(modifiedJson);

        // Generate RFC6902 patches using proper diff algorithm
        const patches = createPatch(original, modified);
        console.log(`[ContextDiff] Generated ${patches.length} RFC6902 patches`);

        return patches;

    } catch (error) {
        console.error('[ContextDiff] Error generating patches:', error);
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