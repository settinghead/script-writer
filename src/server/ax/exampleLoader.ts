import { StoryIdea, BrainstormRequest } from './ax-brainstorm-types';
import { readFileSync } from 'fs';
import { join } from 'path';

// Interface for the JSON example files
interface JSONExample {
    content: string;
    genre: {
        category: string;
        subcategory: string;
        type: string;
    };
    genre_path: string[];
    tags: string[];
    character_count: number;
}

// Convert JSON examples to ax program format
export function loadExamples(): Array<BrainstormRequest & StoryIdea> {
    const examples: Array<BrainstormRequest & StoryIdea> = [];

    // Load all example files
    for (let i = 1; i <= 5; i++) {
        try {
            const filePath = join(__dirname, '../../examples', `example_idea${i}.json`);
            const rawData = readFileSync(filePath, 'utf-8');
            const jsonExample: JSONExample = JSON.parse(rawData);

            // Extract title and body from content
            const { title, body } = extractTitleAndBody(jsonExample.content);

            // Map to ax program format
            const axExample: BrainstormRequest & StoryIdea = {
                // Input format
                genre: jsonExample.genre.type,
                platform: mapGenreToDefaultPlatform(jsonExample.genre.type),
                requirements_section: generateRequirements(jsonExample.tags, jsonExample.genre_path),

                // Output format
                title,
                body
            };

            examples.push(axExample);
        } catch (error) {
            console.warn(`Failed to load example ${i}:`, error);
        }
    }

    return examples;
}

// Extract title and body from content (simple heuristic)
function extractTitleAndBody(content: string): { title: string; body: string } {
    // For now, generate a simple title based on content keywords
    // In a real scenario, you might have separate title fields
    const keywords = content.substring(0, 20);

    let title = '未命名';

    // Simple title generation based on content
    if (content.includes('将军')) title = '将军情缘';
    else if (content.includes('谈判专家')) title = '谈判专家';
    else if (content.includes('总裁')) title = '总裁恋歌';
    else if (content.includes('穿越')) title = '穿越奇缘';
    else if (content.includes('校园')) title = '校园青春';

    // Use the full content as body, truncated if too long
    let body = content;
    if (body.length > 180) {
        body = body.substring(0, 177) + '...';
    }

    return { title, body };
}

// Map genre to default platform
function mapGenreToDefaultPlatform(genreType: string): string {
    const platformMapping: Record<string, string> = {
        "甜宠": "抖音",
        "虐恋": "小红书",
        "复仇": "快手",
        "穿越": "抖音",
        "重生": "小红书",
        "马甲": "快手",
        "霸总": "抖音",
        "战神": "快手",
        "神豪": "抖音",
        "赘婿": "小红书",
        "玄幻": "快手",
        "末世": "抖音",
        "娱乐圈": "小红书",
        "萌宝": "抖音",
        "团宠": "快手"
    };

    return platformMapping[genreType] || "抖音";
}

// Generate requirements from tags and genre path
function generateRequirements(tags: string[], genrePath: string[]): string {
    const tagStr = tags.slice(0, 3).join('、'); // Use first 3 tags
    const backgroundHint = tags.includes('古代背景') ? '古代背景' :
        tags.includes('现代') ? '现代背景' :
            tags.includes('都市') ? '现代都市' : '';

    return backgroundHint ? `${backgroundHint}，${tagStr}` : tagStr;
} 