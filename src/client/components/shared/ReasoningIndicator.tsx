import React from 'react';
import { Brain, Lightbulb } from 'lucide-react';

interface ReasoningIndicatorProps {
    isVisible: boolean;
    phase?: 'brainstorming' | 'outline' | 'synopsis' | 'script';
    message?: string;
    className?: string;
}

const getPhaseMessage = (phase: 'brainstorming' | 'outline' | 'synopsis' | 'script'): string => {
    switch (phase) {
        case 'brainstorming':
            return 'Exploring creative possibilities...';
        case 'outline':
            return 'Structuring your story...';
        case 'synopsis':
            return 'Weaving narrative threads...';
        case 'script':
            return 'Bringing characters to life...';
        default:
            return 'Deep thinking in progress...';
    }
};

const getPhaseIcon = (phase?: string) => {
    switch (phase) {
        case 'brainstorming':
            return <Lightbulb className="w-5 h-5" />;
        case 'outline':
        case 'synopsis':
        case 'script':
            return <Brain className="w-5 h-5" />;
        default:
            return <Brain className="w-5 h-5" />;
    }
};

export const ReasoningIndicator: React.FC<ReasoningIndicatorProps> = ({
    isVisible,
    phase,
    message,
    className = ''
}) => {
    if (!isVisible) return null;

    const displayMessage = message || (phase ? getPhaseMessage(phase) : 'Deep thinking in progress...');
    const icon = getPhaseIcon(phase);

    return (
        <div className={`
            flex items-center gap-3 px-4 py-3 
            bg-gray-800/90 border border-gray-700/50 rounded-lg
            backdrop-blur-sm
            transition-all duration-300 ease-in-out
            ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
            ${className}
        `}>
            {/* Animated thinking icon */}
            <div className="relative">
                <div className="animate-pulse text-blue-400">
                    {icon}
                </div>
                {/* Pulsing ring effect */}
                <div className="absolute inset-0 rounded-full border-2 border-blue-400/30 animate-ping" />
            </div>

            {/* Message text */}
            <div className="flex-1">
                <span className="text-gray-200 text-sm font-medium">
                    {displayMessage}
                </span>
            </div>

            {/* Animated dots */}
            <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
        </div>
    );
};

export default ReasoningIndicator; 