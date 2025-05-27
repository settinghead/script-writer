import * as sqlite3 from 'sqlite3';
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
    constructor(private db: sqlite3.Database) { }

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

        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
        INSERT INTO transforms (id, user_id, type, type_version, status, execution_context, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

            stmt.run(
                [id, userId, type, typeVersion, status, JSON.stringify(executionContext), now],
                function (err) {
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve({
                        id,
                        user_id: userId,
                        type,
                        type_version: typeVersion,
                        status: status as any,
                        execution_context: executionContext,
                        created_at: now
                    });
                }
            );

            stmt.finalize();
        });
    }

    // Add input artifacts to a transform
    async addTransformInputs(
        transformId: string,
        artifacts: Array<{ artifactId: string; inputRole?: string }>
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                const stmt = this.db.prepare(`
          INSERT INTO transform_inputs (transform_id, artifact_id, input_role)
          VALUES (?, ?, ?)
        `);

                let completed = 0;
                let hasError = false;

                artifacts.forEach(({ artifactId, inputRole }) => {
                    stmt.run([transformId, artifactId, inputRole], (err) => {
                        if (err && !hasError) {
                            hasError = true;
                            reject(err);
                            return;
                        }

                        completed++;
                        if (completed === artifacts.length && !hasError) {
                            resolve();
                        }
                    });
                });

                stmt.finalize();
            });
        });
    }

    // Add output artifacts to a transform
    async addTransformOutputs(
        transformId: string,
        artifacts: Array<{ artifactId: string; outputRole?: string }>
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                const stmt = this.db.prepare(`
          INSERT INTO transform_outputs (transform_id, artifact_id, output_role)
          VALUES (?, ?, ?)
        `);

                let completed = 0;
                let hasError = false;

                artifacts.forEach(({ artifactId, outputRole }) => {
                    stmt.run([transformId, artifactId, outputRole], (err) => {
                        if (err && !hasError) {
                            hasError = true;
                            reject(err);
                            return;
                        }

                        completed++;
                        if (completed === artifacts.length && !hasError) {
                            resolve();
                        }
                    });
                });

                stmt.finalize();
            });
        });
    }

    // Add LLM-specific data
    async addLLMTransform(llmTransform: LLMTransform): Promise<void> {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
        INSERT INTO llm_transforms (transform_id, model_name, model_parameters, raw_response, token_usage)
        VALUES (?, ?, ?, ?, ?)
      `);

            stmt.run([
                llmTransform.transform_id,
                llmTransform.model_name,
                JSON.stringify(llmTransform.model_parameters),
                llmTransform.raw_response,
                JSON.stringify(llmTransform.token_usage)
            ], (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });

            stmt.finalize();
        });
    }

    // Add LLM prompts
    async addLLMPrompts(
        transformId: string,
        prompts: Array<{ promptText: string; promptRole?: string }>
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                const stmt = this.db.prepare(`
          INSERT INTO llm_prompts (id, transform_id, prompt_text, prompt_role)
          VALUES (?, ?, ?, ?)
        `);

                let completed = 0;
                let hasError = false;

                prompts.forEach(({ promptText, promptRole = 'primary' }) => {
                    const promptId = uuidv4();
                    stmt.run([promptId, transformId, promptText, promptRole], (err) => {
                        if (err && !hasError) {
                            hasError = true;
                            reject(err);
                            return;
                        }

                        completed++;
                        if (completed === prompts.length && !hasError) {
                            resolve();
                        }
                    });
                });

                stmt.finalize();
            });
        });
    }

    // Add human-specific data
    async addHumanTransform(humanTransform: HumanTransform): Promise<void> {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
        INSERT INTO human_transforms (transform_id, action_type, interface_context, change_description)
        VALUES (?, ?, ?, ?)
      `);

            stmt.run([
                humanTransform.transform_id,
                humanTransform.action_type,
                JSON.stringify(humanTransform.interface_context),
                humanTransform.change_description
            ], (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });

            stmt.finalize();
        });
    }

    // Get transform by ID with all related data
    async getTransform(transformId: string, userId?: string): Promise<any | null> {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM transforms WHERE id = ?';
            let params = [transformId];

            if (userId) {
                query += ' AND user_id = ?';
                params.push(userId);
            }

            this.db.get(query, params, async (err, row: any) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!row) {
                    resolve(null);
                    return;
                }

                try {
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

                    resolve({
                        ...transform,
                        inputs,
                        outputs,
                        llm_data: llmData,
                        human_data: humanData
                    });
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    // Get transform inputs
    async getTransformInputs(transformId: string): Promise<TransformInput[]> {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM transform_inputs WHERE transform_id = ?',
                [transformId],
                (err, rows: any[]) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(rows || []);
                }
            );
        });
    }

    // Get transform outputs
    async getTransformOutputs(transformId: string): Promise<TransformOutput[]> {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM transform_outputs WHERE transform_id = ?',
                [transformId],
                (err, rows: any[]) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(rows || []);
                }
            );
        });
    }

    // Get LLM transform data
    async getLLMTransformData(transformId: string): Promise<any | null> {
        return new Promise((resolve, reject) => {
            // Get LLM transform metadata
            this.db.get(
                'SELECT * FROM llm_transforms WHERE transform_id = ?',
                [transformId],
                (err, row: any) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (!row) {
                        resolve(null);
                        return;
                    }

                    // Get prompts
                    this.db.all(
                        'SELECT * FROM llm_prompts WHERE transform_id = ?',
                        [transformId],
                        (err, prompts: any[]) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            resolve({
                                ...row,
                                model_parameters: row.model_parameters ? JSON.parse(row.model_parameters) : null,
                                token_usage: row.token_usage ? JSON.parse(row.token_usage) : null,
                                prompts: prompts || []
                            });
                        }
                    );
                }
            );
        });
    }

    // Get human transform data
    async getHumanTransformData(transformId: string): Promise<HumanTransform | null> {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM human_transforms WHERE transform_id = ?',
                [transformId],
                (err, row: any) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (!row) {
                        resolve(null);
                        return;
                    }

                    resolve({
                        ...row,
                        interface_context: row.interface_context ? JSON.parse(row.interface_context) : null
                    });
                }
            );
        });
    }

    // Get transforms for a user
    async getUserTransforms(userId: string, limit?: number): Promise<Transform[]> {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM transforms WHERE user_id = ? ORDER BY created_at DESC';
            let params = [userId];

            if (limit) {
                query += ' LIMIT ?';
                params.push(limit.toString());
            }

            this.db.all(query, params, (err, rows: any[]) => {
                if (err) {
                    reject(err);
                    return;
                }

                const transforms = rows.map(row => ({
                    ...row,
                    execution_context: row.execution_context ? JSON.parse(row.execution_context) : null
                }));

                resolve(transforms);
            });
        });
    }

    // Update transform status
    async updateTransformStatus(transformId: string, status: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE transforms SET status = ? WHERE id = ?',
                [status, transformId],
                (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                }
            );
        });
    }
} 