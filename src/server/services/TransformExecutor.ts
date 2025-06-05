import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText, createDataStreamResponse } from 'ai';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { Artifact } from '../types/artifacts';
import { getLLMCredentials } from './LLMConfig';
import { LLMService } from './LLMService';
import { UnifiedStreamingService } from './UnifiedStreamingService';
import { ReasoningEvent } from '../../common/streaming/types';

export class TransformExecutor {
    private llmService: LLMService;

    constructor(
        private artifactRepo: ArtifactRepository,
        private transformRepo: TransformRepository,
        private unifiedStreamingService?: UnifiedStreamingService
    ) {
        this.llmService = new LLMService();
    }

    // Execute an LLM transform
    async executeLLMTransform(
        userId: string,
        inputArtifacts: Artifact[],
        promptTemplate: string,
        promptVariables: Record<string, string>,
        outputArtifactType: string,
        outputArtifactTypeVersion: string = 'v1'
    ): Promise<{ transform: any; outputArtifacts: Artifact[] }> {
        // Get LLM credentials and use default model if not specified
        const { apiKey, baseUrl, modelName } = getLLMCredentials();

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

            // Execute the LLM call with reasoning support
            const result = await this.llmService.generateText(finalPrompt, modelName);

            // Store LLM metadata
            await this.transformRepo.addLLMTransform({
                transform_id: transform.id,
                model_name: modelName,
                raw_response: result.text,
                reasoning_response: result.reasoning || null,
                token_usage: result.usage ? {
                    prompt_tokens: result.usage.promptTokens,
                    completion_tokens: result.usage.completionTokens,
                    total_tokens: result.usage.totalTokens
                } : null
            });

            // Clean the response - remove think tags, code wrappers, etc.
            const { cleanLLMContent } = await import('../../common/utils/textCleaning');
            const cleanedContent = cleanLLMContent(result.text);

            // Parse the response based on output type using robust JSON parsing
            let parsedData: any;
            try {
                const { robustJSONParse } = await import('../../common/utils/textCleaning');
                
                if (outputArtifactType === 'plot_outline') {
                    parsedData = await robustJSONParse(result.text);
                } else if (outputArtifactType === 'brainstorm_idea') {
                    // For brainstorm ideas, expect a JSON array
                    const ideas = await robustJSONParse(result.text);
                    if (!Array.isArray(ideas)) {
                        throw new Error('Expected array of ideas');
                    }
                    parsedData = ideas;
                } else if (outputArtifactType === 'outline_components') {
                    // For outline components, parse into individual components
                    const components = await robustJSONParse(result.text);
                    if (!components || typeof components !== 'object') {
                        throw new Error('Expected object with outline components');
                    }
                    // Validate required fields exist (but don't convert yet - let safeTrim handle it)
                    const requiredFields = ['title', 'genre', 'selling_points', 'setting', 'synopsis'];
                    for (const field of requiredFields) {
                        if (components[field] === undefined || components[field] === null) {
                            throw new Error(`Missing field: ${field}`);
                        }
                    }
                    parsedData = components;
                } else {
                    parsedData = { content: cleanedContent };
                }
            } catch (parseError) {
                // Fallback: treat as plain text
                parsedData = { content: cleanedContent, parse_error: true };
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
            } else if (outputArtifactType === 'outline_components') {
                // Create individual outline component artifacts with safe string conversion
                const safeTrim = (value: any): string => {
                    if (typeof value === 'string') {
                        return value.trim();
                    } else if (Array.isArray(value)) {
                        // If it's an array, join with newlines or appropriate separator
                        // For selling_points, this is okay as the artifact expects a string.
                        return value.map(item => String(item).trim()).join('\\n');
                    } else if (typeof value === 'object' && value !== null) {
                        // This case might be hit for parts of setting or synopsis if not handled specifically
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

                // parsedData is the rich object from the new prompt
                // e.g., parsedData.title, parsedData.genre
                // parsedData.setting = { core_setting_summary: string, key_scenes: string[] }
                // parsedData.synopsis = { opening: string, development: string, turn_climax: string, resolution: string }
                // parsedData.selling_points = string[]
                // parsedData.main_characters = { protagonist: {...}, antagonist_or_love_interest: {...}, other_key_character?: {...}} (not directly used for individual artifacts here)


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

                // selling_points is an array of strings, safeTrim will join them with newline.
                // OutlineSellingPointsV1 expects a single string.
                const sellingPointsArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'outline_selling_points',
                    { selling_points: safeTrim(parsedData.selling_points) }, // safeTrim joins array elements
                    'v1'
                );
                outputArtifacts.push(sellingPointsArtifact);

                // Construct setting string from parsedData.setting object
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
                    // Fallback if structure is not as expected, though validation should catch this.
                    settingString = safeTrim(parsedData.setting);
                }
                const settingArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'outline_setting',
                    { setting: settingString },
                    'v1'
                );
                outputArtifacts.push(settingArtifact);

                // Construct synopsis string from parsedData.synopsis object - NOW IT'S A STRING
                // let synopsisString = '';
                // if (parsedData.synopsis && typeof parsedData.synopsis === 'object') {
                //     const opening = safeTrim(parsedData.synopsis.opening);
                //     const development = safeTrim(parsedData.synopsis.development);
                //     const turnClimax = safeTrim(parsedData.synopsis.turn_climax);
                //     const resolution = safeTrim(parsedData.synopsis.resolution);
                //     synopsisString = `起： ${opening}\n承： ${development}\n转/高潮： ${turnClimax}\n合： ${resolution}`;
                // } else {
                //     // Fallback
                //     synopsisString = safeTrim(parsedData.synopsis);
                // }

                // Synopsis is now expected to be a string directly from parsedData
                const synopsisString = safeTrim(parsedData.synopsis);

                const synopsisArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'outline_synopsis',
                    { synopsis: synopsisString },
                    'v1'
                );
                outputArtifacts.push(synopsisArtifact);

                // Create main_characters artifact if data is available
                if (parsedData.main_characters && Array.isArray(parsedData.main_characters)) {
                    const charactersArtifact = await this.artifactRepo.createArtifact(
                        userId,
                        'outline_characters', // New artifact type
                        { characters: parsedData.main_characters }, // Data conforms to OutlineCharactersV1
                        'v1'
                    );
                    outputArtifacts.push(charactersArtifact);
                }

            } else {
                // Create single output artifact
                const outputArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    outputArtifactType,
                    parsedData,
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

            return { transform, outputArtifacts };

        } catch (error) {
            // Update transform status to failed
            await this.transformRepo.updateTransformStatus(transform.id, 'failed');
            throw error;
        }
    }

    // Execute a streaming LLM transform - returns a data stream response
    async executeLLMTransformStream(
        userId: string,
        inputArtifacts: Artifact[],
        promptTemplate: string,
        promptVariables: Record<string, string>,
        outputArtifactType: string,
        outputArtifactTypeVersion: string = 'v1'
    ) {
        return createDataStreamResponse({
            execute: async (dataStream) => {
                // Get LLM credentials
                const { apiKey, baseUrl, modelName } = getLLMCredentials();

                // Create the transform record immediately
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

                    // Send initial status
                    dataStream.writeData({
                        type: 'status',
                        message: 'Starting AI generation...',
                        transformId: transform.id
                    });

                    // Determine phase for reasoning events
                    const phase = this.getPhaseFromArtifactType(outputArtifactType);

                    // Set up reasoning event callbacks
                    const onReasoningStart = (phase: string) => {
                        if (this.unifiedStreamingService) {
                            const event: ReasoningEvent = {
                                type: 'reasoning_start',
                                phase: phase as any,
                                timestamp: Date.now(),
                                modelName
                            };
                            this.unifiedStreamingService.broadcastReasoningEvent(transform.id, event);
                        }
                        dataStream.writeData({
                            type: 'reasoning',
                            status: 'start',
                            phase,
                            message: this.getReasoningMessage(phase as any)
                        });
                    };

                    const onReasoningEnd = (phase: string) => {
                        if (this.unifiedStreamingService) {
                            const event: ReasoningEvent = {
                                type: 'reasoning_end',
                                phase: phase as any,
                                timestamp: Date.now(),
                                modelName
                            };
                            this.unifiedStreamingService.broadcastReasoningEvent(transform.id, event);
                        }
                        dataStream.writeData({
                            type: 'reasoning',
                            status: 'end',
                            phase
                        });
                    };

                    // Execute the streaming LLM call with reasoning support
                    const result = await this.llmService.streamText(
                        finalPrompt,
                        onReasoningStart,
                        onReasoningEnd,
                        modelName
                    );

                    // Set up content accumulation and streaming
                    let accumulatedContent = '';
                    let previousContent = '';
                    let tokenCount = 0;

                    // Import spinner and processing utilities
                    const { processStreamingContent, ConsoleSpinner } = await import('../../common/utils/textCleaning');
                    const spinner = ConsoleSpinner.getInstance();

                    // Stream the content as it arrives
                    for await (const textPart of result.textStream) {
                        accumulatedContent += textPart;
                        tokenCount++;

                        // Process content for think mode detection
                        const { isThinking, thinkingStarted, thinkingEnded } = processStreamingContent(
                            accumulatedContent, 
                            previousContent
                        );

                        // Handle spinner for think mode
                        if (thinkingStarted) {
                            spinner.start(`Transform ${transform.id.substring(0, 8)} - AI thinking`);
                        } else if (thinkingEnded) {
                            spinner.stop();
                        }

                        // Send streaming content to client
                        dataStream.writeData({
                            type: 'content',
                            content: textPart,
                            accumulated: accumulatedContent
                        });

                        // Send periodic progress updates
                        if (tokenCount % 10 === 0) {
                            dataStream.writeData({
                                type: 'progress',
                                tokens: tokenCount,
                                message: isThinking ? 'AI thinking...' : 'Generating content...'
                            });
                        }

                        previousContent = accumulatedContent;
                    }

                    // Ensure spinner is stopped at the end
                    spinner.stop();

                    // Wait for final result
                    const finalResult = await result;

                    // Clean the response - remove think tags, code wrappers, etc.
                    const { cleanLLMContent } = await import('../../common/utils/textCleaning');
                    const cleanedContent = cleanLLMContent(accumulatedContent);

                    // Store LLM metadata
                    await this.transformRepo.addLLMTransform({
                        transform_id: transform.id,
                        model_name: modelName,
                        raw_response: cleanedContent,
                        token_usage: finalResult.usage ? {
                            prompt_tokens: (await finalResult.usage).promptTokens,
                            completion_tokens: (await finalResult.usage).completionTokens,
                            total_tokens: (await finalResult.usage).totalTokens
                        } : null
                    });

                    dataStream.writeData({
                        type: 'status',
                        message: 'Processing response...'
                    });

                    // Parse the cleaned response
                    let parsedData: any;
                    try {
                        const { robustJSONParse } = await import('../../common/utils/textCleaning');
                        parsedData = await robustJSONParse(accumulatedContent);
                    } catch (parseError) {
                        // Fallback: treat as plain text
                        parsedData = { content: cleanedContent, parse_error: true };
                    }

                    // Create output artifacts (same logic as non-streaming)
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
                    } else if (outputArtifactType === 'plot_outline') {
                        const plotArtifact = await this.artifactRepo.createArtifact(
                            userId,
                            'plot_outline',
                            parsedData,
                            outputArtifactTypeVersion
                        );
                        outputArtifacts.push(plotArtifact);
                    } else if (outputArtifactType === 'outline_components') {
                        // Use the same outline parsing logic from the regular method
                        const safeTrim = (value: any): string => {
                            if (typeof value === 'string') {
                                return value.trim();
                            } else if (Array.isArray(value)) {
                                return value.map(item => String(item).trim()).join('\\n');
                            } else if (typeof value === 'object' && value !== null) {
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

                        // Create individual component artifacts
                        const titleArtifact = await this.artifactRepo.createArtifact(
                            userId, 'outline_title', { title: safeTrim(parsedData.title) }, 'v1'
                        );
                        outputArtifacts.push(titleArtifact);

                        const genreArtifact = await this.artifactRepo.createArtifact(
                            userId, 'outline_genre', { genre: safeTrim(parsedData.genre) }, 'v1'
                        );
                        outputArtifacts.push(genreArtifact);

                        const sellingPointsArtifact = await this.artifactRepo.createArtifact(
                            userId, 'outline_selling_points', { selling_points: safeTrim(parsedData.selling_points) }, 'v1'
                        );
                        outputArtifacts.push(sellingPointsArtifact);

                        // Setting handling
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
                            userId, 'outline_setting', { setting: settingString }, 'v1'
                        );
                        outputArtifacts.push(settingArtifact);

                        const synopsisArtifact = await this.artifactRepo.createArtifact(
                            userId, 'outline_synopsis', { synopsis: safeTrim(parsedData.synopsis) }, 'v1'
                        );
                        outputArtifacts.push(synopsisArtifact);

                        // Characters if available
                        if (parsedData.main_characters && Array.isArray(parsedData.main_characters)) {
                            const charactersArtifact = await this.artifactRepo.createArtifact(
                                userId, 'outline_characters', { characters: parsedData.main_characters }, 'v1'
                            );
                            outputArtifacts.push(charactersArtifact);
                        }
                    } else {
                        // Create single output artifact
                        const outputArtifact = await this.artifactRepo.createArtifact(
                            userId,
                            outputArtifactType,
                            parsedData,
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

                    // Send completion data
                    dataStream.writeData({
                        type: 'complete',
                        transformId: transform.id,
                        artifacts: outputArtifacts.map(a => ({
                            id: a.id,
                            type: a.type,
                            data: a.data
                        })),
                        message: 'Generation completed successfully!',
                        // Include outline session info if available
                        ...(promptVariables.outline_session_id && {
                            outlineSessionId: promptVariables.outline_session_id
                        })
                    });

                } catch (error) {
                    // Update transform status to failed
                    await this.transformRepo.updateTransformStatus(transform.id, 'failed');

                    // Send error to stream
                    dataStream.writeData({
                        type: 'error',
                        message: error instanceof Error ? error.message : String(error),
                        transformId: transform.id
                    });

                    throw error;
                }
            },
            onError: (error) => {
                console.error('Stream error:', error);
                return error instanceof Error ? error.message : String(error);
            }
        });
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

    /**
     * Determine the generation phase from the artifact type
     */
    private getPhaseFromArtifactType(artifactType: string): string {
        switch (artifactType) {
            case 'brainstorm_idea':
                return 'brainstorming';
            case 'outline_components':
                return 'outline';
            case 'episode_synopsis':
                return 'synopsis';
            case 'episode_script':
                return 'script';
            default:
                return 'generation';
        }
    }

    /**
     * Get contextual reasoning message for each phase
     */
    private getReasoningMessage(phase: 'brainstorming' | 'outline' | 'synopsis' | 'script'): string {
        switch (phase) {
            case 'brainstorming':
                return 'Exploring creative possibilities...';
            case 'outline':
                return 'Structuring your story...';
            case 'synopsis':
                return 'Weaving narrative threads...';
            case 'script':
                return 'Bringing characters to life...';
            default:
                return 'Deep thinking in progress...';
        }
    }
} 