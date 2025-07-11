import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBrainstormToolDefinition } from '../tools/BrainstormTools';
import { createOutlineSettingsToolDefinition } from '../tools/OutlineSettingsTool';
import { createChroniclesToolDefinition } from '../tools/ChroniclesTool';
import { ArtifactRepository } from '../transform-artifact-framework/ArtifactRepository';
import { TransformRepository } from '../transform-artifact-framework/TransformRepository';
import { createMockArtifactRepository, createMockTransformRepository } from '../../__tests__/mocks/databaseMocks';
import { TypedArtifact } from '@/common/types';

describe('End-to-End Workflow Tests', () => {
    let mockArtifactRepo: any;
    let mockTransformRepo: any;
    const testProjectId = 'test-project-123';
    const testUserId = 'test-user-456';

    beforeEach(() => {
        mockArtifactRepo = createMockArtifactRepository();
        mockTransformRepo = createMockTransformRepository();

        // Setup mock getArtifact to return proper artifact data
        mockArtifactRepo.getArtifact.mockImplementation(async (id: string) => {
            if (!id) return null;

            // Check for outline settings first (mock-artifact-2 should be outline settings)
            if (id === 'mock-artifact-2' || id === 'mock-artifact-3' || id === 'mock-artifact-4' || id.includes('outline')) {
                return {
                    id: id,
                    project_id: testProjectId,
                    type: 'outline_settings',
                    data: {
                        title: '都市甜宠故事',
                        genre: '现代甜宠',
                        target_audience: '18-35岁都市女性',
                        platform: '抖音',
                        selling_points: ['霸总甜宠', '误会重重'],
                        satisfaction_points: ['甜蜜互动', '霸道总裁'],
                        setting: {
                            time_period: '现代',
                            location: '上海',
                            social_context: '都市职场'
                        },
                        characters: [
                            {
                                name: '林晓雨',
                                type: 'female_lead',
                                age: '25岁',
                                occupation: '设计师',
                                personality: '独立坚强',
                                appearance: '清纯可爱',
                                background: '普通家庭出身'
                            }
                        ]
                    },
                    schema_type: 'outline_settings' as TypedArtifact['schema_type'],
                    origin_type: 'ai_generated'
                };
            } else if (id.includes('brainstorm') || id === 'mock-artifact-1') {
                // Return brainstorm_idea with user_input schema (from human transform)
                return {
                    id: id,
                    project_id: testProjectId,
                    schema_type: 'brainstorm_idea' as TypedArtifact['schema_type'],
                    data: {
                        title: '现代都市甜宠',
                        body: '一个关于都市白领的甜宠故事，男女主角在职场相遇，经历误会后走到一起'
                    },
                    origin_type: 'user_input',
                    metadata: {
                        derived_data: {
                            title: '现代都市甜宠',
                            body: '一个关于都市白领的甜宠故事，男女主角在职场相遇，经历误会后走到一起'
                        }
                    }
                };
            } else if (id.includes('input') || id === 'test-brainstorm-input') {
                // Return brainstorm input artifact
                return {
                    id: id,
                    project_id: testProjectId,
                    schema_type: 'brainstorm_input_params' as TypedArtifact['schema_type'],
                    data: {
                        platform: '抖音',
                        genre: '现代甜宠',
                        other_requirements: '生成3个故事创意',
                        numberOfIdeas: 3
                    },
                    origin_type: 'user_input'
                };
            }
            return null;
        });

        // Setup mock createArtifact to return sequential IDs
        let artifactCounter = 1;
        mockArtifactRepo.createArtifact.mockImplementation(async () => {
            const artifactId = `mock-artifact-${artifactCounter++}`;
            return { id: artifactId };
        });

        // Setup mock createTransform to return sequential IDs
        let transformCounter = 1;
        mockTransformRepo.createTransform.mockImplementation(async () => {
            return { id: `mock-transform-${transformCounter++}` };
        });
    });

    afterEach(() => {
        // Reset any global state if needed
    });

    it('should execute complete workflow: brainstorm → outline settings → chronicles', async () => {
        // Disable caching to use mock responses with new schema
        const cachingOptions = { enableCaching: false };

        console.log('🧪 Testing complete workflow with new outline system...');

        // Step 1: Generate brainstorm ideas
        const brainstormTool = createBrainstormToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            testProjectId,
            testUserId,
            cachingOptions
        );

        const brainstormInput = {
            sourceArtifactId: 'test-brainstorm-input',
            otherRequirements: '生成3个故事创意'
        };

        console.log('📝 Step 1: Generating brainstorm ideas...');
        const brainstormResult = await brainstormTool.execute(brainstormInput, { toolCallId: 'test-brainstorm' });

        expect(brainstormResult).toBeDefined();
        expect(brainstormResult.outputArtifactId).toBeDefined();
        expect(brainstormResult.finishReason).toBeDefined();

        console.log(`✅ Brainstorm completed: ${brainstormResult.outputArtifactId}`);

        // Step 2: Generate outline settings from brainstorm
        const outlineSettingsTool = createOutlineSettingsToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            testProjectId,
            testUserId,
            cachingOptions
        );

        const outlineSettingsInput = {
            sourceArtifactId: brainstormResult.outputArtifactId,
            title: '现代甜宠故事设定',
            requirements: '创建详细的剧本框架，包括角色背景和商业定位'
        };

        console.log('🎭 Step 2: Generating outline settings...');
        const outlineSettingsResult = await outlineSettingsTool.execute(outlineSettingsInput, { toolCallId: 'test-outline-settings' });

        expect(outlineSettingsResult).toBeDefined();
        expect(outlineSettingsResult.outputArtifactId).toBeDefined();
        expect(outlineSettingsResult.finishReason).toBeDefined();

        console.log(`✅ Outline settings completed: ${outlineSettingsResult.outputArtifactId}`);

        // Step 3: Generate chronicles from outline settings
        const chroniclesTool = createChroniclesToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            testProjectId,
            testUserId,
            cachingOptions
        );

        const chroniclesInput = {
            sourceArtifactId: outlineSettingsResult.outputArtifactId,
            requirements: '创建按时间顺序的故事发展脉络'
        };

        console.log('⏰ Step 3: Generating chronicles...');
        const chroniclesResult = await chroniclesTool.execute(chroniclesInput, { toolCallId: 'test-chronicles' });

        expect(chroniclesResult).toBeDefined();
        expect(chroniclesResult.outputArtifactId).toBeDefined();
        expect(chroniclesResult.finishReason).toBeDefined();

        console.log(`✅ Chronicles completed: ${chroniclesResult.outputArtifactId}`);

        // Verify the complete workflow chain
        console.log('🔗 Verifying workflow chain...');

        // Check that all artifacts were created
        expect(brainstormResult.outputArtifactId).toBeDefined();
        expect(outlineSettingsResult.outputArtifactId).toBeDefined();
        expect(chroniclesResult.outputArtifactId).toBeDefined();

        // Verify they're all different artifacts
        expect(brainstormResult.outputArtifactId).not.toBe(outlineSettingsResult.outputArtifactId);
        expect(outlineSettingsResult.outputArtifactId).not.toBe(chroniclesResult.outputArtifactId);
        expect(brainstormResult.outputArtifactId).not.toBe(chroniclesResult.outputArtifactId);

        console.log('✅ Complete workflow test passed!');
    });

    it('should validate tool definitions and schemas', async () => {
        console.log('🔍 Testing tool definitions...');

        const cachingOptions = { enableCaching: false };

        // Test brainstorm tool
        const brainstormTool = createBrainstormToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            testProjectId,
            testUserId,
            cachingOptions
        );

        expect(brainstormTool).toBeDefined();
        expect(brainstormTool.execute).toBeInstanceOf(Function);
        expect(brainstormTool.name).toBe('generate_brainstorm_ideas');

        // Test outline settings tool
        const outlineSettingsTool = createOutlineSettingsToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            testProjectId,
            testUserId,
            cachingOptions
        );

        expect(outlineSettingsTool).toBeDefined();
        expect(outlineSettingsTool.execute).toBeInstanceOf(Function);
        expect(outlineSettingsTool.name).toBe('generate_outline_settings');

        // Test chronicles tool
        const chroniclesTool = createChroniclesToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            testProjectId,
            testUserId,
            cachingOptions
        );

        expect(chroniclesTool).toBeDefined();
        expect(chroniclesTool.execute).toBeInstanceOf(Function);
        expect(chroniclesTool.name).toBe('generate_chronicles');

        console.log('✅ All tool definitions validated!');
    });
}); 