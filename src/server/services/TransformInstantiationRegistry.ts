import { HUMAN_TRANSFORM_DEFINITIONS } from '../../common/schemas/transforms';
import { 
  createOutlineInputFromBrainstormIdea,
  createUserInputFromBrainstormIdea,
  createBrainstormIdeaFromBrainstormIdea,
  createUserInputFromBrainstormField 
} from './transform-instantiations/brainstormTransforms';

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
    this.functions.set('createOutlineInputFromBrainstormIdea', createOutlineInputFromBrainstormIdea);
    this.functions.set('createUserInputFromBrainstormIdea', createUserInputFromBrainstormIdea);
    this.functions.set('createBrainstormIdeaFromBrainstormIdea', createBrainstormIdeaFromBrainstormIdea);
    this.functions.set('createUserInputFromBrainstormField', createUserInputFromBrainstormField);
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