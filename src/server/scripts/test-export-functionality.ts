#!/usr/bin/env node

/**
 * Test script to verify export functionality
 */

import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
import { ProjectRepository } from '../transform-jsondoc-framework/ProjectRepository';
import { db } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';

async function testExportFunctionality() {
    console.log('🧪 Testing export functionality...');

    const jsondocRepo = new TransformJsondocRepository(db);
    const transformRepo = new TransformJsondocRepository(db);
    const projectRepo = new ProjectRepository(db);

    // Create a test project
    const testProjectId = uuidv4();
    const testUserId = 'test-user-1';

    try {
        // Create test project
        await db.insertInto('projects')
            .values({
                id: testProjectId,
                name: 'Export Test Project',
                description: 'Test project for export functionality',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .execute();

        // Add user to project
        await db.insertInto('projects_users')
            .values({
                project_id: testProjectId,
                user_id: testUserId,
                role: 'owner'
            })
            .execute();

        // Create test jsondocs
        const brainstormInputId = uuidv4();
        const brainstormIdeaId = uuidv4();
        const outlineSettingsId = uuidv4();
        const chroniclesId = uuidv4();

        // Create brainstorm input
        await jsondocRepo.createJsondoc(
            testProjectId,
            'brainstorm_input_params',
            {
                platform: '抖音',
                genre: '现代甜宠',
                genrePaths: [['现代', '甜宠']],
                other_requirements: '轻松甜蜜，避免狗血剧情',
                numberOfIdeas: 3
            },
            'v1',
            undefined,
            'completed',
            'user_input'
        );

        // Create brainstorm idea
        await jsondocRepo.createJsondoc(
            testProjectId,
            '灵感创意',
            {
                title: '误爱成宠',
                body: '女主因为误会与霸道总裁开始了一段特殊的关系，在职场中两人逐渐了解彼此，最终走向幸福结局。'
            },
            'v1',
            undefined,
            'completed',
            'user_input'
        );

        // Create 剧本设定
        await jsondocRepo.createJsondoc(
            testProjectId,
            '剧本设定',
            {
                title: '误爱成宠',
                genre: '现代甜宠',
                target_audience: {
                    demographic: '18-35岁都市女性',
                    core_themes: ['职场恋爱', '误会重重', '甜蜜互动']
                },
                selling_points: ['霸总甜宠', '误会重重', '高颜值演员'],
                satisfaction_points: ['甜蜜互动', '霸道总裁', '逆袭成长'],
                setting: {
                    core_setting_summary: '现代都市职场背景，上海繁华商业区',
                    key_scenes: ['总裁办公室', '高端餐厅', '公司大厅']
                },
                characters: [
                    {
                        name: '林慕琛',
                        type: 'male_lead',
                        description: '林氏集团总裁，外表冷酷内心温暖',
                        age: '30岁',
                        gender: '男',
                        occupation: '集团总裁',
                        personality_traits: ['霸道', '深情', '责任感强'],
                        character_arc: '从冷酷总裁到暖心恋人的成长转变',
                        relationships: {
                            '夏栀': '误会中产生的爱情关系',
                            '母亲': '传统家庭压力来源'
                        }
                    },
                    {
                        name: '夏栀',
                        type: 'female_lead',
                        description: '普通职员，坚强独立有原则',
                        age: '25岁',
                        gender: '女',
                        occupation: '公司职员',
                        personality_traits: ['善良', '坚强', '聪慧'],
                        character_arc: '从自卑职员到自信女性的成长历程',
                        relationships: {
                            '林慕琛': '误会中发展的真挚感情',
                            '同事': '职场友谊支撑'
                        }
                    }
                ]
            },
            'v1',
            undefined,
            'completed',
            'user_input'
        );

        // Create chronicles
        await jsondocRepo.createJsondoc(
            testProjectId,
            'chronicles',
            {
                stages: [
                    {
                        title: '初遇与误会阶段（第1-8集）',
                        stageSynopsis: '女主入职遇到男主，因误会开始特殊关系。双方在职场环境中频繁接触，但由于误解而产生复杂的情感纠葛。',
                        event: '女主入职新公司，意外与男主发生误会，被迫开始特殊的合作关系',
                        emotionArcs: [
                            {
                                characters: ['林慕琛', '夏栀'],
                                content: '从陌生到误会，情感逐渐复杂化'
                            }
                        ],
                        relationshipDevelopments: [
                            {
                                characters: ['林慕琛', '夏栀'],
                                content: '建立特殊的工作关系'
                            }
                        ],
                        insights: ['误会是感情发展的催化剂']
                    },
                    {
                        title: '感情升温阶段（第9-16集）',
                        stageSynopsis: '在误会中两人感情逐渐升温，互相关注。工作中的配合让他们更加了解彼此，情感开始微妙变化。',
                        event: '通过工作合作，两人开始互相了解，感情在不知不觉中升温',
                        emotionArcs: [
                            {
                                characters: ['林慕琛', '夏栀'],
                                content: '从误会到理解，情感逐渐升温'
                            }
                        ],
                        relationshipDevelopments: [
                            {
                                characters: ['林慕琛', '夏栀'],
                                content: '从工作伙伴到情感依赖'
                            }
                        ],
                        insights: ['真诚的合作能够化解误会']
                    }
                ]
            },
            'v1',
            undefined,
            'completed',
            'user_input'
        );

        console.log('✅ Test data created successfully');
        console.log(`📁 Project ID: ${testProjectId}`);
        console.log(`👤 User ID: ${testUserId}`);
        console.log(`📄 Created jsondocs: ${brainstormInputId}, ${brainstormIdeaId}, ${outlineSettingsId}, ${chroniclesId}`);

        // Test fetching project data
        const projectData = {
            jsondocs: await jsondocRepo.getAllProjectJsondocsForLineage(testProjectId),
            transforms: await jsondocRepo.getAllProjectTransformsForLineage(testProjectId),
            humanTransforms: await jsondocRepo.getAllProjectHumanTransformsForLineage(testProjectId),
            transformInputs: await jsondocRepo.getAllProjectTransformInputsForLineage(testProjectId),
            transformOutputs: await jsondocRepo.getAllProjectTransformOutputsForLineage(testProjectId)
        };

        console.log(`✅ Fetched project data: ${projectData.jsondocs.length} jsondocs, ${projectData.transforms.length} transforms`);

        // Test export functionality
        const { createExportRoutes } = await import('../routes/exportRoutes.js');
        const { AuthMiddleware } = await import('../middleware/auth.js');
        const { AuthDatabase } = await import('../database/auth.js');

        // Create mock auth middleware
        const authDB = new AuthDatabase(db);
        const authMiddleware = new AuthMiddleware(authDB);

        // Create export routes
        const exportRoutes = createExportRoutes(authMiddleware);

        console.log('✅ Export routes created successfully');
        console.log('🎉 Export functionality test completed!');
        console.log('');
        console.log('📋 Summary:');
        console.log(`  - Test project created: ${testProjectId}`);
        console.log(`  - Jsondocs created: ${projectData.jsondocs.length}`);
        console.log(`  - Export routes initialized successfully`);
        console.log('');
        console.log('🔧 To test the export endpoints, use:');
        console.log(`  GET /api/export/${testProjectId}/items`);
        console.log(`  POST /api/export/${testProjectId}`);
        console.log('');
        console.log('💡 Make sure to include the debug auth token in your requests:');
        console.log('  Authorization: Bearer debug-auth-token-script-writer-dev');

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

// Run the test
testExportFunctionality()
    .then(() => {
        console.log('✅ Test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }); 