import { BrainstormIdea, OutlineInput, UserInput } from '../../../common/schemas/artifacts';
import { extractDataAtPath } from '../../../common/utils/pathExtraction';

/**
 * Create outline input from entire brainstorm idea
 */
export function createOutlineInputFromBrainstormIdea(
  sourceArtifactData: any,
  derivationPath: string
): OutlineInput {
  const ideaData = extractDataAtPath(sourceArtifactData, derivationPath) as BrainstormIdea;
  
  if (!ideaData || typeof ideaData.title !== 'string' || typeof ideaData.body !== 'string') {
    throw new Error(`Invalid brainstorm idea data at path ${derivationPath}`);
  }

  return {
    content: ideaData.body,
    source_metadata: {
      original_idea_title: ideaData.title,
      original_idea_body: ideaData.body,
      derivation_path: derivationPath,
      source_artifact_id: '' // Will be filled by executor
    }
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
    text: fieldValue,
    source: 'modified_brainstorm'
  };
} 