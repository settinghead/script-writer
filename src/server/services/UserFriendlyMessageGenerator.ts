/**
 * UserFriendlyMessageGenerator - Converts raw technical messages into fun, vague, user-friendly Chinese messages
 * for IP protection and better user experience
 */

import { match, P } from 'ts-pattern';

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

    return match({ role, status, hasError: !!(status === 'failed' || errorMessage), toolName, hasContent: !!content.trim() })
        // Handle errors first - highest priority
        .with({ hasError: true }, () => ({
            content: getRandomMessage(ERROR_MESSAGES),
            displayType: 'message' as const
        }))

        // User messages: show as-is (users see what they typed)
        .with({ role: 'user' }, () => ({
            content,
            displayType: 'message' as const
        }))

        // System messages: hide completely (return empty - should not be displayed)
        .with({ role: 'system' }, () => ({
            content: '',
            displayType: 'message' as const
        }))

        // Tool messages with streaming status
        .with({ role: 'tool', status: 'streaming' }, ({ toolName }) => ({
            content: getToolProgressMessage(toolName),
            displayType: 'progress' as const
        }))

        // Tool messages with completed status
        .with({ role: 'tool', status: 'completed' }, () => ({
            content: getRandomMessage(COMPLETION_MESSAGES),
            displayType: 'message' as const
        }))

        // Tool messages (default case or when toolName is present)
        .with(P.union({ role: 'tool' }, { toolName: P.string }), ({ toolName }) => ({
            content: getToolProgressMessage(toolName),
            displayType: 'progress' as const
        }))

        // Assistant streaming with empty content - show thinking
        .with({ role: 'assistant', status: 'streaming', hasContent: false }, () => ({
            content: getRandomMessage(THINKING_MESSAGES),
            displayType: 'thinking' as const
        }))

        // Assistant streaming with content - show progress
        .with({ role: 'assistant', status: 'streaming', hasContent: true }, () => ({
            content: getRandomMessage(STREAMING_MESSAGES),
            displayType: 'progress' as const
        }))

        // Assistant completed - show cleaned content
        .with({ role: 'assistant', status: 'completed' }, () => ({
            content: cleanupAssistantContent(content),
            displayType: 'message' as const
        }))

        // Assistant default - show cleaned content
        .with({ role: 'assistant' }, () => ({
            content: cleanupAssistantContent(content),
            displayType: 'message' as const
        }))

        // Fallback: return content as-is
        .otherwise(() => ({
            content,
            displayType: 'message' as const
        }));
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

    return match(name)
        .when((n) => n.includes('brainstorm') && n.includes('edit'), () => 'brainstorm_edit' as const)
        .when((n) => n.includes('brainstorm'), () => 'brainstorm_generation' as const)
        .when((n) => n.includes('outline'), () => 'outline_generation' as const)
        .when((n) => n.includes('chronicles') || n.includes('timeline'), () => 'chronicles_generation' as const)
        .when((n) => n.includes('episode') && n.includes('planning'), () => 'episode_planning' as const)
        .when((n) => n.includes('episode'), () => 'episode_generation' as const)
        .otherwise(() => 'brainstorm_generation' as const);
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
    const hasNewContent = !!(newContent && newContent.trim());

    return match({ status, toolName, hasNewContent })
        // Handle failures first
        .with({ status: 'failed' }, () => ({
            content: getRandomMessage(ERROR_MESSAGES),
            displayType: 'message' as const
        }))

        // Completed with actual content - show cleaned up
        .with({ status: 'completed', hasNewContent: true }, () => ({
            content: cleanupAssistantContent(newContent),
            displayType: 'message' as const
        }))

        // Completed without content - show completion message
        .with({ status: 'completed', hasNewContent: false }, () => ({
            content: getRandomMessage(COMPLETION_MESSAGES),
            displayType: 'message' as const
        }))

        // Still streaming with tool name
        .with({ status: 'streaming', toolName: P.string }, ({ toolName }) => ({
            content: getToolProgressMessage(toolName),
            displayType: 'progress' as const
        }))

        // Still streaming with new content but no tool name
        .with({ status: 'streaming', hasNewContent: true }, () => ({
            content: getRandomMessage(STREAMING_MESSAGES),
            displayType: 'progress' as const
        }))

        // Still streaming with no content - show thinking
        .with({ status: 'streaming', hasNewContent: false }, () => ({
            content: getRandomMessage(THINKING_MESSAGES),
            displayType: 'thinking' as const
        }))

        // Fallback - shouldn't happen but provide safe default
        .otherwise(() => ({
            content: getRandomMessage(THINKING_MESSAGES),
            displayType: 'thinking' as const
        }));
}