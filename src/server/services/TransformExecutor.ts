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