import { JsondocSchemaRegistry } from '../../../common/schemas/jsondocs';

// Get the schema from the registry
const BrainstormIdeaSchema = JsondocSchemaRegistry.brainstorm_idea;

// Export the schema for use by other modules
export { BrainstormIdeaSchema };

// Utility function to extract data at JSONPath (simplified implementation)
export function extractDataAtPath(sourceData: any, path: string): any {
    // DEFENSIVE: Handle cases where sourceData might be wrapped in an extra "data" field
    // This can happen due to inconsistent data storage patterns
    let normalizedSourceData = sourceData;
    if (sourceData && typeof sourceData === 'object' && sourceData.data &&
        typeof sourceData.data === 'object' && sourceData.data.title && sourceData.data.body) {
        console.warn('[extractDataAtPath] Detected extra "data" wrapper, unwrapping...');
        normalizedSourceData = sourceData.data;
    }

    if (path === '$') {
        return normalizedSourceData;
    }

    // Handle $.ideas[n] pattern for brainstorm collections
    const ideaMatch = path.match(/^\$\.ideas\[(\d+)\]$/);
    if (ideaMatch) {
        const index = parseInt(ideaMatch[1]);

        // Handle both old format (direct array) and new format (with ideas property)
        let ideasArray: any[] = [];

        if (Array.isArray(normalizedSourceData)) {
            // Old format: data is directly an array
            ideasArray = normalizedSourceData;
        } else if (normalizedSourceData.ideas && Array.isArray(normalizedSourceData.ideas)) {
            // New format: data has an ideas property
            ideasArray = normalizedSourceData.ideas;
        }

        if (ideasArray[index]) {
            return {
                title: ideasArray[index].title,
                body: ideasArray[index].body
            };
        }

        throw new Error(`No idea found at index ${index} in collection`);
    }

    // Handle simple field paths like $.title, $.body
    const fieldMatch = path.match(/^\$\.([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (fieldMatch) {
        const field = fieldMatch[1];
        if (normalizedSourceData[field] !== undefined) {
            return normalizedSourceData[field];
        }
        throw new Error(`Field ${field} not found in jsondoc`);
    }

    throw new Error(`Unsupported JSONPath: ${path}`);
}

// Create BrainstormIdea from JSONPath extraction
export function createBrainstormIdeaFromPath(
    sourceJsondocData: any,
    jsondocPath: string
): any {
    const extractedData = extractDataAtPath(sourceJsondocData, jsondocPath);

    // Validate that extracted data matches BrainstormIdea schema
    const result = BrainstormIdeaSchema.safeParse(extractedData);
    if (!result.success) {
        throw new Error(`Data at path ${jsondocPath} does not match BrainstormIdea schema: ${result.error.message}`);
    }

    return result.data;
}

// Generic field extraction using JSONPath
export function createFieldEditFromPath(
    sourceJsondocData: any,
    jsondocPath: string
): any {
    return extractDataAtPath(sourceJsondocData, jsondocPath);
}

// Create editable copy of entire jsondoc for field editing
export function createEditableJsondocCopy(
    sourceJsondocData: any,
    jsondocPath: string
): any {
    // For field editing transforms, return the entire source data
    // This allows the user to edit any field within the jsondoc
    // The path is used for validation but the entire jsondoc is editable
    return sourceJsondocData;
}

// Update existing functions to handle both collections and individual ideas
export function createOutlineInputFromPath(
    sourceJsondocData: any,
    jsondocPath: string = '$'
): any {
    const extractedData = extractDataAtPath(sourceJsondocData, jsondocPath);

    // Convert brainstorm idea to outline input format
    if (extractedData.title && extractedData.body) {
        return {
            content: `${extractedData.title}\n\n${extractedData.body}`,
            source_metadata: {
                original_idea_title: extractedData.title,
                original_idea_body: extractedData.body,
                derivation_path: jsondocPath,
                source_jsondoc_id: '' // Will be filled by caller
            }
        };
    }

    throw new Error('Extracted data does not contain required title and body fields');
} 