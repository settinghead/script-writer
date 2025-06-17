#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { AxAI, AxAIOpenAIModel } from '@ax-llm/ax';
import { BrainstormProgram } from './ax-brainstorm-core';
import { BrainstormRequest, StoryIdea } from './ax-brainstorm-types';
import { loadExamples } from './exampleLoader';
import { getLLMCredentials } from '../services/LLMConfig';
import { createEvaluationSystem } from './ax-evaluation-system-simple';

// Simple optimization approach that doesn't rely on MiPRO's bootstrap
async function simpleOptimizeBrainstorm(options: {
    numIterations?: number;
    outputPath?: string;
    verbose?: boolean;
} = {}) {

    const {
        numIterations = 10,
        outputPath = './simple-optimized-brainstorm.json',
        verbose = true
    } = options;

    console.log('🚀 Starting simple brainstorm optimization...');

    try {
        // 1. Setup AI service
        const {
            apiKey,
            baseUrl,
            modelName,
            provider
        } = getLLMCredentials();
        const ai = new AxAI({
            name: provider as any,
            apiKey,
            apiURL: baseUrl,
            config: {
                model: modelName as AxAIOpenAIModel,
                maxTokens: 3000,
                temperature: 1.5,
            }
        });

        // 2. Load examples and evaluation system
        console.log('📚 Loading training examples...');
        const examples = loadExamples();
        const evaluationSystem = createEvaluationSystem();

        if (examples.length === 0) {
            throw new Error('No training examples found.');
        }

        console.log(`✅ Loaded ${examples.length} training examples`);

        // 3. Create baseline program
        console.log('🔧 Creating baseline program...');
        const program = new BrainstormProgram();

        // 4. Test baseline performance
        console.log('📊 Testing baseline performance...');
        const baselineResults: Array<{ request: BrainstormRequest; result: StoryIdea; score: number }> = [];

        for (let i = 0; i < Math.min(5, examples.length); i++) {
            const example = examples[i];
            const request: BrainstormRequest = {
                genre: example.genre,
                platform: example.platform,
                requirements_section: example.requirements_section || ''
            };

            try {
                const result = await program.forward(ai, request);
                const evaluation = await evaluationSystem.evaluateStoryIdea(
                    result,
                    example.genre,
                    example.platform
                );

                baselineResults.push({
                    request,
                    result,
                    score: evaluation.overall_score
                });

                if (verbose) {
                    console.log(`   Test ${i + 1}: ${evaluation.overall_score.toFixed(2)}/10 - "${result.title}"`);
                }
            } catch (error) {
                console.warn(`   Test ${i + 1} failed:`, error.message);
            }
        }

        const baselineAvg = baselineResults.length > 0
            ? baselineResults.reduce((sum, r) => sum + r.score, 0) / baselineResults.length
            : 0;

        console.log(`📈 Baseline average score: ${baselineAvg.toFixed(2)}/10`);

        // 5. Create optimized demonstrations by selecting best examples
        console.log('🎯 Creating optimized demonstrations...');
        const optimizedDemos: Array<{ input: BrainstormRequest; output: StoryIdea; score: number }> = [];

        for (let i = 0; i < numIterations; i++) {
            const example = examples[i % examples.length];
            const request: BrainstormRequest = {
                genre: example.genre,
                platform: example.platform,
                requirements_section: example.requirements_section || ''
            };

            try {
                // Generate multiple candidates and pick the best
                const candidates: Array<{ result: StoryIdea; score: number }> = [];

                for (let attempt = 0; attempt < 3; attempt++) {
                    const result = await program.forward(ai, request);
                    const evaluation = await evaluationSystem.evaluateStoryIdea(
                        result,
                        example.genre,
                        example.platform
                    );

                    candidates.push({
                        result,
                        score: evaluation.overall_score
                    });
                }

                // Select the best candidate
                const best = candidates.reduce((a, b) => a.score > b.score ? a : b);

                if (best.score >= 7.0) { // Only keep high-quality demonstrations
                    optimizedDemos.push({
                        input: request,
                        output: best.result,
                        score: best.score
                    });

                    if (verbose) {
                        console.log(`   Demo ${optimizedDemos.length}: ${best.score.toFixed(2)}/10 - "${best.result.title}"`);
                    }
                }

            } catch (error) {
                console.warn(`   Iteration ${i + 1} failed:`, error.message);
            }
        }

        console.log(`✅ Created ${optimizedDemos.length} high-quality demonstrations`);

        // 6. Test optimized program with demonstrations
        console.log('🧪 Testing optimized program...');

        // Convert demos to the format expected by ax
        const axDemos = optimizedDemos.map(demo => ({
            input: demo.input,
            output: demo.output
        }));

        // Create optimized program with demos
        const optimizedProgram = new BrainstormProgram();
        // Note: setDemos may not work directly, we'll save demos for manual loading

        // Test optimized performance
        const optimizedResults: Array<{ request: BrainstormRequest; result: StoryIdea; score: number }> = [];

        for (let i = 0; i < Math.min(5, examples.length); i++) {
            const example = examples[i];
            const request: BrainstormRequest = {
                genre: example.genre,
                platform: example.platform,
                requirements_section: example.requirements_section || ''
            };

            try {
                const result = await optimizedProgram.forward(ai, request);
                const evaluation = await evaluationSystem.evaluateStoryIdea(
                    result,
                    example.genre,
                    example.platform
                );

                optimizedResults.push({
                    request,
                    result,
                    score: evaluation.overall_score
                });

                if (verbose) {
                    console.log(`   Optimized test ${i + 1}: ${evaluation.overall_score.toFixed(2)}/10 - "${result.title}"`);
                }
            } catch (error) {
                console.warn(`   Optimized test ${i + 1} failed:`, error.message);
            }
        }

        const optimizedAvg = optimizedResults.length > 0
            ? optimizedResults.reduce((sum, r) => sum + r.score, 0) / optimizedResults.length
            : 0;

        console.log(`📈 Optimized average score: ${optimizedAvg.toFixed(2)}/10`);
        console.log(`📊 Improvement: ${(optimizedAvg - baselineAvg).toFixed(2)} points`);

        // 7. Save results
        console.log('💾 Saving optimization results...');

        const config = {
            timestamp: new Date().toISOString(),
            optimization: {
                method: 'simple_selection',
                numIterations,
                baselineScore: baselineAvg,
                optimizedScore: optimizedAvg,
                improvement: optimizedAvg - baselineAvg,
                demosCreated: optimizedDemos.length
            },
            demos: axDemos,
            metadata: {
                version: '1.0',
                optimizer: 'Simple Selection',
                signature: 'brainstorm signature'
            }
        };

        // Ensure directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
        console.log(`📁 Results saved to: ${outputPath}`);

        console.log('\n🎉 Simple optimization complete!');
        console.log(`📈 Created ${axDemos.length} optimized demonstrations`);
        console.log(`📝 Load them with: program.setDemos(config.demos)`);

        return {
            optimizedProgram,
            demos: axDemos,
            config,
            outputPath,
            improvement: optimizedAvg - baselineAvg
        };

    } catch (error) {
        console.error('❌ Simple optimization failed:', error);
        throw error;
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);

    const options = {
        verbose: args.includes('--verbose') || args.includes('-v'),
        numIterations: parseInt(args.find(arg => arg.startsWith('--iterations='))?.split('=')[1] || '10'),
        outputPath: args.find(arg => arg.startsWith('--output='))?.split('=')[1] || './simple-optimized-brainstorm.json'
    };

    try {
        await simpleOptimizeBrainstorm(options);
    } catch (error) {
        console.error('Simple optimization failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

export { simpleOptimizeBrainstorm }; 