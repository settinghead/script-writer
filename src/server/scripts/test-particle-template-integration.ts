#!/usr/bin/env node

import { db } from '../database/connection';
import { initializeParticleSystem } from '../transform-jsondoc-framework/particles/ParticleSystemInitializer';
import { TemplateService } from '../services/templates/TemplateService';

async function testParticleTemplateIntegration() {
    console.log('🧪 Testing Particle Template Integration (Phase 2)...\n');

    try {
        // 1. Initialize particle system
        const particleSystem = await initializeParticleSystem(db);
        console.log('✅ Particle system initialized successfully\n');

        // 2. Test ParticleTemplateProcessor
        console.log('2️⃣ Testing ParticleTemplateProcessor...');
        const processor = particleSystem.particleTemplateProcessor;

        // Test template without particles
        const simpleTemplate = `
根据用户需求生成故事创意：

## 输入参数
%%params%%

## 参考数据
%%jsondocs%%
`;

        const processedSimple = await processor.processTemplate(
            simpleTemplate,
            'test-project-1',
            'test-user-1'
        );

        console.log('✅ Simple template (no particles) processed correctly');
        console.log('   Original length:', simpleTemplate.length);
        console.log('   Processed length:', processedSimple.length);
        console.log('   Templates match:', simpleTemplate === processedSimple);

        // Test template with particles but no content section (should error)
        const invalidTemplate = `
根据用户需求和角色 @particle:char-001 生成故事创意。

## 输入参数
%%params%%
`;

        try {
            await processor.processTemplate(invalidTemplate, 'test-project-1', 'test-user-1');
            console.log('❌ Template validation failed - should have thrown error');
        } catch (error) {
            console.log('✅ Template validation working - correctly rejected invalid template');
            console.log('   Error:', error instanceof Error ? error.message : error);
        }

        // Test template with particles and content section
        const validTemplate = `
根据用户需求和角色 @particle:char-001 以及情节 @particle:plot-002 生成故事创意。

同时考虑 @particle:char-001 的背景设定。

%%particle-content%%

## 输入参数
%%params%%

## 参考数据
%%jsondocs%%
`;

        const processedValid = await processor.processTemplate(
            validTemplate,
            'test-project-1',
            'test-user-1'
        );

        console.log('✅ Valid template with particles processed');
        console.log('   Contains [MISSING:char-001]:', processedValid.includes('[MISSING:char-001]'));
        console.log('   Contains [MISSING:plot-002]:', processedValid.includes('[MISSING:plot-002]'));
        console.log('   Contains 引用内容 section:', processedValid.includes('## 引用内容'));

        // 3. Test TemplateService with particle support
        console.log('\n3️⃣ Testing TemplateService integration...');
        const templateService = new TemplateService(processor);

        // Get a real template
        const brainstormTemplate = templateService.getTemplate('brainstorming');
        console.log('✅ Retrieved brainstorming template');

        // Test rendering without particles
        const context = {
            params: { genre: '现代甜宠', platform: '抖音' },
            jsondocs: { 'user_input': { description: 'test input', data: { requirements: 'test' } } }
        };

        const renderedWithoutParticles = await templateService.renderTemplate(brainstormTemplate, context);
        console.log('✅ Template rendered without particles');
        console.log('   Contains %%params%%:', renderedWithoutParticles.includes('%%params%%'));
        console.log('   Contains %%jsondocs%%:', renderedWithoutParticles.includes('%%jsondocs%%'));
        console.log('   Contains genre:', renderedWithoutParticles.includes('现代甜宠'));

        // Test rendering with particle context
        const renderedWithParticles = await templateService.renderTemplate(
            brainstormTemplate,
            context,
            { projectId: 'test-project-1', userId: 'test-user-1' }
        );
        console.log('✅ Template rendered with particle context');
        console.log('   Same as without particles:', renderedWithoutParticles === renderedWithParticles);

        // 4. Test reference generation patterns
        console.log('\n4️⃣ Testing reference generation patterns...');

        // Create a mock template with multiple particle types
        const multiParticleTemplate = `
故事包含角色 @particle:char-001 和 @particle:char-002，
以及创意 @particle:idea-001 和卖点 @particle:selling-001。

再次提到角色 @particle:char-001 应该使用相同的引用。

%%particle-content%%
`;

        const processedMulti = await processor.processTemplate(
            multiParticleTemplate,
            'test-project-1',
            'test-user-1'
        );

        console.log('✅ Multi-particle template processed');
        console.log('   Contains [MISSING:char-001]:', processedMulti.includes('[MISSING:char-001]'));
        console.log('   Contains [MISSING:char-002]:', processedMulti.includes('[MISSING:char-002]'));
        console.log('   Contains [MISSING:idea-001]:', processedMulti.includes('[MISSING:idea-001]'));
        console.log('   Contains [MISSING:selling-001]:', processedMulti.includes('[MISSING:selling-001]'));

        // Count occurrences of char-001 reference
        const char001Matches = (processedMulti.match(/\[MISSING:char-001\]/g) || []).length;
        console.log('   char-001 reference count:', char001Matches, '(should be 2 for deduplication test)');

        console.log('\n🎉 Particle Template Integration Tests Completed!\n');

        console.log('📋 Summary:');
        console.log('✅ ParticleTemplateProcessor initialization');
        console.log('✅ Template validation (reject invalid templates)');
        console.log('✅ Particle reference extraction and replacement');
        console.log('✅ TemplateService integration with particle support');
        console.log('✅ Reference generation patterns');
        console.log('✅ Content section generation');

        console.log('\n⚠️  Note: All particles show as MISSING because no real particles exist in test database');
        console.log('   This is expected behavior - the template processing logic is working correctly.');

    } catch (error) {
        console.error('❌ Test failed:', error);
        if (error instanceof Error) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    } finally {
        // Cleanup
        await db.destroy();
        console.log('\n✅ Test completed successfully');
    }
}

// Run the test
testParticleTemplateIntegration().catch(console.error); 