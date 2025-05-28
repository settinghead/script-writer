import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { jsonrepair } from 'jsonrepair';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { Artifact } from '../types/artifacts';

export interface StreamingUpdate {
    type: 'partial_json' | 'complete' | 'error' | 'progress';
    data?: any;
    rawContent?: string;
    parsedContent?: any;
    error?: string;
    progress?: {
        stage: string;
        percentage?: number;
    };
}

export interface StreamingTransformResult {
    transformId: string;
    outputArtifacts: Artifact[];
}

export class StreamingTransformExecutor {
    constructor(
        private artifactRepo: ArtifactRepository,
        private transformRepo: TransformRepository
    ) { }

    // Execute a streaming LLM transform with real-time updates
    async executeStreamingLLMTransform(
        userId: string,
        inputArtifacts: Artifact[],
        promptTemplate: string,
        promptVariables: Record<string, string>,
        outputArtifactType: string,
        onUpdate: (update: StreamingUpdate) => void,
        modelName: string = 'deepseek-chat',
        outputArtifactTypeVersion: string = 'v1'
    ): Promise<StreamingTransformResult> {
        // Create the transform
        const transform = await this.transformRepo.createTransform(
            userId,
            'llm',
            'v1',
            'running',
            {
                started_at: new Date().toISOString(),
                model_name: modelName,
                prompt_variables: promptVariables,
                streaming: true
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

            onUpdate({
                type: 'progress',
                progress: { stage: 'Initializing LLM request...', percentage: 10 }
            });

            // Execute the streaming LLM call
            const apiKey = process.env.DEEPSEEK_API_KEY;
            if (!apiKey) {
                throw new Error('DEEPSEEK_API_KEY not configured');
            }

            const deepseekAI = createOpenAI({
                apiKey,
                baseURL: 'https://api.deepseek.com',
            });

            onUpdate({
                type: 'progress',
                progress: { stage: 'Connecting to AI model...', percentage: 20 }
            });

            const result = await streamText({
                model: deepseekAI(modelName),
                messages: [{ role: 'user', content: finalPrompt }],
                response_format: { type: 'json_object' }
            });

            onUpdate({
                type: 'progress',
                progress: { stage: 'Receiving response...', percentage: 30 }
            });

            // Process the streaming response
            let fullResponse = '';
            let lastValidJson: any = null;
            let tokenCount = 0;

            for await (const textPart of result.textStream) {
                fullResponse += textPart;
                tokenCount++;

                // Try to parse partial JSON every few tokens to avoid excessive parsing
                if (tokenCount % 5 === 0) {
                    const partialResult = this.tryParsePartialJson(fullResponse, outputArtifactType);
                    if (partialResult.success && partialResult.data !== lastValidJson) {
                        lastValidJson = partialResult.data;
                        onUpdate({
                            type: 'partial_json',
                            rawContent: fullResponse,
                            parsedContent: partialResult.data,
                            data: this.formatForDisplay(partialResult.data, outputArtifactType)
                        });
                    }
                }

                // Update progress based on estimated completion
                const progressPercentage = Math.min(30 + (tokenCount * 0.5), 90);
                if (tokenCount % 20 === 0) {
                    onUpdate({
                        type: 'progress',
                        progress: {
                            stage: 'Generating content...',
                            percentage: progressPercentage
                        }
                    });
                }
            }

            onUpdate({
                type: 'progress',
                progress: { stage: 'Processing final response...', percentage: 95 }
            });

            // Get final usage stats
            const usage = await result.usage;

            // Store LLM metadata
            await this.transformRepo.addLLMTransform({
                transform_id: transform.id,
                model_name: modelName,
                raw_response: fullResponse,
                token_usage: usage ? {
                    prompt_tokens: usage.promptTokens,
                    completion_tokens: usage.completionTokens,
                    total_tokens: usage.totalTokens
                } : null
            });

            // Parse the final response
            const finalResult = this.parseCompleteResponse(fullResponse, outputArtifactType);

            // Create output artifacts
            const outputArtifacts = await this.createOutputArtifacts(
                userId,
                finalResult.parsedData,
                outputArtifactType,
                outputArtifactTypeVersion
            );

            // Link output artifacts
            await this.transformRepo.addTransformOutputs(
                transform.id,
                outputArtifacts.map(artifact => ({ artifactId: artifact.id }))
            );

            // Update transform status
            await this.transformRepo.updateTransformStatus(transform.id, 'completed');

            onUpdate({
                type: 'complete',
                data: this.formatForDisplay(finalResult.parsedData, outputArtifactType),
                parsedContent: finalResult.parsedData
            });

            return {
                transformId: transform.id,
                outputArtifacts
            };

        } catch (error) {
            // Update transform status to failed
            await this.transformRepo.updateTransformStatus(transform.id, 'failed');

            onUpdate({
                type: 'error',
                error: error instanceof Error ? error.message : String(error)
            });

            throw error;
        }
    }

    // Try to parse partial JSON using jsonrepair
    private tryParsePartialJson(content: string, outputType: string): { success: boolean; data?: any } {
        try {
            // First try direct parsing
            const parsed = JSON.parse(content);
            return { success: true, data: parsed };
        } catch {
            try {
                // Try with jsonrepair
                const repaired = jsonrepair(content);
                const parsed = JSON.parse(repaired);
                return { success: true, data: parsed };
            } catch {
                // If still fails, try to extract partial object
                return this.extractPartialObject(content, outputType);
            }
        }
    }

    // Extract partial object from incomplete JSON
    private extractPartialObject(content: string, outputType: string): { success: boolean; data?: any } {
        try {
            // Look for opening brace
            const startIndex = content.indexOf('{');
            if (startIndex === -1) return { success: false };

            // Try to find a reasonable stopping point
            let braceCount = 0;
            let inString = false;
            let escaped = false;
            let lastValidIndex = startIndex;

            for (let i = startIndex; i < content.length; i++) {
                const char = content[i];

                if (escaped) {
                    escaped = false;
                    continue;
                }

                if (char === '\\') {
                    escaped = true;
                    continue;
                }

                if (char === '"') {
                    inString = !inString;
                    continue;
                }

                if (!inString) {
                    if (char === '{') {
                        braceCount++;
                    } else if (char === '}') {
                        braceCount--;
                        if (braceCount === 0) {
                            lastValidIndex = i + 1;
                            break;
                        }
                    } else if (char === ',' && braceCount === 1) {
                        lastValidIndex = i;
                    }
                }
            }

            // Try to parse the partial content
            const partialContent = content.substring(startIndex, lastValidIndex);
            if (partialContent.endsWith(',')) {
                // Remove trailing comma and try to close the object
                const cleaned = partialContent.slice(0, -1) + '}';
                const repaired = jsonrepair(cleaned);
                const parsed = JSON.parse(repaired);
                return { success: true, data: parsed };
            }

            return { success: false };
        } catch {
            return { success: false };
        }
    }

    // Parse the complete response
    private parseCompleteResponse(content: string, outputType: string): { parsedData: any } {
        try {
            const parsed = JSON.parse(content);
            return { parsedData: parsed };
        } catch {
            try {
                const repaired = jsonrepair(content);
                const parsed = JSON.parse(repaired);
                return { parsedData: parsed };
            } catch (error) {
                // Fallback: treat as plain text
                return {
                    parsedData: {
                        content: content,
                        parse_error: true,
                        error_message: error instanceof Error ? error.message : String(error)
                    }
                };
            }
        }
    }

    // Format data for visual display
    private formatForDisplay(data: any, outputType: string): any {
        if (!data || typeof data !== 'object') {
            return { content: String(data) };
        }

        switch (outputType) {
            case 'outline_components':
                return this.formatOutlineForDisplay(data);
            case 'brainstorm_idea':
                return this.formatBrainstormForDisplay(data);
            case 'plot_outline':
                return this.formatPlotOutlineForDisplay(data);
            default:
                return data;
        }
    }

    // Format outline components for hierarchical display
    private formatOutlineForDisplay(data: any): any {
        const sections = [];

        if (data.title) {
            sections.push({
                key: 'title',
                label: '剧名',
                content: data.title,
                icon: '🎬',
                complete: true
            });
        }

        if (data.genre) {
            sections.push({
                key: 'genre',
                label: '题材类型',
                content: data.genre,
                icon: '🎭',
                complete: true
            });
        }

        if (data.selling_points) {
            const points = Array.isArray(data.selling_points)
                ? data.selling_points
                : [data.selling_points];
            sections.push({
                key: 'selling_points',
                label: '核心看点',
                content: points,
                icon: '⭐',
                complete: true,
                isList: true
            });
        }

        if (data.setting) {
            let settingContent = data.setting;
            if (typeof data.setting === 'object') {
                settingContent = {
                    summary: data.setting.core_setting_summary || '',
                    scenes: data.setting.key_scenes || []
                };
            }
            sections.push({
                key: 'setting',
                label: '故事设定',
                content: settingContent,
                icon: '🌍',
                complete: true,
                isStructured: typeof settingContent === 'object'
            });
        }

        if (data.main_characters && Array.isArray(data.main_characters)) {
            sections.push({
                key: 'characters',
                label: '主要人物',
                content: data.main_characters,
                icon: '👥',
                complete: true,
                isCharacterList: true
            });
        }

        if (data.synopsis) {
            sections.push({
                key: 'synopsis',
                label: '故事梗概',
                content: data.synopsis,
                icon: '📖',
                complete: true,
                isLongText: true
            });
        }

        return {
            type: 'outline',
            sections,
            completionPercentage: (sections.filter(s => s.complete).length / 5) * 100
        };
    }

    // Format brainstorm ideas for display
    private formatBrainstormForDisplay(data: any): any {
        if (Array.isArray(data)) {
            return {
                type: 'brainstorm',
                ideas: data.map((idea, index) => ({
                    id: index,
                    title: typeof idea === 'object' ? idea.title : `想法 ${index + 1}`,
                    content: typeof idea === 'object' ? idea.body : idea,
                    complete: true
                })),
                completionPercentage: 100
            };
        }
        return { type: 'brainstorm', ideas: [], completionPercentage: 0 };
    }

    // Format plot outline for display
    private formatPlotOutlineForDisplay(data: any): any {
        return {
            type: 'plot_outline',
            mediaType: data.media_type || '',
            platform: data.platform || '',
            outline: data.plot_outline || '',
            analysis: data.analysis || '',
            complete: !!(data.plot_outline && data.analysis)
        };
    }

    // Create output artifacts based on parsed data
    private async createOutputArtifacts(
        userId: string,
        parsedData: any,
        outputArtifactType: string,
        outputArtifactTypeVersion: string
    ): Promise<Artifact[]> {
        const outputArtifacts: Artifact[] = [];

        if (outputArtifactType === 'brainstorm_idea' && Array.isArray(parsedData)) {
            // Create multiple idea artifacts
            for (let i = 0; i < parsedData.length; i++) {
                const ideaText = typeof parsedData[i] === 'object'
                    ? parsedData[i].body || parsedData[i].content || String(parsedData[i])
                    : String(parsedData[i]);

                const ideaArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'brainstorm_idea',
                    {
                        idea_text: ideaText,
                        order_index: i,
                        confidence_score: null
                    },
                    outputArtifactTypeVersion
                );
                outputArtifacts.push(ideaArtifact);
            }
        } else if (outputArtifactType === 'outline_components') {
            // Create individual outline component artifacts
            const safeTrim = (value: any): string => {
                if (typeof value === 'string') {
                    return value.trim();
                } else if (Array.isArray(value)) {
                    return value.map(item => String(item).trim()).join('\n');
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
            if (parsedData.title) {
                const titleArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'outline_title',
                    { title: safeTrim(parsedData.title) },
                    'v1'
                );
                outputArtifacts.push(titleArtifact);
            }

            if (parsedData.genre) {
                const genreArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'outline_genre',
                    { genre: safeTrim(parsedData.genre) },
                    'v1'
                );
                outputArtifacts.push(genreArtifact);
            }

            if (parsedData.selling_points) {
                const sellingPointsArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'outline_selling_points',
                    { selling_points: safeTrim(parsedData.selling_points) },
                    'v1'
                );
                outputArtifacts.push(sellingPointsArtifact);
            }

            if (parsedData.setting) {
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
                    settingString = safeTrim(parsedData.setting);
                }

                const settingArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'outline_setting',
                    { setting: settingString },
                    'v1'
                );
                outputArtifacts.push(settingArtifact);
            }

            if (parsedData.synopsis) {
                const synopsisArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'outline_synopsis',
                    { synopsis: safeTrim(parsedData.synopsis) },
                    'v1'
                );
                outputArtifacts.push(synopsisArtifact);
            }

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
            // Create single output artifact
            const outputArtifact = await this.artifactRepo.createArtifact(
                userId,
                outputArtifactType,
                parsedData,
                outputArtifactTypeVersion
            );
            outputArtifacts.push(outputArtifact);
        }

        return outputArtifacts;
    }
} 