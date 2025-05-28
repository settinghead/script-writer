import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import {
    Transform,
    TransformInput,
    TransformOutput,
    LLMPrompt,
    LLMTransform,
    HumanTransform
} from '../types/artifacts';

export class TransformRepository {
    constructor(private db: Knex) { }

    // Create a new transform
    async createTransform(
        userId: string,
        type: 'llm' | 'human',
        typeVersion: string = 'v1',
        status: string = 'completed',
        executionContext?: any
    ): Promise<Transform> {
        const id = uuidv4();
        const now = new Date().toISOString();

        const transformData = {
            id,
            user_id: userId,
            type,
            type_version: typeVersion,
            status,
            execution_context: JSON.stringify(executionContext),
            created_at: now
        };

        await this.db('transforms').insert(transformData);

        return {
            id,
            user_id: userId,
            type,
            type_version: typeVersion,
            status: status as any,
            execution_context: executionContext,
            created_at: now
        };
    }

    // Add input artifacts to a transform
    async addTransformInputs(
        transformId: string,
        artifacts: Array<{ artifactId: string; inputRole?: string }>
    ): Promise<void> {
        const inputData = artifacts.map(({ artifactId, inputRole }) => ({
            transform_id: transformId,
            artifact_id: artifactId,
            input_role: inputRole
        }));

        await this.db('transform_inputs').insert(inputData);
    }

    // Add output artifacts to a transform
    async addTransformOutputs(
        transformId: string,
        artifacts: Array<{ artifactId: string; outputRole?: string }>
    ): Promise<void> {
        const outputData = artifacts.map(({ artifactId, outputRole }) => ({
            transform_id: transformId,
            artifact_id: artifactId,
            output_role: outputRole
        }));

        await this.db('transform_outputs').insert(outputData);
    }

    // Add or Update LLM-specific data (Upsert)
    async addLLMTransform(llmTransform: LLMTransform): Promise<void> {
        const llmData = {
            transform_id: llmTransform.transform_id,
            model_name: llmTransform.model_name,
            model_parameters: JSON.stringify(llmTransform.model_parameters),
            raw_response: llmTransform.raw_response,
            token_usage: JSON.stringify(llmTransform.token_usage)
        };

        // Knex syntax for INSERT ... ON CONFLICT ... UPDATE for SQLite
        await this.db.raw(
            `INSERT INTO llm_transforms (transform_id, model_name, model_parameters, raw_response, token_usage)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(transform_id) DO UPDATE SET
                model_name = excluded.model_name,
                model_parameters = excluded.model_parameters,
                raw_response = excluded.raw_response,
                token_usage = excluded.token_usage`,
            [llmData.transform_id, llmData.model_name, llmData.model_parameters, llmData.raw_response, llmData.token_usage]
        );
    }

    // Add LLM prompts
    async addLLMPrompts(
        transformId: string,
        prompts: Array<{ promptText: string; promptRole?: string }>
    ): Promise<void> {
        const promptData = prompts.map(({ promptText, promptRole = 'primary' }) => ({
            id: uuidv4(),
            transform_id: transformId,
            prompt_text: promptText,
            prompt_role: promptRole
        }));

        await this.db('llm_prompts').insert(promptData);
    }

    // Add human-specific data
    async addHumanTransform(humanTransform: HumanTransform): Promise<void> {
        const humanData = {
            transform_id: humanTransform.transform_id,
            action_type: humanTransform.action_type,
            interface_context: JSON.stringify(humanTransform.interface_context),
            change_description: humanTransform.change_description
        };

        await this.db('human_transforms').insert(humanData);
    }

    // Get transform by ID with all related data
    async getTransform(transformId: string, userId?: string): Promise<any | null> {
        let query = this.db('transforms').where('id', transformId);

        if (userId) {
            query = query.where('user_id', userId);
        }

        const row = await query.first();

        if (!row) {
            return null;
        }

        const transform = {
            ...row,
            execution_context: row.execution_context ? JSON.parse(row.execution_context) : null
        };

        // Get inputs
        const inputs = await this.getTransformInputs(transformId);

        // Get outputs
        const outputs = await this.getTransformOutputs(transformId);

        // Get LLM data if applicable
        let llmData = null;
        if (transform.type === 'llm') {
            llmData = await this.getLLMTransformData(transformId);
        }

        // Get human data if applicable
        let humanData = null;
        if (transform.type === 'human') {
            humanData = await this.getHumanTransformData(transformId);
        }

        return {
            ...transform,
            inputs,
            outputs,
            llm_data: llmData,
            human_data: humanData
        };
    }

    // Get transform inputs
    async getTransformInputs(transformId: string): Promise<TransformInput[]> {
        const rows = await this.db('transform_inputs')
            .where('transform_id', transformId);

        return rows || [];
    }

    // Get transform outputs
    async getTransformOutputs(transformId: string): Promise<TransformOutput[]> {
        const rows = await this.db('transform_outputs')
            .where('transform_id', transformId);

        return rows || [];
    }

    // Get LLM transform data
    async getLLMTransformData(transformId: string): Promise<any | null> {
        // Get LLM transform metadata
        const row = await this.db('llm_transforms')
            .where('transform_id', transformId)
            .first();

        if (!row) {
            return null;
        }

        // Get prompts
        const prompts = await this.db('llm_prompts')
            .where('transform_id', transformId);

        return {
            ...row,
            model_parameters: row.model_parameters ? JSON.parse(row.model_parameters) : null,
            token_usage: row.token_usage ? JSON.parse(row.token_usage) : null,
            prompts: prompts || []
        };
    }

    // Get human transform data
    async getHumanTransformData(transformId: string): Promise<HumanTransform | null> {
        const row = await this.db('human_transforms')
            .where('transform_id', transformId)
            .first();

        if (!row) {
            return null;
        }

        return {
            ...row,
            interface_context: row.interface_context ? JSON.parse(row.interface_context) : null
        };
    }

    // Get transforms for a user
    async getUserTransforms(userId: string, limit?: number): Promise<Transform[]> {
        let query = this.db('transforms')
            .where('user_id', userId)
            .orderBy('created_at', 'desc');

        if (limit) {
            query = query.limit(limit);
        }

        const rows = await query;

        const transforms = rows.map(row => ({
            ...row,
            execution_context: row.execution_context ? JSON.parse(row.execution_context) : null
        }));

        return transforms;
    }

    // Update transform status
    async updateTransformStatus(transformId: string, status: string): Promise<void> {
        await this.db('transforms')
            .where('id', transformId)
            .update({ status });
    }

    // Update transform execution context
    async updateTransformExecutionContext(transformId: string, context: any): Promise<void> {
        await this.db('transforms')
            .where('id', transformId)
            .update({ execution_context: JSON.stringify(context) });
    }
} 