interface OutlineExportData {
    sessionId: string;
    sourceArtifact: {
        text: string;
        title?: string;
        type: string;
    };
    totalEpisodes?: number;
    episodeDuration?: number;
    components: {
        title?: string;
        genre?: string;
        target_audience?: {
            demographic?: string;
            core_themes?: string[];
        };
        selling_points?: string;
        satisfaction_points?: string[];
        setting?: string;
        synopsis?: string;
        synopsis_stages?: Array<{
            stageSynopsis: string;
            numberOfEpisodes: number;
            timeframe?: string;
            startingCondition?: string;
            endingCondition?: string;
            stageStartEvent?: string;
            stageEndEvent?: string;
            keyMilestones?: string[];
            relationshipLevel?: string;
            emotionalArc?: string;
            externalPressure?: string;
        }>;
        characters?: Array<{
            name: string;
            type?: string;
            description: string;
            age?: string;
            gender?: string;
            occupation?: string;
            personality_traits?: string[];
            character_arc?: string;
            relationships?: { [key: string]: string };
            key_scenes?: string[];
        }>;
    };
    createdAt: string;
}

// Helper function to repeat characters
function repeatChar(char: string, count: number): string {
    return Array(count + 1).join(char);
}

export function formatOutlineForExport(data: OutlineExportData): string {
    const sections: string[] = [];

    // Header
    sections.push(repeatChar("=", 60));
    sections.push("剧本大纲");
    sections.push(repeatChar("=", 60));
    sections.push("");

    // Basic Information
    sections.push("📋 基本信息");
    sections.push(repeatChar("-", 30));
    if (data.components.title) {
        sections.push(`标题：${data.components.title}`);
    }
    if (data.components.genre) {
        sections.push(`类型：${data.components.genre}`);
    }
    if (data.totalEpisodes) {
        sections.push(`总集数：${data.totalEpisodes}集`);
    }
    if (data.episodeDuration) {
        sections.push(`每集时长：${data.episodeDuration}分钟`);
    }
    sections.push(`创建时间：${new Date(data.createdAt).toLocaleString('zh-CN')}`);
    sections.push(`会话ID：${data.sessionId}`);
    sections.push("");

    // Source Idea
    sections.push("💡 创意来源");
    sections.push(repeatChar("-", 30));
    if (data.sourceArtifact.title) {
        sections.push(`标题：${data.sourceArtifact.title}`);
    }
    sections.push(`内容：${data.sourceArtifact.text || '无'}`);
    sections.push(`类型：${data.sourceArtifact.type}`);
    sections.push("");

    // Target Audience
    if (data.components.target_audience) {
        sections.push("🎯 目标受众");
        sections.push(repeatChar("-", 30));
        if (data.components.target_audience.demographic) {
            sections.push(`受众群体：${data.components.target_audience.demographic}`);
        }
        if (data.components.target_audience.core_themes && data.components.target_audience.core_themes.length > 0) {
            sections.push(`核心主题：${data.components.target_audience.core_themes.join('、')}`);
        }
        sections.push("");
    }

    // Selling Points
    if (data.components.selling_points) {
        sections.push("💼 产品卖点");
        sections.push(repeatChar("-", 30));
        sections.push(data.components.selling_points);
        sections.push("");
    }

    // Satisfaction Points
    if (data.components.satisfaction_points && data.components.satisfaction_points.length > 0) {
        sections.push("⚡ 情感爽点");
        sections.push(repeatChar("-", 30));
        data.components.satisfaction_points.forEach((point, index) => {
            sections.push(`${index + 1}. ${point}`);
        });
        sections.push("");
    }

    // Setting
    if (data.components.setting) {
        sections.push("🏞️ 故事设定");
        sections.push(repeatChar("-", 30));
        sections.push(data.components.setting);
        sections.push("");
    }

    // Characters
    if (data.components.characters && data.components.characters.length > 0) {
        sections.push("👥 主要角色");
        sections.push(repeatChar("-", 30));

        data.components.characters.forEach((character, index) => {
            sections.push(`${index + 1}. ${character.name}`);

            // Character details in a compact format
            const details: string[] = [];
            if (character.type) details.push(`类型：${character.type}`);
            if (character.age) details.push(`年龄：${character.age}`);
            if (character.gender) details.push(`性别：${character.gender}`);
            if (character.occupation) details.push(`职业：${character.occupation}`);

            if (details.length > 0) {
                sections.push(`   ${details.join(' | ')}`);
            }

            if (character.description) {
                sections.push(`   描述：${character.description}`);
            }

            if (character.personality_traits && character.personality_traits.length > 0) {
                sections.push(`   性格特点：${character.personality_traits.join('、')}`);
            }

            if (character.character_arc) {
                sections.push(`   成长轨迹：${character.character_arc}`);
            }

            sections.push("");
        });
    }

    // Synopsis
    if (data.components.synopsis) {
        sections.push("📖 故事梗概");
        sections.push(repeatChar("-", 30));
        sections.push(data.components.synopsis);
        sections.push("");
    }

    // Enhanced Synopsis Stages with detailed structure
    if (data.components.synopsis_stages && data.components.synopsis_stages.length > 0) {
        sections.push("📚 分段故事梗概（详细结构）");
        sections.push(repeatChar("-", 30));

        // Calculate total episodes
        const totalEpisodes = data.components.synopsis_stages.reduce((sum, stage) => sum + stage.numberOfEpisodes, 0);
        sections.push(`总计：${totalEpisodes}集`);
        sections.push("");

        let currentEpisode = 1;
        data.components.synopsis_stages.forEach((stage, index) => {
            const endEpisode = currentEpisode + stage.numberOfEpisodes - 1;

            // Stage header
            sections.push(repeatChar("─", 40));
            sections.push(`第${index + 1}阶段 (第${currentEpisode}-${endEpisode}集，共${stage.numberOfEpisodes}集)`);
            sections.push(repeatChar("─", 40));

            // Basic story content
            sections.push("📖 故事内容：");
            sections.push(stage.stageSynopsis);
            sections.push("");

            // Temporal Constraints (🟢)
            if (stage.timeframe || stage.startingCondition || stage.endingCondition) {
                sections.push("🟢 时间约束：");
                if (stage.timeframe) {
                    sections.push(`   时间框架：${stage.timeframe}`);
                }
                if (stage.startingCondition) {
                    sections.push(`   开始条件：${stage.startingCondition}`);
                }
                if (stage.endingCondition) {
                    sections.push(`   结束条件：${stage.endingCondition}`);
                }
                sections.push("");
            }

            // Event Boundaries (🔵)
            if (stage.stageStartEvent || stage.stageEndEvent || (stage.keyMilestones && stage.keyMilestones.length > 0)) {
                sections.push("🔵 事件边界：");
                if (stage.stageStartEvent) {
                    sections.push(`   开始事件：${stage.stageStartEvent}`);
                }
                if (stage.stageEndEvent) {
                    sections.push(`   结束事件：${stage.stageEndEvent}`);
                }
                if (stage.keyMilestones && stage.keyMilestones.length > 0) {
                    sections.push("   关键节点：");
                    stage.keyMilestones.forEach((milestone, mIndex) => {
                        if (milestone.trim()) {
                            sections.push(`     ${mIndex + 1}. ${milestone}`);
                        }
                    });
                }
                sections.push("");
            }

            // Relationship Progression (🟠)
            if (stage.relationshipLevel || stage.emotionalArc || stage.externalPressure) {
                sections.push("🟠 关系发展：");
                if (stage.relationshipLevel) {
                    sections.push(`   关系层次：${stage.relationshipLevel}`);
                }
                if (stage.emotionalArc) {
                    sections.push(`   情感弧线：${stage.emotionalArc}`);
                }
                if (stage.externalPressure) {
                    sections.push(`   外部压力：${stage.externalPressure}`);
                }
                sections.push("");
            }

            currentEpisode = endEpisode + 1;
        });
    }

    // Footer
    sections.push(repeatChar("=", 60));
    sections.push("导出完成");
    sections.push(`导出时间：${new Date().toLocaleString('zh-CN')}`);
    sections.push(repeatChar("=", 60));

    return sections.join("\n");
}

export type { OutlineExportData }; 