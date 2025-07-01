import { HUMAN_TRANSFORM_DEFINITIONS } from '../../common/schemas/transforms';
import {
  createUserInputFromBrainstormIdea,
  createBrainstormIdeaFromBrainstormIdea,
  createUserInputFromBrainstormField,
  createOutlineSettingsFromOutlineSettings
} from './transform-instantiations/brainstormTransforms';
import {
  createBrainstormIdeaFromPath,
  createFieldEditFromPath,
  createOutlineInputFromPath
} from './transform-instantiations/pathTransforms';

type InstantiationFunction = (
  sourceArtifactData: any,
  derivationPath: string
) => any;

export class TransformInstantiationRegistry {
  private functions: Map<string, InstantiationFunction> = new Map();

  constructor() {
    this.registerFunctions();
  }

  private registerFunctions() {
    // NEW: Path-based transform functions
    this.functions.set('createBrainstormIdeaFromPath', createBrainstormIdeaFromPath);
    this.functions.set('createFieldEditFromPath', createFieldEditFromPath);
    this.functions.set('createOutlineInputFromPath', createOutlineInputFromPath);

    // LEGACY: Keep existing functions for backward compatibility
    this.functions.set('createUserInputFromBrainstormIdea', createUserInputFromBrainstormIdea);
    this.functions.set('createBrainstormIdeaFromBrainstormIdea', createBrainstormIdeaFromBrainstormIdea);
    this.functions.set('createUserInputFromBrainstormField', createUserInputFromBrainstormField);

    // NEW: Outline settings editing
    this.functions.set('createOutlineSettingsFromOutlineSettings', createOutlineSettingsFromOutlineSettings);
  }

  executeInstantiation(
    transformName: string,
    sourceArtifactData: any,
    derivationPath: string,
    sourceArtifactId: string
  ): any {
    const definition = HUMAN_TRANSFORM_DEFINITIONS[transformName];
    if (!definition) {
      throw new Error(`Transform definition not found: ${transformName}`);
    }

    const instantiationFn = this.functions.get(definition.instantiationFunction);
    if (!instantiationFn) {
      throw new Error(`Instantiation function not found: ${definition.instantiationFunction}`);
    }

    const result = instantiationFn(sourceArtifactData, derivationPath);

    // Add source artifact ID to metadata if applicable
    if (result.source_metadata) {
      result.source_metadata.source_artifact_id = sourceArtifactId;
    }

    return result;
  }
} 