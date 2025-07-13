import { JsonDocRepository } from './JsonDocRepository';
import { TransformRepository } from './TransformRepository';
import { TransformInstantiationRegistry } from '../services/TransformInstantiationRegistry';
import {
  JsonDocSchemaRegistry,
} from '../../common/schemas/jsonDocs';
import { HUMAN_TRANSFORM_DEFINITIONS, validateTransformPath } from '../../common/schemas/transforms';

export class HumanTransformExecutor {
  private instantiationRegistry: TransformInstantiationRegistry;

  constructor(
    private jsonDocRepo: JsonDocRepository,
    private transformRepo: TransformRepository
  ) {
    this.instantiationRegistry = new TransformInstantiationRegistry();
  }


  private isCompatibleJsonDocType(jsonDocSchemaType: string | undefined, expectedSchemaType: string): boolean {
    // Check if legacy type maps to expected schema type
    return jsonDocSchemaType === expectedSchemaType;
  }

  /**
   * Execute a schema-validated human transform with race condition protection
   */
  async executeSchemaHumanTransform(
    transformName: string,
    sourceJsonDocId: string,
    derivationPath: string,
    projectId: string,
    fieldUpdates?: Record<string, any>
  ): Promise<{ transform: any; derivedJsonDoc: any; wasTransformed: boolean }> {

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
      sourceJsonDocId,
      derivationPath,
      projectId
    );

    if (existingTransform && existingTransform.derived_jsonDoc_id) {
      // Update existing derived jsonDoc
      return this.updateExistingDerivedJsonDoc(
        existingTransform,
        fieldUpdates || {},
        transformDef
      );
    }

    // 4. Create new derived jsonDoc with race condition protection
    return this.createNewDerivedJsonDocWithRetry(
      transformName,
      sourceJsonDocId,
      derivationPath,
      projectId,
      transformDef,
      fieldUpdates
    );
  }

  /**
   * Create new derived jsonDoc with retry logic for race conditions
   */
  private async createNewDerivedJsonDocWithRetry(
    transformName: string,
    sourceJsonDocId: string,
    derivationPath: string,
    projectId: string,
    transformDef: any,
    fieldUpdates?: Record<string, any>,
    retryCount: number = 0
  ): Promise<{ transform: any; derivedJsonDoc: any; wasTransformed: boolean }> {
    try {
      return await this.createNewDerivedJsonDoc(
        transformName,
        sourceJsonDocId,
        derivationPath,
        projectId,
        transformDef
      );
    } catch (error: any) {
      // Check if this is a unique constraint violation
      const isUniqueConstraintError =
        error.code === '23505' || // PostgreSQL unique violation
        (error.message && error.message.includes('unique_human_transform_per_jsonDoc_path')) ||
        (error.message && error.message.includes('duplicate key value violates unique constraint'));

      if (isUniqueConstraintError && retryCount < 3) {
        console.log(`Unique constraint violation detected, retrying... (attempt ${retryCount + 1})`);

        // Another process created the transform, try to find and update it
        await new Promise(resolve => setTimeout(resolve, 50 * (retryCount + 1))); // Exponential backoff

        const existingTransform = await this.transformRepo.findHumanTransform(
          sourceJsonDocId,
          derivationPath,
          projectId
        );

        if (existingTransform && existingTransform.derived_jsonDoc_id) {
          // Found the transform created by another process, update it
          return this.updateExistingDerivedJsonDoc(
            existingTransform,
            fieldUpdates || {},
            transformDef
          );
        } else {
          // Still not found, retry creation
          return this.createNewDerivedJsonDocWithRetry(
            transformName,
            sourceJsonDocId,
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

  private async updateExistingDerivedJsonDoc(
    existingTransform: any,
    fieldUpdates: Record<string, any>,
    transformDef: any
  ) {
    const currentJsonDoc = await this.jsonDocRepo.getJsonDoc(
      existingTransform.derived_jsonDoc_id
    );

    if (!currentJsonDoc) {
      throw new Error('Derived jsonDoc not found');
    }

    // Get current data and apply updates
    const currentData = currentJsonDoc.data; // Already parsed by JsonDocRepository

    // Use jsonDoc data directly (no special handling needed)

    const updatedData = { ...currentData, ...fieldUpdates };

    // Validate against the correct schema based on target type
    let validationResult;

    // Get the correct schema key from the registry
    const targetSchemaKey = transformDef.targetJsonDocType as keyof typeof JsonDocSchemaRegistry;
    const targetSchema = JsonDocSchemaRegistry[targetSchemaKey];

    if (!targetSchema) {
      throw new Error(`Schema not found for type: ${transformDef.targetJsonDocType}. Available schemas: ${Object.keys(JsonDocSchemaRegistry).join(', ')}`);
    }

    validationResult = targetSchema.safeParse(updatedData);

    if (!validationResult.success) {
      throw new Error(`Schema validation failed: ${validationResult.error.message}`);
    }

    // Update jsonDoc with validated data
    let finalData;
    const finalMetadata = currentJsonDoc.metadata || {};

    // Store the validated data directly (no special handling needed)
    finalData = validationResult.data;

    await this.jsonDocRepo.updateJsonDoc(
      existingTransform.derived_jsonDoc_id,
      finalData,
      finalMetadata
    );

    const updatedJsonDoc = await this.jsonDocRepo.getJsonDoc(
      existingTransform.derived_jsonDoc_id
    );

    return {
      transform: existingTransform.transform,
      derivedJsonDoc: updatedJsonDoc,
      wasTransformed: false
    };
  }

  private async createNewDerivedJsonDoc(
    transformName: string,
    sourceJsonDocId: string,
    derivationPath: string,
    projectId: string,
    transformDef: any
  ) {
    // 1. Get and validate source jsonDoc
    const sourceJsonDoc = await this.jsonDocRepo.getJsonDoc(sourceJsonDocId);
    if (!sourceJsonDoc) {
      throw new Error('Source jsonDoc not found');
    }

    // 2. Check jsonDoc type compatibility
    if (!this.isCompatibleJsonDocType(sourceJsonDoc.schema_type, transformDef.sourceJsonDocType)) {
      throw new Error(`Incompatible jsonDoc type. Expected: ${transformDef.sourceJsonDocType}, but jsonDoc has type: ${sourceJsonDoc.schema_type}${sourceJsonDoc.schema_type ? ` (schema_type: ${sourceJsonDoc.schema_type})` : ''}`);
    }

    // 3. Validate source jsonDoc data against schema
    const sourceSchema = JsonDocSchemaRegistry[transformDef.sourceJsonDocType as keyof typeof JsonDocSchemaRegistry];
    const sourceData = sourceJsonDoc.data; // Already parsed by JsonDocRepository
    const sourceValidation = sourceSchema.safeParse(sourceData);

    if (!sourceValidation.success) {
      throw new Error(`Source jsonDoc schema validation failed: ${sourceValidation.error.message}`);
    }

    // 2. Execute instantiation
    const initialData = this.instantiationRegistry.executeInstantiation(
      transformName,
      sourceValidation.data,
      derivationPath,
      sourceJsonDocId
    );

    // 3. Validate instantiated data
    const targetSchema = JsonDocSchemaRegistry[transformDef.targetJsonDocType as keyof typeof JsonDocSchemaRegistry];
    const targetValidation = targetSchema.safeParse(initialData);

    if (!targetValidation.success) {
      throw new Error(`Target jsonDoc schema validation failed: ${targetValidation.error.message}`);
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

    // 5. Create derived jsonDoc
    let jsonDocData = targetValidation.data;
    const jsonDocMetadata: any = {
      transform_name: transformName,
      source_jsonDoc_id: sourceJsonDocId,
      derivation_path: derivationPath
    };

    // Store the validated data directly
    jsonDocData = targetValidation.data;

    // Map schema type back to legacy type for createJsonDoc
    const legacyType = transformDef.targetJsonDocType;

    const derivedJsonDoc = await this.jsonDocRepo.createJsonDoc(
      projectId,
      legacyType,
      jsonDocData,
      'v1', // typeVersion
      jsonDocMetadata, // metadata
      'completed', // streamingStatus
      'user_input' // originType - human transform result
    );

    // 6. Link relationships
    await this.transformRepo.addTransformInputs(transform.id, [
      { jsonDocId: sourceJsonDocId, inputRole: 'source' }
    ], projectId);

    await this.transformRepo.addTransformOutputs(transform.id, [
      { jsonDocId: derivedJsonDoc.id, outputRole: 'derived' }
    ], projectId);

    // 7. Store human transform metadata
    await this.transformRepo.addHumanTransform({
      transform_id: transform.id,
      action_type: 'schema_transform',
      source_jsonDoc_id: sourceJsonDocId,
      derivation_path: derivationPath,
      derived_jsonDoc_id: derivedJsonDoc.id,
      transform_name: transformName,
      change_description: `Schema transform: ${transformName} at path ${derivationPath}`,
      project_id: projectId
    });

    return {
      transform,
      derivedJsonDoc,
      wasTransformed: true
    };
  }
} 