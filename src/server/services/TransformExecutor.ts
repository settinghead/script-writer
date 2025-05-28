import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText, StreamingTextResponse, readableFromAsyncIterable } from 'ai';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { Artifact } from '../types/artifacts';

export class TransformExecutor {
    constructor(
        private artifactRepo: ArtifactRepository,
        private transformRepo: TransformRepository
    ) { }

    // Execute an LLM transform and stream the response
    async executeLLMTransform(
        userId: string,
        inputArtifacts: Artifact[],
        promptTemplate: string,
        promptVariables: Record<string, string>,
        modelName: string = 'deepseek-chat',
        outputArtifactType: string,
        outputArtifactTypeVersion: string = 'v1',
        response_format: { type: "json_object" } | undefined = undefined // Allow specifying response format for LLM
    ): Promise<{
        transform: any;
        llmStream: ReadableStream<Uint8Array>;
        completionPromise: Promise<{ outputArtifacts: Artifact[]; rawResponse: string; usage: any }>;
    }> {
        // Create the transform
        const transform = await this.transformRepo.createTransform(
            userId,
            'llm',
            'v1',
            'running',
            {
                started_at: new Date().toISOString(),
                model_name: modelName,
                prompt_variables: promptVariables
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

            const apiKey = process.env.DEEPSEEK_API_KEY;
            if (!apiKey) {
                throw new Error('DEEPSEEK_API_KEY not configured');
            }

            const deepseekAI = createOpenAI({
                apiKey,
                baseURL: 'https://api.deepseek.com',
            });

            // Prepare the messages for the LLM
            const messages = [{ role: 'user', content: finalPrompt }];
            if (response_format?.type === "json_object") {
                messages.unshift({ role: 'system', content: 'You are a helpful assistant designed to output JSON.' });
            }

            const result = await streamText({
                model: deepseekAI(modelName),
                messages: messages,
                // @ts-ignore TODO: Fix this type error if response_format is a problem with streamText
                response_format: response_format,
            });

            const llmStream = result.toDataStream();

            // completionPromise will handle post-streaming logic (parsing, artifact creation, db updates)
            const completionPromise = new Promise<{ outputArtifacts: Artifact[]; rawResponse: string; usage: any }>(async (resolve, reject) => {
                try {
                    let accumulatedText = '';
                    const reader = result.textStream.getReader();
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                            break;
                        }
                        accumulatedText += value;
                    }

                    // Store LLM metadata (raw_response will be the complete text)
                    await this.transformRepo.addLLMTransform({
                        transform_id: transform.id,
                        model_name: modelName,
                        raw_response: accumulatedText, // Store complete response
                        token_usage: result.usage ? {
                            prompt_tokens: result.usage.promptTokens,
                            completion_tokens: result.usage.completionTokens,
                            total_tokens: result.usage.totalTokens
                        } : null
                    });

                    // Parse the response based on output type
                    let parsedData: any;
                    try {
                        if (outputArtifactType === 'plot_outline' || outputArtifactType === 'brainstorm_idea' || outputArtifactType === 'outline_components') {
                            // Attempt to parse as JSON directly first
                            try {
                                parsedData = JSON.parse(accumulatedText);
                            } catch (initialParseError) {
                                // If direct parse fails, try with jsonrepair
                                const { jsonrepair } = await import('jsonrepair');
                                const repairedJson = jsonrepair(accumulatedText);
                                parsedData = JSON.parse(repairedJson);
                            }
                            // Validate specific structures if needed (e.g., array for brainstorm_idea)
                            if (outputArtifactType === 'brainstorm_idea' && !Array.isArray(parsedData)) {
                                console.warn('Brainstorm idea was not an array after repair, attempting to wrap or fallback.');
                                // Attempt to parse as newline-delimited JSON if it's a string now
                                if (typeof parsedData === 'string') {
                                    try {
                                        const lines = parsedData.trim().split('\n');
                                        parsedData = lines.map(line => JSON.parse(line));
                                    } catch (e) {
                                        console.error('Could not parse repaired string as NDJSON for brainstorm_idea, using as single element array');
                                        parsedData = [parsedData]; // Fallback to array with the string
                                    }
                                } else {
                                    parsedData = [parsedData]; // Fallback for non-array JSON
                                }
                            }
                        } else {
                            parsedData = { content: accumulatedText };
                        }
                    } catch (parseError: any) {
                        console.error(`Failed to parse or repair JSON for ${outputArtifactType}:`, parseError.message);
                        // Fallback: treat as plain text, include error info
                        parsedData = { content: accumulatedText, parse_error: true, error_message: parseError.message };
                    }

                    // Create output artifacts
                    const outputArtifacts: Artifact[] = [];

                    if (outputArtifactType === 'brainstorm_idea' && Array.isArray(parsedData)) {
                        // Create multiple idea artifacts
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
                    } else if (outputArtifactType === 'outline_components' && parsedData && typeof parsedData === 'object' && !parsedData.parse_error) {
                        // Create individual outline component artifacts with safe string conversion
                        const safeTrim = (value: any): string => {
                            if (typeof value === 'string') {
                                return value.trim();
                            } else if (Array.isArray(value)) {
                                return value.map(item => String(item).trim()).join('\n');
                            } else if (typeof value === 'object' && value !== null) {
                                console.warn(`Object value encountered for outline field: ${JSON.stringify(value)}, attempting to extract meaningful text or stringify.`);
                                if (value.text) return String(value.text).trim();
                                if (value.content) return String(value.content).trim();
                                if (value.value) return String(value.value).trim();
                                return JSON.stringify(value, null, 2); // Fallback
                            } else if (value === undefined || value === null) {
                                return ''; // Return empty string for undefined/null
                            } else {
                                return String(value).trim();
                            }
                        };

                        const requiredFields = ['title', 'genre', 'selling_points', 'setting', 'synopsis'];
                        let allRequiredFieldsPresent = true;
                        for (const field of requiredFields) {
                            if (parsedData[field] === undefined || parsedData[field] === null) {
                                console.warn(`Outline components: Missing field '${field}' in LLM response.`);
                                // Don't throw error here, proceed and let individual artifacts handle missing data gracefully
                                // allRequiredFieldsPresent = false;
                                // break;
                            }
                        }

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
                                settingString += `\n关键场景：\n- ${scenes.join('\n- ')}`;
                            }
                        } else {
                            settingString = safeTrim(parsedData.setting); // Fallback for non-object setting
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
                        // Create single output artifact (handles plain text or parse errors)
                        const outputArtifact = await this.artifactRepo.createArtifact(
                            userId,
                            outputArtifactType,
                            parsedData, // This will contain { content: accumulatedText, parse_error: true, ... } if error occurred
                            outputArtifactTypeVersion
                        );
                        outputArtifacts.push(outputArtifact);
                    }

                    // Link output artifacts
                    await this.transformRepo.addTransformOutputs(
                        transform.id,
                        outputArtifacts.map(artifact => ({ artifactId: artifact.id }))
                    );

                    // Update transform status
                    await this.transformRepo.updateTransformStatus(transform.id, 'completed');

                    resolve({ outputArtifacts, rawResponse: accumulatedText, usage: result.usage });
                } catch (error) {
                    console.error('Error in completionPromise of executeLLMTransform:', error);
                    await this.transformRepo.updateTransformStatus(transform.id, 'failed');
                    reject(error);
                }
            });

            return { transform, llmStream, completionPromise };

        } catch (error) {
            // Update transform status to failed if initial setup fails
            await this.transformRepo.updateTransformStatus(transform.id, 'failed');
            console.error('Error setting up LLM transform stream:', error);
            throw error; // Re-throw to be caught by the route handler
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