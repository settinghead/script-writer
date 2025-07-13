import { Kysely, sql } from 'kysely';
import { v4 as uuidv4 } from 'uuid';
import {
    Transform,
    TransformInput,
    TransformOutput,
    LLMPrompt,
    LLMTransform,
    HumanTransform
} from '../../common/jsondocs';
import type { DB } from '../database/types';

export class TransformRepository {
    constructor(private db: Kysely<DB>) { }

    // Create a new transform
    async createTransform(
        projectId: string,
        type: 'llm' | 'human',
        typeVersion: string = 'v1',
        status: string = 'running',
        executionContext?: any
    ): Promise<Transform> {
        const id = uuidv4();
        const now = new Date();

        const transformData = {
            id,
            project_id: projectId,
            type,
            type_version: typeVersion,
            status,
            retry_count: 0,
            max_retries: executionContext?.max_retries || 2,
            execution_context: executionContext ? JSON.stringify(executionContext) : null,
            created_at: now,
            updated_at: now
        };

        await this.db
            .insertInto('transforms')
            .values(transformData)
            .execute();

        return {
            id,
            project_id: projectId,
            type,
            type_version: typeVersion,
            status: status as any,
            retry_count: 0,
            max_retries: executionContext?.max_retries || 2,
            execution_context: executionContext,
            created_at: now.toISOString()
        };
    }

    // Add input jsondocs to a transform
    async addTransformInputs(
        transformId: string,
        jsondocs: Array<{
            jsondocId: string;
            inputRole?: string;
            jsondocPath?: string; // NEW: Support JSONPath parameter
        }>,
        projectId: string
    ): Promise<void> {
        const inputData = jsondocs.map(({ jsondocId, inputRole, jsondocPath }) => ({
            transform_id: transformId,
            jsondoc_id: jsondocId,
            input_role: inputRole || null,
            jsondoc_path: jsondocPath || '$', // NEW: Store JSONPath, '$' = root object
            project_id: projectId
        }));

        await this.db
            .insertInto('transform_inputs')
            .values(inputData)
            .execute();
    }

    // Add output jsondocs to a transform
    async addTransformOutputs(
        transformId: string,
        jsondocs: Array<{ jsondocId: string; outputRole?: string }>,
        projectId: string
    ): Promise<void> {
        const outputData = jsondocs.map(({ jsondocId, outputRole }) => ({
            transform_id: transformId,
            jsondoc_id: jsondocId,
            output_role: outputRole || null,
            project_id: projectId
        }));

        await this.db
            .insertInto('transform_outputs')
            .values(outputData)
            .execute();
    }

    // Add LLM-specific data
    async addLLMTransform(llmTransform: LLMTransform & { project_id: string }): Promise<void> {
        const llmData = {
            transform_id: llmTransform.transform_id,
            model_name: llmTransform.model_name,
            model_parameters: llmTransform.model_parameters ? JSON.stringify(llmTransform.model_parameters) : null,
            raw_response: llmTransform.raw_response || null,
            token_usage: llmTransform.token_usage ? JSON.stringify(llmTransform.token_usage) : null,
            project_id: llmTransform.project_id
        };

        await this.db
            .insertInto('llm_transforms')
            .values(llmData)
            .execute();
    }

    // Add LLM prompts
    async addLLMPrompts(
        transformId: string,
        prompts: Array<{ promptText: string; promptRole?: string }>,
        projectId: string
    ): Promise<void> {
        const promptData = prompts.map(({ promptText, promptRole = 'primary' }) => ({
            id: uuidv4(),
            transform_id: transformId,
            prompt_text: promptText,
            prompt_role: promptRole,
            project_id: projectId
        }));

        await this.db
            .insertInto('llm_prompts')
            .values(promptData)
            .execute();
    }

    // Add human-specific data with path-based derivation support
    async addHumanTransform(humanTransform: HumanTransform & {
        source_jsondoc_id?: string;
        derivation_path?: string;
        derived_jsondoc_id?: string;
        transform_name?: string;
        project_id: string;
    }): Promise<void> {
        const humanData = {
            transform_id: humanTransform.transform_id,
            action_type: humanTransform.action_type,
            interface_context: humanTransform.interface_context ? JSON.stringify(humanTransform.interface_context) : null,
            change_description: humanTransform.change_description || null,
            source_jsondoc_id: humanTransform.source_jsondoc_id || null,
            derivation_path: humanTransform.derivation_path || '',
            derived_jsondoc_id: humanTransform.derived_jsondoc_id || null,
            transform_name: humanTransform.transform_name || null,
            project_id: humanTransform.project_id
        };

        await this.db
            .insertInto('human_transforms')
            .values(humanData)
            .execute();
    }

    // Get transforms that produced a specific jsondoc (for graph traversal)
    async getTransformsByOutput(jsondocId: string): Promise<Transform[]> {
        const rows = await this.db
            .selectFrom('transforms as t')
            .innerJoin('transform_outputs as to', 'to.transform_id', 't.id')
            .selectAll('t')
            .where('to.jsondoc_id', '=', jsondocId)
            .execute();

        return rows.map(this.mapTransformRow);
    }

    // Get transforms that used a specific jsondoc as input (for graph traversal)
    async getTransformsByInput(jsondocId: string): Promise<Transform[]> {
        const rows = await this.db
            .selectFrom('transforms as t')
            .innerJoin('transform_inputs as ti', 'ti.transform_id', 't.id')
            .selectAll('t')
            .where('ti.jsondoc_id', '=', jsondocId)
            .execute();

        return rows.map(this.mapTransformRow);
    }

    // Check if an jsondoc was generated by an LLM transform
    async isJsondocLLMGenerated(jsondocId: string): Promise<boolean> {
        const result = await this.db
            .selectFrom('transform_outputs as to')
            .innerJoin('transforms as t', 't.id', 'to.transform_id')
            .select('t.type')
            .where('to.jsondoc_id', '=', jsondocId)
            .where('t.type', '=', 'llm')
            .limit(1)
            .execute();

        return result.length > 0;
    }

    private mapTransformRow(row: any): Transform {
        return {
            id: row.id,
            project_id: row.project_id,
            type: row.type,
            type_version: row.type_version,
            status: row.status,
            retry_count: row.retry_count || 0,
            max_retries: row.max_retries || 2,
            execution_context: row.execution_context ? JSON.parse(row.execution_context) : undefined,
            created_at: row.created_at?.toISOString() || new Date().toISOString()
        };
    }

    // Find existing human transform by source jsondoc and path
    async findHumanTransform(
        sourceJsondocId: string,
        derivationPath: string = '',
        projectId: string
    ): Promise<any | null> {
        const result = await this.db
            .selectFrom('human_transforms as ht')
            .innerJoin('transforms as t', 't.id', 'ht.transform_id')
            .selectAll(['ht', 't'])
            .where('ht.source_jsondoc_id', '=', sourceJsondocId)
            .where('ht.derivation_path', '=', derivationPath)
            .where('t.project_id', '=', projectId)
            .executeTakeFirst();

        if (!result) return null;

        return {
            transform_id: result.transform_id,
            action_type: result.action_type,
            interface_context: result.interface_context ? JSON.parse(result.interface_context) : null,
            change_description: result.change_description,
            source_jsondoc_id: result.source_jsondoc_id,
            derivation_path: result.derivation_path,
            derived_jsondoc_id: result.derived_jsondoc_id,
            transform: {
                id: result.id,
                project_id: result.project_id,
                type: result.type,
                status: result.status,
                created_at: result.created_at?.toISOString(),
                updated_at: result.updated_at?.toISOString()
            }
        };
    }

    // Get transform by ID with all related data
    async getTransform(transformId: string, projectId?: string): Promise<any | null> {
        let query = this.db
            .selectFrom('transforms')
            .selectAll()
            .where('id', '=', transformId);

        if (projectId) {
            query = query.where('project_id', '=', projectId);
        }

        const row = await query.executeTakeFirst();

        if (!row) {
            return null;
        }

        const transform = {
            id: row.id,
            project_id: row.project_id,
            type: row.type,
            type_version: row.type_version,
            status: row.status,
            retry_count: row.retry_count,
            max_retries: row.max_retries,
            progress_percentage: row.progress_percentage ? Number(row.progress_percentage) : null,
            error_message: row.error_message,
            streaming_status: row.streaming_status,
            execution_context: row.execution_context ? JSON.parse(row.execution_context) : null,
            created_at: row.created_at?.toISOString() || new Date().toISOString(),
            updated_at: row.updated_at?.toISOString() || new Date().toISOString()
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

    // Get transform inputs (already exists but ensuring it's properly typed)
    async getTransformInputs(transformId: string): Promise<TransformInput[]> {
        const rows = await this.db
            .selectFrom('transform_inputs')
            .selectAll()
            .where('transform_id', '=', transformId)
            .execute();

        return rows.map(row => ({
            id: row.id,
            transform_id: row.transform_id,
            jsondoc_id: row.jsondoc_id,
            input_role: row.input_role || undefined
        }));
    }

    // Get transform outputs
    async getTransformOutputs(transformId: string): Promise<TransformOutput[]> {
        const rows = await this.db
            .selectFrom('transform_outputs')
            .selectAll()
            .where('transform_id', '=', transformId)
            .execute();

        return rows.map(row => ({
            id: row.id,
            transform_id: row.transform_id,
            jsondoc_id: row.jsondoc_id,
            output_role: row.output_role || undefined
        }));
    }

    // Get LLM transform data
    async getLLMTransformData(transformId: string): Promise<any | null> {
        // Get LLM transform metadata
        const row = await this.db
            .selectFrom('llm_transforms')
            .selectAll()
            .where('transform_id', '=', transformId)
            .executeTakeFirst();

        if (!row) {
            return null;
        }

        // Get prompts
        const prompts = await this.db
            .selectFrom('llm_prompts')
            .selectAll()
            .where('transform_id', '=', transformId)
            .execute();

        return {
            transform_id: row.transform_id,
            model_name: row.model_name,
            model_parameters: row.model_parameters ? JSON.parse(row.model_parameters) : null,
            raw_response: row.raw_response,
            token_usage: row.token_usage ? JSON.parse(row.token_usage) : null,
            prompts: prompts.map(p => ({
                id: p.id,
                transform_id: p.transform_id,
                prompt_text: p.prompt_text,
                prompt_role: p.prompt_role
            }))
        };
    }

    // Get human transform data
    async getHumanTransformData(transformId: string): Promise<HumanTransform | null> {
        const row = await this.db
            .selectFrom('human_transforms')
            .selectAll()
            .where('transform_id', '=', transformId)
            .executeTakeFirst();

        if (!row) {
            return null;
        }

        return {
            transform_id: row.transform_id,
            action_type: row.action_type,
            interface_context: row.interface_context ? JSON.parse(row.interface_context) : null,
            change_description: row.change_description || undefined
        };
    }

    // Get all transforms for a project
    async getProjectTransforms(projectId: string, limit: number = 50): Promise<Transform[]> {
        const rows = await this.db
            .selectFrom('transforms')
            .selectAll()
            .where('project_id', '=', projectId)
            .orderBy('created_at', 'desc')
            .limit(limit)
            .execute();

        return rows.map(row => ({
            id: row.id,
            project_id: row.project_id,
            type: row.type as 'llm' | 'human',
            type_version: row.type_version,
            status: row.status as any,
            retry_count: row.retry_count || 0,
            max_retries: row.max_retries || 2,
            progress_percentage: row.progress_percentage ? Number(row.progress_percentage) : null,
            error_message: row.error_message,
            streaming_status: row.streaming_status,
            execution_context: row.execution_context ? JSON.parse(row.execution_context) : null,
            created_at: row.created_at?.toISOString() || new Date().toISOString(),
            updated_at: row.updated_at?.toISOString() || new Date().toISOString()
        }));
    }

    // Get transforms for a user across all their projects
    async getUserTransforms(userId: string): Promise<Transform[]> {
        const rows = await this.db
            .selectFrom('transforms')
            .innerJoin('projects_users', 'transforms.project_id', 'projects_users.project_id')
            .select(['transforms.id', 'transforms.project_id', 'transforms.type', 'transforms.type_version', 'transforms.status', 'transforms.retry_count', 'transforms.max_retries', 'transforms.progress_percentage', 'transforms.error_message', 'transforms.streaming_status', 'transforms.execution_context', 'transforms.created_at', 'transforms.updated_at'])
            .where('projects_users.user_id', '=', userId)
            .orderBy('transforms.created_at', 'desc')
            .execute();

        return rows.map(row => ({
            id: row.id,
            project_id: row.project_id,
            type: row.type as 'llm' | 'human',
            type_version: row.type_version,
            status: row.status as any,
            retry_count: row.retry_count || 0,
            max_retries: row.max_retries || 2,
            progress_percentage: row.progress_percentage ? Number(row.progress_percentage) : null,
            error_message: row.error_message,
            streaming_status: row.streaming_status,
            execution_context: row.execution_context ? JSON.parse(row.execution_context) : null,
            created_at: row.created_at?.toISOString() || new Date().toISOString(),
            updated_at: row.updated_at?.toISOString() || new Date().toISOString()
        }));
    }

    // Update transform status
    async updateTransformStatus(transformId: string, status: string): Promise<void> {
        await this.db
            .updateTable('transforms')
            .set({
                status,
                updated_at: new Date()
            })
            .where('id', '=', transformId)
            .execute();
    }

    // Update transform with arbitrary fields
    async updateTransform(transformId: string, updates: any): Promise<void> {
        const updateData = {
            ...updates,
            updated_at: new Date()
        };

        // Serialize execution_context if it exists
        if (updateData.execution_context && typeof updateData.execution_context === 'object') {
            updateData.execution_context = JSON.stringify(updateData.execution_context);
        }

        await this.db
            .updateTable('transforms')
            .set(updateData)
            .where('id', '=', transformId)
            .execute();
    }

    // Update transform streaming status and progress
    async updateTransformStreamingStatus(
        transformId: string,
        streamingStatus: string,
        progress?: number
    ): Promise<void> {
        const updateData: any = {
            streaming_status: streamingStatus,
            updated_at: new Date()
        };

        if (progress !== undefined) {
            updateData.progress_percentage = progress.toString();
        }

        await this.db
            .updateTable('transforms')
            .set(updateData)
            .where('id', '=', transformId)
            .execute();
    }

    // Get active transform for a specific ideation run
    async getActiveTransformForRun(projectId: string, ideationRunId: string): Promise<Transform | null> {
        const row = await this.db
            .selectFrom('transforms as t')
            .innerJoin('transform_inputs as ti', 't.id', 'ti.transform_id')
            .innerJoin('jsondocs as a', 'ti.jsondoc_id', 'a.id')
            .select(['t.id', 't.project_id', 't.type', 't.type_version', 't.status', 't.retry_count', 't.max_retries', 't.progress_percentage', 't.error_message', 't.streaming_status', 't.execution_context', 't.created_at', 't.updated_at'])
            .where('t.project_id', '=', projectId)
            .where('t.status', 'in', ['running', 'pending'])
            .where((eb) =>
                eb.or([
                    eb(sql`a.data->>'id'`, '=', ideationRunId),
                    eb(sql`a.data->>'ideation_session_id'`, '=', ideationRunId)
                ])
            )
            .orderBy('t.created_at', 'desc')
            .executeTakeFirst();

        if (!row) {
            return null;
        }

        return {
            id: row.id,
            project_id: row.project_id,
            type: row.type as 'llm' | 'human',
            type_version: row.type_version,
            status: row.status as any,
            retry_count: row.retry_count || 0,
            max_retries: row.max_retries || 2,
            execution_context: row.execution_context ? JSON.parse(row.execution_context) : null,
            created_at: row.created_at?.toISOString() || new Date().toISOString()
        };
    }

    // Get transforms by ideation run
    async getTransformsByIdeationRun(projectId: string, ideationRunId: string): Promise<Transform[]> {
        const rows = await this.db
            .selectFrom('transforms as t')
            .innerJoin('transform_inputs as ti', 't.id', 'ti.transform_id')
            .innerJoin('jsondocs as a', 'ti.jsondoc_id', 'a.id')
            .select(['t.id', 't.project_id', 't.type', 't.type_version', 't.status', 't.retry_count', 't.max_retries', 't.progress_percentage', 't.error_message', 't.streaming_status', 't.execution_context', 't.created_at', 't.updated_at'])
            .where('t.project_id', '=', projectId)
            .where((eb) =>
                eb.or([
                    eb(sql`a.data->>'id'`, '=', ideationRunId),
                    eb(sql`a.data->>'ideation_session_id'`, '=', ideationRunId)
                ])
            )
            .orderBy('t.created_at', 'desc')
            .execute();

        return rows.map(row => ({
            id: row.id,
            project_id: row.project_id,
            type: row.type as 'llm' | 'human',
            type_version: row.type_version,
            status: row.status as any,
            retry_count: row.retry_count || 0,
            max_retries: row.max_retries || 2,
            progress_percentage: row.progress_percentage ? Number(row.progress_percentage) : null,
            error_message: row.error_message,
            streaming_status: row.streaming_status,
            execution_context: row.execution_context ? JSON.parse(row.execution_context) : null,
            created_at: row.created_at?.toISOString() || new Date().toISOString(),
            updated_at: row.updated_at?.toISOString() || new Date().toISOString()
        }));
    }

    // Get transforms by outline session
    async getTransformsByOutlineSession(projectId: string, outlineSessionId: string): Promise<Transform[]> {
        const rows = await this.db
            .selectFrom('transforms as t')
            .innerJoin('transform_inputs as ti', 't.id', 'ti.transform_id')
            .innerJoin('jsondocs as a', 'ti.jsondoc_id', 'a.id')
            .select(['t.id', 't.project_id', 't.type', 't.type_version', 't.status', 't.retry_count', 't.max_retries', 't.progress_percentage', 't.error_message', 't.streaming_status', 't.execution_context', 't.created_at', 't.updated_at'])
            .where('t.project_id', '=', projectId)
            .where((eb) =>
                eb.or([
                    eb(sql`a.data->>'id'`, '=', outlineSessionId),
                    eb(sql`a.data->>'outline_session_id'`, '=', outlineSessionId)
                ])
            )
            .orderBy('t.created_at', 'desc')
            .execute();

        return rows.map(row => ({
            id: row.id,
            project_id: row.project_id,
            type: row.type as 'llm' | 'human',
            type_version: row.type_version,
            status: row.status as any,
            retry_count: row.retry_count || 0,
            max_retries: row.max_retries || 2,
            progress_percentage: row.progress_percentage ? Number(row.progress_percentage) : null,
            error_message: row.error_message,
            streaming_status: row.streaming_status,
            execution_context: row.execution_context ? JSON.parse(row.execution_context) : null,
            created_at: row.created_at?.toISOString() || new Date().toISOString(),
            updated_at: row.updated_at?.toISOString() || new Date().toISOString()
        }));
    }

    // DELETION METHODS

    // Get transform inputs by jsondoc ID (for validation)
    async getTransformInputsByJsondoc(jsondocId: string): Promise<TransformInput[]> {
        const rows = await this.db
            .selectFrom('transform_inputs')
            .selectAll()
            .where('jsondoc_id', '=', jsondocId)
            .execute();

        return rows.map(row => ({
            id: row.id,
            transform_id: row.transform_id,
            jsondoc_id: row.jsondoc_id,
            input_role: row.input_role || undefined
        }));
    }

    // Delete transform inputs
    async deleteTransformInputs(transformId: string): Promise<void> {
        await this.db
            .deleteFrom('transform_inputs')
            .where('transform_id', '=', transformId)
            .execute();
    }

    // Delete transform outputs
    async deleteTransformOutputs(transformId: string): Promise<void> {
        await this.db
            .deleteFrom('transform_outputs')
            .where('transform_id', '=', transformId)
            .execute();
    }

    // Delete transform outputs by jsondoc ID
    async deleteTransformOutputsByJsondoc(jsondocId: string): Promise<void> {
        await this.db
            .deleteFrom('transform_outputs')
            .where('jsondoc_id', '=', jsondocId)
            .execute();
    }

    // Delete human transform by transform ID
    async deleteHumanTransformByTransformId(transformId: string): Promise<void> {
        await this.db
            .deleteFrom('human_transforms')
            .where('transform_id', '=', transformId)
            .execute();
    }

    // Delete LLM transform by transform ID
    async deleteLLMTransformByTransformId(transformId: string): Promise<void> {
        // Delete LLM prompts first
        await this.db
            .deleteFrom('llm_prompts')
            .where('transform_id', '=', transformId)
            .execute();

        // Delete LLM transform
        await this.db
            .deleteFrom('llm_transforms')
            .where('transform_id', '=', transformId)
            .execute();
    }

    // Delete transform (main record)
    async deleteTransform(transformId: string): Promise<void> {
        await this.db
            .deleteFrom('transforms')
            .where('id', '=', transformId)
            .execute();
    }
}