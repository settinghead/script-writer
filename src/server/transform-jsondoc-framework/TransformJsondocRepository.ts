import { Kysely, sql } from 'kysely';
import { v4 as uuidv4 } from 'uuid';
import {
    Transform,
    TransformInput,
    TransformOutput,
    LLMPrompt,
    LLMTransform,
    HumanTransform,
    Jsondoc,
    validateJsondocData
} from '../../common/jsondocs';
import type { DB } from '../database/types';
import { buildLineageGraph, findLatestJsondoc } from '../../common/transform-jsondoc-framework/lineageResolution';
import type { ElectricJsondoc, ElectricTransform, ElectricHumanTransform, ElectricTransformInput, ElectricTransformOutput, TypedJsondoc } from '../../common/types';

export class TransformJsondocRepository {
    constructor(private db: Kysely<DB>) { }

    // ===== JSONDOC METHODS =====

    // Create a new jsondoc
    async createJsondoc(
        projectId: string,
        schemaType: TypedJsondoc['schema_type'],
        data: any,
        schemaVersion: TypedJsondoc['schema_version'],
        metadata: any | undefined,
        streamingStatus: string,
        originType: 'ai_generated' | 'user_input',
        initialInput: boolean = false
    ): Promise<Jsondoc> {
        // Skip validation for initial brainstorm input jsondocs
        const shouldSkipValidation = schemaType === 'brainstorm_input_params' && initialInput;

        // Only validate completed jsondocs, skip validation during streaming or for initial brainstorm inputs
        if (streamingStatus === 'completed' && !shouldSkipValidation && !validateJsondocData(schemaType, schemaVersion, data)) {
            console.error(`Invalid data for jsondoc schemaType ${schemaType}:${schemaVersion}`);
            console.error("data:", data);
            throw new Error(`Invalid data for jsondoc schemaType ${schemaType}:${schemaVersion}`);
        }

        const id = uuidv4();
        const now = new Date();

        const jsondocData = {
            id,
            project_id: projectId,
            schema_type: schemaType,
            schema_version: schemaVersion,
            origin_type: originType,
            data: JSON.stringify(data),
            metadata: metadata ? JSON.stringify(metadata) : null,
            streaming_status: streamingStatus,
            created_at: now
        };

        await this.db
            .insertInto('jsondocs')
            .values(jsondocData)
            .execute();

        return {
            id,
            project_id: projectId,
            schema_type: schemaType,
            schema_version: schemaVersion,
            origin_type: originType,
            data,
            metadata,
            created_at: now.toISOString()
        };
    }

    // Get jsondoc by ID
    async getJsondoc(jsondocId: string, projectId?: string): Promise<Jsondoc | null> {
        let query = this.db
            .selectFrom('jsondocs')
            .selectAll()
            .where('id', '=', jsondocId);

        if (projectId) {
            query = query.where('project_id', '=', projectId);
        }

        const row = await query.executeTakeFirst();

        if (!row) {
            return null;
        }

        return {
            id: row.id,
            project_id: row.project_id,
            schema_type: row.schema_type,
            schema_version: row.schema_version,
            origin_type: row.origin_type as 'ai_generated' | 'user_input',
            data: JSON.parse(row.data),
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            created_at: row.created_at?.toISOString() || new Date().toISOString()
        };
    }

    // Get jsondocs by type for a project
    async getJsondocsByType(
        projectId: string,
        schemaType: TypedJsondoc['schema_type'],
        schemaVersion?: TypedJsondoc['schema_version']
    ): Promise<Jsondoc[]> {
        let query = this.db
            .selectFrom('jsondocs')
            .selectAll()
            .where('project_id', '=', projectId)
            .where('schema_type', '=', schemaType);

        if (schemaVersion) {
            query = query.where('schema_version', '=', schemaVersion);
        }

        const rows = await query
            .orderBy('created_at', 'desc')
            .execute();

        return rows.map(row => this.rowToJsondoc(row));
    }

    // Get all jsondocs for a project
    async getProjectJsondocs(projectId: string, limit: number = 50): Promise<Jsondoc[]> {
        let query = this.db
            .selectFrom('jsondocs')
            .selectAll()
            .where('project_id', '=', projectId)
            .orderBy('created_at', 'desc');

        if (limit) {
            query = query.limit(limit);
        }

        const rows = await query.execute();

        return rows.map(row => this.rowToJsondoc(row));
    }

    // Get jsondocs by IDs for a specific project
    async getJsondocsByIds(jsondocIds: string[], projectId?: string): Promise<Jsondoc[]> {
        let query = this.db
            .selectFrom('jsondocs')
            .selectAll()
            .where('id', 'in', jsondocIds);

        if (projectId) {
            query = query.where('project_id', '=', projectId);
        }

        const rows = await query.execute();

        return rows.map(row => this.rowToJsondoc(row));
    }

    // Check if user has access to a project
    async userHasProjectAccess(userId: string, projectId: string): Promise<boolean> {
        const result = await this.db
            .selectFrom('projects_users')
            .select('id')
            .where('user_id', '=', userId)
            .where('project_id', '=', projectId)
            .executeTakeFirst();

        return !!result;
    }

    // Check if user has access to an jsondoc (via project membership)
    async userHasJsondocAccess(userId: string, jsondocId: string): Promise<boolean> {
        const jsondoc = await this.db
            .selectFrom('jsondocs')
            .select('project_id')
            .where('id', '=', jsondocId)
            .executeTakeFirst();

        if (!jsondoc) {
            return false; // Jsondoc doesn't exist
        }

        return this.userHasProjectAccess(userId, jsondoc.project_id);
    }

    // Get jsondocs by type for a specific project
    async getProjectJsondocsByType(projectId: string, schemaType: TypedJsondoc['schema_type'], limit: number = 20): Promise<Jsondoc[]> {
        const rows = await this.db
            .selectFrom('jsondocs')
            .selectAll()
            .where('project_id', '=', projectId)
            .where('schema_type', '=', schemaType)
            .orderBy('created_at', 'desc')
            .limit(limit)
            .execute();

        return rows.map(row => this.rowToJsondoc(row));
    }

    // Get jsondocs by type for a specific session
    async getJsondocsByTypeForSession(
        projectId: string,
        schemaType: TypedJsondoc['schema_type'],
        sessionId: string,
    ): Promise<Jsondoc[]> {
        let query = this.db
            .selectFrom('jsondocs as a')
            .selectAll()
            .where('a.project_id', '=', projectId)
            .where('a.schema_type', '=', schemaType)
            .where((eb) =>
                eb.or([
                    eb(sql`a.data->>'id'`, '=', sessionId),
                    eb(sql`a.data->>'ideation_session_id'`, '=', sessionId),
                    eb(sql`a.data->>'outline_session_id'`, '=', sessionId)
                ])
            );

        const rows = await query
            .orderBy('a.created_at', 'desc')
            .execute();

        return rows.map(row => this.rowToJsondoc(row));
    }

    // Get latest user input for a session (ideation or outline)
    async getLatestUserInputForSession(
        projectId: string,
        sessionId: string
    ): Promise<Jsondoc | null> {
        const row = await this.db
            .selectFrom('jsondocs as a')
            .innerJoin('transform_inputs as ti', 'a.id', 'ti.jsondoc_id')
            .innerJoin('transforms as t', 'ti.transform_id', 't.id')
            .innerJoin('transform_inputs as ti2', 't.id', 'ti2.transform_id')
            .innerJoin('jsondocs as session_a', 'ti2.jsondoc_id', 'session_a.id')
            .select(['a.id', 'a.project_id', 'a.schema_type', 'a.schema_version', 'a.data', 'a.metadata', 'a.created_at'])
            .where('a.project_id', '=', projectId)
            .where('a.origin_type', '=', 'user_input')
            .where((eb) =>
                eb.or([
                    eb(sql`session_a.data->>'id'`, '=', sessionId),
                    eb(sql`session_a.data->>'ideation_session_id'`, '=', sessionId)
                ])
            )
            .orderBy('a.created_at', 'desc')
            .executeTakeFirst();

        if (!row) {
            return null;
        }

        return this.rowToJsondoc(row);
    }

    // Delete jsondoc (should be rare since jsondocs are immutable)
    async deleteJsondoc(jsondocId: string, projectId?: string): Promise<boolean> {
        let query = this.db
            .deleteFrom('jsondocs')
            .where('id', '=', jsondocId);

        if (projectId) {
            query = query.where('project_id', '=', projectId);
        }

        const result = await query.execute();

        return result.length > 0 && Number(result[0].numDeletedRows) > 0;
    }

    async updateJsondoc(jsondocId: string, data: any, metadata?: any, streamingStatus?: string): Promise<void> {
        const updateData: any = {
            data: JSON.stringify(data)
        };

        if (metadata !== undefined) {
            updateData.metadata = metadata ? JSON.stringify(metadata) : null;
        }

        if (streamingStatus !== undefined) {
            updateData.streaming_status = streamingStatus;
        }

        await this.db
            .updateTable('jsondocs')
            .set(updateData)
            .where('id', '=', jsondocId)
            .execute();
    }

    // Get all jsondocs for a user (legacy method for backward compatibility)
    async getUserJsondocs(userId: string, limit?: number): Promise<Jsondoc[]> {
        // In the new project-based system, we need to get jsondocs for all user's projects
        // Use the projects_users junction table to find user's projects
        let query = this.db
            .selectFrom('jsondocs')
            .innerJoin('projects_users', 'jsondocs.project_id', 'projects_users.project_id')
            .select(['jsondocs.id', 'jsondocs.project_id', 'jsondocs.schema_type', 'jsondocs.schema_version', 'jsondocs.data', 'jsondocs.metadata', 'jsondocs.created_at'])
            .where('projects_users.user_id', '=', userId)
            .orderBy('jsondocs.created_at', 'desc');

        if (limit) {
            query = query.limit(limit);
        }

        const rows = await query.execute();

        return rows.map(row => this.rowToJsondoc(row));
    }

    /**
     * Get the latest brainstorm ideas for a project using lineage resolution
     * This ensures we get the most recent versions of each idea, not duplicates from editing
     */
    async getLatestBrainstormIdeas(projectId: string): Promise<Jsondoc[]> {
        try {
            // Get all project data needed for lineage resolution
            const jsondocs = await this.getAllProjectJsondocsForLineage(projectId);
            const transforms = await this.getAllProjectTransformsForLineage(projectId);
            const humanTransforms = await this.getAllProjectHumanTransformsForLineage(projectId);
            const transformInputs = await this.getAllProjectTransformInputsForLineage(projectId);
            const transformOutputs = await this.getAllProjectTransformOutputsForLineage(projectId);

            // Build the lineage graph
            const graph = buildLineageGraph(
                jsondocs,
                transforms,
                humanTransforms,
                transformInputs,
                transformOutputs
            );

            // Get all 灵感创意 jsondocs
            const allBrainstormIdeas = jsondocs.filter(a => a.schema_type === '灵感创意');

            // Resolve each to its latest version
            const latestJsondocIds = new Set<string>();
            const resolvedJsondocs: Jsondoc[] = [];

            for (const idea of allBrainstormIdeas) {
                const result = findLatestJsondoc(idea.id, undefined, graph);

                if (result.jsondocId && !latestJsondocIds.has(result.jsondocId)) {
                    latestJsondocIds.add(result.jsondocId);

                    // Find the actual jsondoc data
                    const latestJsondoc = jsondocs.find(a => a.id === result.jsondocId);
                    if (latestJsondoc && latestJsondoc.schema_type === '灵感创意') {
                        resolvedJsondocs.push(this.rowToJsondoc({
                            ...latestJsondoc,
                        }));
                    }
                }
            }

            // Sort by creation time (newest first)
            resolvedJsondocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            return resolvedJsondocs;

        } catch (error) {
            console.error('Error getting latest brainstorm ideas:', error);
            // Fallback to regular method if lineage resolution fails
            return this.getProjectJsondocsByType(projectId, '灵感创意');
        }
    }

    /**
     * Helper methods to get all project data in Electric format for lineage resolution
     */
    public async getAllProjectJsondocsForLineage(projectId: string): Promise<ElectricJsondoc[]> {
        const rows = await this.db
            .selectFrom('jsondocs')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        return rows.map(row => ({
            id: row.id,
            project_id: row.project_id,
            schema_type: row.schema_type,
            schema_version: row.schema_version,
            data: row.data, // Keep as string for Electric format
            metadata: row.metadata || undefined,
            created_at: row.created_at?.toISOString() || new Date().toISOString(),
            streaming_status: row.streaming_status as 'streaming' | 'completed' | 'failed' | 'cancelled' | undefined,
            origin_type: (row.origin_type as 'ai_generated' | 'user_input') || 'ai_generated'
        }));
    }

    // ===== TRANSFORM METHODS =====

    // Create a new transform
    async createTransform(
        projectId: string,
        type: 'llm' | 'human' | 'ai_patch' | 'human_patch_approval',
        typeVersion: string = 'v1',
        status: string = 'running',
        executionContext?: any,
        toolCallId?: string
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
            tool_call_id: toolCallId || null,
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
            tool_call_id: toolCallId,
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
            tool_call_id: row.tool_call_id || undefined,
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

    public async getAllProjectTransformsForLineage(projectId: string): Promise<ElectricTransform[]> {
        const rows = await this.db
            .selectFrom('transforms')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        return rows.map(row => ({
            id: row.id,
            project_id: row.project_id,
            type: row.type as 'llm' | 'human',
            type_version: row.type_version,
            status: row.status || 'completed',
            retry_count: row.retry_count || 0,
            max_retries: row.max_retries || 3,
            execution_context: row.execution_context || undefined,
            created_at: row.created_at?.toISOString() || new Date().toISOString(),
            updated_at: row.updated_at?.toISOString() || new Date().toISOString(),
            streaming_status: row.streaming_status || undefined,
            progress_percentage: row.progress_percentage ? Number(row.progress_percentage) : undefined,
            error_message: row.error_message || undefined
        }));
    }

    public async getAllProjectHumanTransformsForLineage(projectId: string): Promise<ElectricHumanTransform[]> {
        const rows = await this.db
            .selectFrom('human_transforms')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        return rows.map(row => ({
            transform_id: row.transform_id,
            project_id: row.project_id,
            action_type: row.action_type,
            interface_context: row.interface_context || undefined,
            change_description: row.change_description || undefined,
            source_jsondoc_id: row.source_jsondoc_id || undefined,
            derivation_path: row.derivation_path || '',
            derived_jsondoc_id: row.derived_jsondoc_id || undefined,
            transform_name: row.transform_name || undefined
        }));
    }

    public async getAllProjectTransformInputsForLineage(projectId: string): Promise<ElectricTransformInput[]> {
        const rows = await this.db
            .selectFrom('transform_inputs')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        return rows.map(row => ({
            id: row.id,
            transform_id: row.transform_id,
            jsondoc_id: row.jsondoc_id,
            project_id: row.project_id,
            input_role: row.input_role || undefined
        }));
    }

    public async getAllProjectTransformOutputsForLineage(projectId: string): Promise<ElectricTransformOutput[]> {
        const rows = await this.db
            .selectFrom('transform_outputs')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        return rows.map(row => ({
            id: row.id,
            transform_id: row.transform_id,
            jsondoc_id: row.jsondoc_id,
            project_id: row.project_id
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

    // Helper to convert database row to Jsondoc with all required fields
    private rowToJsondoc(row: any): Jsondoc {
        return {
            id: row.id,
            project_id: row.project_id,
            schema_type: row.schema_type,
            schema_version: row.schema_version,
            origin_type: (row.origin_type as 'ai_generated' | 'user_input') || 'ai_generated',
            data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
            metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
            created_at: row.created_at?.toISOString() || new Date().toISOString()
        };
    }
} 