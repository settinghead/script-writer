/**
 * Text cleaning utilities for LLM outputs
 */

/**
 * Console spinner utility for think mode indication
 */
export class ConsoleSpinner {
    private static instance: ConsoleSpinner | null = null;
    private spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    private currentIndex = 0;
    private intervalId: NodeJS.Timeout | null = null;
    private isSpinning = false;

    static getInstance(): ConsoleSpinner {
        if (!ConsoleSpinner.instance) {
            ConsoleSpinner.instance = new ConsoleSpinner();
        }
        return ConsoleSpinner.instance;
    }

    start(message: string = 'AI thinking'): void {
        if (this.isSpinning) return;
        
        this.isSpinning = true;
        this.currentIndex = 0;
        
        // Only show spinner in development/server environment
        if (typeof process !== 'undefined' && process.stdout && process.stdout.write) {
            this.intervalId = setInterval(() => {
                const spinner = this.spinnerChars[this.currentIndex];
                process.stdout.write(`\r${spinner} ${message}...`);
                this.currentIndex = (this.currentIndex + 1) % this.spinnerChars.length;
            }, 100);
        }
    }

    stop(): void {
        if (!this.isSpinning) return;
        
        this.isSpinning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        // Clear the spinner line
        if (typeof process !== 'undefined' && process.stdout && process.stdout.write) {
            process.stdout.write('\r' + ' '.repeat(50) + '\r');
        }
    }

    isActive(): boolean {
        return this.isSpinning;
    }
}

/**
 * Check if content contains an opening think tag
 */
export function hasOpenThinkTag(content: string): boolean {
    return /<think\b[^>]*>/i.test(content);
}

/**
 * Check if content contains a closing think tag
 */
export function hasCloseThinkTag(content: string): boolean {
    return /<\/think>/i.test(content);
}

/**
 * Check if we're currently inside think tags (has opening but no closing)
 */
export function isInsideThinkTags(content: string): boolean {
    const openMatches = content.match(/<think\b[^>]*>/gi) || [];
    const closeMatches = content.match(/<\/think>/gi) || [];
    return openMatches.length > closeMatches.length;
}

/**
 * Remove <think>...</think> tags from text content
 * These tags are often used by models for reasoning but should not be included in the output
 */
export function removeThinkTags(content: string): string {
    // Remove <think>...</think> tags with any content between them
    // Use case-insensitive matching and handle multiline content
    return content.replace(/<think[\s\S]*?<\/think>/gi, '');
}

/**
 * Remove markdown code block wrappers (```json, ```, etc.)
 */
export function removeCodeBlockWrappers(content: string): string {
    let cleaned = content.trim();
    
    // Remove ```json and ``` wrappers if present
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    return cleaned;
}

/**
 * Comprehensive content cleaning for LLM outputs
 * Applies all cleaning operations in the correct order
 */
export function cleanLLMContent(content: string): string {
    if (!content) return content;
    
    let cleaned = content;
    
    // 1. Remove think tags first (before other processing)
    cleaned = removeThinkTags(cleaned);
    
    // 2. Remove code block wrappers
    cleaned = removeCodeBlockWrappers(cleaned);
    
    // 3. Trim whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
}

/**
 * Process streaming content with think mode detection and console feedback
 * Returns cleaned content and think mode status
 */
export function processStreamingContent(
    content: string, 
    previousContent: string = ''
): { 
    cleanedContent: string; 
    isThinking: boolean; 
    thinkingStarted: boolean; 
    thinkingEnded: boolean; 
} {
    const wasThinking = isInsideThinkTags(previousContent);
    const isThinking = isInsideThinkTags(content);
    const thinkingStarted = !wasThinking && isThinking;
    const thinkingEnded = wasThinking && !isThinking;
    
    return {
        cleanedContent: cleanLLMContent(content),
        isThinking,
        thinkingStarted,
        thinkingEnded
    };
}

/**
 * Extract JSON from content that may be wrapped in code blocks or followed by additional text
 * This handles cases where LLMs output valid JSON followed by explanatory content
 */
export function extractJSONFromContent(content: string): string {
    if (!content?.trim()) return content;
    
    let cleaned = content.trim();
    
    // First, remove think tags
    cleaned = removeThinkTags(cleaned);
    
    // Check if content is wrapped in code blocks
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim();
    }
    
    // Try to extract JSON portion when followed by additional content
    // Look for the end of a complete JSON object or array
    let jsonEndIndex = -1;
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escaped = false;
    let jsonStarted = false;
    
    for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        
        if (escaped) {
            escaped = false;
            continue;
        }
        
        if (char === '\\') {
            escaped = true;
            continue;
        }
        
        if (char === '"' && !escaped) {
            inString = !inString;
            continue;
        }
        
        if (inString) continue;
        
        // Track JSON structure boundaries
        if (char === '{') {
            braceCount++;
            jsonStarted = true;
        } else if (char === '}') {
            braceCount--;
            if (jsonStarted && braceCount === 0 && bracketCount === 0) {
                jsonEndIndex = i;
                break;
            }
        } else if (char === '[') {
            bracketCount++;
            jsonStarted = true;
        } else if (char === ']') {
            bracketCount--;
            if (jsonStarted && braceCount === 0 && bracketCount === 0) {
                jsonEndIndex = i;
                break;
            }
        }
    }
    
    // If we found a complete JSON structure, extract just that part
    if (jsonEndIndex >= 0) {
        cleaned = cleaned.substring(0, jsonEndIndex + 1);
    }
    
    return cleaned.trim();
}

/**
 * Robust JSON parsing with fallback to jsonrepair
 * First tries to extract clean JSON, then falls back to jsonrepair if needed
 */
export async function robustJSONParse(content: string): Promise<any> {
    if (!content?.trim()) {
        throw new Error('Empty content provided for JSON parsing');
    }
    
    // Step 1: Try to extract clean JSON
    const cleanJSON = extractJSONFromContent(content);
    
    // Step 2: Try normal JSON parsing first
    try {
        return JSON.parse(cleanJSON);
    } catch (parseError) {
        console.log('Initial JSON parse failed, attempting repair...');
        
        // Step 3: Try jsonrepair on the extracted JSON
        try {
            const { jsonrepair } = await import('jsonrepair');
            const repairedJSON = jsonrepair(cleanJSON);
            return JSON.parse(repairedJSON);
        } catch (repairError) {
            console.log('JSON repair failed on extracted JSON');
            
            // Step 4: Try jsonrepair on the original cleaned content as a last resort
            try {
                const { jsonrepair } = await import('jsonrepair');
                const basicCleaned = cleanLLMContent(content);
                const repairedOriginal = jsonrepair(basicCleaned);
                return JSON.parse(repairedOriginal);
            } catch (finalError) {
                // Step 5: Log detailed error information for debugging
                console.error('All JSON parsing attempts failed:');
                console.error('- Original content length:', content.length);
                console.error('- Cleaned JSON length:', cleanJSON.length);
                console.error('- Cleaned JSON preview:', cleanJSON.substring(0, 200));
                throw new Error(`Failed to parse JSON after all attempts. Original error: ${parseError.message}`);
            }
        }
    }
} 