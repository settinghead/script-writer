import { jsonrepair } from 'jsonrepair';
import { createPatch } from 'rfc6902';

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
 * Semantic operation types that LLMs can express naturally
 */
export interface SemanticOperation {
    type: 'ADD_TO_ARRAY' | 'REPLACE' | 'INSERT_AFTER' | 'INSERT_BEFORE' | 'DELETE' | 'UPDATE_FIELD';
    target: string;           // JSONPath-like: "characters", "characters[2].name"
    position?: string;        // "after X", "before Y", "at_end", "at_start"
    findContent?: string;     // What to find (fuzzy match)
    replaceContent?: string;  // What to replace with
    addContent?: any;         // What to add
    description?: string;     // Human-readable description of the operation
}

/**
 * Result of applying semantic operations
 */
export interface ApplicationResult {
    success: boolean;
    partialSuccess: boolean;
    operationsApplied: number;
    operationsFailed: number;
    failureReasons: string[];
    resultJson: any;
    warnings: string[];
    appliedOperations: SemanticOperation[];
    failedOperations: SemanticOperation[];
}

/**
 * Smart match result for fuzzy matching
 */
export interface SmartMatchResult {
    index: number;
    score: number;
    matchedText: string;
    method: string;
    confidence: number;
}

/**
 * Legacy interface for compatibility
 */
export interface ParsedDiff {
    context: string;
    removals: string[];
    additions: string[];
}

// ============================================================================
// MAIN PROCESSOR CLASS
// ============================================================================

export class LLMTolerantDiffProcessor {
    private debugMode: boolean = true;

    constructor(debugMode: boolean = true) {
        this.debugMode = debugMode;
    }

    /**
     * Parse LLM output into semantic operations
     */
    parseSemanticDiff(llmOutput: string): SemanticOperation[] {
        this.log('[SemanticParser] Starting semantic diff parsing...');

        const operations: SemanticOperation[] = [];

        // Strategy 1: Look for OPERATION blocks
        const operationBlocks = this.extractOperationBlocks(llmOutput);
        if (operationBlocks.length > 0) {
            this.log(`[SemanticParser] Found ${operationBlocks.length} operation blocks`);
            return operationBlocks;
        }

        // Strategy 2: Parse unified diff format with tolerance
        const unifiedDiffOps = this.parseUnifiedDiffTolerant(llmOutput);
        if (unifiedDiffOps.length > 0) {
            this.log(`[SemanticParser] Parsed ${unifiedDiffOps.length} operations from unified diff`);
            return unifiedDiffOps;
        }

        // Strategy 3: Look for JSON additions/changes
        const jsonOps = this.extractJSONOperations(llmOutput);
        if (jsonOps.length > 0) {
            this.log(`[SemanticParser] Extracted ${jsonOps.length} JSON operations`);
            return jsonOps;
        }

        this.log('[SemanticParser] No operations found in LLM output');
        return [];
    }

    /**
     * Apply semantic operations to JSON with fuzzy matching
     */
    applyOperations(json: any, operations: SemanticOperation[]): ApplicationResult {
        this.log(`[OperationApplier] Applying ${operations.length} operations...`);

        const result: ApplicationResult = {
            success: false,
            partialSuccess: false,
            operationsApplied: 0,
            operationsFailed: 0,
            failureReasons: [],
            resultJson: JSON.parse(JSON.stringify(json)), // Deep clone
            warnings: [],
            appliedOperations: [],
            failedOperations: []
        };

        for (let i = 0; i < operations.length; i++) {
            const operation = operations[i];
            this.log(`[OperationApplier] Applying operation ${i + 1}: ${operation.type}`);

            try {
                const applied = this.applySingleOperation(result.resultJson, operation);
                if (applied) {
                    result.operationsApplied++;
                    result.appliedOperations.push(operation);
                    this.log(`[OperationApplier] ✅ Operation ${i + 1} applied successfully`);
                } else {
                    result.operationsFailed++;
                    result.failedOperations.push(operation);
                    result.failureReasons.push(`Operation ${i + 1} (${operation.type}) failed to apply`);
                    this.log(`[OperationApplier] ❌ Operation ${i + 1} failed`);
                }
            } catch (error: unknown) {
                result.operationsFailed++;
                result.failedOperations.push(operation);
                const errorMessage = error instanceof Error ? error.message : String(error);
                result.failureReasons.push(`Operation ${i + 1} threw error: ${errorMessage}`);
                this.log(`[OperationApplier] ❌ Operation ${i + 1} threw error: ${errorMessage}`);
            }
        }

        // Determine success status
        result.success = result.operationsFailed === 0;
        result.partialSuccess = result.operationsApplied > 0;

        this.log(`[OperationApplier] Complete: ${result.operationsApplied}/${operations.length} operations applied`);
        return result;
    }

    /**
     * Apply a single semantic operation
     */
    private applySingleOperation(json: any, operation: SemanticOperation): boolean {
        switch (operation.type) {
            case 'ADD_TO_ARRAY':
                return this.applyAddToArray(json, operation);
            case 'REPLACE':
                return this.applyReplace(json, operation);
            case 'INSERT_AFTER':
                return this.applyInsertAfter(json, operation);
            case 'INSERT_BEFORE':
                return this.applyInsertBefore(json, operation);
            case 'DELETE':
                return this.applyDelete(json, operation);
            case 'UPDATE_FIELD':
                return this.applyUpdateField(json, operation);
            default:
                this.log(`[OperationApplier] Unknown operation type: ${operation.type}`);
                return false;
        }
    }

    /**
     * Extract OPERATION blocks from LLM output
     */
    private extractOperationBlocks(llmOutput: string): SemanticOperation[] {
        const operations: SemanticOperation[] = [];
        const lines = llmOutput.split('\n');

        let currentOperation: Partial<SemanticOperation> | null = null;
        let contentLines: string[] = [];
        let inContentBlock = false;

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith('OPERATION:')) {
                // Save previous operation
                if (currentOperation) {
                    this.finalizeOperation(currentOperation, contentLines, operations);
                }

                // Start new operation
                currentOperation = {
                    type: this.parseOperationType(trimmed.substring(10).trim())
                };
                contentLines = [];
                inContentBlock = false;
            } else if (currentOperation && trimmed.startsWith('TARGET:')) {
                currentOperation.target = trimmed.substring(7).trim();
            } else if (currentOperation && trimmed.startsWith('POSITION:')) {
                currentOperation.position = trimmed.substring(9).trim();
            } else if (currentOperation && trimmed.startsWith('FIND:')) {
                currentOperation.findContent = trimmed.substring(5).trim();
            } else if (currentOperation && trimmed.startsWith('REPLACE:')) {
                currentOperation.replaceContent = trimmed.substring(8).trim();
            } else if (currentOperation && trimmed.startsWith('CONTENT:')) {
                inContentBlock = true;
                contentLines = [];
            } else if (inContentBlock && currentOperation) {
                contentLines.push(line);
            }
        }

        // Finalize last operation
        if (currentOperation) {
            this.finalizeOperation(currentOperation, contentLines, operations);
        }

        return operations;
    }

    /**
     * Parse unified diff format with tolerance for LLM errors
     */
    private parseUnifiedDiffTolerant(llmOutput: string): SemanticOperation[] {
        const operations: SemanticOperation[] = [];
        const lines = llmOutput.split('\n');

        let currentHunk: string[] = [];
        let inHunk = false;

        for (const line of lines) {
            if (line.startsWith('@@')) {
                // Process previous hunk
                if (currentHunk.length > 0) {
                    const op = this.parseHunkToOperation(currentHunk);
                    if (op) operations.push(op);
                }

                // Start new hunk
                currentHunk = [line];
                inHunk = true;
            } else if (inHunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
                currentHunk.push(line);
            } else if (inHunk && line.trim() === '') {
                // End of hunk
                const op = this.parseHunkToOperation(currentHunk);
                if (op) operations.push(op);
                currentHunk = [];
                inHunk = false;
            }
        }

        // Process final hunk
        if (currentHunk.length > 0) {
            const op = this.parseHunkToOperation(currentHunk);
            if (op) operations.push(op);
        }

        return operations;
    }

    /**
     * Extract JSON operations from raw content
     */
    private extractJSONOperations(llmOutput: string): SemanticOperation[] {
        const operations: SemanticOperation[] = [];

        // Look for JSON objects that might be additions
        const jsonMatches = llmOutput.match(/\{[^{}]*"name"[^{}]*\}/g);
        if (jsonMatches) {
            for (const match of jsonMatches) {
                try {
                    const parsed = JSON.parse(match);
                    if (parsed.name && parsed.type) {
                        operations.push({
                            type: 'ADD_TO_ARRAY',
                            target: 'characters',
                            addContent: parsed,
                            description: `Add character ${parsed.name}`
                        });
                    }
                } catch (error) {
                    // Ignore invalid JSON
                }
            }
        }

        return operations;
    }

    // ============================================================================
    // OPERATION APPLIERS
    // ============================================================================

    private applyAddToArray(json: any, operation: SemanticOperation): boolean {
        this.log(`[AddToArray] Target: ${operation.target}`);

        const target = this.resolveTarget(json, operation.target);
        if (!target || !Array.isArray(target)) {
            this.log(`[AddToArray] Target not found or not an array: ${operation.target}`);
            return false;
        }

        if (!operation.addContent) {
            this.log(`[AddToArray] No content to add`);
            return false;
        }

        // Determine position
        if (operation.position) {
            const index = this.findInsertionIndex(target, operation.position);
            target.splice(index, 0, operation.addContent);
            this.log(`[AddToArray] Inserted at index ${index}`);
        } else {
            target.push(operation.addContent);
            this.log(`[AddToArray] Appended to end`);
        }

        return true;
    }

    private applyReplace(json: any, operation: SemanticOperation): boolean {
        this.log(`[Replace] Finding content to replace...`);

        if (!operation.findContent || !operation.replaceContent) {
            this.log(`[Replace] Missing find or replace content`);
            return false;
        }

        const found = this.findContentInJSON(json, operation.findContent);
        if (!found) {
            this.log(`[Replace] Content not found for replacement`);
            return false;
        }

        // Perform replacement
        return this.replaceContentInJSON(json, operation.findContent, operation.replaceContent);
    }

    private applyInsertAfter(json: any, operation: SemanticOperation): boolean {
        // Implementation for inserting after specific content
        this.log(`[InsertAfter] Not yet implemented`);
        return false;
    }

    private applyInsertBefore(json: any, operation: SemanticOperation): boolean {
        // Implementation for inserting before specific content
        this.log(`[InsertBefore] Not yet implemented`);
        return false;
    }

    private applyDelete(json: any, operation: SemanticOperation): boolean {
        // Implementation for deleting content
        this.log(`[Delete] Not yet implemented`);
        return false;
    }

    private applyUpdateField(json: any, operation: SemanticOperation): boolean {
        // Implementation for updating specific fields
        this.log(`[UpdateField] Not yet implemented`);
        return false;
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    private resolveTarget(json: any, target: string): any {
        // Simple JSONPath-like resolution
        const parts = target.split('.');
        let current = json;

        for (const part of parts) {
            if (part.includes('[') && part.includes(']')) {
                // Handle array indexing like "characters[0]"
                const [arrayName, indexStr] = part.split('[');
                const index = parseInt(indexStr.replace(']', ''));
                current = current[arrayName];
                if (Array.isArray(current) && index < current.length) {
                    current = current[index];
                } else {
                    return null;
                }
            } else {
                current = current[part];
            }

            if (current === undefined) {
                return null;
            }
        }

        return current;
    }

    private findInsertionIndex(array: any[], position: string): number {
        if (position === 'at_end' || !position) {
            return array.length;
        }
        if (position === 'at_start') {
            return 0;
        }

        // Handle "after X" or "before X"
        if (position.startsWith('after ')) {
            const searchTerm = position.substring(6);
            const index = this.findArrayElementIndex(array, searchTerm);
            return index >= 0 ? index + 1 : array.length;
        }

        if (position.startsWith('before ')) {
            const searchTerm = position.substring(7);
            const index = this.findArrayElementIndex(array, searchTerm);
            return index >= 0 ? index : 0;
        }

        return array.length; // Default to end
    }

    private findArrayElementIndex(array: any[], searchTerm: string): number {
        for (let i = 0; i < array.length; i++) {
            const element = array[i];
            if (typeof element === 'object' && element.name === searchTerm) {
                return i;
            }
            if (typeof element === 'string' && element.includes(searchTerm)) {
                return i;
            }
        }
        return -1;
    }

    private findContentInJSON(json: any, content: string): boolean {
        const jsonStr = JSON.stringify(json, null, 2);
        return jsonStr.includes(content.trim());
    }

    private replaceContentInJSON(json: any, findContent: string, replaceContent: string): boolean {
        try {
            const jsonStr = JSON.stringify(json, null, 2);
            const replaced = jsonStr.replace(findContent.trim(), replaceContent.trim());

            if (replaced !== jsonStr) {
                const parsed = JSON.parse(replaced);
                Object.assign(json, parsed);
                return true;
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log(`[Replace] Error during replacement: ${errorMessage}`);
        }
        return false;
    }

    private parseOperationType(typeStr: string): SemanticOperation['type'] {
        const normalized = typeStr.toUpperCase().replace(/[^A-Z_]/g, '');
        switch (normalized) {
            case 'ADDTOARRAY':
            case 'ADD_TO_ARRAY':
            case 'ADD':
                return 'ADD_TO_ARRAY';
            case 'REPLACE':
                return 'REPLACE';
            case 'INSERTAFTER':
            case 'INSERT_AFTER':
                return 'INSERT_AFTER';
            case 'INSERTBEFORE':
            case 'INSERT_BEFORE':
                return 'INSERT_BEFORE';
            case 'DELETE':
            case 'REMOVE':
                return 'DELETE';
            case 'UPDATEFIELD':
            case 'UPDATE_FIELD':
            case 'UPDATE':
                return 'UPDATE_FIELD';
            default:
                return 'REPLACE'; // Default fallback
        }
    }

    private finalizeOperation(operation: Partial<SemanticOperation>, contentLines: string[], operations: SemanticOperation[]): void {
        if (operation.type && operation.target) {
            // Parse content if available
            if (contentLines.length > 0) {
                const contentStr = contentLines.join('\n').trim();
                try {
                    operation.addContent = JSON.parse(contentStr);
                } catch (error) {
                    operation.addContent = contentStr;
                }
            }

            operations.push(operation as SemanticOperation);
        }
    }

    private parseHunkToOperation(hunkLines: string[]): SemanticOperation | null {
        if (hunkLines.length < 2) return null;

        const additions: string[] = [];
        const removals: string[] = [];

        for (let i = 1; i < hunkLines.length; i++) {
            const line = hunkLines[i];
            if (line.startsWith('+')) {
                additions.push(line.substring(1));
            } else if (line.startsWith('-')) {
                removals.push(line.substring(1));
            }
        }

        // Determine operation type based on additions/removals
        if (additions.length > 0 && removals.length === 0) {
            // Pure addition - try to parse as character addition
            const content = additions.join('\n').trim();
            if (content.includes('"name":') && content.includes('"type":')) {
                try {
                    const parsed = JSON.parse(content);
                    return {
                        type: 'ADD_TO_ARRAY',
                        target: 'characters',
                        addContent: parsed,
                        description: 'Character addition from unified diff'
                    };
                } catch (error) {
                    // Fallback to raw content
                }
            }
        } else if (additions.length > 0 && removals.length > 0) {
            // Replacement
            return {
                type: 'REPLACE',
                target: 'root',
                findContent: removals.join('\n'),
                replaceContent: additions.join('\n'),
                description: 'Content replacement from unified diff'
            };
        }

        return null;
    }

    private log(message: string): void {
        if (this.debugMode) {
            console.log(message);
        }
    }
}

// ============================================================================
// GLOBAL PROCESSOR INSTANCE
// ============================================================================

const globalProcessor = new LLMTolerantDiffProcessor();

// ============================================================================
// LEGACY COMPATIBILITY FUNCTIONS
// ============================================================================

/**
 * Legacy function for compatibility with existing code
 */
export function parseContextDiff(diffText: string): ParsedDiff | null {
    console.log('[LegacyCompat] parseContextDiff called - routing to semantic parser');

    const operations = globalProcessor.parseSemanticDiff(diffText);
    if (operations.length === 0) {
        return null;
    }

    // Convert to legacy format for compatibility
    return {
        context: 'Semantic operations parsed',
        removals: operations.filter(op => op.type === 'DELETE' || op.type === 'REPLACE').map(op => op.findContent || ''),
        additions: operations.filter(op => op.type === 'ADD_TO_ARRAY' || op.type === 'REPLACE').map(op => JSON.stringify(op.addContent || op.replaceContent) || '')
    };
}

/**
 * Main function for applying context diff to JSON
 */
export function applyContextDiffToJSON(jsonString: string, diffText: string): string {
    console.log('[LegacyCompat] applyContextDiffToJSON called - using semantic processor');

    try {
        const json = JSON.parse(jsonString);
        const operations = globalProcessor.parseSemanticDiff(diffText);

        if (operations.length === 0) {
            console.log('[LegacyCompat] No operations found, returning original JSON');
            return jsonString;
        }

        const result = globalProcessor.applyOperations(json, operations);

        if (result.success || result.partialSuccess) {
            console.log(`[LegacyCompat] Applied ${result.operationsApplied}/${operations.length} operations`);
            return JSON.stringify(result.resultJson, null, 2);
        } else {
            console.log('[LegacyCompat] All operations failed, returning original JSON');
            return jsonString;
        }
    } catch (error) {
        console.error('[LegacyCompat] Error in applyContextDiffToJSON:', error);
        return jsonString;
    }
}

/**
 * Generate RFC6902 patches from applied operations
 */
export function applyContextDiffAndGeneratePatches(originalJson: string, diffText: string): any[] {
    console.log('[LegacyCompat] applyContextDiffAndGeneratePatches called');

    try {
        const original = JSON.parse(originalJson);
        const operations = globalProcessor.parseSemanticDiff(diffText);

        if (operations.length === 0) {
            return [];
        }

        const result = globalProcessor.applyOperations(original, operations);

        if (result.success || result.partialSuccess) {
            // Generate RFC6902 patches
            const patches = createPatch(original, result.resultJson);
            console.log(`[LegacyCompat] Generated ${patches.length} RFC6902 patches`);
            return patches;
        }

        return [];
    } catch (error) {
        console.error('[LegacyCompat] Error generating patches:', error);
        return [];
    }
}

// Legacy compatibility exports
export function smartMatch(text: string, candidates: string[]): SmartMatchResult[] {
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

export function addLineNumbers(jsonString: string): string {
    const lines = jsonString.split('\n');
    return lines.map((line, index) => `${index + 1}: ${line}`).join('\n');
}

export function removeLineNumbers(numberedString: string): string {
    return numberedString.replace(/^\d+:\s*/gm, '');
} 