export const mockArtifacts = {
    brainstormIdea: {
        id: 'test-brainstorm-1',
        type: 'brainstorm_idea',
        project_id: 'test-project-1',
        data: JSON.stringify({
            title: '误爱成宠',
            body: '林氏集团总裁林慕琛因一场误会将普通职员夏栀认作富家千金...'
        }),
        schema_type: 'brainstorm_idea',
        schema_version: '1.0',
        type_version: '1.0',
        origin_type: 'ai_generated',
        metadata: null,
        created_at: new Date(),
        updated_at: new Date()
    },

    outline: {
        id: 'test-outline-1',
        type: 'outline',
        project_id: 'test-project-1',
        data: JSON.stringify({
            title: '误爱成宠',
            genre: '现代言情',
            target_audience: {
                demographic: '18-35岁都市女性',
                core_themes: ['误会', '甜宠', '职场']
            },
            selling_points: ['霸道总裁', '甜宠日常', '误会解除'],
            satisfaction_points: ['甜蜜互动', '身份反转', '真爱胜利'],
            setting: {
                core_setting_summary: '现代都市背景，主要场景为林氏集团总部',
                key_scenes: ['总裁办公室', '员工餐厅', '豪华酒店', '家庭聚会']
            },
            characters: [
                {
                    name: '林慕琛',
                    type: 'male_lead',
                    description: '林氏集团总裁，外冷内热',
                    age: '30岁',
                    gender: '男',
                    occupation: '集团总裁',
                    personality_traits: ['冷静', '专业', '内心温柔'],
                    character_arc: '从误解到理解，从冷漠到深情',
                    relationships: { '夏栀': '恋人关系' },
                    key_scenes: ['初次见面', '误会产生', '真相大白', '表白场景']
                },
                {
                    name: '夏栀',
                    type: 'female_lead',
                    description: '普通职员，善良坚强',
                    age: '25岁',
                    gender: '女',
                    occupation: '公司职员',
                    personality_traits: ['善良', '坚强', '聪明'],
                    character_arc: '从被误解到证明自己，获得真爱',
                    relationships: { '林慕琛': '恋人关系' },
                    key_scenes: ['入职场景', '被误解', '澄清真相', '接受告白']
                }
            ],
            stages: [
                {
                    title: '相遇篇',
                    stageSynopsis: '夏栀入职林氏集团，与总裁林慕琛初次相遇',
                    keyPoints: [
                        {
                            event: '夏栀入职',
                            emotionArcs: [
                                {
                                    characters: ['夏栀'],
                                    content: '紧张兴奋，希望有好的开始'
                                }
                            ],
                            relationshipDevelopments: [
                                {
                                    characters: ['夏栀', '林慕琛'],
                                    content: '初次相遇，产生第一印象'
                                }
                            ]
                        }
                    ]
                },
                {
                    title: '误会篇',
                    stageSynopsis: '林慕琛误以为夏栀是富家千金，开始特殊对待',
                    keyPoints: [
                        {
                            event: '误会产生',
                            emotionArcs: [
                                {
                                    characters: ['林慕琛'],
                                    content: '对夏栀另眼相看，心生好感'
                                }
                            ],
                            relationshipDevelopments: [
                                {
                                    characters: ['夏栀', '林慕琛'],
                                    content: '关系变得复杂，夏栀困惑不解'
                                }
                            ]
                        }
                    ]
                }
            ]
        }),
        schema_type: 'outline',
        schema_version: '1.0',
        type_version: '1.0',
        origin_type: 'ai_generated',
        metadata: null,
        created_at: new Date(),
        updated_at: new Date()
    }
};

export const mockTransforms = {
    brainstormTransform: {
        id: 'test-transform-1',
        type: 'llm',
        project_id: 'test-project-1',
        status: 'completed',
        input_artifacts: ['test-input-1'],
        output_artifact_id: 'test-brainstorm-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
}; 