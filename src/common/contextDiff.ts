import { jsonrepair } from 'jsonrepair';
import { createPatch } from 'rfc6902';

/**
 * Context-based diff modification structure
 */
export interface ContextModification {
    context: string;
    removals: string[];
    additions: string[];
}

/**
 * Location information for applying modifications
 */
export interface ContextLocation {
    type: 'array' | 'object';
    parent: any;
    key: string;
    array?: any[];
    object?: any;
}

/**
 * Result of applying context-based diff
 */
export interface ContextDiffResult {
    success: boolean;
    result?: any;
    error?: string;
}

/**
 * Parse context-based diff format into structured modifications
 */
export function parseContextBasedDiff(diffString: string): ContextModification[] {
    const modifications: ContextModification[] = [];

    // Split by CONTEXT: markers
    const blocks = diffString.split(/CONTEXT:\s*/i).filter(block => block.trim());

    for (const block of blocks) {
        const lines = block.split('\n');
        const contextLine = lines[0].trim();

        const removals: string[] = [];
        const additions: string[] = [];
        let currentMultiLineRemoval = '';
        let currentMultiLineAddition = '';
        let inRemoval = false;
        let inAddition = false;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('- ')) {
                // Start of removal
                if (currentMultiLineAddition) {
                    additions.push(currentMultiLineAddition.trim());
                    currentMultiLineAddition = '';
                }
                inRemoval = true;
                inAddition = false;
                currentMultiLineRemoval = line.substring(2) + '\n';
            } else if (line.startsWith('+ ')) {
                // Start of addition
                if (currentMultiLineRemoval) {
                    removals.push(currentMultiLineRemoval.trim());
                    currentMultiLineRemoval = '';
                }
                inRemoval = false;
                inAddition = true;
                currentMultiLineAddition = line.substring(2) + '\n';
            } else if (line.startsWith('-')) {
                // Continuation of removal
                if (inRemoval) {
                    currentMultiLineRemoval += line.substring(1) + '\n';
                }
            } else if (line.startsWith('+')) {
                // Continuation of addition
                if (inAddition) {
                    currentMultiLineAddition += line.substring(1) + '\n';
                }
            } else if (line.trim() === '') {
                // Empty line - might continue multiline blocks
                if (inRemoval) {
                    currentMultiLineRemoval += '\n';
                } else if (inAddition) {
                    currentMultiLineAddition += '\n';
                }
            } else {
                // Context line or end of modification block
                if (currentMultiLineRemoval) {
                    removals.push(currentMultiLineRemoval.trim());
                    currentMultiLineRemoval = '';
                    inRemoval = false;
                }
                if (currentMultiLineAddition) {
                    additions.push(currentMultiLineAddition.trim());
                    currentMultiLineAddition = '';
                    inAddition = false;
                }
            }
        }

        // Handle any remaining multiline content
        if (currentMultiLineRemoval) {
            removals.push(currentMultiLineRemoval.trim());
        }
        if (currentMultiLineAddition) {
            additions.push(currentMultiLineAddition.trim());
        }

        if (removals.length > 0 || additions.length > 0) {
            modifications.push({
                context: contextLine,
                removals,
                additions
            });
        }
    }

    return modifications;
}

/**
 * Find the location in JSON data where the context appears
 */
export function findContextLocation(data: any, context: string): ContextLocation | null {
    try {
        console.log('[ContextDiff] Looking for context:', context.substring(0, 200) + '...');

        // Clean up context and remove extra whitespace for better matching
        const cleanContext = context.trim();

        // Try different strategies to find the context

        // Strategy 1: Look for array patterns like "characters": [
        const arrayMatch = cleanContext.match(/"([^"]+)":\s*\[/);
        if (arrayMatch) {
            const arrayKey = arrayMatch[1];
            console.log('[ContextDiff] Trying array pattern for key:', arrayKey);
            if (data[arrayKey] && Array.isArray(data[arrayKey])) {
                console.log('[ContextDiff] Found array location:', arrayKey);
                return {
                    type: 'array',
                    parent: data,
                    key: arrayKey,
                    array: data[arrayKey]
                };
            }
        }

        // Strategy 2: Look for object patterns like "characters": {
        const objectMatch = cleanContext.match(/"([^"]+)":\s*\{/);
        if (objectMatch) {
            const objectKey = objectMatch[1];
            console.log('[ContextDiff] Trying object pattern for key:', objectKey);
            if (data[objectKey] && typeof data[objectKey] === 'object') {
                console.log('[ContextDiff] Found object location:', objectKey);
                return {
                    type: 'object',
                    parent: data,
                    key: objectKey,
                    object: data[objectKey]
                };
            }
        }

        // Strategy 3: Look for string field patterns like "description": "some content"
        const stringFieldMatch = cleanContext.match(/"([^"]+)":\s*"([^"]*)/);
        if (stringFieldMatch) {
            const fieldKey = stringFieldMatch[1];
            const fieldValueStart = stringFieldMatch[2];
            console.log('[ContextDiff] Trying string field pattern for key:', fieldKey, 'value start:', fieldValueStart.substring(0, 50) + '...');

            // Search for this field in the data structure
            const location = findFieldInData(data, fieldKey, fieldValueStart);
            if (location) {
                console.log('[ContextDiff] Found string field location');
                return location;
            }
        }

        // Strategy 4: Look for any quoted key pattern and search for it in the data
        const keyMatch = cleanContext.match(/"([^"]+)":/);
        if (keyMatch) {
            const key = keyMatch[1];
            console.log('[ContextDiff] Trying general key search for:', key);

            const location = findKeyInData(data, key);
            if (location) {
                console.log('[ContextDiff] Found general key location');
                return location;
            }
        }

        console.log('[ContextDiff] No context location found');
        return null;
    } catch (error) {
        console.warn('[ContextDiff] Failed to parse context:', error);
        return null;
    }
}

/**
 * Recursively find a field with a specific key and value start in nested data
 */
function findFieldInData(data: any, fieldKey: string, fieldValueStart: string): ContextLocation | null {
    // Helper to normalize text for comparison (remove extra whitespace, line breaks)
    const normalizeText = (text: string): string => {
        return text.replace(/\s+/g, ' ').trim();
    };

    // Recursive search function
    const searchInObject = (obj: any, path: string[] = []): ContextLocation | null => {
        if (!obj || typeof obj !== 'object') return null;

        // Check if this object has the field we're looking for
        if (obj[fieldKey] && typeof obj[fieldKey] === 'string') {
            const objFieldValue = normalizeText(obj[fieldKey]);
            const targetValueStart = normalizeText(fieldValueStart);

            // Check if the field value starts with our target (be tolerant of formatting)
            if (objFieldValue.startsWith(targetValueStart) || objFieldValue.includes(targetValueStart)) {
                console.log('[ContextDiff] Found matching field at path:', path.join('.') + '.' + fieldKey);
                return {
                    type: 'object',
                    parent: obj,
                    key: fieldKey,
                    object: obj
                };
            }
        }

        // Recursively search in child objects and arrays
        for (const [key, value] of Object.entries(obj)) {
            if (Array.isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    const result = searchInObject(value[i], [...path, key, i.toString()]);
                    if (result) return result;
                }
            } else if (value && typeof value === 'object') {
                const result = searchInObject(value, [...path, key]);
                if (result) return result;
            }
        }

        return null;
    };

    return searchInObject(data);
}

/**
 * Recursively find any occurrence of a key in nested data
 */
function findKeyInData(data: any, targetKey: string): ContextLocation | null {
    const searchInObject = (obj: any, path: string[] = []): ContextLocation | null => {
        if (!obj || typeof obj !== 'object') return null;

        // Check if this object has the target key
        if (obj.hasOwnProperty(targetKey)) {
            console.log('[ContextDiff] Found key at path:', path.join('.') + '.' + targetKey);

            if (Array.isArray(obj[targetKey])) {
                return {
                    type: 'array',
                    parent: obj,
                    key: targetKey,
                    array: obj[targetKey]
                };
            } else if (typeof obj[targetKey] === 'object') {
                return {
                    type: 'object',
                    parent: obj,
                    key: targetKey,
                    object: obj[targetKey]
                };
            } else {
                // String or primitive field
                return {
                    type: 'object',
                    parent: obj,
                    key: targetKey,
                    object: obj
                };
            }
        }

        // Recursively search in child objects and arrays
        for (const [key, value] of Object.entries(obj)) {
            if (Array.isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    const result = searchInObject(value[i], [...path, key, i.toString()]);
                    if (result) return result;
                }
            } else if (value && typeof value === 'object') {
                const result = searchInObject(value, [...path, key]);
                if (result) return result;
            }
        }

        return null;
    };

    return searchInObject(data);
}

/**
 * Check if two objects match (for finding items to remove)
 */
export function objectsMatch(obj1: any, obj2: any): boolean {
    if (typeof obj1 !== typeof obj2) return false;
    if (obj1 === null || obj2 === null) return obj1 === obj2;
    if (typeof obj1 !== 'object') return obj1 === obj2;

    // For objects, check if obj2's properties all match obj1
    for (const [key, value] of Object.entries(obj2)) {
        if (obj1[key] !== value) return false;
    }

    return true;
}

/**
 * Apply modifications at a specific location
 */
export function applyModificationAtLocation(
    data: any,
    location: ContextLocation,
    removals: string[],
    additions: string[]
): any {
    try {
        const modifiedData = JSON.parse(JSON.stringify(data)); // Deep clone

        console.log('[ContextDiff] Applying modifications at location type:', location.type, 'key:', location.key);
        console.log('[ContextDiff] Removals:', removals);
        console.log('[ContextDiff] Additions:', additions);

        if (location.type === 'array') {
            const array = modifiedData[location.key];

            // Process removals
            for (const removal of removals) {
                try {
                    const removalObj = JSON.parse(removal);
                    const index = array.findIndex((item: any) =>
                        objectsMatch(item, removalObj)
                    );
                    if (index !== -1) {
                        console.log('[ContextDiff] Removing array item at index:', index);
                        array.splice(index, 1);
                    }
                } catch (error) {
                    console.warn('[ContextDiff] Failed to parse removal:', removal, error);
                }
            }

            // Process additions
            for (const addition of additions) {
                try {
                    const additionObj = JSON.parse(addition);
                    console.log('[ContextDiff] Adding to array:', additionObj);
                    array.push(additionObj);
                } catch (error) {
                    console.warn('[ContextDiff] Failed to parse addition:', addition, error);
                }
            }
        } else if (location.type === 'object') {
            // Handle different types of object modifications

            // Strategy 1: Direct field value replacement with proper value extraction
            if (removals.length > 0 && additions.length > 0) {
                const target = location.object || modifiedData[location.key];

                for (let i = 0; i < removals.length && i < additions.length; i++) {
                    const removal = removals[i].trim();
                    const addition = additions[i].trim();

                    console.log('[ContextDiff] Trying direct field replacement:', removal, '->', addition);

                    // Extract field values from JSON-formatted strings like "description": "value"
                    const extractFieldValue = (jsonString: string): string | null => {
                        try {
                            // Try to parse as a complete JSON object like {"description": "value"}
                            if (jsonString.startsWith('{') && jsonString.endsWith('}')) {
                                const parsed = JSON.parse(jsonString);
                                const values = Object.values(parsed);
                                return values.length > 0 ? String(values[0]) : null;
                            }

                            // Try to extract value from "field": "value", format
                            const match = jsonString.match(/"([^"]+)":\s*"([^"]*(?:\\.[^"]*)*)"/);
                            if (match && match[2]) {
                                return match[2];
                            }

                            // If no pattern matches, return the original string (might be a plain value)
                            return jsonString.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
                        } catch (error) {
                            return jsonString.replace(/^["']|["']$/g, ''); // Fallback: remove quotes
                        }
                    };

                    const oldValue = extractFieldValue(removal);
                    const newValue = extractFieldValue(addition);

                    if (oldValue && newValue && oldValue !== newValue) {
                        console.log('[ContextDiff] Extracted values - Old:', oldValue.substring(0, 100), '| New:', newValue.substring(0, 100));

                        // Try to replace the exact value in the target object
                        const replaced = replaceInObject(target, oldValue, newValue);
                        if (replaced) {
                            console.log('[ContextDiff] Successfully applied direct field replacement');
                            continue; // Move to next modification
                        }
                    }
                }
            }

            // Strategy 2: JSON object property modifications (fallback)
            for (const removal of removals) {
                try {
                    const removalObj = JSON.parse(removal);
                    const target = location.object || modifiedData[location.key];

                    // Remove matching properties
                    for (const [key, value] of Object.entries(removalObj)) {
                        if (target[key] === value) {
                            console.log('[ContextDiff] Removing object property:', key);
                            delete target[key];
                        }
                    }
                } catch (error) {
                    // Not valid JSON, might be a string replacement
                    console.log('[ContextDiff] Removal not valid JSON, treating as string:', removal);
                }
            }

            for (const addition of additions) {
                try {
                    const additionObj = JSON.parse(addition);
                    const target = location.object || modifiedData[location.key];
                    console.log('[ContextDiff] Adding object properties:', additionObj);
                    Object.assign(target, additionObj);
                } catch (error) {
                    // Not valid JSON, might be a string replacement
                    console.log('[ContextDiff] Addition not valid JSON, treating as string:', addition);
                }
            }
        }

        return modifiedData;
    } catch (error) {
        console.error('[ContextDiff] Failed to apply modification at location:', error);
        throw error;
    }
}

/**
 * Replace text content within an object, handling string fields and arrays
 */
function replaceInObject(obj: any, oldText: string, newText: string): boolean {
    if (!obj || typeof obj !== 'object') return false;

    let replaced = false;

    // Clean up text for comparison (normalize whitespace)
    const normalizeText = (text: string): string => {
        return text.replace(/\s+/g, ' ').trim();
    };

    const normalizedOldText = normalizeText(oldText);
    const normalizedNewText = normalizeText(newText);

    // Search through all properties
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            const normalizedValue = normalizeText(value);

            // Check for exact match
            if (normalizedValue === normalizedOldText) {
                console.log('[ContextDiff] Found exact string match in field:', key);
                obj[key] = newText;
                replaced = true;
            }
            // Check for partial match and replace
            else if (normalizedValue.includes(normalizedOldText)) {
                console.log('[ContextDiff] Found partial string match in field:', key);
                // Replace in the original value to preserve original formatting
                const updatedValue = value.replace(new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), newText);
                obj[key] = updatedValue;
                replaced = true;
            }
        } else if (Array.isArray(value)) {
            // Search in array elements
            for (let i = 0; i < value.length; i++) {
                if (typeof value[i] === 'string') {
                    const normalizedValue = normalizeText(value[i]);
                    if (normalizedValue === normalizedOldText) {
                        console.log('[ContextDiff] Found exact string match in array index:', i);
                        value[i] = newText;
                        replaced = true;
                    } else if (normalizedValue.includes(normalizedOldText)) {
                        console.log('[ContextDiff] Found partial string match in array index:', i);
                        const updatedValue = value[i].replace(new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), newText);
                        value[i] = updatedValue;
                        replaced = true;
                    }
                } else if (value[i] && typeof value[i] === 'object') {
                    if (replaceInObject(value[i], oldText, newText)) {
                        replaced = true;
                    }
                }
            }
        } else if (value && typeof value === 'object') {
            // Recursively search in nested objects
            if (replaceInObject(value, oldText, newText)) {
                replaced = true;
            }
        }
    }

    return replaced;
}

/**
 * Apply a single context-based modification to JSON data
 */
export function applyContextModification(
    data: any,
    modification: ContextModification
): any {
    const { context, removals, additions } = modification;

    // Find the location in the JSON where this context appears
    const location = findContextLocation(data, context);
    if (!location) {
        console.warn('[ContextDiff] Could not find context location:', context);
        return data;
    }

    // Apply removals and additions at the found location
    return applyModificationAtLocation(data, location, removals, additions);
}

/**
 * Apply context-based modifications to JSON data
 */
export function applyContextBasedModifications(
    originalData: any,
    modifications: ContextModification[]
): any {
    try {
        let modifiedData = JSON.parse(JSON.stringify(originalData)); // Deep clone

        for (const modification of modifications) {
            modifiedData = applyContextModification(modifiedData, modification);
        }

        return modifiedData;
    } catch (error) {
        console.error('[ContextDiff] Failed to apply context-based modifications:', error);
        throw error;
    }
}

/**
 * Apply context-based diff to JSON string using enhanced logic
 */
export function applyContextDiffToJsonString(
    originalJsonString: string,
    contextDiff: string
): ContextDiffResult {
    try {
        console.log('[ContextDiff] Applying context diff to JSON string...');
        console.log('[ContextDiff] Original JSON length:', originalJsonString.length);
        console.log('[ContextDiff] Context diff:', contextDiff.substring(0, 500) + '...');

        // Parse the original JSON
        const originalData = JSON.parse(originalJsonString);

        // Parse context-based diff format into modifications using enhanced logic
        const modifications = parseContextBasedDiff(contextDiff);
        if (!modifications || modifications.length === 0) {
            throw new Error('No valid modifications found in context-based diff');
        }

        console.log('[ContextDiff] Found', modifications.length, 'modifications');

        // Apply each modification using enhanced logic
        let modifiedData = JSON.parse(JSON.stringify(originalData)); // Deep clone

        for (const modification of modifications) {
            console.log('[ContextDiff] Looking for context:', modification.context.substring(0, 200) + '...');

            // Find the location for this modification
            const location = findContextLocation(modifiedData, modification.context);
            if (!location) {
                console.warn('[ContextDiff] Could not find context location for:', modification.context.substring(0, 100));
                continue;
            }

            // Apply the modification at the found location
            modifiedData = applyModificationAtLocation(
                modifiedData,
                location,
                modification.removals,
                modification.additions
            );
        }

        // Use jsonrepair to fix any JSON issues after modification
        const repairedJsonString = jsonrepair(JSON.stringify(modifiedData, null, 2));
        console.log('[ContextDiff] Context diff applied successfully, result length:', repairedJsonString.length);

        return { success: true, result: repairedJsonString };
    } catch (error) {
        console.error('[ContextDiff] Failed to apply context diff:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Create RFC6902 patch operations from original and modified JSON strings
 * @param originalJsonString - Original JSON string
 * @param modifiedJsonString - Modified JSON string  
 * @returns Array of RFC6902 patch operations
 */
export function createRFC6902Patches(
    originalJsonString: string,
    modifiedJsonString: string
): any[] {
    try {
        console.log('[ContextDiff] Creating RFC6902 patches...');
        console.log('[ContextDiff] Original JSON length:', originalJsonString.length);
        console.log('[ContextDiff] Modified JSON length:', modifiedJsonString.length);

        // Check if strings are different
        if (originalJsonString === modifiedJsonString) {
            console.log('[ContextDiff] JSON strings are identical - no patches needed');
            return [];
        }

        console.log('[ContextDiff] Strings are different, generating patches...');
        const originalJson = JSON.parse(originalJsonString);
        const modifiedJson = JSON.parse(modifiedJsonString);

        const patches = createPatch(originalJson, modifiedJson);
        console.log('[ContextDiff] Generated', patches.length, 'RFC6902 patches');

        if (patches.length > 0) {
            console.log('[ContextDiff] First patch:', JSON.stringify(patches[0], null, 2));
        }

        return patches;
    } catch (error) {
        console.error('[ContextDiff] Failed to create RFC6902 patches:', error);
        return [];
    }
}

/**
 * Apply context diff and generate RFC6902 patches in one operation
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
    error?: string;
} {
    try {
        // Apply context diff
        const diffResult = applyContextDiffToJsonString(originalJsonString, contextDiff);

        if (!diffResult.success || !diffResult.result) {
            return {
                success: false,
                error: diffResult.error || 'Failed to apply context diff'
            };
        }

        // Generate RFC6902 patches
        const rfc6902Patches = createRFC6902Patches(originalJsonString, diffResult.result);

        return {
            success: true,
            modifiedJson: diffResult.result,
            rfc6902Patches
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
} 