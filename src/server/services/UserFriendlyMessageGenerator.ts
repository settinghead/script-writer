/**
 * UserFriendlyMessageGenerator - Converts raw technical messages into fun, vague, user-friendly Chinese messages
 * for IP protection and better user experience
 */

export interface MessageOptions {
    toolName?: string;
    toolCallId?: string;
    toolParameters?: Record<string, any>;
    toolResult?: Record<string, any>;
    status?: 'streaming' | 'completed' | 'failed';
    errorMessage?: string;
}

export interface DisplayMessage {
    content: string;
    displayType: 'message' | 'thinking' | 'progress';
}

// Creative progress messages for different tool types
const TOOL_MESSAGES = {
    'brainstorm_generation': [
        "✨ 创意火花四溅中...",
        "🎨 灵感正在酝酿...",
        "💡 捕捉精彩创意...",
        "🌟 思维碰撞进行时...",
        "🔥 创意熔炉加热中..."
    ],
    'outline_generation': [
        "📝 精心编织故事大纲...",
        "🏗️ 构建剧情框架...",
        "📖 雕琢故事细节...",
        "🎭 塑造人物命运...",
        "📚 编排故事脉络..."
    ],
    'chronicles_generation': [
        "⏰ 梳理时间线索...",
        "📅 编排剧情节奏...",
        "🗓️ 整理故事脉络...",
        "⌛ 时光轴构建中...",
        "🕐 时序安排进行时..."
    ],
    'episode_planning': [
        "🎬 规划精彩剧集...",
        "📺 设计分集结构...",
        "🎭 安排剧情高潮...",
        "🎪 编排戏剧张力...",
        "🎨 精雕细琢剧本..."
    ],
    'episode_generation': [
        "🎬 创作精彩剧本...",
        "📝 编写对白台词...",
        "🎭 塑造角色表演...",
        "🎪 营造戏剧氛围...",
        "✍️ 妙笔生花进行时..."
    ],
    'brainstorm_edit': [
        "✏️ 精心雕琢创意...",
        "🔧 调整灵感细节...",
        "🎨 完善创作思路...",
        "💎 打磨创意宝石...",
        "🌟 提升创意亮度..."
    ]
};

// Generic progress messages for unknown tools
const GENERIC_TOOL_MESSAGES = [
    "🔧 努力工作中...",
    "⚙️ 系统处理中...",
    "🎯 专注创作中...",
    "💪 全力以赴中...",
    "🚀 加速处理中..."
];

// Thinking/reasoning messages
const THINKING_MESSAGES = [
    "🤔 思考中...",
    "💭 深度思考中...",
    "🧠 分析中...",
    "💡 构思中...",
    "🎯 专注思考中..."
];

// Streaming progress messages
const STREAMING_MESSAGES = [
    "✍️ 创作中...",
    "📝 书写中...",
    "🎨 创造中...",
    "✨ 生成中...",
    "🌟 制作中..."
];

// Error messages
const ERROR_MESSAGES = [
    "😅 哎呀，出了点小问题，再试一次吧！",
    "🤷‍♀️ 遇到了一些小困难，让我重新来...",
    "😊 稍等一下，我需要重新整理思路...",
    "🔄 让我换个思路再试试...",
    "💪 不要紧，我们再来一次！"
];

// Completion messages
const COMPLETION_MESSAGES = [
    "✅ 完成啦！",
    "🎉 大功告成！",
    "👏 搞定了！",
    "🌟 完美收工！",
    "🎊 任务完成！"
];

/**
 * Generate user-friendly message content based on raw message details
 */
export function generateUserFriendlyContent(
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: string,
    options: MessageOptions = {}
): DisplayMessage {
    const { toolName, status, errorMessage } = options;

    // User messages: show as-is (users see what they typed)
    if (role === 'user') {
        return {
            content,
            displayType: 'message'
        };
    }

    // System messages: hide completely (return empty - should not be displayed)
    if (role === 'system') {
        return {
            content: '',
            displayType: 'message'
        };
    }

    // Handle errors first
    if (status === 'failed' || errorMessage) {
        return {
            content: getRandomMessage(ERROR_MESSAGES),
            displayType: 'message'
        };
    }

    // Tool messages: convert to progress indicators
    if (role === 'tool' || toolName) {
        if (status === 'streaming') {
            return {
                content: getToolProgressMessage(toolName),
                displayType: 'progress'
            };
        } else if (status === 'completed') {
            return {
                content: getRandomMessage(COMPLETION_MESSAGES),
                displayType: 'message'
            };
        } else {
            return {
                content: getToolProgressMessage(toolName),
                displayType: 'progress'
            };
        }
    }

    // Assistant messages: handle based on status and content
    if (role === 'assistant') {
        // If streaming, show progress
        if (status === 'streaming') {
            // If content is empty, show thinking
            if (!content.trim()) {
                return {
                    content: getRandomMessage(THINKING_MESSAGES),
                    displayType: 'thinking'
                };
            } else {
                return {
                    content: getRandomMessage(STREAMING_MESSAGES),
                    displayType: 'progress'
                };
            }
        }

        // If completed, show the actual content (cleaned up)
        if (status === 'completed') {
            return {
                content: cleanupAssistantContent(content),
                displayType: 'message'
            };
        }

        // Default: show cleaned content
        return {
            content: cleanupAssistantContent(content),
            displayType: 'message'
        };
    }

    // Fallback: return content as-is
    return {
        content,
        displayType: 'message'
    };
}

/**
 * Get a progress message for a specific tool
 */
function getToolProgressMessage(toolName?: string): string {
    if (!toolName) {
        return getRandomMessage(GENERIC_TOOL_MESSAGES);
    }

    // Map tool names to message categories
    const toolCategory = getToolCategory(toolName);
    const messages = TOOL_MESSAGES[toolCategory] || GENERIC_TOOL_MESSAGES;

    return getRandomMessage(messages);
}

/**
 * Categorize tool names to message types
 */
function getToolCategory(toolName: string): keyof typeof TOOL_MESSAGES {
    const name = toolName.toLowerCase();

    if (name.includes('brainstorm') && name.includes('edit')) {
        return 'brainstorm_edit';
    } else if (name.includes('brainstorm')) {
        return 'brainstorm_generation';
    } else if (name.includes('outline')) {
        return 'outline_generation';
    } else if (name.includes('chronicles') || name.includes('timeline')) {
        return 'chronicles_generation';
    } else if (name.includes('episode') && name.includes('planning')) {
        return 'episode_planning';
    } else if (name.includes('episode')) {
        return 'episode_generation';
    }

    // Return a default category
    return 'brainstorm_generation';
}

/**
 * Clean up assistant content to be more user-friendly
 */
function cleanupAssistantContent(content: string): string {
    if (!content) return '';

    // Remove technical markers, debugging info, etc.
    let cleaned = content
        // Remove common technical prefixes
        .replace(/^\[.*?\]\s*/gm, '')
        // Remove debugging markers
        .replace(/DEBUG:|ERROR:|INFO:/gi, '')
        // Remove excessive whitespace
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();

    // If content is too technical or empty, provide a friendly fallback
    if (!cleaned || cleaned.length < 10) {
        return "✨ 已为您完成处理！";
    }

    return cleaned;
}

/**
 * Get a random message from an array
 */
function getRandomMessage(messages: string[]): string {
    return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Update display message content during streaming
 */
export function updateStreamingDisplayMessage(
    currentContent: string,
    newContent: string,
    status: 'streaming' | 'completed' | 'failed',
    options: MessageOptions = {}
): DisplayMessage {
    const { toolName } = options;

    if (status === 'failed') {
        return {
            content: getRandomMessage(ERROR_MESSAGES),
            displayType: 'message'
        };
    }

    if (status === 'completed') {
        // If we have actual content, show it cleaned up
        if (newContent && newContent.trim()) {
            return {
                content: cleanupAssistantContent(newContent),
                displayType: 'message'
            };
        } else {
            return {
                content: getRandomMessage(COMPLETION_MESSAGES),
                displayType: 'message'
            };
        }
    }

    // Still streaming
    if (toolName) {
        return {
            content: getToolProgressMessage(toolName),
            displayType: 'progress'
        };
    }

    // If we have some content, show streaming message
    if (newContent && newContent.trim()) {
        return {
            content: getRandomMessage(STREAMING_MESSAGES),
            displayType: 'progress'
        };
    }

    // No content yet, show thinking
    return {
        content: getRandomMessage(THINKING_MESSAGES),
        displayType: 'thinking'
    };
}