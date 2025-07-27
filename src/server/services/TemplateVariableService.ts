import { dump } from 'js-yaml';
import { ZodSchema } from 'zod';
import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository.js';
import { SchemaDescriptionParser } from './SchemaDescriptionParser';
import { JsondocReference } from '../../common/schemas/common';

export type CustomTemplateVariableFunction = (
    input: any,
    inputSchema: ZodSchema,
    executionContext: TemplateExecutionContext,
    defaultService: TemplateVariableService
) => Promise<Record<string, string>> | Record<string, string>;

export interface TemplateExecutionContext {
    jsondocRepo: TransformJsondocRepository;
    projectId: string;
    userId: string;
    [key: string]: any;
}

export class TemplateVariableService {
    private schemaParser: SchemaDescriptionParser;

    constructor() {
        this.schemaParser = new SchemaDescriptionParser();
    }

    /**
     * Main entry point for template variable preparation
     * Supports both default intelligent processing and custom override functions
     */
    async prepareTemplateVariables(
        input: any,
        inputSchema: ZodSchema,
        executionContext: TemplateExecutionContext,
        customFunction?: CustomTemplateVariableFunction
    ): Promise<Record<string, string>> {
        // If custom function provided, use it
        if (customFunction) {
            return await customFunction(input, inputSchema, executionContext, this);
        }

        // Default intelligent processing
        return await this.prepareDefaultTemplateVariables(input, inputSchema, executionContext);
    }

    /**
     * Default intelligent template variable preparation
     * Automatically processes schema fields and jsondoc references
     */
    async prepareDefaultTemplateVariables(
        input: any,
        inputSchema: ZodSchema,
        executionContext: TemplateExecutionContext
    ): Promise<Record<string, string>> {
        const variables: Record<string, string> = {};

        // Process jsondocs if present
        if (input.jsondocs && Array.isArray(input.jsondocs)) {
            const jsondocContents = await this.processJsondocReferences(
                input.jsondocs,
                executionContext
            );
            variables.jsondocs = this.formatAsYaml(jsondocContents);
        }

        // Process other parameters (excluding jsondocs)
        const { jsondocs, ...otherParams } = input;
        if (Object.keys(otherParams).length > 0) {
            variables.params = this.formatAsYaml(otherParams);
        }

        return variables;
    }

    /**
     * Process jsondoc references and extract their content
     */
    async processJsondocReferences(
        jsondocs: JsondocReference[],
        executionContext: TemplateExecutionContext
    ): Promise<Record<string, any>> {
        console.log(`[TemplateVariableService] Processing ${jsondocs.length} jsondoc references`);
        const jsondocContents: Record<string, any> = {};

        for (const ref of jsondocs) {
            try {
                console.log(`[TemplateVariableService] Loading jsondoc ${ref.jsondocId}`);
                const jsondoc = await executionContext.jsondocRepo.getJsondoc(ref.jsondocId);
                if (jsondoc) {
                    console.log(`[TemplateVariableService] Loaded jsondoc:`, {
                        id: jsondoc.id,
                        schema_type: jsondoc.schema_type,
                        data_preview: JSON.stringify(jsondoc.data).substring(0, 100) + '...'
                    });

                    // Use description as key, fallback to schema type
                    const key = ref.description || ref.schemaType || ref.jsondocId;
                    console.log(`[TemplateVariableService] Using key "${key}" for jsondoc`);

                    jsondocContents[key] = {
                        id: jsondoc.id,
                        schemaType: jsondoc.schema_type,
                        schema_type: jsondoc.schema_type, // Add both for compatibility
                        content: jsondoc.data,
                        data: jsondoc.data // Add both for compatibility
                    };

                    console.log(`[TemplateVariableService] Created jsondoc entry:`, {
                        key,
                        entry_keys: Object.keys(jsondocContents[key]),
                        schema_type: jsondocContents[key].schema_type,
                        schemaType: jsondocContents[key].schemaType
                    });
                } else {
                    console.log(`[TemplateVariableService] ERROR: Jsondoc ${ref.jsondocId} not found`);
                }
            } catch (error) {
                console.warn(`Failed to load jsondoc ${ref.jsondocId}:`, error);
                // Continue processing other jsondocs
            }
        }

        console.log(`[TemplateVariableService] Final jsondocContents keys:`, Object.keys(jsondocContents));
        return jsondocContents;
    }

    /**
     * Format data as human-readable YAML
     */
    formatAsYaml(data: any): string {
        try {
            return dump(data, {
                indent: 2,
                lineWidth: 120,
                noRefs: true,
                sortKeys: false
            });
        } catch (error) {
            console.warn('Failed to format as YAML, falling back to JSON:', error);
            return JSON.stringify(data, null, 2);
        }
    }

    /**
     * Helper method for custom functions to access default processing
     */
    async getDefaultJsondocProcessing(
        jsondocs: JsondocReference[],
        executionContext: TemplateExecutionContext
    ): Promise<string> {
        const jsondocContents = await this.processJsondocReferences(jsondocs, executionContext);
        return this.formatAsYaml(jsondocContents);
    }

    /**
     * Helper method for custom functions to access default parameter processing
     */
    getDefaultParamsProcessing(params: any): string {
        return this.formatAsYaml(params);
    }

    /**
     * Extract human-readable field names from schema using descriptions
     */
    extractFieldTitles(inputSchema: ZodSchema): Record<string, string> {
        return this.schemaParser.extractFieldTitles(inputSchema);
    }
} 