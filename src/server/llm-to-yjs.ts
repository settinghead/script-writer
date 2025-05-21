interface EditOperation {
    position: number;
    insert?: string;
    delete?: number;
}

interface LLMEditResponse {
    edits: EditOperation[];
    explanation?: string;
}

export const parseLLMResponse = (response: string): EditOperation[] => {
    try {
        // Clean up the response string if needed
        const cleanedResponse = response.trim();

        // Try to extract JSON from the response
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No valid JSON found in response');
        }

        const jsonStr = jsonMatch[0];
        const parsed: LLMEditResponse = JSON.parse(jsonStr);

        if (!parsed.edits || !Array.isArray(parsed.edits)) {
            throw new Error('Invalid edits format');
        }

        // Validate each edit operation
        return parsed.edits.filter(edit => {
            // Position must be a number
            if (typeof edit.position !== 'number') return false;

            // Must have either insert or delete
            if (edit.insert === undefined && edit.delete === undefined) return false;

            // If has delete, it must be a positive number
            if (edit.delete !== undefined && (typeof edit.delete !== 'number' || edit.delete <= 0)) return false;

            // If has insert, it must be a string
            if (edit.insert !== undefined && typeof edit.insert !== 'string') return false;

            return true;
        });
    } catch (err) {
        console.error('Error parsing LLM response:', err);
        return [];
    }
}; 