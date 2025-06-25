import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { TransformInstantiationRegistry } from './TransformInstantiationRegistry';
import {
  ARTIFACT_SCHEMAS,
  BrainstormIdeaSchema
} from '../../common/schemas/artifacts';
import { HUMAN_TRANSFORM_DEFINITIONS, validateTransformPath } from '../../common/schemas/transforms';

export class HumanTransformExecutor {
  private instantiationRegistry: TransformInstantiationRegistry;

  constructor(
    private artifactRepo: ArtifactRepository,
    private transformRepo: TransformRepository
  ) {
    this.instantiationRegistry = new TransformInstantiationRegistry();
  }

  /**
   * Execute a schema-validated human transform with race condition protection
   */
  async executeSchemaHumanTransform(
    transformName: string,
    sourceArtifactId: string,
    derivationPath: string,
    projectId: string,
    fieldUpdates?: Record<string, any>
  ): Promise<{ transform: any; derivedArtifact: any; wasTransformed: boolean }> {

    // 1. Validate transform definition
    const transformDef = HUMAN_TRANSFORM_DEFINITIONS[transformName];
    if (!transformDef) {
      throw new Error(`Transform definition not found: ${transformName}`);
    }

    // 2. Validate path pattern
    if (!validateTransformPath(transformName, derivationPath)) {
      throw new Error(`Invalid path '${derivationPath}' for transform '${transformName}'`);
    }

    // 3. Check for existing transform
    const existingTransform = await this.transformRepo.findHumanTransform(
      sourceArtifactId,
      derivationPath,
      projectId
    );

    if (existingTransform && existingTransform.derived_artifact_id) {
      // Update existing derived artifact
      return this.updateExistingDerivedArtifact(
        existingTransform,
        fieldUpdates || {},
        transformDef
      );
    }

    // 4. Create new derived artifact with race condition protection
    return this.createNewDerivedArtifactWithRetry(
      transformName,
      sourceArtifactId,
      derivationPath,
      projectId,
      transformDef,
      fieldUpdates
    );
  }

  /**
   * Create new derived artifact with retry logic for race conditions
   */
  private async createNewDerivedArtifactWithRetry(
    transformName: string,
    sourceArtifactId: string,
    derivationPath: string,
    projectId: string,
    transformDef: any,
    fieldUpdates?: Record<string, any>,
    retryCount: number = 0
  ): Promise<{ transform: any; derivedArtifact: any; wasTransformed: boolean }> {
    try {
      return await this.createNewDerivedArtifact(
        transformName,
        sourceArtifactId,
        derivationPath,
        projectId,
        transformDef
      );
    } catch (error: any) {
      // Check if this is a unique constraint violation
      const isUniqueConstraintError =
        error.code === '23505' || // PostgreSQL unique violation
        (error.message && error.message.includes('unique_human_transform_per_artifact_path')) ||
        (error.message && error.message.includes('duplicate key value violates unique constraint'));

      if (isUniqueConstraintError && retryCount < 3) {
        console.log(`Unique constraint violation detected, retrying... (attempt ${retryCount + 1})`);

        // Another process created the transform, try to find and update it
        await new Promise(resolve => setTimeout(resolve, 50 * (retryCount + 1))); // Exponential backoff

        const existingTransform = await this.transformRepo.findHumanTransform(
          sourceArtifactId,
          derivationPath,
          projectId
        );

        if (existingTransform && existingTransform.derived_artifact_id) {
          // Found the transform created by another process, update it
          return this.updateExistingDerivedArtifact(
            existingTransform,
            fieldUpdates || {},
            transformDef
          );
        } else {
          // Still not found, retry creation
          return this.createNewDerivedArtifactWithRetry(
            transformName,
            sourceArtifactId,
            derivationPath,
            projectId,
            transformDef,
            fieldUpdates,
            retryCount + 1
          );
        }
      }

      // Re-throw if not a unique constraint error or max retries exceeded
      throw error;
    }
  }

  private async updateExistingDerivedArtifact(
    existingTransform: any,
    fieldUpdates: Record<string, any>,
    transformDef: any
  ) {
    const currentArtifact = await this.artifactRepo.getArtifact(
      existingTransform.derived_artifact_id
    );

    if (!currentArtifact) {
      throw new Error('Derived artifact not found');
    }

    // Get current data and apply updates
    let currentData = currentArtifact.data; // Already parsed by ArtifactRepository

    // Handle user_input artifacts with derived data
    if (currentArtifact.type === 'user_input') {
      // First try to get derived_data from metadata
      if (currentArtifact.metadata && currentArtifact.metadata.derived_data) {
        currentData = currentArtifact.metadata.derived_data;
      } else if (currentArtifact.data && currentArtifact.data.text) {
        // Fallback: try to parse JSON from text field
        try {
          currentData = JSON.parse(currentArtifact.data.text);
        } catch (e) {
          // If not JSON, treat as plain text
          currentData = { text: currentArtifact.data.text };
        }
      }
    }
    // For brainstorm_idea artifacts, use data directly
    // (currentData is already set above)

    const updatedData = { ...currentData, ...fieldUpdates };

    // Validate against the correct schema based on target type
    let validationResult;
    if (transformDef.targetArtifactType === 'user_input') {

      const targetSchema = ARTIFACT_SCHEMAS[transformDef.targetArtifactType as keyof typeof ARTIFACT_SCHEMAS];
      validationResult = targetSchema.safeParse(updatedData);
    } else {
      // For direct artifact types (like brainstorm_idea), validate against target schema
      const targetSchema = ARTIFACT_SCHEMAS[transformDef.targetArtifactType as keyof typeof ARTIFACT_SCHEMAS];
      validationResult = targetSchema.safeParse(updatedData);
    }

    if (!validationResult.success) {
      throw new Error(`Schema validation failed: ${validationResult.error.message}`);
    }

    // Update artifact with validated data
    let finalData;
    let finalMetadata = currentArtifact.metadata || {};

    // Special handling for user_input artifacts
    if (transformDef.targetArtifactType === 'user_input') {
      // Store the actual validated data in metadata
      finalMetadata = {
        ...finalMetadata,
        derived_data: validationResult.data
      };

      // Store as JSON string in the text field for user_input format
      finalData = {
        text: JSON.stringify(validationResult.data),
        source: 'modified_brainstorm'
      };
    } else {
      // For direct artifact types, store the validated data directly
      finalData = validationResult.data;
    }

    await this.artifactRepo.updateArtifact(
      existingTransform.derived_artifact_id,
      finalData,
      finalMetadata
    );

    const updatedArtifact = await this.artifactRepo.getArtifact(
      existingTransform.derived_artifact_id
    );

    return {
      transform: existingTransform.transform,
      derivedArtifact: updatedArtifact,
      wasTransformed: false
    };
  }

  private async createNewDerivedArtifact(
    transformName: string,
    sourceArtifactId: string,
    derivationPath: string,
    projectId: string,
    transformDef: any
  ) {
    // 1. Get and validate source artifact
    const sourceArtifact = await this.artifactRepo.getArtifact(sourceArtifactId);
    if (!sourceArtifact) {
      throw new Error('Source artifact not found');
    }

    const sourceSchema = ARTIFACT_SCHEMAS[transformDef.sourceArtifactType as keyof typeof ARTIFACT_SCHEMAS];
    const sourceData = sourceArtifact.data; // Already parsed by ArtifactRepository
    const sourceValidation = sourceSchema.safeParse(sourceData);

    if (!sourceValidation.success) {
      throw new Error(`Source artifact schema validation failed: ${sourceValidation.error.message}`);
    }

    // 2. Execute instantiation
    const initialData = this.instantiationRegistry.executeInstantiation(
      transformName,
      sourceValidation.data,
      derivationPath,
      sourceArtifactId
    );

    // 3. Validate instantiated data
    const targetSchema = ARTIFACT_SCHEMAS[transformDef.targetArtifactType as keyof typeof ARTIFACT_SCHEMAS];
    const targetValidation = targetSchema.safeParse(initialData);

    if (!targetValidation.success) {
      throw new Error(`Target artifact schema validation failed: ${targetValidation.error.message}`);
    }

    // 4. Create transform
    const transform = await this.transformRepo.createTransform(
      projectId,
      'human',
      'v1',
      'completed',
      {
        transform_name: transformName,
        derivation_path: derivationPath,
        timestamp: new Date().toISOString()
      }
    );

    // 5. Create derived artifact
    let artifactData = targetValidation.data;
    let artifactMetadata: any = {
      transform_name: transformName,
      source_artifact_id: sourceArtifactId,
      derivation_path: derivationPath
    };

    // Special handling for user_input artifacts
    if (transformDef.targetArtifactType === 'user_input') {
      artifactMetadata.derived_data = targetValidation.data;
      artifactData = {
        text: JSON.stringify(targetValidation.data),
        source: 'modified_brainstorm'
      };
    }

    const derivedArtifact = await this.artifactRepo.createArtifact(
      projectId,
      transformDef.targetArtifactType,
      artifactData,
      'v1',
      artifactMetadata
    );

    // 6. Link relationships
    await this.transformRepo.addTransformInputs(transform.id, [
      { artifactId: sourceArtifactId, inputRole: 'source' }
    ], projectId);

    await this.transformRepo.addTransformOutputs(transform.id, [
      { artifactId: derivedArtifact.id, outputRole: 'derived' }
    ], projectId);

    // 7. Store human transform metadata
    await this.transformRepo.addHumanTransform({
      transform_id: transform.id,
      action_type: 'schema_transform',
      source_artifact_id: sourceArtifactId,
      derivation_path: derivationPath,
      derived_artifact_id: derivedArtifact.id,
      transform_name: transformName,
      change_description: `Schema transform: ${transformName} at path ${derivationPath}`,
      project_id: projectId
    });

    return {
      transform,
      derivedArtifact,
      wasTransformed: true
    };
  }
} 