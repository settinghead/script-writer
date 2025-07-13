import { ZodSchema, ZodObject, ZodRawShape } from 'zod';

export class SchemaDescriptionParser {
    // Punctuation patterns for title extraction (Chinese and English)
    private static readonly TITLE_SEPARATORS = /[，。、；：！？,.\;:!?]/;

    /**
     * Extract human-readable field titles from Zod schema descriptions
     * Parses descriptions like "源jsondoc ID，包含所有生成参数" to extract "源jsondoc ID"
     */
    extractFieldTitles(schema: ZodSchema): Record<string, string> {
        const titles: Record<string, string> = {};

        try {
            // Handle ZodObject schemas
            if (schema instanceof ZodObject) {
                const shape = schema.shape as ZodRawShape;

                for (const [fieldName, fieldSchema] of Object.entries(shape)) {
                    const description = this.getSchemaDescription(fieldSchema);
                    if (description) {
                        titles[fieldName] = this.extractTitleFromDescription(description);
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to extract field titles from schema:', error);
        }

        return titles;
    }

    /**
     * Extract title from description string using punctuation as separator
     */
    private extractTitleFromDescription(description: string): string {
        if (!description.trim()) {
            return description;
        }

        // Split by punctuation and take the first part as title
        const parts = description.split(SchemaDescriptionParser.TITLE_SEPARATORS);
        const title = parts[0]?.trim();

        return title || description;
    }

    /**
     * Get description from a Zod schema field
     */
    private getSchemaDescription(schema: any): string | undefined {
        try {
            // Check if schema has description
            if (schema._def?.description) {
                return schema._def.description;
            }

            // Handle optional/nullable schemas
            if (schema._def?.innerType?._def?.description) {
                return schema._def.innerType._def.description;
            }

            return undefined;
        } catch (error) {
            return undefined;
        }
    }

    /**
     * Utility method to test title extraction
     */
    static testTitleExtraction(description: string): string {
        const parser = new SchemaDescriptionParser();
        return parser.extractTitleFromDescription(description);
    }
} 