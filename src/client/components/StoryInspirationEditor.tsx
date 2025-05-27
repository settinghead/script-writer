import React, { useState, useEffect, useCallback } from 'react';
import { Input, Typography } from 'antd';

const { TextArea } = Input;
const { Text } = Typography;

interface StoryInspirationEditorProps {
    ideationSessionId: string;
    onInputChange?: (value: string, hasChanged: boolean) => void;
    readOnly?: boolean;
    placeholder?: string;
    initialValue?: string;
    externalValue?: string; // For syncing with parent component state
}

interface UserInputArtifact {
    text: string;
    source: 'manual' | 'selected_idea';
    selected_idea_id?: string;
}

const StoryInspirationEditor: React.FC<StoryInspirationEditorProps> = ({
    ideationSessionId,
    onInputChange,
    readOnly = false,
    placeholder = "输入完整的故事梗概，包含起承转合结构",
    initialValue = "",
    externalValue
}) => {
    const [currentValue, setCurrentValue] = useState<string>(initialValue);
    const [originalValue, setOriginalValue] = useState<string>(initialValue);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [hasLoaded, setHasLoaded] = useState<boolean>(false);

    // Load existing user input for this ideation session
    const loadExistingUserInput = useCallback(async () => {
        if (!ideationSessionId || hasLoaded) return;

        setIsLoading(true);
        try {
            // Get ideation run data which includes the current user input
            const response = await fetch(`/api/ideations/${ideationSessionId}`);
            if (response.ok) {
                const ideationData = await response.json();
                const existingText = ideationData.userInput || "";
                setCurrentValue(existingText);
                setOriginalValue(existingText);
                setHasLoaded(true);

                // Notify parent of initial value
                if (onInputChange) {
                    onInputChange(existingText, false);
                }
            }
        } catch (error) {
            console.error('Error loading existing user input:', error);
        } finally {
            setIsLoading(false);
        }
    }, [ideationSessionId, hasLoaded, onInputChange]);

    // Load existing input on mount
    useEffect(() => {
        if (ideationSessionId && !hasLoaded && !initialValue) {
            loadExistingUserInput();
        } else if (initialValue) {
            setCurrentValue(initialValue);
            setOriginalValue(initialValue);
            setHasLoaded(true);
        }
    }, [ideationSessionId, loadExistingUserInput, initialValue, hasLoaded]);

    // Sync with external value changes (e.g., from brainstorming selection)
    useEffect(() => {
        if (externalValue !== undefined && externalValue !== currentValue) {
            setCurrentValue(externalValue);
            // Don't update originalValue here - we want to track if it's changed from the loaded/initial state

            // Notify parent of the sync
            if (onInputChange) {
                const hasChanged = externalValue.trim() !== originalValue.trim();
                onInputChange(externalValue, hasChanged);
            }
        }
    }, [externalValue, currentValue, originalValue, onInputChange]);

    // Handle text changes
    const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setCurrentValue(newValue);

        // Check if content has actually changed from original
        const hasChanged = newValue.trim() !== originalValue.trim();

        // Notify parent component
        if (onInputChange) {
            onInputChange(newValue, hasChanged);
        }
    }, [originalValue, onInputChange]);

    // Create human transform when user makes significant changes
    const createHumanTransform = useCallback(async (newText: string) => {
        if (!ideationSessionId || newText.trim() === originalValue.trim()) {
            return null; // No change, no transform needed
        }

        try {
            // This would be handled by the parent component when they call the outline generation
            // For now, we'll just update our original value to prevent duplicate transforms
            setOriginalValue(newText);
            return { success: true };
        } catch (error) {
            console.error('Error creating human transform:', error);
            return null;
        }
    }, [ideationSessionId, originalValue]);

    // Get current text value (for parent components)
    const getCurrentValue = useCallback(() => {
        return currentValue;
    }, [currentValue]);

    // Check if content has changed
    const hasChanged = useCallback(() => {
        return currentValue.trim() !== originalValue.trim();
    }, [currentValue, originalValue]);

    // Expose methods to parent via ref (if needed)
    React.useImperativeHandle(React.useRef(), () => ({
        getCurrentValue,
        hasChanged,
        createHumanTransform
    }));

    return (
        <div style={{ marginBottom: '24px' }}>
            <Text strong style={{ display: 'block', marginBottom: '12px', fontSize: '16px' }}>
                故事灵感
            </Text>
            <TextArea
                rows={8}
                value={currentValue}
                onChange={handleTextChange}
                placeholder={placeholder}
                disabled={readOnly || isLoading}
                style={{
                    fontSize: '14px',
                    lineHeight: '1.6',
                    background: readOnly ? '#1a1a1a' : '#141414',
                    border: '1px solid #434343',
                    borderRadius: '8px',
                    opacity: isLoading ? 0.6 : 1
                }}
            />
            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                    {readOnly
                        ? '故事灵感（只读）'
                        : isLoading
                            ? '加载中...'
                            : placeholder
                    }
                </Text>
                {!readOnly && hasChanged() && (
                    <Text type="warning" style={{ fontSize: '12px' }}>
                        已修改
                    </Text>
                )}
            </div>
        </div>
    );
};

export default StoryInspirationEditor; 