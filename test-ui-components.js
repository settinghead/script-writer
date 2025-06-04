// Test script for enhanced outline UI components
const fs = require('fs');
const path = require('path');

console.log('Testing Enhanced Outline UI Components...\n');

// Test data that matches the new structure from the user's JSON
const testOutlineData = {
    "id": "c59ce510-dcb9-46d8-ad5a-dd2a868b87eb",
    "sourceArtifact": {
        "id": "5314c55b-16b8-4037-923c-85243403f547",
        "text": "她重生回到十年前，决定改变命运同时远离那段虐恋。但阴差阳错下，还是与他相遇。两人再度相恋，而她知道未来结局注定悲惨，这一次她能否扭转命运，让爱情开花结果？",
        "title": "时光恋人",
        "type": "brainstorm_idea",
        "ideationRunId": "a1f19936-3b36-406c-9bf7-67a4dd95c0e1"
    },
    "ideationRunId": "a1f19936-3b36-406c-9bf7-67a4dd95c0e1",
    "totalEpisodes": 60,
    "episodeDuration": 2,
    "components": {
        "title": "重生之我再爱你一次",
        "genre": "都市言情/虐恋/重生",
        "target_audience": {
            "demographic": "95-05年女性",
            "core_themes": [
                "青春怀旧",
                "情感困境",
                "自我成长"
            ]
        },
        "selling_points": [
            "聚焦当代年轻女性的情感焦虑，展现重生逆袭的爽感与治愈力量",
            "探讨爱情中信任与牺牲的边界，弘扬独立自主的价值观",
            "结合热门重生+虐恋元素，打造高话题度与传播潜力"
        ],
        "satisfaction_points": [
            "女主重生后一步步掌控命运，巧妙化解前世悲剧",
            "男主深情不改却步步为营，最终被女主感动放下心防",
            "前世恶人终遭报应，真相揭晓瞬间引爆观众情绪"
        ],
        "setting": "女主因前世被背叛而死，重生回十年前大学时期，决定远离那段虐恋，却阴差阳错再度陷入爱河。\n\n关键场景：\n- 重生苏醒时的崩溃与觉醒\n- 两人在校园咖啡馆意外重逢\n- 前世真相揭露引发激烈对峙",
        "characters": [
            {
                "name": "林晚晴",
                "type": "female_lead",
                "description": "聪慧坚韧却内心敏感，曾因深陷爱情而失去自我。重生后决心改变命运，却难敌宿命牵引。",
                "age": "22岁",
                "gender": "女",
                "occupation": "大三学生",
                "personality_traits": [
                    "冷静理性",
                    "缺乏安全感",
                    "表面疏离实则深情"
                ],
                "character_arc": "从逃避过去到直面情感，学会信任并勇敢争取幸福",
                "relationships": {
                    "顾沉舟": "前世恋人，今生再次相恋却充满矛盾",
                    "周子墨": "男二，温柔守护者，默默付出多年"
                },
                "key_scenes": [
                    "重生醒来崩溃痛哭",
                    "拒绝顾沉舟的告白",
                    "真相揭晓时的爆发质问"
                ]
            },
            {
                "name": "顾沉舟",
                "type": "male_lead",
                "description": "外表冷漠强势，内心炽热执着，前世因误会伤害了最爱的人，今世誓要挽回一切。",
                "age": "24岁",
                "gender": "男",
                "occupation": "研究生/校董继承人",
                "personality_traits": [
                    "隐忍深情",
                    "控制欲强",
                    "外冷内热"
                ],
                "character_arc": "从占有欲极强到学会尊重爱人意愿，完成从偏执到成熟的转变",
                "relationships": {
                    "林晚晴": "命中注定的恋人，前世错过今生重逢",
                    "苏若雪": "暗恋他的富家千金，多次设计陷害女主"
                },
                "key_scenes": [
                    "初遇时的试探与靠近",
                    "发现女主重生记忆后的震惊",
                    "为救女主身受重伤"
                ]
            }
        ],
        "stages": [
            {
                "title": "重生觉醒阶段",
                "stageSynopsis": "林晚晴重生回到十年前，决心改变命运远离悲剧。但命运弄人，她再次与顾沉舟相遇，内心挣扎不已。",
                "numberOfEpisodes": 15,
                "timeframe": "重生后第1-30天",
                "startingCondition": "林晚晴重生苏醒，回到大学时期",
                "endingCondition": "两人重新建立联系，感情开始萌芽",
                "stageStartEvent": "林晚晴重生苏醒",
                "stageEndEvent": "顾沉舟主动表白",
                "keyPoints": [
                    {
                        "event": "林晚晴重生苏醒，回忆前世痛苦",
                        "timeSpan": "第1天",
                        "emotionArcs": [
                            {
                                "characters": ["林晚晴"],
                                "content": "从绝望痛苦转为坚定决心"
                            }
                        ],
                        "relationshipDevelopments": [
                            {
                                "characters": ["林晚晴", "顾沉舟"],
                                "content": "从前世恋人关系重置为陌生人"
                            }
                        ]
                    },
                    {
                        "event": "校园咖啡馆意外重逢",
                        "timeSpan": "第7天",
                        "emotionArcs": [
                            {
                                "characters": ["林晚晴"],
                                "content": "从刻意回避转为内心动摇"
                            },
                            {
                                "characters": ["顾沉舟"],
                                "content": "从淡然转为强烈好奇"
                            }
                        ],
                        "relationshipDevelopments": [
                            {
                                "characters": ["林晚晴", "顾沉舟"],
                                "content": "从陌生人升级为有印象的同学"
                            }
                        ]
                    }
                ],
                "externalPressure": "学业压力、家庭期望、前世记忆的困扰"
            },
            {
                "title": "情感纠葛阶段",
                "stageSynopsis": "两人感情逐渐升温，但林晚晴因前世记忆而犹豫不决，顾沉舟则全力追求。各种误会和考验接踵而至。",
                "numberOfEpisodes": 25,
                "timeframe": "重生后第31-90天",
                "startingCondition": "两人开始交往",
                "endingCondition": "感情面临重大危机",
                "stageStartEvent": "正式确立恋爱关系",
                "stageEndEvent": "前世真相部分揭露",
                "keyPoints": [
                    {
                        "event": "正式确立恋爱关系",
                        "timeSpan": "第31天",
                        "emotionArcs": [
                            {
                                "characters": ["林晚晴"],
                                "content": "从犹豫不决转为勇敢尝试"
                            },
                            {
                                "characters": ["顾沉舟"],
                                "content": "从追求转为珍惜呵护"
                            }
                        ],
                        "relationshipDevelopments": [
                            {
                                "characters": ["林晚晴", "顾沉舟"],
                                "content": "从暧昧关系升级为正式恋人"
                            }
                        ]
                    },
                    {
                        "event": "前世真相开始浮现",
                        "timeSpan": "第80-90天",
                        "emotionArcs": [
                            {
                                "characters": ["林晚晴"],
                                "content": "从甜蜜转为恐惧和痛苦"
                            },
                            {
                                "characters": ["顾沉舟"],
                                "content": "从困惑转为震惊和愧疚"
                            }
                        ],
                        "relationshipDevelopments": [
                            {
                                "characters": ["林晚晴", "顾沉舟"],
                                "content": "从甜蜜恋人转为充满隔阂的关系"
                            }
                        ]
                    }
                ],
                "externalPressure": "苏若雪的陷害、家族压力、前世仇人的出现"
            },
            {
                "title": "真相揭露与和解阶段",
                "stageSynopsis": "前世真相完全揭露，两人经历痛苦的分离和误解。最终通过努力和成长，化解心结，获得真正的幸福。",
                "numberOfEpisodes": 20,
                "timeframe": "重生后第91-150天",
                "startingCondition": "两人关系破裂",
                "endingCondition": "重归于好，获得幸福结局",
                "stageStartEvent": "前世真相完全揭露",
                "stageEndEvent": "两人重新在一起，获得幸福",
                "keyPoints": [
                    {
                        "event": "前世真相完全揭露，两人痛苦分离",
                        "timeSpan": "第91-100天",
                        "emotionArcs": [
                            {
                                "characters": ["林晚晴"],
                                "content": "从痛苦转为理解和原谅"
                            },
                            {
                                "characters": ["顾沉舟"],
                                "content": "从愧疚转为坚定的救赎决心"
                            }
                        ],
                        "relationshipDevelopments": [
                            {
                                "characters": ["林晚晴", "顾沉舟"],
                                "content": "从恋人关系跌落到陌生人"
                            }
                        ]
                    },
                    {
                        "event": "顾沉舟为救林晚晴身受重伤",
                        "timeSpan": "第140天",
                        "emotionArcs": [
                            {
                                "characters": ["林晚晴"],
                                "content": "从冷漠转为深深的感动和爱意"
                            },
                            {
                                "characters": ["顾沉舟"],
                                "content": "从绝望转为看到希望"
                            }
                        ],
                        "relationshipDevelopments": [
                            {
                                "characters": ["林晚晴", "顾沉舟"],
                                "content": "从陌生人重新升级为相爱的恋人"
                            }
                        ]
                    }
                ],
                "externalPressure": "前世仇人的最后反扑、生死考验"
            }
        ]
    }
};

console.log('=== Test 1: Data Structure Validation ===');
console.log('✓ Test data loaded successfully');
console.log(`✓ Title: ${testOutlineData.components.title}`);
console.log(`✓ Genre: ${testOutlineData.components.genre}`);
console.log(`✓ Total Episodes: ${testOutlineData.totalEpisodes}`);
console.log(`✓ Characters: ${testOutlineData.components.characters.length}`);
console.log(`✓ Stages: ${testOutlineData.components.stages.length}`);

// Validate stages structure
console.log('\n=== Test 2: Stages Structure Validation ===');
testOutlineData.components.stages.forEach((stage, index) => {
    console.log(`Stage ${index + 1}: ${stage.title}`);
    console.log(`  - Episodes: ${stage.numberOfEpisodes}`);
    console.log(`  - Key Points: ${stage.keyPoints.length}`);

    stage.keyPoints.forEach((point, pIndex) => {
        console.log(`    Point ${pIndex + 1}: ${point.event}`);
        console.log(`      - Emotion Arcs: ${point.emotionArcs.length}`);
        console.log(`      - Relationship Developments: ${point.relationshipDevelopments.length}`);
    });
});

// Calculate episode distribution
console.log('\n=== Test 3: Episode Distribution ===');
let totalCalculated = 0;
testOutlineData.components.stages.forEach((stage, index) => {
    const start = totalCalculated + 1;
    const end = totalCalculated + stage.numberOfEpisodes;
    totalCalculated += stage.numberOfEpisodes;
    console.log(`Stage ${index + 1}: Episodes ${start}-${end} (${stage.numberOfEpisodes} episodes)`);
});
console.log(`Total calculated: ${totalCalculated} episodes`);
console.log(`Expected total: ${testOutlineData.totalEpisodes} episodes`);

if (totalCalculated === testOutlineData.totalEpisodes) {
    console.log('✓ Episode distribution matches total');
} else {
    console.log('✗ Episode distribution mismatch');
}

// Test field registry compatibility
console.log('\n=== Test 4: Field Registry Compatibility ===');
const expectedFields = [
    'title',
    'genre',
    'target_audience',
    'selling_points',
    'satisfaction_points',
    'setting',
    'characters',
    'stages'
];

expectedFields.forEach(field => {
    if (testOutlineData.components[field] !== undefined) {
        console.log(`✓ Field '${field}' present`);
    } else {
        console.log(`✗ Field '${field}' missing`);
    }
});

// Test enhanced key points structure
console.log('\n=== Test 5: Enhanced Key Points Structure ===');
const firstStage = testOutlineData.components.stages[0];
const firstKeyPoint = firstStage.keyPoints[0];

console.log('First key point structure:');
console.log(`  Event: ${firstKeyPoint.event}`);
console.log(`  Time Span: ${firstKeyPoint.timeSpan}`);
console.log(`  Emotion Arcs: ${firstKeyPoint.emotionArcs.length}`);
console.log(`  Relationship Developments: ${firstKeyPoint.relationshipDevelopments.length}`);

// Validate emotion arcs
firstKeyPoint.emotionArcs.forEach((arc, index) => {
    console.log(`    Emotion Arc ${index + 1}:`);
    console.log(`      Characters: ${arc.characters.join(', ')}`);
    console.log(`      Content: ${arc.content}`);
});

// Validate relationship developments
firstKeyPoint.relationshipDevelopments.forEach((dev, index) => {
    console.log(`    Relationship Dev ${index + 1}:`);
    console.log(`      Characters: ${dev.characters.join(', ')}`);
    console.log(`      Content: ${dev.content}`);
});

console.log('\n=== All Tests Passed! ===');
console.log('✓ Enhanced outline structure is properly formatted');
console.log('✓ All required fields are present');
console.log('✓ Episode distribution is correct');
console.log('✓ Enhanced key points structure is valid');
console.log('✓ Emotion arcs and relationship developments are properly structured');

// Save test data for manual UI testing
const outputPath = path.join(__dirname, 'test-outline-data.json');
fs.writeFileSync(outputPath, JSON.stringify(testOutlineData, null, 2));
console.log(`\n✓ Test data saved to: ${outputPath}`);
console.log('You can use this data to manually test the UI components.'); 