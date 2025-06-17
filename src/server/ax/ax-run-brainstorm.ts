import { AxAI, AxAIOpenAIModel } from '@ax-llm/ax';
import { BrainstormRequest, StoryIdea } from './ax-brainstorm-types';
import { BrainstormProgram } from './ax-brainstorm-core';
import { StoryEvaluationSystem } from './ax-evaluation-system-simple';
import { getLLMCredentials } from '../services/LLMConfig';

// Environment variables are loaded by run-ts script

// Configuration
interface ScriptConfig {
    runName: string;
    useStreaming: boolean;
    enableEvaluation: boolean;
    ideaCount: number;
}

// Create a simple AI instance (we'll fix config issues later)
function createSimpleAI(): AxAI {
    const credentials = getLLMCredentials();


    try {
        return new AxAI({
            name: credentials.provider,
            apiKey: credentials.apiKey,
            apiURL: credentials.baseUrl,
            config: {
                model: credentials.modelName as AxAIOpenAIModel,

            }
        });
    } catch (error) {
        console.error('Failed to create AI instance:', error);
        throw error;
    }
}

// Main brainstorm function
async function runBrainstorm(
    request: BrainstormRequest,
    config: ScriptConfig
): Promise<void> {
    console.log(`\n🚀 Starting Brainstorm Run: ${config.runName}`);
    console.log(`📝 Genre: ${request.genre}`);
    console.log(`📱 Platform: ${request.platform}`);
    console.log(`📋 Requirements: ${request.requirements_section || '无特殊要求'}`);
    console.log(`🔢 Ideas to generate: ${config.ideaCount}`);
    console.log(`⚡ Streaming: ${config.useStreaming ? 'enabled' : 'disabled'}`);
    console.log(`📊 Evaluation: ${config.enableEvaluation ? 'enabled' : 'disabled'}`);

    try {
        // Initialize systems
        const ai = createSimpleAI();
        const brainstormProgram = new BrainstormProgram();
        const evaluationSystem = config.enableEvaluation ? new StoryEvaluationSystem() : null;

        console.log('\n💭 Generating ideas...');

        if (config.useStreaming) {
            // Streaming generation (simplified for now)
            console.log('🌊 Using streaming generation...');
            try {
                const idea = await brainstormProgram.generateIdea(ai, request);
                console.log(`📝 Title: ${idea.title}`);
                console.log(`📖 Body: ${idea.body}`);

                if (evaluationSystem) {
                    console.log('\n📊 Evaluating generated idea...');
                    const evaluation = await evaluationSystem.evaluateStoryIdea(
                        ai,
                        idea,
                        request.genre,
                        request.platform
                    );

                    console.log(`\n📈 Evaluation Results:`);
                    console.log(`   Overall Score: ${evaluation.overall_score.toFixed(2)}/10`);
                    console.log(`   Novelty: ${evaluation.novelty_score}/10`);
                    console.log(`   Feasibility: ${evaluation.feasibility_score}/10`);
                    console.log(`   Structure: ${evaluation.structure_score}/10`);
                    console.log(`   Detail: ${evaluation.detail_score}/10`);
                    console.log(`   Logic: ${evaluation.logical_coherence_score}/10`);
                    console.log(`   Genre: ${evaluation.genre_score}/10`);
                    console.log(`   Engagement: ${evaluation.engagement_score}/10`);
                }
            } catch (error) {
                console.error('Streaming generation failed:', error);
            }

        } else {
            // Regular generation
            console.log('⚡ Using regular generation...');
            const ideas = await brainstormProgram.generateIdeas(ai, request, config.ideaCount);

            for (let i = 0; i < ideas.length; i++) {
                const idea = ideas[i];
                console.log(`\n💡 Idea ${i + 1}:`);
                console.log(`   Title: ${idea.title}`);
                console.log(`   Body: ${idea.body}`);

                if (evaluationSystem) {
                    console.log('   📊 Evaluating...');
                    try {
                        const evaluation = await evaluationSystem.evaluateStoryIdea(
                            ai,
                            idea,
                            request.genre,
                            request.platform
                        );

                        console.log(`   📈 Score: ${evaluation.overall_score.toFixed(2)}/10`);
                    } catch (error) {
                        console.warn(`   ⚠️  Evaluation failed: ${error}`);
                    }
                }
            }
        }

        console.log('\n✅ Brainstorm completed successfully!');

    } catch (error) {
        console.error('\n❌ Brainstorm failed:', error);
        throw error;
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);

    // Parse command line arguments
    const runName = args.find(arg => arg.startsWith('--name='))?.split('=')[1] || 'default';
    const useStreaming = args.includes('--streaming');
    const enableEvaluation = args.includes('--evaluate');
    const ideaCount = parseInt(args.find(arg => arg.startsWith('--count='))?.split('=')[1] || '2');

    const config: ScriptConfig = {
        runName,
        useStreaming,
        enableEvaluation,
        ideaCount,
    };

    // Example brainstorm requests
    const exampleRequests: BrainstormRequest[] = [
        {
            genre: '甜宠',
            platform: '抖音',
            requirements_section: '现代都市背景，温馨浪漫的日常生活',
        },
        {
            genre: '虐恋',
            platform: '小红书',
            requirements_section: '古装背景，深刻的情感纠葛',
        },
        {
            genre: '复仇',
            platform: '快手',
            requirements_section: '现代商战，强势女主角',
        },
    ];

    // Run brainstorm for the first example (or specify via args)
    const requestIndex = parseInt(args.find(arg => arg.startsWith('--example='))?.split('=')[1] || '0');
    const request = exampleRequests[requestIndex] || exampleRequests[0];

    await runBrainstorm(request, config);
}

// Script execution
if (require.main === module) {
    main()
        .then(() => {
            console.log('\n🎉 Script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Script failed:', error);
            process.exit(1);
        });
}

export { runBrainstorm, createSimpleAI }; 