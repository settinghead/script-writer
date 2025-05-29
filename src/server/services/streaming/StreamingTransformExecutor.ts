import { createOpenAI } from '@ai-sdk/openai';
import { streamText, createDataStreamResponse } from 'ai';
import { Response } from 'express';
import { jsonrepair } from 'jsonrepair';
import { ArtifactRepository } from '../../repositories/ArtifactRepository';
import { TransformRepository } from '../../repositories/TransformRepository';
import { TemplateService } from '../templates/TemplateService';
import { StreamingRequest } from '../../../common/streaming/types';
import { Artifact } from '../../types/artifacts';

export class StreamingTransformExecutor {
    constructor(
        private artifactRepo: ArtifactRepository,
        private transformRepo: TransformRepository,
        private templateService: TemplateService
    ) { }

    async executeStreamingTransform(
        userId: string,
        request: StreamingRequest,
        res: Response
    ): Promise<void> {
        try {
            // 1. Load artifacts (if any)
            const artifacts = await this.loadArtifacts(userId, request.artifactIds);

            // 2. Get and render template
            const template = this.templateService.getTemplate(request.templateId);
            if (!template) {
                throw new Error(`Template not found: ${request.templateId}`);
            }

            const prompt = await this.templateService.renderTemplate(template, {
                artifacts: this.mapArtifactsToContext(artifacts),
                params: request.templateParams || {}
            });

            // 3. Create transform record
            const transform = await this.createTransform(userId, artifacts, template.id);

            // 4. Stream LLM response
            await this.streamLLMResponse(
                prompt,
                request.modelName || 'deepseek-chat',
                template.outputFormat,
                transform,
                res,
                userId
            );

        } catch (error) {
            console.error('Error in streaming transform:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Streaming failed',
                    details: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }

    private async loadArtifacts(userId: string, artifactIds: string[]): Promise<Artifact[]> {
        if (artifactIds.length === 0) return [];

        const artifacts: Artifact[] = [];
        for (const id of artifactIds) {
            const artifact = await this.artifactRepo.getArtifact(userId, id);
            if (artifact) {
                artifacts.push(artifact);
            }
        }
        return artifacts;
    }

    private mapArtifactsToContext(artifacts: Artifact[]): Record<string, any> {
        const context: Record<string, any> = {};
        for (const artifact of artifacts) {
            context[artifact.type] = artifact.data;
        }
        return context;
    }

    private async createTransform(userId: string, artifacts: Artifact[], templateId: string) {
        const transform = await this.transformRepo.createTransform(
            userId,
            'llm',
            'v1',
            'running',
            {
                started_at: new Date().toISOString(),
                template_id: templateId,
                model_name: 'deepseek-chat'
            }
        );

        // Link input artifacts
        if (artifacts.length > 0) {
            await this.transformRepo.addTransformInputs(
                transform.id,
                artifacts.map(artifact => ({ artifactId: artifact.id }))
            );
        }

        return transform;
    }

    private async streamLLMResponse(
        prompt: string,
        modelName: string,
        outputFormat: string,
        transform: any,
        res: Response,
        userId: string
    ): Promise<void> {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            throw new Error('DEEPSEEK_API_KEY not configured');
        }

        const deepseekAI = createOpenAI({
            apiKey,
            baseURL: 'https://api.deepseek.com',
        });

        // Store the prompt
        await this.transformRepo.addLLMPrompts(transform.id, [
            { promptText: prompt, promptRole: 'primary' }
        ]);

        const result = await streamText({
            model: deepseekAI(modelName),
            messages: [{ role: 'user', content: prompt }]
        });

        // Set up the data stream response
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        const pump = async () => {
            try {
                for await (const chunk of result.textStream) {
                    res.write(`0:${JSON.stringify(chunk)}\n`);
                }

                // Handle completion
                const finalResult = await result;
                const text = await finalResult.text;
                const usage = await finalResult.usage;

                try {
                    // Mark transform as completed
                    await this.transformRepo.updateTransformStatus(transform.id, 'completed');

                    // Update LLM transform data
                    await this.transformRepo.addLLMTransform({
                        transform_id: transform.id,
                        model_name: modelName,
                        raw_response: text,
                        token_usage: usage
                    });

                    // Parse and create output artifacts
                    let jsonData: any[] = [];

                    try {
                        // Clean the text content
                        let cleanContent = text.trim();
                        if (cleanContent.startsWith('```json')) {
                            cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                        } else if (cleanContent.startsWith('```')) {
                            cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
                        }

                        // Use jsonrepair for more robust parsing
                        const repairedJson = jsonrepair(cleanContent);
                        jsonData = JSON.parse(repairedJson);

                        if (!Array.isArray(jsonData)) {
                            throw new Error('Response is not a JSON array');
                        }

                        console.log(`Parsed ${jsonData.length} items from LLM response`);
                    } catch (parseError) {
                        console.error('Error parsing JSON response:', parseError);
                        console.error('Raw content:', text);
                        console.error('Content length:', text.length);

                        // Try a more aggressive cleaning approach
                        try {
                            let fallbackContent = text.trim();
                            // Remove any trailing incomplete JSON
                            const lastBracket = fallbackContent.lastIndexOf('}');
                            if (lastBracket > 0) {
                                fallbackContent = fallbackContent.substring(0, lastBracket + 1) + ']';
                            }

                            const repairedFallback = jsonrepair(fallbackContent);
                            jsonData = JSON.parse(repairedFallback);

                            if (Array.isArray(jsonData)) {
                                console.log(`Fallback parsing succeeded with ${jsonData.length} items`);
                            } else {
                                throw new Error('Fallback parsing failed - not an array');
                            }
                        } catch (fallbackError) {
                            console.error('Fallback parsing also failed:', fallbackError);
                            throw parseError; // Throw original error
                        }
                    }

                    // Create output artifacts
                    if (jsonData.length > 0) {
                        await this.createOutputArtifacts(userId, transform, jsonData, text);
                    }

                    console.log(`Transform ${transform.id} completed successfully`);
                } catch (error) {
                    console.error('Error in completion handler:', error);
                    await this.transformRepo.updateTransformStatus(transform.id, 'failed');
                    throw error;
                }

                // Send completion events
                res.write(`e:${JSON.stringify({ finishReason: finalResult.finishReason, usage })}\n`);
                res.write(`d:${JSON.stringify({ finishReason: finalResult.finishReason, usage })}\n`);
                res.end();

            } catch (error) {
                console.error('Streaming error:', error);
                await this.transformRepo.updateTransformStatus(transform.id, 'failed');
                res.write(`error:${JSON.stringify({ error: error.message })}\n`);
                res.end();
            }
        };
        pump();
    }

    private async createOutputArtifacts(
        userId: string,
        transform: any,
        jsonData: any[],
        rawContent: string
    ): Promise<void> {
        try {
            // Create individual brainstorm idea artifacts
            for (let i = 0; i < jsonData.length; i++) {
                const item = jsonData[i];

                // Transform the LLM response format to match BrainstormIdeaV1
                const brainstormIdeaData = {
                    idea_text: item.body || item.text || String(item),
                    idea_title: item.title,
                    order_index: i,
                    confidence_score: item.confidence_score || undefined
                };

                const artifact = await this.artifactRepo.createArtifact(
                    userId,
                    'brainstorm_idea',
                    brainstormIdeaData,
                    'v1',
                    { transform_id: transform.id }
                );

                // Link artifact as transform output
                await this.transformRepo.addTransformOutputs(transform.id, [
                    { artifactId: artifact.id, outputRole: `idea_${i}` }
                ]);
            }

            console.log(`Created ${jsonData.length} brainstorm idea artifacts for transform ${transform.id}`);
        } catch (error) {
            console.error('Error creating brainstorm idea artifacts:', error);
            throw error;
        }
    }
} 