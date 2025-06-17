import fs from 'fs';
import path from 'path';
import { AxAI, AxMiPRO, AxMetricFn, AxAIOpenAIModel } from '@ax-llm/ax';
import { BrainstormProgram } from './ax-brainstorm-core';
import { BrainstormRequest, StoryIdea } from './ax-brainstorm-types';
import { loadExamples } from './exampleLoader';
import { getLLMCredentials } from '../services/LLMConfig';
import { createEvaluationSystem } from './ax-evaluation-system-simple';

// Create evaluation system instance
const evaluationSystem = createEvaluationSystem();

// Cache for professional evaluations to avoid repeated API calls
const evaluationCache = new Map<string, number>();

// Professional evaluation metric using the full evaluation system
const professionalEvaluationMetric: AxMetricFn = ({ prediction, example }) => {
    const pred = prediction as unknown as StoryIdea;
    const exp = example as BrainstormRequest & StoryIdea;

    // Create cache key based on prediction content
    const cacheKey = `${pred.title}|${pred.body}|${exp.genre}|${exp.platform}`;

    // Return cached result if available
    if (evaluationCache.has(cacheKey)) {
        return evaluationCache.get(cacheKey)!;
    }

    // If not cached, this means we need pre-evaluation or the metric will fail
    throw new Error(`Professional evaluation not available for: ${pred.title}. Use preEvaluate option.`);
};

// Main optimization function
export async function optimizeBrainstormProgram(options: {
    numTrials?: number;
    auto?: 'light' | 'medium' | 'heavy';
    metricType?: 'quality' | 'similarity' | 'professional';
    outputPath?: string;
    verbose?: boolean;
    preEvaluate?: boolean;
} = {}) {

    const {
        numTrials = 15,
        auto = 'medium',
        metricType = 'quality',
        outputPath = './optimized-brainstorm-demos.json',
        verbose = false,
        preEvaluate = false
    } = options;

    console.log('🚀 Starting brainstorm program optimization with MiPRO v2...');

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

        // 2. Load training examples
        console.log('📚 Loading training examples...');
        const examples = loadExamples();

        if (examples.length === 0) {
            throw new Error('No training examples found. Cannot optimize without examples.');
        }

        console.log(`✅ Loaded ${examples.length} training examples`);

        // 2.5. Pre-evaluate examples with professional evaluation system
        console.log('🧠 Pre-evaluating examples with professional evaluation system...');
        const maxExamplesToEvaluate = Math.min(examples.length, preEvaluate ? 20 : 10);

        for (let i = 0; i < maxExamplesToEvaluate; i++) {
            const example = examples[i];
            try {
                const evaluation = await evaluationSystem.evaluateStoryIdea(
                    { title: example.title, body: example.body },
                    example.genre,
                    example.platform
                );
                const cacheKey = `${example.title}|${example.body}|${example.genre}|${example.platform}`;
                evaluationCache.set(cacheKey, evaluation.overall_score / 10.0);

                if (verbose) {
                    console.log(`   Pre-evaluated example ${i + 1}: ${evaluation.overall_score.toFixed(2)}/10`);
                }
            } catch (error) {
                console.error(`❌ Failed to pre-evaluate example ${i + 1}:`, error);
                throw new Error(`Pre-evaluation failed for example ${i + 1}. Cannot proceed with optimization.`);
            }
        }
        console.log(`✅ Pre-evaluated ${maxExamplesToEvaluate} examples`);

        // 3. Create the program to optimize
        console.log('🔧 Creating brainstorm program...');
        const program = new BrainstormProgram();

        // 4. Configure the MiPRO optimizer
        console.log('⚙️ Configuring MiPRO v2 optimizer...');
        const optimizer = new AxMiPRO({
            ai,
            program,
            examples: examples,
            options: {
                numTrials,
                verbose,
                maxDemos: auto === 'light' ? 2 : auto === 'medium' ? 3 : 4,
                maxExamples: auto === 'light' ? 3 : auto === 'medium' ? 4 : 5,
                earlyStoppingPatience: 5,
            },
        });

        // 5. Choose evaluation metric - only professional evaluation supported
        const metricFn = professionalEvaluationMetric;
        console.log(`📊 Using professional evaluation metric (${metricType} mode)`);

        // 6. Run optimization
        console.log(`🔄 Running optimization with ${numTrials} trials...`);
        const startTime = Date.now();

        const optimizedProgram = await optimizer.compile(metricFn, {
            valset: examples.slice(-Math.min(10, Math.floor(examples.length * 0.2))), // Use last 20% as validation
        });

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log(`✅ Optimization completed in ${duration} seconds`);

        // 7. Extract demos/configuration
        console.log('💾 Saving optimized configuration...');

        // Get the optimized demos from the program
        const optimizedDemos = (optimizedProgram as any).demos || [];

        // Save configuration
        const config = {
            timestamp: new Date().toISOString(),
            optimization: {
                numTrials,
                auto,
                metricType,
                duration: `${duration}s`,
                examplesUsed: examples.length
            },
            demos: optimizedDemos,
            metadata: {
                version: '1.0',
                optimizer: 'MiPRO v2',
                signature: program.getSignature?.() || 'brainstorm signature'
            }
        };

        // Ensure directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
        console.log(`📁 Optimized configuration saved to: ${outputPath}`);

        // 8. Test the optimized program
        console.log('🧪 Testing optimized program...');
        const testRequest: BrainstormRequest = {
            genre: '甜宠',
            platform: '抖音',
            requirements_section: '现代都市背景，温馨浪漫'
        };

        const testResult = await optimizedProgram.forward(ai, testRequest);
        console.log('Test result:', testResult);

        console.log('\n🎉 Optimization complete!');
        console.log(`📈 Performance should be improved with ${optimizedDemos.length} optimized demonstrations`);
        console.log(`📝 Load the optimized demos using: program.setDemos(config.demos)`);

        return {
            optimizedProgram,
            demos: optimizedDemos,
            config,
            outputPath
        };

    } catch (error) {
        console.error('❌ Optimization failed:', error);
        throw error;
    }
}

// CLI interface for running optimization
export async function runOptimization() {
    const args = process.argv.slice(2);

    const options: Parameters<typeof optimizeBrainstormProgram>[0] = {
        verbose: args.includes('--verbose') || args.includes('-v'),
        auto: (args.find(arg => arg.startsWith('--auto='))?.split('=')[1] as 'light' | 'medium' | 'heavy') || 'medium',
        numTrials: parseInt(args.find(arg => arg.startsWith('--trials='))?.split('=')[1] || '15'),
        metricType: (args.find(arg => arg.startsWith('--metric='))?.split('=')[1] as 'quality' | 'similarity' | 'professional') || 'professional',
        outputPath: args.find(arg => arg.startsWith('--output='))?.split('=')[1] || './optimized-brainstorm-demos.json',
        preEvaluate: args.includes('--pre-evaluate') || args.includes('--full-eval')
    };

    try {
        await optimizeBrainstormProgram(options);
    } catch (error) {
        console.error('Optimization failed:', error);
        process.exit(1);
    }
}

// Export for use in other modules
export { BrainstormProgram, professionalEvaluationMetric };

// Run optimization if called directly
if (require.main === module) {
    runOptimization();
} 