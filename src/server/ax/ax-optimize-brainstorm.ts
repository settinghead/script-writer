import fs from 'fs';
import { AxAI, AxAIOpenAIModel, AxMiPRO, type AxMetricFn } from '@ax-llm/ax';
import {
    BrainstormRequest,
    StoryIdea,
    TrainingExample,
    EVALUATION_WEIGHTS
} from './ax-brainstorm-types';
import { BrainstormProgram } from './ax-brainstorm-core';
import { StoryEvaluationSystem } from './ax-evaluation-system-simple';
import { getLLMCredentials } from './ax-llm-config';

// Environment variables loaded by run-ts

// Training data for optimization (similar to Python version)
const trainingData: TrainingExample[] = [
    {
        genre: '甜宠',
        platform: '抖音',
        requirements_section: '现代都市背景，温馨浪漫',
    },
    {
        genre: '虐恋',
        platform: '小红书',
        requirements_section: '古装背景，情感纠葛深刻',
    },
    {
        genre: '复仇',
        platform: '快手',
        requirements_section: '现代商战，强势女主',
    },
    {
        genre: '穿越',
        platform: '抖音',
        requirements_section: '古代宫廷，智慧女主',
    },
    {
        genre: '重生',
        platform: '小红书',
        requirements_section: '现代都市，第二次人生',
    },
    {
        genre: '霸总',
        platform: '抖音',
        requirements_section: '商界精英，甜宠日常',
    },
    {
        genre: '战神',
        platform: '快手',
        requirements_section: '古代军营，英雄美人',
    },
    {
        genre: '萌宝',
        platform: '抖音',
        requirements_section: '现代家庭，亲子温馨',
    },
];

// Validation data
const validationData: TrainingExample[] = [
    {
        genre: '玄幻',
        platform: '快手',
        requirements_section: '修仙世界，逆天改命',
    },
    {
        genre: '娱乐圈',
        platform: '小红书',
        requirements_section: '明星生活，追梦励志',
    },
];

// Create AI instance for optimization
function createOptimizationAI(): AxAI {

    const credentials = getLLMCredentials();

    return new AxAI({
        name: 'openai',
        apiKey: credentials.apiKey,
        apiURL: credentials.baseUrl,
        config: {
            model: credentials.modelName as AxAIOpenAIModel,
            // Use simple config for now - will be refined later
            maxTokens: 3000,
            temperature: 1.0,
        }
    });
}

// Evaluation metric function
const createEvaluationMetric = (ai: AxAI, evaluationSystem: StoryEvaluationSystem): AxMetricFn => {
    return async ({ prediction, example }) => {
        try {
            const storyIdea = prediction as StoryIdea;
            const brainstormRequest = example as BrainstormRequest;

            if (!storyIdea.title || !storyIdea.body) {
                return 0.0;
            }

            // Evaluate the generated story idea
            const evaluation = await evaluationSystem.evaluateStoryIdea(
                ai,
                storyIdea,
                brainstormRequest.genre,
                brainstormRequest.platform
            );

            // Normalize score to 0-1 range (ax expects this range)
            return evaluation.overall_score / 10.0;
        } catch (error) {
            console.warn('Evaluation failed:', error);
            return 0.0;
        }
    };
};

// Main optimization function
async function optimizeBrainstormProgram() {
    console.log('Starting MiPRO optimization for brainstorm program...');

    // Initialize AI and systems
    const ai = createOptimizationAI();
    const evaluationSystem = new StoryEvaluationSystem();
    const program = new BrainstormProgram();

    // Configure MiPRO optimizer
    const optimizer = new AxMiPRO({
        ai,
        program,
        examples: trainingData,
        options: {
            // Core MiPRO settings
            numCandidates: 3, // Number of candidate programs per trial
            numTrials: 10, // Number of optimization trials
            maxBootstrappedDemos: 2, // Maximum bootstrapped demos
            maxLabeledDemos: 3, // Maximum labeled demos

            // Advanced optimization
            earlyStoppingTrials: 3, // Stop if no improvement after N trials
            minImprovementThreshold: 0.01, // Minimum score improvement

            // Optimization strategies
            programAwareProposer: true, // Use program structure
            dataAwareProposer: true, // Consider dataset characteristics

            // Logging
            verbose: true,
        },
    });

    // Define evaluation metric
    const metricFn = createEvaluationMetric(ai, evaluationSystem);

    console.log('Running MiPRO optimization...');
    console.log('This systematically searches for optimal prompt configurations.');

    // Run optimization
    const optimizedProgram = await optimizer.compile(metricFn, {
        valset: validationData,
        auto: 'medium', // Use medium optimization level
    });

    // Save optimized configuration
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const configPath = `./ax-optimized-brainstorm-${timestamp}.json`;

    const programConfig = JSON.stringify(optimizedProgram, null, 2);
    await fs.promises.writeFile(configPath, programConfig);

    console.log(`\nOptimized program configuration saved to: ${configPath}`);

    // Evaluate optimized program on validation set
    console.log('\nEvaluating optimized program on validation set:');
    let totalScore = 0;
    let validEvaluations = 0;

    for (const example of validationData) {
        try {
            console.log(`\nGenerating idea for: ${example.genre} on ${example.platform}`);

            const prediction = await optimizedProgram.forward(ai, example);
            const score = await metricFn({ prediction, example });

            totalScore += score;
            validEvaluations++;

            console.log(`Title: "${prediction.title}"`);
            console.log(`Body: "${prediction.body}"`);
            console.log(`Score: ${score.toFixed(4)} (${score === 1.0 ? '✓ EXCELLENT' : score > 0.7 ? '✓ GOOD' : score > 0.5 ? '~ FAIR' : '✗ POOR'})`);

        } catch (error) {
            console.warn(`Failed to evaluate example:`, error);
        }
    }

    const averageScore = validEvaluations > 0 ? totalScore / validEvaluations : 0;
    console.log(`\nFinal Average Score: ${averageScore.toFixed(4)} (${totalScore.toFixed(2)}/${validEvaluations})`);
    console.log(`Optimization complete! Configuration saved to: ${configPath}`);

    return {
        optimizedProgram,
        configPath,
        averageScore,
    };
}

// Script execution
if (require.main === module) {
    optimizeBrainstormProgram()
        .then((result) => {
            console.log('\n✅ Optimization completed successfully!');
            console.log(`📁 Config file: ${result.configPath}`);
            console.log(`📊 Average score: ${result.averageScore.toFixed(4)}`);
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Optimization failed:', error);
            process.exit(1);
        });
}

export { optimizeBrainstormProgram, createOptimizationAI, createEvaluationMetric }; 