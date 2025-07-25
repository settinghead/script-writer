import { HUMAN_TRANSFORM_DEFINITIONS } from '../../common/schemas/transforms';
import {
  createUserInputFromBrainstormIdea,
  createBrainstormIdeaFromBrainstormIdea,
  createUserInputFromBrainstormField,
  createOutlineSettingsFromOutlineSettings,
  createChroniclesFromChronicles,
  createEpisodePlanningFromEpisodePlanning,
  createEpisodeSynopsisFromEpisodeSynopsis,
  createBrainstormToolInput
} from './transform-instantiations/brainstormTransforms';
import {
  createBrainstormIdeaFromPath,
  createFieldEditFromPath,
  createEditableJsondocCopy,
  createOutlineInputFromPath
} from './transform-instantiations/pathTransforms';

type InstantiationFunction = (
  sourceJsondocData: any,
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
    this.functions.set('createEditableJsondocCopy', createEditableJsondocCopy);
    this.functions.set('createOutlineInputFromPath', createOutlineInputFromPath);

    // LEGACY: Keep existing functions for backward compatibility
    this.functions.set('createUserInputFromBrainstormIdea', createUserInputFromBrainstormIdea);
    this.functions.set('createBrainstormIdeaFromBrainstormIdea', createBrainstormIdeaFromBrainstormIdea);
    this.functions.set('createUserInputFromBrainstormField', createUserInputFromBrainstormField);

    // NEW: Outline settings editing
    this.functions.set('createOutlineSettingsFromOutlineSettings', createOutlineSettingsFromOutlineSettings);

    // NEW: Chronicles editing
    this.functions.set('createChroniclesFromChronicles', createChroniclesFromChronicles);

    // NEW: Episode planning editing
    this.functions.set('createEpisodePlanningFromEpisodePlanning', createEpisodePlanningFromEpisodePlanning);

    // NEW: Episode synopsis editing
    this.functions.set('createEpisodeSynopsisFromEpisodeSynopsis', createEpisodeSynopsisFromEpisodeSynopsis);

    // NEW: Brainstorm tool input creation
    this.functions.set('createBrainstormToolInput', createBrainstormToolInput);


  }

  executeInstantiation(
    transformName: string,
    sourceJsondocData: any,
    derivationPath: string,
    sourceJsondocId: string
  ): any {
    const definition = HUMAN_TRANSFORM_DEFINITIONS[transformName];
    if (!definition) {
      throw new Error(`Transform definition not found: ${transformName}`);
    }

    const instantiationFn = this.functions.get(definition.instantiationFunction);
    if (!instantiationFn) {
      throw new Error(`Instantiation function not found: ${definition.instantiationFunction}`);
    }

    const result = instantiationFn(sourceJsondocData, derivationPath);

    // Add source jsondoc ID to metadata if applicable
    if (result.source_metadata) {
      result.source_metadata.source_jsondoc_id = sourceJsondocId;
    }

    return result;
  }
} 