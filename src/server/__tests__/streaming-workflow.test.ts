import { describe, it, expect, beforeEach } from 'vitest';
import { createOutlineSettingsToolDefinition } from '../tools/OutlineSettingsTool';
import { createChroniclesToolDefinition } from '../tools/ChroniclesTool';
import { JsonDocRepository } from '../transform-jsonDoc-framework/JsonDocRepository';
import { TransformRepository } from '../transform-jsonDoc-framework/TransformRepository';
import { createMockJsonDocRepository, createMockTransformRepository } from '../../__tests__/mocks/databaseMocks';
import { TypedJsonDoc } from '@/common/types';

describe('Streaming Workflow Tests', () => {
    let mockJsonDocRepo: any;
    let mockTransformRepo: any;
    const testProjectId = 'streaming-test-project';
    const testUserId = 'streaming-test-user';

    beforeEach(() => {
        mockJsonDocRepo = createMockJsonDocRepository();
        mockTransformRepo = createMockTransformRepository();

        // Setup mock getJsonDoc to return proper jsonDoc data
        mockJsonDocRepo.getJsonDoc.mockImplementation(async (id: string) => {
            // Return proper jsonDoc data based on the ID pattern
            if (id.includes('mock-jsonDoc-1') || id.startsWith('new-jsonDoc-')) {
                // This should be a brainstorm_idea with user_input schema (from human transform)
                return {
                    id: id,
                    project_id: testProjectId,
                    data: {
                        title: '现代都市甜宠',
                        body: '一个关于都市白领的甜宠故事，男女主角在职场相遇，经历误会后走到一起'
                    },
                    schema_type: 'brainstorm_idea' as TypedJsonDoc['schema_type'],
                    origin_type: 'user_input',
                    metadata: {
                        derived_data: {
                            title: '现代都市甜宠',
                            body: '一个关于都市白领的甜宠故事，男女主角在职场相遇，经历误会后走到一起'
                        }
                    }
                };
            } else if (id.includes('mock-jsonDoc-') || id.includes('outline') || id.startsWith('new-outline-')) {
                return {
                    id: id,
                    project_id: testProjectId,
                    data: {
                        title: '都市甜宠故事',
                        genre: '现代甜宠',
                        target_audience: '18-35岁女性',
                        platform: '抖音',
                        selling_points: ['职场恋爱', '霸总甜宠', '误会重重'],
                        satisfaction_points: ['甜蜜互动', '霸道宠溺', '逆袭成功'],
                        setting: {
                            time_period: '现代',
                            location: '上海',
                            social_context: '都市职场'
                        },
                        characters: [
                            {
                                name: '林晓雨',
                                type: 'female_lead',
                                age: '25',
                                occupation: '设计师',
                                personality: '独立坚强',
                                appearance: '清纯可爱',
                                background: '普通家庭出身'
                            }
                        ]
                    },
                    schema_type: 'outline_settings' as TypedJsonDoc['schema_type'],
                    origin_type: 'ai_generated'
                };
            }
            return null;
        });
    });

    it('should handle streaming outline settings generation', async () => {
        const cachingOptions = { enableCaching: false };

        // Create a mock brainstorm idea jsonDoc (from human transform)
        const mockBrainstormJsonDoc = await mockJsonDocRepo.createJsonDoc({
            schema_type: 'brainstorm_idea' as TypedJsonDoc['schema_type'],
            data: {
                title: '现代都市甜宠',
                body: '一个关于都市白领的甜宠故事，男女主角在职场相遇，经历误会后走到一起'
            },
            projectId: testProjectId,
            schemaType: 'brainstorm_idea',
            originType: 'user_input'
        });

        const outlineSettingsTool = createOutlineSettingsToolDefinition(
            mockTransformRepo,
            mockJsonDocRepo,
            testProjectId,
            testUserId,
            cachingOptions
        );

        const outlineSettingsResult = await outlineSettingsTool.execute({
            sourceJsonDocId: mockBrainstormJsonDoc.id,
            title: '都市甜宠剧本框架',
            requirements: '创建详细的角色设定和商业定位'
        }, { toolCallId: 'test-outline-settings' });

        expect(outlineSettingsResult).toBeDefined();
        expect(outlineSettingsResult.outputJsonDocId).toBeDefined();
        expect(outlineSettingsResult.finishReason).toBeDefined();
    });

    it('should handle streaming chronicles generation', async () => {
        const cachingOptions = { enableCaching: false };

        // Create a mock outline settings jsonDoc first
        const mockOutlineSettingsJsonDoc = await mockJsonDocRepo.createJsonDoc({
            schema_type: 'outline_settings' as TypedJsonDoc['schema_type'],
            data: {
                title: '都市甜宠故事',
                genre: '现代甜宠',
                target_audience: '18-35岁女性',
                platform: '抖音',
                selling_points: ['职场恋爱', '霸总甜宠', '误会重重'],
                satisfaction_points: ['甜蜜互动', '霸道宠溺', '逆袭成功'],
                setting: {
                    time_period: '现代',
                    location: '上海',
                    social_context: '都市职场'
                },
                characters: [
                    {
                        name: '林晓雨',
                        type: 'female_lead',
                        age: '25',
                        occupation: '设计师',
                        personality: '独立坚强',
                        appearance: '清纯可爱',
                        background: '普通家庭出身'
                    }
                ]
            },
            projectId: testProjectId,
            schemaType: 'outline_settings' as TypedJsonDoc['schema_type'],
            originType: 'ai_generated'
        });

        const chroniclesTool = createChroniclesToolDefinition(
            mockTransformRepo,
            mockJsonDocRepo,
            testProjectId,
            testUserId,
            cachingOptions
        );

        const chroniclesResult = await chroniclesTool.execute({
            sourceJsonDocId: mockOutlineSettingsJsonDoc.id,
            requirements: '创建完整的时序发展脉络'
        }, { toolCallId: 'test-chronicles' });

        expect(chroniclesResult).toBeDefined();
        expect(chroniclesResult.outputJsonDocId).toBeDefined();
        expect(chroniclesResult.finishReason).toBeDefined();
    });

    it('should validate tool definitions', async () => {
        const cachingOptions = { enableCaching: false };

        const outlineSettingsTool = createOutlineSettingsToolDefinition(
            mockTransformRepo,
            mockJsonDocRepo,
            testProjectId,
            testUserId,
            cachingOptions
        );

        expect(outlineSettingsTool).toBeDefined();
        expect(outlineSettingsTool.execute).toBeInstanceOf(Function);

        const chroniclesTool = createChroniclesToolDefinition(
            mockTransformRepo,
            mockJsonDocRepo,
            testProjectId,
            testUserId,
            cachingOptions
        );

        expect(chroniclesTool).toBeDefined();
        expect(chroniclesTool.execute).toBeInstanceOf(Function);
    });
}); 