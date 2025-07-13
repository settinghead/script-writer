import { z } from 'zod';
import { JsondocSchemaRegistry, BrainstormToolInputSchema } from '../../../common/schemas/jsondocs';
import {
  OutlineSettingsInputSchema,
  OutlineSettingsOutputSchema,
  ChroniclesInputSchema,
  ChroniclesOutputSchema,
} from '../../../common/schemas/outlineSchemas';

// Get the schemas from the registry
const BrainstormIdeaSchema = JsondocSchemaRegistry.brainstorm_idea;


// Type definitions based on schemas
type BrainstormIdea = z.infer<typeof BrainstormIdeaSchema>;
type BrainstormToolInput = z.infer<typeof BrainstormToolInputSchema>;


/**
 * Extract data at a given path from source data
 */
function extractDataAtPath(sourceData: any, path: string): any {
  // Simple path extraction - for complex paths, use a proper JSONPath library
  if (path === '$') {
    return sourceData;
  }

  // Handle array index paths like $.ideas[0] or $.stages[0]
  const arrayMatch = path.match(/^\$\.(\w+)\[(\d+)\]$/);
  if (arrayMatch) {
    const [, fieldName, index] = arrayMatch;
    return sourceData[fieldName]?.[parseInt(index)];
  }

  // Handle simple field paths like $.title
  const fieldMatch = path.match(/^\$\.(\w+)$/);
  if (fieldMatch) {
    const [, fieldName] = fieldMatch;
    return sourceData[fieldName];
  }

  return sourceData;
}



/**
 * Create brainstorm idea from brainstorm idea (for editing)
 */
export function createBrainstormIdeaFromBrainstormIdea(
  sourceJsondocData: any,
  derivationPath: string
): BrainstormIdea {
  const ideaData = extractDataAtPath(sourceJsondocData, derivationPath) as BrainstormIdea;

  if (!ideaData || typeof ideaData.title !== 'string' || typeof ideaData.body !== 'string') {
    throw new Error(`Invalid brainstorm idea data at path ${derivationPath}`);
  }

  // Return the idea data directly for editing
  return {
    title: ideaData.title,
    body: ideaData.body
  };
}

/**
 * Create user input from brainstorm idea (for editing)
 */
export function createUserInputFromBrainstormIdea(
  sourceJsondocData: any,
  derivationPath: string
): any {
  const ideaData = extractDataAtPath(sourceJsondocData, derivationPath);

  if (!ideaData) {
    throw new Error(`No data found at path ${derivationPath}`);
  }

  // Convert brainstorm idea to user input format
  return {
    text: typeof ideaData === 'string' ? ideaData : JSON.stringify(ideaData),
    source: 'modified_brainstorm',
    source_jsondoc_id: undefined // Will be set by the executor
  };
}

/**
 * Create user input from brainstorm field (for editing specific fields)
 */
export function createUserInputFromBrainstormField(
  sourceJsondocData: any,
  derivationPath: string
): any {
  const fieldData = extractDataAtPath(sourceJsondocData, derivationPath);

  if (fieldData === null || fieldData === undefined) {
    throw new Error(`No data found at path ${derivationPath}`);
  }

  // Convert field data to user input format
  return {
    text: typeof fieldData === 'string' ? fieldData : JSON.stringify(fieldData),
    source: 'modified_brainstorm',
    source_jsondoc_id: undefined // Will be set by the executor
  };
}


export const createOutlineSettingsTransform = (sourceJsondocId: string) => {
  return {
    sourceJsondocId,
    targetPath: '$[outline_settings]',
    inputSchema: OutlineSettingsInputSchema,
    outputSchema: OutlineSettingsOutputSchema,
    transformType: 'llm' as const
  };
};

export const createChroniclesTransform = (sourceJsondocId: string) => {
  return {
    sourceJsondocId,
    targetPath: '$[chronicles]',
    inputSchema: ChroniclesInputSchema,
    outputSchema: ChroniclesOutputSchema,
    transformType: 'llm' as const
  };
};

/**
 * Create brainstorm tool input parameters (for new project creation)
 */
export function createBrainstormToolInput(
  sourceJsondocData: any,
  derivationPath: string
): BrainstormToolInput {
  // For new creation, provide default values
  // This function is called when creating a new brainstorm input jsondoc
  return {
    platform: '抖音',
    genre: '',
    genrePaths: [],
    other_requirements: '',
    numberOfIdeas: 3
  };
}

/**
 * Create editable outline settings from existing outline settings
 * Returns the outline settings data directly (no wrapper)
 */
export function createOutlineSettingsFromOutlineSettings(
  sourceJsondocData: any,
  derivationPath: string
): any {
  const outlineSettingsData = extractDataAtPath(sourceJsondocData, derivationPath);

  if (!outlineSettingsData || typeof outlineSettingsData !== 'object') {
    throw new Error(`Invalid outline settings data at path ${derivationPath}`);
  }

  // Validate the data structure against the output schema
  try {
    const validatedData = OutlineSettingsOutputSchema.parse(outlineSettingsData);
    return validatedData;
  } catch (error) {
    console.warn('Outline settings validation failed, using raw data:', error);
    // Return the raw data even if validation fails - user can edit it
    return outlineSettingsData;
  }
}

/**
 * Create editable chronicles from existing chronicles
 * Returns the chronicles data directly (no wrapper)
 */
export function createChroniclesFromChronicles(
  sourceJsondocData: any,
  derivationPath: string
): any {
  const chroniclesData = extractDataAtPath(sourceJsondocData, derivationPath);

  if (!chroniclesData || typeof chroniclesData !== 'object') {
    throw new Error(`Invalid chronicles data at path ${derivationPath}`);
  }

  // Validate the data structure against the output schema
  try {
    const validatedData = ChroniclesOutputSchema.parse(chroniclesData);
    return validatedData;
  } catch (error) {
    console.warn('Chronicles validation failed, using raw data:', error);
    // Return the raw data even if validation fails - user can edit it
    return chroniclesData;
  }
} 