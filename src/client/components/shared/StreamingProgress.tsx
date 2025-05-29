import React from 'react';

interface StreamingProgressProps {
    isStreaming: boolean;
    isConnecting: boolean;
    onStop: () => void;
    itemCount?: number;
    itemLabel?: string; // "ideas" or "components"
}

export const StreamingProgress: React.FC<StreamingProgressProps> = ({
    isStreaming,
    isConnecting,
    onStop,
    itemCount = 0,
    itemLabel = 'items'
}) => {
    if (!isStreaming && !isConnecting) {
        return null;
    }

    return (
        <div className="streaming-progress bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <div className="text-blue-700">
                        {isConnecting ? (
                            <span>正在连接...</span>
                        ) : (
                            <span>正在生成 {itemLabel}... ({itemCount} 已完成)</span>
                        )}
                    </div>
                </div>

                <button
                    onClick={onStop}
                    className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                    disabled={isConnecting}
                >
                    停止生成
                </button>
            </div>
        </div>
    );
}; 