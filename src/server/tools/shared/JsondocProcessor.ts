import { JsondocRepository } from '../../transform-jsondoc-framework/JsondocRepository';
import { JsondocReference } from '../../../common/schemas/common';

/**
 * Shared utility for processing jsondocs across all tools
 * Follows the same pattern as EpisodePlanningTool - processes all jsondocs without active filtering
 */
export class JsondocProcessor {
    constructor(
        private jsondocRepo: JsondocRepository,
        private userId: string
    ) { }

    /**
     * Process all jsondocs provided, extracting their data and organizing by schema type
     * @param jsondocs Array of jsondoc references to process
     * @returns Object containing jsondoc data organized by schema type and metadata
     */
    async processJsondocs(jsondocs: JsondocReference[]): Promise<{
        jsondocData: Record<string, any>;
        jsondocMetadata: Record<string, string>;
        processedCount: number;
    }> {
        const jsondocData: Record<string, any> = {};
        const jsondocMetadata: Record<string, string> = {};
        let processedCount = 0;

        for (const jsondocRef of jsondocs) {
            console.log(`[JsondocProcessor] Processing jsondoc: ${jsondocRef.jsondocId} (type: ${jsondocRef.schemaType})`);

            const jsondoc = await this.jsondocRepo.getJsondoc(jsondocRef.jsondocId);
            if (!jsondoc) {
                console.warn(`[JsondocProcessor] Jsondoc not found: ${jsondocRef.jsondocId}`);
                continue;
            }

            // Verify user has access to this jsondoc's project
            const hasAccess = await this.jsondocRepo.userHasProjectAccess(this.userId, jsondoc.project_id);
            if (!hasAccess) {
                console.warn(`[JsondocProcessor] Access denied to jsondoc: ${jsondocRef.jsondocId}`);
                continue;
            }

            // Store the jsondoc data using schema type as key
            jsondocData[jsondoc.schema_type] = jsondoc.data;
            jsondocMetadata[jsondoc.schema_type] = jsondoc.id;
            processedCount++;

            console.log(`[JsondocProcessor] Loaded ${jsondoc.schema_type}: ${jsondoc.data.title || jsondoc.data.name || 'untitled'}`);
        }

        console.log(`[JsondocProcessor] Processed ${processedCount} jsondocs`);
        return { jsondocData, jsondocMetadata, processedCount };
    }

    /**
     * Get a specific jsondoc by ID with access control
     * @param jsondocId ID of the jsondoc to retrieve
     * @returns The jsondoc if found and accessible, null otherwise
     */
    async getJsondocWithAccess(jsondocId: string) {
        const jsondoc = await this.jsondocRepo.getJsondoc(jsondocId);
        if (!jsondoc) {
            return null;
        }

        const hasAccess = await this.jsondocRepo.userHasProjectAccess(this.userId, jsondoc.project_id);
        if (!hasAccess) {
            return null;
        }

        return jsondoc;
    }
}

/**
 * Factory function to create a JsondocProcessor instance
 */
export function createJsondocProcessor(jsondocRepo: JsondocRepository, userId: string): JsondocProcessor {
    return new JsondocProcessor(jsondocRepo, userId);
} 