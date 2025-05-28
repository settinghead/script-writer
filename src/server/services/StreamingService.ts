import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { jsonrepair } from 'jsonrepair';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { Artifact } from '../types/artifacts';
// import { CompletionUsage } from 'ai/prompts'; // Assuming CompletionUsage structure { promptTokens, completionTokens, totalTokens }

interface ActiveStream {
    stream: ReadableStream<Uint8Array>;
    transformId: string;
    userId: string;
    outputArtifactType: string;
    outputArtifactTypeVersion: string;
    modelName: string; // Added
    usagePromise: Promise<any>; // Changed from CompletionUsage to any, to be resolved later: Promise<CompletionUsage>
    // To store incoming chunks for jsonrepair
    rawJsonBuffer: string;
    // To store the full response once streaming is complete
    fullResponse: string;
    // Promise that resolves when the stream is fully processed
    processingPromise: Promise<void>;
    // Callback to send data to the client
    sendDataToClient?: (data: string) => void;
}

export class StreamingService {
    private activeStreams: Map<string, ActiveStream> = new Map();

    constructor(
        private artifactRepo: ArtifactRepository,
        private transformRepo: TransformRepository
    ) { }

    public registerStream(
        transformId: string,
        userId: string,
        stream: ReadableStream<Uint8Array>,
        outputArtifactType: string,
        outputArtifactTypeVersion: string = 'v1',
        modelName: string, // Added
        usagePromise: Promise<any> // Added, to be resolved later: Promise<CompletionUsage>
    ): string {
        const streamId = uuidv4(); // Internal ID for managing this stream instance if needed

        const activeStreamOmit: Omit<ActiveStream, 'processingPromise'> = {
            stream,
            transformId,
            userId,
            outputArtifactType,
            outputArtifactTypeVersion,
            modelName, // Store modelName
            usagePromise, // Store usagePromise
            rawJsonBuffer: '',
            fullResponse: '',
        };

        // Type assertion is needed because processingPromise is not yet assigned
        const activeStream = activeStreamOmit as ActiveStream;
        activeStream.processingPromise = this.processStream(activeStream);
        this.activeStreams.set(transformId, activeStream);

        return streamId;
    }

    private async processStream(activeStream: ActiveStream): Promise<void> {
        const reader = activeStream.stream.getReader();
        const decoder = new TextDecoder();
        let accumulatedData = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                const chunk = decoder.decode(value, { stream: true });
                accumulatedData += chunk;
                activeStream.rawJsonBuffer += chunk; // Keep raw buffer for potential later use or full repair

                // Attempt to repair and send partial JSON
                if (activeStream.sendDataToClient) {
                    try {
                        // Try to repair only if it looks like JSON (starts with { or [)
                        const trimmedBuffer = activeStream.rawJsonBuffer.trimStart();
                        if (trimmedBuffer.startsWith('{') || trimmedBuffer.startsWith('[')) {
                            const repairedJson = jsonrepair(activeStream.rawJsonBuffer);
                            activeStream.sendDataToClient(JSON.stringify({ type: 'partial', data: JSON.parse(repairedJson) }));
                        } else {
                            // If not clearly JSON, send as text update
                            activeStream.sendDataToClient(JSON.stringify({ type: 'text_chunk', data: chunk }));
                        }
                    } catch (error) {
                        // Not a valid partial JSON yet, or jsonrepair failed.
                        // Send the raw chunk as a progress update if needed, or wait for more data.
                        // For now, we'll just log, client will eventually get the full repaired one.
                        // console.warn('Partial JSON repair failed, waiting for more data:', error);
                        if (activeStream.sendDataToClient) {
                            activeStream.sendDataToClient(JSON.stringify({ type: 'text_chunk', data: chunk, warning: 'JSON parse pending' }));
                        }
                    }
                }
            }
            // Append final chunk if any
            const finalChunk = decoder.decode(undefined, { stream: false });
            if (finalChunk) {
                accumulatedData += finalChunk;
                activeStream.rawJsonBuffer += finalChunk;
            }

            activeStream.fullResponse = accumulatedData;
            let usageData = null;
            try {
                usageData = await activeStream.usagePromise; // Resolve the usage promise
            } catch (usageError) {
                console.error(`Failed to get usage data for transform ${activeStream.transformId}:`, usageError);
            }

            // Final repair attempt on the complete data
            let finalParsedData: any;
            try {
                const repairedJson = jsonrepair(activeStream.fullResponse);
                finalParsedData = JSON.parse(repairedJson);
                if (activeStream.sendDataToClient) {
                    activeStream.sendDataToClient(JSON.stringify({ type: 'final', data: finalParsedData }));
                }
            } catch (parseError) {
                console.error(`Failed to parse final JSON for transform ${activeStream.transformId}:`, parseError);
                console.error('Original response was:', activeStream.fullResponse);
                finalParsedData = { content: activeStream.fullResponse, parse_error: true, error_details: (parseError as Error).message };
                if (activeStream.sendDataToClient) {
                    activeStream.sendDataToClient(JSON.stringify({ type: 'error', message: 'Failed to parse final JSON.', details: (parseError as Error).message, rawResponse: activeStream.fullResponse.slice(0, 1000) + '...' }));
                }
                await this.transformRepo.updateTransformStatus(activeStream.transformId, 'failed_parsing');
                // Record LLM transform details even on parsing failure (with raw response)
                await this.transformRepo.addLLMTransform({
                    transform_id: activeStream.transformId,
                    model_name: activeStream.modelName,
                    raw_response: activeStream.fullResponse,
                    token_usage: usageData ? {
                        prompt_tokens: usageData.promptTokens,
                        completion_tokens: usageData.completionTokens,
                        total_tokens: usageData.totalTokens
                    } : null,
                    model_parameters: null // Or pass if available
                });
                return; // Stop further processing if final parsing fails
            }

            // Create output artifact(s)
            const outputArtifacts: Artifact[] = [];
            // This logic needs to be as robust as the original one in TransformExecutor
            // For simplicity, creating a single artifact here. Adapt as needed based on outputArtifactType.
            if (activeStream.outputArtifactType === 'brainstorm_idea' && Array.isArray(finalParsedData)) {
                for (let i = 0; i < finalParsedData.length; i++) {
                    const ideaArtifact = await this.artifactRepo.createArtifact(
                        activeStream.userId,
                        'brainstorm_idea',
                        {
                            idea_text: finalParsedData[i], // Assuming each item is the idea text
                            order_index: i,
                        },
                        activeStream.outputArtifactTypeVersion
                    );
                    outputArtifacts.push(ideaArtifact);
                }
            } else if (finalParsedData && typeof finalParsedData === 'object') {
                const outputArtifact = await this.artifactRepo.createArtifact(
                    activeStream.userId,
                    activeStream.outputArtifactType,
                    finalParsedData,
                    activeStream.outputArtifactTypeVersion
                );
                outputArtifacts.push(outputArtifact);
            } else {
                // Fallback for non-object data or unexpected structure
                const outputArtifact = await this.artifactRepo.createArtifact(
                    activeStream.userId,
                    activeStream.outputArtifactType,
                    { content: activeStream.fullResponse, unexpected_structure: true },
                    activeStream.outputArtifactTypeVersion
                );
                outputArtifacts.push(outputArtifact);
            }

            await this.transformRepo.addTransformOutputs(
                activeStream.transformId,
                outputArtifacts.map(artifact => ({ artifactId: artifact.id }))
            );

            // This call to addLLMTransform will now create the full record or update if a stub was made by TransformExecutor
            await this.transformRepo.addLLMTransform({
                transform_id: activeStream.transformId,
                model_name: activeStream.modelName,
                raw_response: activeStream.fullResponse,
                token_usage: usageData ? {
                    prompt_tokens: usageData.promptTokens,
                    completion_tokens: usageData.completionTokens,
                    total_tokens: usageData.totalTokens
                } : null,
                // model_parameters: null // Or pass if available/needed for streaming calls
            });

            await this.transformRepo.updateTransformStatus(activeStream.transformId, 'completed');
            // TODO: Update llm_transforms with model_name, raw_response, token_usage
            // This information (model_name, token_usage) needs to be passed into registerStream or captured earlier.
            // For now, just storing raw_response.

        } catch (error) {
            console.error(`Error processing stream for transform ${activeStream.transformId}:`, error);
            await this.transformRepo.updateTransformStatus(activeStream.transformId, 'failed_streaming');
            if (activeStream.sendDataToClient) {
                activeStream.sendDataToClient(JSON.stringify({ type: 'error', message: 'Error during streaming process.', details: (error as Error).message }));
            }
            // Attempt to record LLM transform details even on streaming failure if some data was collected
            const usageDataOnError = activeStream.usagePromise ? await activeStream.usagePromise.catch(() => null) : null;
            await this.transformRepo.addLLMTransform({
                transform_id: activeStream.transformId,
                model_name: activeStream.modelName,
                raw_response: activeStream.fullResponse || 'Streaming error, no response captured',
                token_usage: usageDataOnError ? {
                    prompt_tokens: usageDataOnError.promptTokens,
                    completion_tokens: usageDataOnError.completionTokens,
                    total_tokens: usageDataOnError.totalTokens
                } : null,
                model_parameters: null // Or pass if available
            }).catch(dbError => console.error("Failed to save error details to llm_transforms", dbError));
        } finally {
            if (activeStream.sendDataToClient) {
                activeStream.sendDataToClient(JSON.stringify({ type: 'stream_end' }));
            }
            this.activeStreams.delete(activeStream.transformId); // Clean up
            console.log(`Finished processing and cleaned up stream for transform ${activeStream.transformId}`);
        }
    }

    public subscribeToStream(transformId: string, sendDataCallback: (data: string) => void): boolean {
        const activeStream = this.activeStreams.get(transformId);
        if (activeStream) {
            activeStream.sendDataToClient = sendDataCallback;
            // If there's already buffered data, try to send it
            if (activeStream.rawJsonBuffer.length > 0) {
                try {
                    const trimmedBuffer = activeStream.rawJsonBuffer.trimStart();
                    if (trimmedBuffer.startsWith('{') || trimmedBuffer.startsWith('[')) {
                        const repairedJson = jsonrepair(activeStream.rawJsonBuffer);
                        sendDataCallback(JSON.stringify({ type: 'partial', data: JSON.parse(repairedJson) }));
                    } else {
                        sendDataCallback(JSON.stringify({ type: 'buffered_text', data: activeStream.rawJsonBuffer }));
                    }
                } catch (e) {
                    // console.warn("Error sending buffered partial JSON on subscribe", e);
                    sendDataCallback(JSON.stringify({ type: 'buffered_text', data: activeStream.rawJsonBuffer, warning: 'JSON parse pending' }));
                }
            }
            return true;
        }
        return false;
    }

    public async getFullResponse(transformId: string): Promise<string | null> {
        const activeStream = this.activeStreams.get(transformId);
        if (activeStream) {
            await activeStream.processingPromise; // Wait for stream to finish
            return activeStream.fullResponse;
        }
        // If stream not active, it might have completed.
        // The actual artifact should be retrieved via TransformRepository or ArtifactRepository.
        // This method is more for cases where the stream recently finished.
        return null;
    }

    public isStreaming(transformId: string): boolean {
        return this.activeStreams.has(transformId);
    }
} 