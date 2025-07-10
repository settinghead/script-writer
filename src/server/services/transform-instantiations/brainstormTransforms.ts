import { z } from 'zod';
import { ArtifactSchemaRegistry, BrainstormToolInputSchema } from '../../../common/schemas/artifacts';
import {
  OutlineSettingsInputSchema,
  OutlineSettingsOutputSchema,
  ChroniclesInputSchema,
  ChroniclesOutputSchema,
} from '../../../common/schemas/outlineSchemas';

// Get the schemas from the registry
const BrainstormIdeaSchema = ArtifactSchemaRegistry.brainstorm_item_schema;
const UserInputSchema = ArtifactSchemaRegistry.user_input_schema;


// Type definitions based on schemas
type BrainstormIdea = z.infer<typeof BrainstormIdeaSchema>;
type UserInput = z.infer<typeof UserInputSchema>;
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

// Legacy function removed - OutlineInput type no longer exists in new system

/**
 * Create user input from entire brainstorm idea
 */
export function createUserInputFromBrainstormIdea(
  sourceArtifactData: any,
  derivationPath: string
): UserInput {
  const ideaData = extractDataAtPath(sourceArtifactData, derivationPath) as BrainstormIdea;

  if (!ideaData || typeof ideaData.title !== 'string' || typeof ideaData.body !== 'string') {
    throw new Error(`Invalid brainstorm idea data at path ${derivationPath}`);
  }

  // For entire object editing, we store the full idea in the text field as JSON
  return {
    title: ideaData.title,
    body: ideaData.body
  };
}

/**
 * Create brainstorm idea from brainstorm idea (for editing)
 */
export function createBrainstormIdeaFromBrainstormIdea(
  sourceArtifactData: any,
  derivationPath: string
): BrainstormIdea {
  const ideaData = extractDataAtPath(sourceArtifactData, derivationPath) as BrainstormIdea;

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
 * Create user input from brainstorm idea field (title or body)
 */
export function createUserInputFromBrainstormField(
  sourceArtifactData: any,
  derivationPath: string
): UserInput {
  const fieldValue = extractDataAtPath(sourceArtifactData, derivationPath);

  if (typeof fieldValue !== 'string') {
    throw new Error(`Invalid field value at path ${derivationPath}`);
  }

  return {
    title: 'Field Edit',
    body: fieldValue
  };
}



// Define transform functions
export const createBrainstormIdeaTransform = (sourceArtifactId: string, targetPath: string) => {
  return {
    sourceArtifactId,
    targetPath,
    inputSchema: BrainstormIdeaSchema,
    outputSchema: UserInputSchema,
    transformType: 'human' as const
  };
};

export const createOutlineSettingsTransform = (sourceArtifactId: string) => {
  return {
    sourceArtifactId,
    targetPath: '$[outline_settings]',
    inputSchema: OutlineSettingsInputSchema,
    outputSchema: OutlineSettingsOutputSchema,
    transformType: 'llm' as const
  };
};

export const createChroniclesTransform = (sourceArtifactId: string) => {
  return {
    sourceArtifactId,
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
  sourceArtifactData: any,
  derivationPath: string
): BrainstormToolInput {
  // For new creation, provide default values
  // This function is called when creating a new brainstorm input artifact
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
  sourceArtifactData: any,
  derivationPath: string
): any {
  const outlineSettingsData = extractDataAtPath(sourceArtifactData, derivationPath);

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