import { ZodSchema } from 'zod';
import { CustomTemplateVariableFunction } from './TemplateVariableService';

export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: ZodSchema;
    templatePath: string;
    customTemplateVariables?: CustomTemplateVariableFunction;
}

export class ToolRegistry {
    private static instance: ToolRegistry;
    private tools: Map<string, ToolDefinition> = new Map();

    private constructor() { }

    static getInstance(): ToolRegistry {
        if (!ToolRegistry.instance) {
            ToolRegistry.instance = new ToolRegistry();
        }
        return ToolRegistry.instance;
    }

    /**
     * Register a tool with the registry
     */
    registerTool(definition: ToolDefinition): void {
        this.tools.set(definition.name, definition);
    }

    /**
     * Get a tool definition by name
     */
    getTool(name: string): ToolDefinition | undefined {
        return this.tools.get(name);
    }

    /**
     * Get all registered tools
     */
    getAllTools(): ToolDefinition[] {
        return Array.from(this.tools.values());
    }

    /**
     * Get tool names
     */
    getToolNames(): string[] {
        return Array.from(this.tools.keys());
    }

    /**
     * Check if a tool is registered
     */
    hasTool(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * Get tools that accept a specific jsondoc schema type
     */
    getToolsForSchemaType(schemaType: string): ToolDefinition[] {
        return this.getAllTools().filter(tool => {
            // This is a simplified check - in a real implementation,
            // we'd need to analyze the tool's input schema to see if it accepts
            // jsondocs with the given schema type
            return true; // For now, return all tools
        });
    }

    /**
     * Clear all registered tools (useful for testing)
     */
    clear(): void {
        this.tools.clear();
    }
} 