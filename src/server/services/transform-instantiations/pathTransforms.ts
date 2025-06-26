import { BrainstormIdeaSchema } from '../../../common/schemas/artifacts.js';

// Utility function to extract data at JSONPath (simplified implementation)
export function extractDataAtPath(sourceData: any, path: string): any {
    if (path === '$') {
        return sourceData;
    }

    // Handle $.ideas[n] pattern for brainstorm collections
    const ideaMatch = path.match(/^\$\.ideas\[(\d+)\]$/);
    if (ideaMatch) {
        const index = parseInt(ideaMatch[1]);
        if (sourceData.ideas && Array.isArray(sourceData.ideas) && sourceData.ideas[index]) {
            return {
                title: sourceData.ideas[index].title,
                body: sourceData.ideas[index].body
            };
        }
        throw new Error(`No idea found at index ${index} in collection`);
    }

    // Handle simple field paths like $.title, $.body
    const fieldMatch = path.match(/^\$\.([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (fieldMatch) {
        const field = fieldMatch[1];
        if (sourceData[field] !== undefined) {
            return sourceData[field];
        }
        throw new Error(`Field ${field} not found in artifact`);
    }

    throw new Error(`Unsupported JSONPath: ${path}`);
}

// Create BrainstormIdea from JSONPath extraction
export function createBrainstormIdeaFromPath(
    sourceArtifactData: any,
    artifactPath: string
): any {
    const extractedData = extractDataAtPath(sourceArtifactData, artifactPath);

    // Validate that extracted data matches BrainstormIdea schema
    const result = BrainstormIdeaSchema.safeParse(extractedData);
    if (!result.success) {
        throw new Error(`Data at path ${artifactPath} does not match BrainstormIdea schema: ${result.error.message}`);
    }

    return result.data;
}

// Generic field extraction using JSONPath
export function createFieldEditFromPath(
    sourceArtifactData: any,
    artifactPath: string
): any {
    return extractDataAtPath(sourceArtifactData, artifactPath);
}

// Update existing functions to handle both collections and individual ideas
export function createOutlineInputFromPath(
    sourceArtifactData: any,
    artifactPath: string = '$'
): any {
    const extractedData = extractDataAtPath(sourceArtifactData, artifactPath);

    // Convert brainstorm idea to outline input format
    if (extractedData.title && extractedData.body) {
        return {
            content: `${extractedData.title}\n\n${extractedData.body}`,
            source_metadata: {
                original_idea_title: extractedData.title,
                original_idea_body: extractedData.body,
                derivation_path: artifactPath,
                source_artifact_id: '' // Will be filled by caller
            }
        };
    }

    throw new Error('Extracted data does not contain required title and body fields');
} 