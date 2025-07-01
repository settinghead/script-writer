import { ArtifactRepository } from '../transform-artifact-framework/ArtifactRepository';
import { TransformRepository } from '../transform-artifact-framework/TransformRepository';
import { TransformExecutor } from './TransformExecutor';
import { Artifact, Transform } from '../types/artifacts';

export class ReplayService {
    constructor(
        private artifactRepo: ArtifactRepository,
        private transformRepo: TransformRepository,
        private transformExecutor: TransformExecutor
    ) { }

    // Replay a specific transform
    async replayTransform(userId: string, transformId: string): Promise<{
        originalTransform: any;
        replayedTransform: any;
        outputArtifacts: Artifact[];
        differences?: any;
    }> {
        // Get the original transform with all its data
        const originalTransform = await this.transformRepo.getTransform(transformId, userId);
        if (!originalTransform) {
            throw new Error('Transform not found');
        }

        if (originalTransform.type !== 'llm') {
            throw new Error('Only LLM transforms can be replayed');
        }

        // Get input artifacts
        const inputArtifactIds = originalTransform.inputs.map((input: any) => input.artifact_id);
        const inputArtifacts = await this.artifactRepo.getArtifactsByIds(inputArtifactIds, userId);

        // Get the original prompt
        const originalPrompt = originalTransform.llm_data?.prompts?.find((p: any) => p.prompt_role === 'primary');
        if (!originalPrompt) {
            throw new Error('Original prompt not found');
        }

        // Extract prompt variables from the original execution context
        const promptVariables = originalTransform.execution_context?.prompt_variables || {};

        // Determine output artifact type from original outputs
        const originalOutputIds = originalTransform.outputs.map((output: any) => output.artifact_id);
        const originalOutputs = await this.artifactRepo.getArtifactsByIds(originalOutputIds, userId);
        const outputType = originalOutputs.length > 0 ? originalOutputs[0].type : 'unknown';

        // Replay the transform with same inputs and prompt
        const { transform: replayedTransform, outputArtifacts } = await this.transformExecutor.executeLLMTransform(
            userId,
            inputArtifacts,
            originalPrompt.prompt_text,
            {}, // Empty variables since we're using the exact prompt
            outputType,
            'v1'
        );

        // Compare results
        const differences = this.compareTransformResults(originalOutputs, outputArtifacts);

        return {
            originalTransform,
            replayedTransform,
            outputArtifacts,
            differences
        };
    }

    // Compare transform results to identify differences
    private compareTransformResults(originalOutputs: Artifact[], replayedOutputs: Artifact[]): any {
        if (originalOutputs.length !== replayedOutputs.length) {
            return {
                type: 'count_mismatch',
                original_count: originalOutputs.length,
                replayed_count: replayedOutputs.length
            };
        }

        const differences = [];
        for (let i = 0; i < originalOutputs.length; i++) {
            const original = originalOutputs[i];
            const replayed = replayedOutputs[i];

            if (original.type !== replayed.type) {
                differences.push({
                    index: i,
                    type: 'type_mismatch',
                    original_type: original.type,
                    replayed_type: replayed.type
                });
                continue;
            }

            // Compare data content
            const originalStr = JSON.stringify(original.data);
            const replayedStr = JSON.stringify(replayed.data);

            if (originalStr !== replayedStr) {
                differences.push({
                    index: i,
                    type: 'data_difference',
                    original_data: original.data,
                    replayed_data: replayed.data,
                    similarity_score: this.calculateSimilarity(originalStr, replayedStr)
                });
            }
        }

        return {
            type: 'detailed_comparison',
            total_differences: differences.length,
            differences
        };
    }

    // Simple string similarity calculation
    private calculateSimilarity(str1: string, str2: string): number {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) return 1.0;

        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    // Levenshtein distance implementation
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    // Replay an entire workflow (chain of transforms)
    async replayWorkflow(userId: string, startingArtifactId: string): Promise<{
        original_chain: any[];
        replayed_chain: any[];
        workflow_differences: any[];
    }> {
        // Find the transform chain starting from the given artifact
        const transformChain = await this.buildTransformChain(userId, startingArtifactId);

        const originalChain = [];
        const replayedChain = [];
        const workflowDifferences = [];

        let currentInputs = [await this.artifactRepo.getArtifact(startingArtifactId, userId)];

        for (const transformId of transformChain) {
            try {
                const replayResult = await this.replayTransform(userId, transformId);

                originalChain.push(replayResult.originalTransform);
                replayedChain.push(replayResult.replayedTransform);

                if (replayResult.differences && replayResult.differences.total_differences > 0) {
                    workflowDifferences.push({
                        transform_id: transformId,
                        differences: replayResult.differences
                    });
                }

                // Update inputs for next transform
                currentInputs = replayResult.outputArtifacts;

            } catch (error) {
                workflowDifferences.push({
                    transform_id: transformId,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        return {
            original_chain: originalChain,
            replayed_chain: replayedChain,
            workflow_differences: workflowDifferences
        };
    }

    // Build a chain of transforms starting from an artifact
    private async buildTransformChain(userId: string, startingArtifactId: string): Promise<string[]> {
        const userTransforms = await this.transformRepo.getUserTransforms(userId);
        const chain: string[] = [];
        const visited = new Set<string>();

        let currentArtifactIds = [startingArtifactId];

        while (currentArtifactIds.length > 0) {
            const nextArtifactIds: string[] = [];

            for (const transform of userTransforms) {
                if (visited.has(transform.id)) continue;

                const inputs = await this.transformRepo.getTransformInputs(transform.id);
                const hasCurrentArtifact = inputs.some(input => currentArtifactIds.includes(input.artifact_id));

                if (hasCurrentArtifact) {
                    chain.push(transform.id);
                    visited.add(transform.id);

                    const outputs = await this.transformRepo.getTransformOutputs(transform.id);
                    nextArtifactIds.push(...outputs.map(output => output.artifact_id));
                }
            }

            currentArtifactIds = nextArtifactIds;
        }

        return chain;
    }

    // Get transform execution statistics
    async getTransformStats(userId: string): Promise<any> {
        const transforms = await this.transformRepo.getUserTransforms(userId);

        const stats = {
            total_transforms: transforms.length,
            by_type: {} as Record<string, number>,
            by_status: {} as Record<string, number>,
            avg_execution_time: 0,
            failed_transforms: [] as any[],
            llm_token_usage: {
                total_prompt_tokens: 0,
                total_completion_tokens: 0,
                total_cost_estimate: 0 // Assuming $0.001 per 1K tokens
            }
        };

        let totalExecutionTime = 0;
        let executionCount = 0;

        for (const transform of transforms) {
            // Count by type
            stats.by_type[transform.type] = (stats.by_type[transform.type] || 0) + 1;

            // Count by status
            stats.by_status[transform.status] = (stats.by_status[transform.status] || 0) + 1;

            // Track failed transforms
            if (transform.status === 'failed') {
                stats.failed_transforms.push({
                    id: transform.id,
                    created_at: transform.created_at,
                    execution_context: transform.execution_context
                });
            }

            // Calculate execution time if available
            if (transform.execution_context?.started_at) {
                const startTime = new Date(transform.execution_context.started_at).getTime();
                const endTime = new Date(transform.created_at).getTime();
                totalExecutionTime += endTime - startTime;
                executionCount++;
            }

            // Aggregate LLM token usage
            if (transform.type === 'llm') {
                const fullTransform = await this.transformRepo.getTransform(transform.id, userId);
                if (fullTransform?.llm_data?.token_usage) {
                    const usage = fullTransform.llm_data.token_usage;
                    stats.llm_token_usage.total_prompt_tokens += usage.prompt_tokens || 0;
                    stats.llm_token_usage.total_completion_tokens += usage.completion_tokens || 0;
                }
            }
        }

        if (executionCount > 0) {
            stats.avg_execution_time = totalExecutionTime / executionCount;
        }

        // Estimate cost (rough calculation)
        const totalTokens = stats.llm_token_usage.total_prompt_tokens + stats.llm_token_usage.total_completion_tokens;
        stats.llm_token_usage.total_cost_estimate = (totalTokens / 1000) * 0.001;

        return stats;
    }
} 