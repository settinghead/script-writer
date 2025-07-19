import { JsondocRepository } from './JsondocRepository';
import { TransformRepository } from './TransformRepository';
import { TransformInstantiationRegistry } from '../services/TransformInstantiationRegistry';
import {
  JsondocSchemaRegistry,
} from '../../common/schemas/jsondocs';
import { HUMAN_TRANSFORM_DEFINITIONS, validateTransformPath } from '../../common/schemas/transforms';

export class HumanTransformExecutor {
  private instantiationRegistry: TransformInstantiationRegistry;

  constructor(
    private jsondocRepo: JsondocRepository,
    private transformRepo: TransformRepository
  ) {
    this.instantiationRegistry = new TransformInstantiationRegistry();
  }


  private isCompatibleJsondocType(jsondocSchemaType: string | undefined, expectedSchemaType: string): boolean {
    // Handle undefined jsondoc schema type
    if (!jsondocSchemaType) {
      return false;
    }

    // Exact match - no wildcards allowed for deterministic transforms
    return jsondocSchemaType === expectedSchemaType;
  }

  /**
   * Execute a schema-validated human transform with race condition protection
   */
  async executeSchemaHumanTransform(
    transformName: string,
    sourceJsondocId: string,
    derivationPath: string,
    projectId: string,
    fieldUpdates?: Record<string, any>
  ): Promise<{ transform: any; derivedJsondoc: any; wasTransformed: boolean }> {

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
      sourceJsondocId,
      derivationPath,
      projectId
    );

    if (existingTransform && existingTransform.derived_jsondoc_id) {
      // Update existing derived jsondoc
      return this.updateExistingDerivedJsondoc(
        existingTransform,
        fieldUpdates || {},
        transformDef
      );
    }

    // 4. Create new derived jsondoc with race condition protection
    return this.createNewDerivedJsondocWithRetry(
      transformName,
      sourceJsondocId,
      derivationPath,
      projectId,
      transformDef,
      fieldUpdates
    );
  }

  /**
   * Create new derived jsondoc with retry logic for race conditions
   */
  private async createNewDerivedJsondocWithRetry(
    transformName: string,
    sourceJsondocId: string,
    derivationPath: string,
    projectId: string,
    transformDef: any,
    fieldUpdates?: Record<string, any>,
    retryCount: number = 0
  ): Promise<{ transform: any; derivedJsondoc: any; wasTransformed: boolean }> {
    try {
      return await this.createNewDerivedJsondoc(
        transformName,
        sourceJsondocId,
        derivationPath,
        projectId,
        transformDef
      );
    } catch (error: any) {
      // Check if this is a unique constraint violation
      const isUniqueConstraintError =
        error.code === '23505' || // PostgreSQL unique violation
        (error.message && error.message.includes('unique_human_transform_per_jsondoc_path')) ||
        (error.message && error.message.includes('duplicate key value violates unique constraint'));

      if (isUniqueConstraintError && retryCount < 3) {
        console.log(`Unique constraint violation detected, retrying... (attempt ${retryCount + 1})`);

        // Another process created the transform, try to find and update it
        await new Promise(resolve => setTimeout(resolve, 50 * (retryCount + 1))); // Exponential backoff

        const existingTransform = await this.transformRepo.findHumanTransform(
          sourceJsondocId,
          derivationPath,
          projectId
        );

        if (existingTransform && existingTransform.derived_jsondoc_id) {
          // Found the transform created by another process, update it
          return this.updateExistingDerivedJsondoc(
            existingTransform,
            fieldUpdates || {},
            transformDef
          );
        } else {
          // Still not found, retry creation
          return this.createNewDerivedJsondocWithRetry(
            transformName,
            sourceJsondocId,
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

  private async updateExistingDerivedJsondoc(
    existingTransform: any,
    fieldUpdates: Record<string, any>,
    transformDef: any
  ) {
    const currentJsondoc = await this.jsondocRepo.getJsondoc(
      existingTransform.derived_jsondoc_id
    );

    if (!currentJsondoc) {
      throw new Error('Derived jsondoc not found');
    }

    // Get current data and apply updates
    const currentData = currentJsondoc.data; // Already parsed by JsondocRepository

    // Use jsondoc data directly (no special handling needed)

    const updatedData = { ...currentData, ...fieldUpdates };

    // Validate against the correct schema based on target type
    let validationResult;

    // Get the correct schema key from the registry
    const targetSchemaKey = transformDef.targetJsondocType as keyof typeof JsondocSchemaRegistry;
    const targetSchema = JsondocSchemaRegistry[targetSchemaKey];

    if (!targetSchema) {
      throw new Error(`Schema not found for type: ${transformDef.targetJsondocType}. Available schemas: ${Object.keys(JsondocSchemaRegistry).join(', ')}`);
    }

    validationResult = targetSchema.safeParse(updatedData);

    if (!validationResult.success) {
      throw new Error(`Schema validation failed: ${validationResult.error.message}`);
    }

    // Update jsondoc with validated data
    let finalData;
    const finalMetadata = currentJsondoc.metadata || {};

    // Store the validated data directly (no special handling needed)
    finalData = validationResult.data;

    await this.jsondocRepo.updateJsondoc(
      existingTransform.derived_jsondoc_id,
      finalData,
      finalMetadata
    );

    const updatedJsondoc = await this.jsondocRepo.getJsondoc(
      existingTransform.derived_jsondoc_id
    );

    return {
      transform: existingTransform.transform,
      derivedJsondoc: updatedJsondoc,
      wasTransformed: false
    };
  }

  private async createNewDerivedJsondoc(
    transformName: string,
    sourceJsondocId: string,
    derivationPath: string,
    projectId: string,
    transformDef: any
  ) {
    // 1. Get and validate source jsondoc
    const sourceJsondoc = await this.jsondocRepo.getJsondoc(sourceJsondocId);
    if (!sourceJsondoc) {
      throw new Error('Source jsondoc not found');
    }

    // 2. Check jsondoc type compatibility
    if (!this.isCompatibleJsondocType(sourceJsondoc.schema_type, transformDef.sourceJsondocType)) {
      throw new Error(`Incompatible jsondoc type. Expected: ${transformDef.sourceJsondocType}, but jsondoc has type: ${sourceJsondoc.schema_type}${sourceJsondoc.schema_type ? ` (schema_type: ${sourceJsondoc.schema_type})` : ''}`);
    }

    // 3. Validate source jsondoc data against schema
    const sourceSchema = JsondocSchemaRegistry[transformDef.sourceJsondocType as keyof typeof JsondocSchemaRegistry];
    if (!sourceSchema) {
      throw new Error(`No schema found for type: ${transformDef.sourceJsondocType}`);
    }

    const sourceData = sourceJsondoc.data; // Already parsed by JsondocRepository
    const sourceValidation = sourceSchema.safeParse(sourceData);

    if (!sourceValidation.success) {
      throw new Error(`Source jsondoc schema validation failed: ${sourceValidation.error.message}`);
    }

    // 2. Execute instantiation
    const initialData = this.instantiationRegistry.executeInstantiation(
      transformName,
      sourceValidation.data,
      derivationPath,
      sourceJsondocId
    );

    // 3. Validate instantiated data
    const targetSchema = JsondocSchemaRegistry[transformDef.targetJsondocType as keyof typeof JsondocSchemaRegistry];
    const targetValidation = targetSchema.safeParse(initialData);

    if (!targetValidation.success) {
      throw new Error(`Target jsondoc schema validation failed: ${targetValidation.error.message}`);
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

    // 5. Create derived jsondoc
    let jsondocData = targetValidation.data;
    const jsondocMetadata: any = {
      transform_name: transformName,
      source_jsondoc_id: sourceJsondocId,
      derivation_path: derivationPath
    };

    // Store the validated data directly
    jsondocData = targetValidation.data;

    // Map schema type back to legacy type for createJsondoc
    const legacyType = transformDef.targetJsondocType;

    const derivedJsondoc = await this.jsondocRepo.createJsondoc(
      projectId,
      legacyType,
      jsondocData,
      'v1', // typeVersion
      jsondocMetadata, // metadata
      'completed', // streamingStatus
      'user_input' // originType - human transform result
    );

    // 6. Link relationships - special handling for patch jsondocs
    let transformInputs = [{ jsondocId: sourceJsondocId, inputRole: 'source' }];

    // Special case: If source is a json_patch jsondoc, also link the original jsondoc
    if (sourceJsondoc.schema_type === 'json_patch') {
      console.log('🔍 [HumanTransformExecutor] Detected patch jsondoc, finding original jsondoc...');

      // Find the original jsondoc that this patch was created from
      const patchCreatingOutputs = await this.jsondocRepo.getAllProjectTransformOutputsForLineage(projectId);
      console.log('🔍 [HumanTransformExecutor] All transform outputs:', patchCreatingOutputs.length);

      const patchCreatingOutput = patchCreatingOutputs.find((output: any) => output.jsondoc_id === sourceJsondocId);
      console.log('🔍 [HumanTransformExecutor] Patch creating output:', patchCreatingOutput);

      if (patchCreatingOutput) {
        const patchCreatingInputs = await this.jsondocRepo.getAllProjectTransformInputsForLineage(projectId);
        console.log('🔍 [HumanTransformExecutor] All transform inputs:', patchCreatingInputs.length);

        const relevantInputs = patchCreatingInputs.filter((input: any) =>
          input.transform_id === patchCreatingOutput.transform_id
        );
        console.log('🔍 [HumanTransformExecutor] Inputs for patch creating transform:', relevantInputs);

        // Find the source input (first jsondoc in the transform inputs)
        const originalInput = relevantInputs.find((input: any) =>
          input.input_role === 'source'
        );
        console.log('🔍 [HumanTransformExecutor] Original input found:', originalInput);

        if (originalInput) {
          const originalJsondoc = await this.jsondocRepo.getJsondoc(originalInput.jsondoc_id);
          console.log('🔍 [HumanTransformExecutor] Original jsondoc:', originalJsondoc?.id, 'type:', originalJsondoc?.schema_type);

          if (originalJsondoc) {
            console.log('🔍 [HumanTransformExecutor] Found original jsondoc:', originalInput.jsondoc_id, 'type:', originalJsondoc.schema_type);
            // Add the original jsondoc as an additional input
            transformInputs.push({ jsondocId: originalInput.jsondoc_id, inputRole: 'original' });
          }
        }
      } else {
        console.log('🔍 [HumanTransformExecutor] No patch creating output found for jsondoc:', sourceJsondocId);
      }
    }

    await this.transformRepo.addTransformInputs(transform.id, transformInputs, projectId);

    await this.transformRepo.addTransformOutputs(transform.id, [
      { jsondocId: derivedJsondoc.id, outputRole: 'derived' }
    ], projectId);

    // 7. Store human transform metadata
    await this.transformRepo.addHumanTransform({
      transform_id: transform.id,
      action_type: 'schema_transform',
      source_jsondoc_id: sourceJsondocId,
      derivation_path: derivationPath,
      derived_jsondoc_id: derivedJsondoc.id,
      transform_name: transformName,
      change_description: `Schema transform: ${transformName} at path ${derivationPath}`,
      project_id: projectId
    });

    return {
      transform,
      derivedJsondoc,
      wasTransformed: true
    };
  }
} 