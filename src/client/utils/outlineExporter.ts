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
        selling_points?: string;
        setting?: string;
        synopsis?: string;
        characters?: Array<{
            name: string;
            description: string;
            age?: string;
            gender?: string;
            occupation?: string;
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

    // Selling Points
    if (data.components.selling_points) {
        sections.push("🎯 故事卖点");
        sections.push(repeatChar("-", 30));
        sections.push(data.components.selling_points);
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
            if (character.age) details.push(`年龄：${character.age}`);
            if (character.gender) details.push(`性别：${character.gender}`);
            if (character.occupation) details.push(`职业：${character.occupation}`);

            if (details.length > 0) {
                sections.push(`   ${details.join(' | ')}`);
            }

            if (character.description) {
                sections.push(`   描述：${character.description}`);
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

    // Footer
    sections.push(repeatChar("=", 60));
    sections.push("导出完成");
    sections.push(`导出时间：${new Date().toLocaleString('zh-CN')}`);
    sections.push(repeatChar("=", 60));

    return sections.join("\n");
}

export type { OutlineExportData }; 