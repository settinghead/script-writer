/**
 * Utility functions for consistent JSON formatting and line numbering
 * Used across the codebase to ensure format consistency between LLM templates and patch application
 */

/**
 * Produces consistent, formatted JSON string across the entire application
 * This ensures that JSON data has identical formatting everywhere:
 * - In template rendering
 * - In patch application 
 * - In database storage
 * - In debugging outputs
 */
export function formatJsonConsistently(data: any): string {
    return JSON.stringify(data, null, 2);
}

/**
 * Adds line numbers to a multiline string for LLM template usage
 * Line numbers help LLMs understand the structure and generate accurate unified diffs
 * 
 * @param content - Multiline string to add line numbers to
 * @returns String with line numbers in format "1: content"
 */
export function addLineNumbers(content: string): string {
    const lines = content.split('\n');
    return lines
        .map((line, index) => `${index + 1}: ${line}`)
        .join('\n');
}

/**
 * Combined utility: Format JSON consistently and add line numbers
 * This is the standard function for preparing JSON for LLM templates
 */
export function formatJsonWithLineNumbers(data: any): string {
    const formattedJson = formatJsonConsistently(data);
    return addLineNumbers(formattedJson);
}

/**
 * Remove line numbers from a string (for processing LLM output)
 * Useful when processing content that has line numbers added
 */
export function removeLineNumbers(content: string): string {
    return content
        .split('\n')
        .map(line => {
            // Remove line number prefix like "1: ", "10: ", etc.
            const match = line.match(/^\d+:\s*/);
            return match ? line.slice(match[0].length) : line;
        })
        .join('\n');
} 