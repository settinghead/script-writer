import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { Artifact } from '../types/artifacts';

export class TransformExecutor {
    constructor(
        private artifactRepo: ArtifactRepository,
        private transformRepo: TransformRepository
    ) { }

    // Execute an LLM transform
    async executeLLMTransform(
        userId: string,
        inputArtifacts: Artifact[],
        promptTemplate: string,
        promptVariables: Record<string, string>,
        modelName: string = 'deepseek-chat',
        outputArtifactType: string,
        outputArtifactTypeVersion: string = 'v1'
    ): Promise<{ transform: any; outputArtifacts: Artifact[] }> {
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

            // Execute the LLM call
            const apiKey = process.env.DEEPSEEK_API_KEY;
            if (!apiKey) {
                throw new Error('DEEPSEEK_API_KEY not configured');
            }

            const deepseekAI = createOpenAI({
                apiKey,
                baseURL: 'https://api.deepseek.com',
            });

            const result = await generateText({
                model: deepseekAI(modelName),
                messages: [{ role: 'user', content: finalPrompt }]
            });

            // Store LLM metadata
            await this.transformRepo.addLLMTransform({
                transform_id: transform.id,
                model_name: modelName,
                raw_response: result.text,
                token_usage: result.usage ? {
                    prompt_tokens: result.usage.promptTokens,
                    completion_tokens: result.usage.completionTokens,
                    total_tokens: result.usage.totalTokens
                } : null
            });

            // Parse the response based on output type
            let parsedData: any;
            try {
                if (outputArtifactType === 'plot_outline') {
                    parsedData = JSON.parse(result.text);
                } else if (outputArtifactType === 'brainstorm_idea') {
                    // For brainstorm ideas, expect a JSON array
                    const ideas = JSON.parse(result.text);
                    if (!Array.isArray(ideas)) {
                        throw new Error('Expected array of ideas');
                    }
                    parsedData = ideas;
                } else if (outputArtifactType === 'outline_components') {
                    // For outline components, parse into individual components
                    const components = JSON.parse(result.text);
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
                    parsedData = { content: result.text };
                }
            } catch (parseError) {
                // Try with jsonrepair if available
                try {
                    const { jsonrepair } = await import('jsonrepair');
                    const repairedJson = jsonrepair(result.text);
                    parsedData = JSON.parse(repairedJson);
                } catch (repairError) {
                    // Fallback: treat as plain text
                    parsedData = { content: result.text, parse_error: true };
                }
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