import { createOpenAI } from '@ai-sdk/openai';
import { StreamTextResult, generateText, streamText } from 'ai';
import { CompletionUsage } from 'ai/prompts';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { Artifact } from '../types/artifacts';
import { StreamingService } from './StreamingService';

export class TransformExecutor {
    constructor(
        private artifactRepo: ArtifactRepository,
        private transformRepo: TransformRepository,
        private streamingService: StreamingService
    ) { }

    // Execute an LLM transform
    async executeLLMTransform(
        userId: string,
        inputArtifacts: Artifact[],
        promptTemplate: string,
        promptVariables: Record<string, string>,
        modelName: string = 'deepseek-chat',
        outputArtifactType: string,
        outputArtifactTypeVersion: string = 'v1',
        streamOutput: boolean = false
    ): Promise<{ transform: any; outputArtifacts?: Artifact[]; isStreaming?: boolean; streamPath?: string; streamingTransformId?: string }> {
        // Create the transform
        const transform = await this.transformRepo.createTransform(
            userId,
            'llm',
            'v1',
            streamOutput ? 'streaming' : 'running',
            {
                started_at: new Date().toISOString(),
                model_name: modelName,
                prompt_variables: promptVariables,
                requested_output_artifact_type: outputArtifactType,
                requested_output_artifact_type_version: outputArtifactTypeVersion,
            }
        );

        try {
            // Link input artifacts
            await this.transformRepo.addTransformInputs(
                transform.id,
                inputArtifacts.map(artifact => ({ artifactId: artifact.id }))
            );

            // Build the final prompt
            let finalPrompt = promptTemplate;
            for (const [key, value] of Object.entries(promptVariables)) {
                finalPrompt = finalPrompt.replace(`{${key}}`, value);
            }

            // Store the prompt
            await this.transformRepo.addLLMPrompts(transform.id, [
                { promptText: finalPrompt, promptRole: 'primary' }
            ]);

            // Store initial LLM metadata (raw_response and token_usage will be updated later if streaming)
            // It's important to record the intent to call the LLM immediately.
            await this.transformRepo.addLLMTransform({
                transform_id: transform.id,
                model_name: modelName,
                raw_response: streamOutput ? 'Pending stream completion' : null,
                token_usage: null
            });

            const apiKey = process.env.DEEPSEEK_API_KEY;
            if (!apiKey) {
                await this.transformRepo.updateTransformStatus(transform.id, 'failed');
                throw new Error('DEEPSEEK_API_KEY not configured');
            }

            const deepseekAI = createOpenAI({
                apiKey,
                baseURL: 'https://api.deepseek.com',
            });

            if (streamOutput) {
                const llmStreamResult: StreamTextResult<never, never> = await streamText({
                    model: deepseekAI(modelName),
                    messages: [{ role: 'user', content: finalPrompt }],
                });

                this.streamingService.registerStream(
                    transform.id,
                    userId,
                    llmStreamResult.toDataStream(),
                    outputArtifactType,
                    outputArtifactTypeVersion,
                    modelName,
                    llmStreamResult.usage
                );

                return {
                    transform,
                    isStreaming: true,
                    streamPath: `/api/transforms/${transform.id}/stream`,
                    streamingTransformId: transform.id
                };

            } else {
                const result = await generateText({
                    model: deepseekAI(modelName),
                    messages: [{ role: 'user', content: finalPrompt }]
                });

                await this.transformRepo.updateLLMTransformDetails(transform.id, {
                    raw_response: result.text,
                    token_usage: result.usage ? {
                        prompt_tokens: result.usage.promptTokens,
                        completion_tokens: result.usage.completionTokens,
                        total_tokens: result.usage.totalTokens
                    } : null
                });

                let parsedData: any;
                try {
                    if (outputArtifactType === 'plot_outline') {
                        parsedData = JSON.parse(result.text);
                    } else if (outputArtifactType === 'brainstorm_idea') {
                        const ideas = JSON.parse(result.text);
                        if (!Array.isArray(ideas)) {
                            throw new Error('Expected array of ideas');
                        }
                        parsedData = ideas;
                    } else if (outputArtifactType === 'outline_components') {
                        const components = JSON.parse(result.text);
                        if (!components || typeof components !== 'object') {
                            throw new Error('Expected object with outline components');
                        }
                        const requiredFields = ['title', 'genre', 'selling_points', 'setting', 'synopsis'];
                        for (const field of requiredFields) {
                            if (components[field] === undefined || components[field] === null) {
                                throw new Error(`Missing field: ${field}`);
                            }
                        }
                        parsedData = components;
                    } else {
                        parsedData = { content: result.text };
                    }
                } catch (parseError) {
                    try {
                        const { jsonrepair } = await import('jsonrepair');
                        const repairedJson = jsonrepair(result.text);
                        parsedData = JSON.parse(repairedJson);
                    } catch (repairError) {
                        parsedData = { content: result.text, parse_error: true };
                    }
                }

                const outputArtifacts: Artifact[] = [];

                if (outputArtifactType === 'brainstorm_idea' && Array.isArray(parsedData)) {
                    for (let i = 0; i < parsedData.length; i++) {
                        const ideaArtifact = await this.artifactRepo.createArtifact(
                            userId,
                            'brainstorm_idea',
                            {
                                idea_text: parsedData[i],
                                order_index: i,
                                confidence_score: null
                            },
                            outputArtifactTypeVersion
                        );
                        outputArtifacts.push(ideaArtifact);
                    }
                } else if (outputArtifactType === 'outline_components') {
                    const safeTrim = (value: any): string => {
                        if (typeof value === 'string') {
                            return value.trim();
                        } else if (Array.isArray(value)) {
                            return value.map(item => String(item).trim()).join('\\n');
                        } else if (typeof value === 'object' && value !== null) {
                            console.warn(`Object value encountered for outline field: ${JSON.stringify(value)}, attempting to extract meaningful text or stringify.`);
                            if (value.text) return String(value.text).trim();
                            if (value.content) return String(value.content).trim();
                            if (value.value) return String(value.value).trim();
                            return JSON.stringify(value, null, 2);
                        } else if (value === undefined || value === null) {
                            return '';
                        } else {
                            return String(value).trim();
                        }
                    };

                    const titleArtifact = await this.artifactRepo.createArtifact(
                        userId,
                        'outline_title',
                        { title: safeTrim(parsedData.title) },
                        'v1'
                    );
                    outputArtifacts.push(titleArtifact);

                    const genreArtifact = await this.artifactRepo.createArtifact(
                        userId,
                        'outline_genre',
                        { genre: safeTrim(parsedData.genre) },
                        'v1'
                    );
                    outputArtifacts.push(genreArtifact);

                    const sellingPointsArtifact = await this.artifactRepo.createArtifact(
                        userId,
                        'outline_selling_points',
                        { selling_points: safeTrim(parsedData.selling_points) },
                        'v1'
                    );
                    outputArtifacts.push(sellingPointsArtifact);

                    let settingString = '';
                    if (parsedData.setting && typeof parsedData.setting === 'object') {
                        const summary = safeTrim(parsedData.setting.core_setting_summary);
                        const scenes = Array.isArray(parsedData.setting.key_scenes)
                            ? parsedData.setting.key_scenes.map((s: string) => safeTrim(s))
                            : [];
                        settingString = `核心设定： ${summary}`;
                        if (scenes.length > 0) {
                            settingString += `\\n关键场景：\\n- ${scenes.join('\\n- ')}`;
                        }
                    } else {
                        settingString = safeTrim(parsedData.setting);
                    }
                    const settingArtifact = await this.artifactRepo.createArtifact(
                        userId,
                        'outline_setting',
                        { setting: settingString },
                        'v1'
                    );
                    outputArtifacts.push(settingArtifact);

                    const synopsisString = safeTrim(parsedData.synopsis);

                    const synopsisArtifact = await this.artifactRepo.createArtifact(
                        userId,
                        'outline_synopsis',
                        { synopsis: synopsisString },
                        'v1'
                    );
                    outputArtifacts.push(synopsisArtifact);

                    if (parsedData.main_characters && Array.isArray(parsedData.main_characters)) {
                        const charactersArtifact = await this.artifactRepo.createArtifact(
                            userId,
                            'outline_characters',
                            { characters: parsedData.main_characters },
                            'v1'
                        );
                        outputArtifacts.push(charactersArtifact);
                    }

                } else {
                    const outputArtifact = await this.artifactRepo.createArtifact(
                        userId,
                        outputArtifactType,
                        parsedData,
                        outputArtifactTypeVersion
                    );
                    outputArtifacts.push(outputArtifact);
                }

                await this.transformRepo.addTransformOutputs(
                    transform.id,
                    outputArtifacts.map(artifact => ({ artifactId: artifact.id }))
                );

                await this.transformRepo.updateTransformStatus(transform.id, 'completed');

                return { transform, outputArtifacts };
            }
        } catch (error) {
            console.error(`Error in executeLLMTransform for transform ${transform.id}:`, error);
            await this.transformRepo.updateTransformStatus(transform.id, 'failed');
            await this.transformRepo.updateTransformExecutionContext(transform.id, {
                error: (error as Error).message,
                stack: (error as Error).stack,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    // Execute a human transform (for user inputs, selections, etc.)
    async executeHumanTransform(
        userId: string,
        inputArtifacts: Artifact[],
        actionType: string,
        outputArtifacts: Artifact[],
        interfaceContext?: any,
        changeDescription?: string
    ): Promise<{ transform: any }> {
        // Create the transform
        const transform = await this.transformRepo.createTransform(
            userId,
            'human',
            'v1',
            'completed',
            {
                timestamp: new Date().toISOString(),
                action_type: actionType
            }
        );

        // Link input artifacts
        if (inputArtifacts.length > 0) {
            await this.transformRepo.addTransformInputs(
                transform.id,
                inputArtifacts.map(artifact => ({ artifactId: artifact.id }))
            );
        }

        // Link output artifacts
        if (outputArtifacts.length > 0) {
            await this.transformRepo.addTransformOutputs(
                transform.id,
                outputArtifacts.map(artifact => ({ artifactId: artifact.id }))
            );
        }

        // Store human-specific data
        await this.transformRepo.addHumanTransform({
            transform_id: transform.id,
            action_type: actionType,
            interface_context: interfaceContext,
            change_description: changeDescription
        });

        return { transform };
    }
} 