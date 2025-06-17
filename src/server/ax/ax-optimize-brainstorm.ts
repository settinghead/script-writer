import fs from 'fs';
import path from 'path';
import { AxAI, AxMiPRO, AxMetricFn, AxAIOpenAIModel } from '@ax-llm/ax';
import { BrainstormProgram } from './ax-brainstorm-core';
import { BrainstormRequest, StoryIdea } from './ax-brainstorm-types';
import { loadExamples } from './exampleLoader';
import { getLLMCredentials } from '../services/LLMConfig';

// Evaluation metric for story quality
const storyQualityMetric: AxMetricFn = ({ prediction, example }) => {
    const pred = prediction as unknown as StoryIdea;
    const exp = example as BrainstormRequest & StoryIdea;

    let score = 0;

    // Title quality (30% weight)
    if (pred.title && pred.title.length >= 3 && pred.title.length <= 10) {
        score += 0.3;
    }

    // Body length appropriateness (40% weight)
    if (pred.body && pred.body.length >= 50 && pred.body.length <= 200) {
        score += 0.4;
    }

    // Content relevance to genre (30% weight)
    if (pred.body && exp.genre && pred.body.includes(exp.genre)) {
        score += 0.3;
    }

    return score;
};

// Alternative similarity-based metric
const semanticSimilarityMetric: AxMetricFn = ({ prediction, example }) => {
    const pred = prediction as unknown as StoryIdea;
    const exp = example as BrainstormRequest & StoryIdea;

    // Simple similarity based on genre matching and length appropriateness
    let score = 0;

    // Check if generated story matches expected genre characteristics
    if (pred.title && pred.body) {
        // Basic structural validation
        if (pred.title.length >= 3 && pred.title.length <= 10) score += 0.25;
        if (pred.body.length >= 50 && pred.body.length <= 200) score += 0.25;

        // Genre relevance (simple keyword matching)
        const genreKeywords = {
            '甜宠': ['甜', '爱', '恋', '温柔', '暖'],
            '虐恋': ['痛', '误会', '分离', '虐'],
            '穿越': ['穿越', '古代', '现代', '时空'],
            '霸总': ['总裁', '霸道', '冷酷', '豪门']
        };

        const keywords = genreKeywords[exp.genre as keyof typeof genreKeywords] || [];
        const matchCount = keywords.filter(keyword =>
            pred.title.includes(keyword) || pred.body.includes(keyword)
        ).length;

        score += (matchCount / Math.max(keywords.length, 1)) * 0.5;
    }

    return Math.min(score, 1.0);
};

// Main optimization function
export async function optimizeBrainstormProgram(options: {
    numTrials?: number;
    auto?: 'light' | 'medium' | 'heavy';
    metricType?: 'quality' | 'similarity';
    outputPath?: string;
    verbose?: boolean;
} = {}) {

    const {
        numTrials = 15,
        auto = 'medium',
        metricType = 'quality',
        outputPath = './optimized-brainstorm-demos.json',
        verbose = false
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

        // 5. Choose evaluation metric
        const metricFn = metricType === 'quality' ? storyQualityMetric : semanticSimilarityMetric;
        console.log(`📊 Using ${metricType} evaluation metric`);

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
        metricType: (args.find(arg => arg.startsWith('--metric='))?.split('=')[1] as 'quality' | 'similarity') || 'quality',
        outputPath: args.find(arg => arg.startsWith('--output='))?.split('=')[1] || './optimized-brainstorm-demos.json'
    };

    try {
        await optimizeBrainstormProgram(options);
    } catch (error) {
        console.error('Optimization failed:', error);
        process.exit(1);
    }
}

// Export for use in other modules
export { BrainstormProgram, storyQualityMetric, semanticSimilarityMetric };

// Run optimization if called directly
if (require.main === module) {
    runOptimization();
} 