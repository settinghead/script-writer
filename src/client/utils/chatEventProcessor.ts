import { ChatEvent, parseEventMessage } from '../../common/schemas/chatMessages';

export interface ProcessedChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    timestamp: string;
    isThinking: boolean;
    thinkingDuration?: number;
    showSpinner: boolean;
    events: ChatEvent[];
}

export function processChatMessage(
    messageId: string,
    role: 'user' | 'assistant' | 'tool',
    content: string,
    createdAt: string
): ProcessedChatMessage {
    // Parse events from content
    const events = parseEventMessage(content);

    if (events.length === 0) {
        // Fallback for non-event messages
        return {
            id: messageId,
            role,
            content,
            timestamp: createdAt,
            isThinking: false,
            showSpinner: false,
            events: []
        };
    }

    // Process events to determine current state
    const result = processEventHistory(events);

    return {
        id: messageId,
        role,
        content: result.displayContent,
        timestamp: result.timestamp,
        isThinking: result.isThinking,
        thinkingDuration: result.thinkingDuration,
        showSpinner: result.showSpinner,
        events
    };
}

interface EventProcessingResult {
    displayContent: string;
    timestamp: string;
    isThinking: boolean;
    thinkingDuration?: number;
    showSpinner: boolean;
}

function processEventHistory(events: ChatEvent[]): EventProcessingResult {
    if (events.length === 0) {
        return {
            displayContent: '',
            timestamp: new Date().toISOString(),
            isThinking: false,
            showSpinner: false
        };
    }

    // Get the latest timestamp
    const latestEvent = events[events.length - 1];
    const timestamp = latestEvent.timestamp;

    // Find thinking events
    const thinkingStart = events.find(e => e.type === 'agent_thinking_start');
    const thinkingEnd = events.find(e => e.type === 'agent_thinking_end');

    // Find response and error events
    const responses = events.filter(e => e.type === 'agent_response');
    const errors = events.filter(e => e.type === 'agent_error');
    const userMessages = events.filter(e => e.type === 'user_message');
    const toolCalls = events.filter(e => e.type === 'agent_tool_call');

    // Determine current state
    let isThinking = false;
    let showSpinner = false;
    let thinkingDuration: number | undefined;
    let displayContent = '';

    if (thinkingStart && !thinkingEnd) {
        // Currently thinking
        isThinking = true;
        showSpinner = true;
        displayContent = `正在${thinkingStart.task}...`;
    } else if (thinkingStart && thinkingEnd) {
        // Finished thinking
        isThinking = false;
        showSpinner = false;
        thinkingDuration = thinkingEnd.duration_ms;

        // Show thinking duration
        const durationText = formatDuration(thinkingEnd.duration_ms);
        displayContent = `思考了 ${durationText}`;

        // Add responses if any
        if (responses.length > 0) {
            displayContent += '\n\n' + responses.map(r => r.content).join('\n\n');
        }
    } else if (userMessages.length > 0) {
        // User message
        displayContent = userMessages[userMessages.length - 1].content;
    }

    // Handle errors
    if (errors.length > 0) {
        isThinking = false;
        showSpinner = false;
        displayContent = errors[errors.length - 1].message;
    }

    // Handle tool calls
    if (toolCalls.length > 0) {
        const toolCallsText = toolCalls.map(tc => `🔧 ${tc.description}`).join('\n');
        if (displayContent) {
            displayContent += '\n\n' + toolCallsText;
        } else {
            displayContent = toolCallsText;
        }
    }

    return {
        displayContent,
        timestamp,
        isThinking,
        thinkingDuration,
        showSpinner
    };
}

function formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);

    if (seconds < 60) {
        return `${seconds}秒`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (remainingSeconds === 0) {
        return `${minutes}分钟`;
    }

    return `${minutes}分${remainingSeconds}秒`;
}

// Helper function to check if a message is currently thinking
export function isMessageThinking(content: string): boolean {
    const events = parseEventMessage(content);
    const thinkingStart = events.find(e => e.type === 'agent_thinking_start');
    const thinkingEnd = events.find(e => e.type === 'agent_thinking_end');

    return !!(thinkingStart && !thinkingEnd);
}

// Helper function to get thinking duration if completed
export function getThinkingDuration(content: string): number | null {
    const events = parseEventMessage(content);
    const thinkingEnd = events.find(e => e.type === 'agent_thinking_end');

    return thinkingEnd ? thinkingEnd.duration_ms : null;
} 