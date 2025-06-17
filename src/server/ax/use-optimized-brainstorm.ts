#!/usr/bin/env tsx

import fs from 'fs';
import { AxAI, AxAIOpenAIModel } from '@ax-llm/ax';
import { BrainstormProgram } from './ax-brainstorm-core';
import { BrainstormRequest } from './ax-brainstorm-types';
import { getLLMCredentials } from '../services/LLMConfig';

async function main() {
    const configPath = process.argv[2] || './optimized-brainstorm-demos.json';

    if (!fs.existsSync(configPath)) {
        console.error(`❌ Configuration file not found: ${configPath}`);
        console.log('Please run optimization first or provide a valid config path.');
        process.exit(1);
    }

    console.log('📚 Loading optimized brainstorm configuration...');

    try {
        // Load optimized configuration
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log(`✅ Loaded configuration from ${configPath}`);
        console.log(`📊 Optimizer: ${config.metadata?.optimizer || 'Unknown'}`);
        console.log(`🔧 Demos: ${config.demos?.length || 0}`);

        // Setup AI service
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

        // Create program and load optimized demos
        const program = new BrainstormProgram();
        if (config.demos && config.demos.length > 0) {
            program.setDemos(config.demos);
            console.log(`🎯 Applied ${config.demos.length} optimized demonstrations`);
        }

        // Test with various story requests
        const testRequests: BrainstormRequest[] = [
            {
                genre: '甜宠',
                platform: '抖音',
                requirements_section: '现代都市，温馨浪漫，双向暗恋'
            },
            {
                genre: '虐恋',
                platform: '快手',
                requirements_section: '古装背景，命运多舛，情深缘浅'
            },
            {
                genre: '霸总',
                platform: '抖音',
                requirements_section: '豪门世家，冷酷总裁遇到平凡女孩'
            },
            {
                genre: '穿越',
                platform: '西瓜视频',
                requirements_section: '现代女性穿越到古代，智斗宫廷'
            }
        ];

        console.log('\n🎬 Testing optimized program with different genres...\n');

        for (let i = 0; i < testRequests.length; i++) {
            const request = testRequests[i];
            console.log(`--- Test ${i + 1}: ${request.genre} ---`);
            console.log(`Platform: ${request.platform}`);
            console.log(`Requirements: ${request.requirements_section}`);

            try {
                const startTime = Date.now();
                const result = await program.forward(ai, request);
                const duration = Date.now() - startTime;

                console.log(`\n✨ Generated Story (${duration}ms):`);
                console.log(`📝 Title: ${result.title}`);
                console.log(`📖 Body: ${result.body}`);
                console.log(`📊 Title Length: ${result.title.length} chars`);
                console.log(`📊 Body Length: ${result.body.length} chars`);

            } catch (error) {
                console.error(`❌ Failed to generate story for ${request.genre}:`, error);
            }

            console.log(''); // Empty line for spacing
        }

        console.log('🎉 Testing completed!');
        console.log('\n💡 Usage Tips:');
        console.log('- The optimized program should produce higher quality stories');
        console.log('- Demos help maintain consistent output format');
        console.log('- Re-run optimization periodically with new training data');

    } catch (error) {
        console.error('❌ Failed to load or use optimized configuration:', error);
        process.exit(1);
    }
}

// Run the usage example
main().catch(console.error); 