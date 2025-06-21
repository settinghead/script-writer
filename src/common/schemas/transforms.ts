import { z } from 'zod';
import { ARTIFACT_SCHEMAS, ArtifactType } from './artifacts';

// Transform definition schema
export const HumanTransformDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  sourceArtifactType: z.string(),
  targetArtifactType: z.string(),
  pathPattern: z.string(), // Regex pattern for valid paths
  instantiationFunction: z.string()
});

export type HumanTransformDefinition = z.infer<typeof HumanTransformDefinitionSchema>;

// Transform registry
export const HUMAN_TRANSFORM_DEFINITIONS: Record<string, HumanTransformDefinition> = {
  'brainstorm_to_outline': {
    name: 'brainstorm_to_outline',
    description: 'Convert a brainstorm idea to outline input',
    sourceArtifactType: 'brainstorm_idea_collection',
    targetArtifactType: 'outline_input',
    pathPattern: '^\\[\\d+\\]$', // Matches [0], [1], etc.
    instantiationFunction: 'createOutlineInputFromBrainstormIdea'
  },
  'edit_brainstorm_idea': {
    name: 'edit_brainstorm_idea',
    description: 'Edit entire brainstorm idea object',
    sourceArtifactType: 'brainstorm_idea_collection', 
    targetArtifactType: 'brainstorm_idea',
    pathPattern: '^\\[\\d+\\]$', // Matches [0], [1], etc. - entire object
    instantiationFunction: 'createBrainstormIdeaFromBrainstormIdea'
  },
  'edit_brainstorm_idea_field': {
    name: 'edit_brainstorm_idea_field',
    description: 'Edit individual fields of brainstorm ideas',
    sourceArtifactType: 'brainstorm_idea_collection', 
    targetArtifactType: 'user_input',
    pathPattern: '^\\[\\d+\\]\\.(title|body)$', // Matches [0].title, [1].body, etc.
    instantiationFunction: 'createUserInputFromBrainstormField'
  }
};

// Validation function
export function validateTransformPath(transformName: string, path: string): boolean {
  const definition = HUMAN_TRANSFORM_DEFINITIONS[transformName];
  if (!definition) return false;
  
  const regex = new RegExp(definition.pathPattern);
  return regex.test(path);
} 