import { HUMAN_TRANSFORM_DEFINITIONS } from '../../common/schemas/transforms';
import {
  createUserInputFromBrainstormIdea,
  createBrainstormIdeaFromBrainstormIdea,
  createUserInputFromBrainstormField,
  createOutlineSettingsFromOutlineSettings,
  createChroniclesFromChronicles,
  createBrainstormToolInput
} from './transform-instantiations/brainstormTransforms';
import {
  createBrainstormIdeaFromPath,
  createFieldEditFromPath,
  createOutlineInputFromPath
} from './transform-instantiations/pathTransforms';

type InstantiationFunction = (
  sourceJsonDocData: any,
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

    // NEW: Chronicles editing
    this.functions.set('createChroniclesFromChronicles', createChroniclesFromChronicles);

    // NEW: Brainstorm tool input creation
    this.functions.set('createBrainstormToolInput', createBrainstormToolInput);


  }

  executeInstantiation(
    transformName: string,
    sourceJsonDocData: any,
    derivationPath: string,
    sourceJsonDocId: string
  ): any {
    const definition = HUMAN_TRANSFORM_DEFINITIONS[transformName];
    if (!definition) {
      throw new Error(`Transform definition not found: ${transformName}`);
    }

    const instantiationFn = this.functions.get(definition.instantiationFunction);
    if (!instantiationFn) {
      throw new Error(`Instantiation function not found: ${definition.instantiationFunction}`);
    }

    const result = instantiationFn(sourceJsonDocData, derivationPath);

    // Add source jsonDoc ID to metadata if applicable
    if (result.source_metadata) {
      result.source_metadata.source_jsonDoc_id = sourceJsonDocId;
    }

    return result;
  }
} 