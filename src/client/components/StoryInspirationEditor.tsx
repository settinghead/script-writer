import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Input, Typography, Spin } from 'antd';

const { TextArea } = Input;
const { Text } = Typography;

interface StoryInspirationEditorProps {
    currentArtifactId?: string; // Current artifact being displayed/edited
    onArtifactChange?: (artifactId: string | null) => void; // Called when artifact ID changes (null when no artifact)
    onValueChange?: (value: string) => void; // Called when text value changes
    externalValue?: string; // For syncing with parent component state (e.g., brainstorm selection)
    readOnly?: boolean;
    placeholder?: string;
}

const StoryInspirationEditor: React.FC<StoryInspirationEditorProps> = ({
    currentArtifactId,
    onArtifactChange,
    onValueChange,
    externalValue,
    readOnly = false,
    placeholder = "请描述您的故事灵感..."
}) => {
    const [value, setValue] = useState<string>('');
    const [artifactId, setArtifactId] = useState<string | null>(currentArtifactId || null);
    const [artifactType, setArtifactType] = useState<'brainstorm_idea' | 'user_input' | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [hasLoaded, setHasLoaded] = useState<boolean>(false);

    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const originalBrainstormTextRef = useRef<string>('');

    // Load artifact content when artifact ID changes
    const loadArtifactContent = useCallback(async (id: string) => {
        if (!id) return;

        setIsLoading(true);
        try {
            const response = await fetch(`/api/artifacts/${id}`);
            if (response.ok) {
                const artifact = await response.json();
                const text = artifact.data.text || artifact.data.idea_text || '';

                setValue(text);
                setArtifactType(artifact.type);

                // Store original brainstorm text if this is a brainstorm_idea
                if (artifact.type === 'brainstorm_idea') {
                    originalBrainstormTextRef.current = text;
                }

                // Notify parent of value change
                if (onValueChange) {
                    onValueChange(text);
                }

                // Notify parent of artifact ID (in case it's different from what was passed)
                if (onArtifactChange && id !== artifactId) {
                    onArtifactChange(id);
                }
            } else {
                console.error('Failed to load artifact:', response.statusText);
            }
        } catch (error) {
            console.error('Error loading artifact:', error);
        } finally {
            setIsLoading(false);
            setHasLoaded(true);
        }
    }, [onValueChange, onArtifactChange, artifactId]);

    // Load content when artifact ID changes or on initial mount
    useEffect(() => {
        if (currentArtifactId && currentArtifactId !== artifactId) {
            setArtifactId(currentArtifactId);
            setHasLoaded(false);
            loadArtifactContent(currentArtifactId);
        }
    }, [currentArtifactId, artifactId, loadArtifactContent]);

    // Initial load effect for when component mounts with an artifact ID
    useEffect(() => {
        if (currentArtifactId && !hasLoaded && !isLoading) {
            setArtifactId(currentArtifactId);
            loadArtifactContent(currentArtifactId);
        }
    }, [currentArtifactId, hasLoaded, isLoading, loadArtifactContent]);

    // Sync with external value changes (e.g., from brainstorming selection)
    useEffect(() => {
        if (externalValue !== undefined && externalValue !== value) {
            setValue(externalValue);

            // If we're setting an external value and don't have an artifact yet,
            // clear the artifact ID since this is new manual input
            if (!currentArtifactId) {
                setArtifactId(null);
                setArtifactType(null);

                // Notify parent that we don't have an artifact
                if (onArtifactChange) {
                    onArtifactChange(null);
                }
            }

            // Notify parent of value change
            if (onValueChange) {
                onValueChange(externalValue);
            }
        }
    }, [externalValue, value, currentArtifactId, onValueChange, onArtifactChange]);

    // Debounced save function
    const debouncedSave = useCallback(async (text: string) => {
        if (!text.trim() || readOnly) return;

        // Clear existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Set new timeout
        saveTimeoutRef.current = setTimeout(async () => {
            setIsSaving(true);
            try {
                let newArtifactId = artifactId;

                if (artifactType === 'brainstorm_idea' && text !== originalBrainstormTextRef.current) {
                    // User modified brainstorm idea - create new user_input artifact
                    const response = await fetch('/api/artifacts/user-input', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text: text,
                            sourceArtifactId: artifactId
                        })
                    });

                    if (response.ok) {
                        const newArtifact = await response.json();
                        newArtifactId = newArtifact.id;
                        setArtifactId(newArtifactId);
                        setArtifactType('user_input');

                        // Notify parent of artifact change
                        if (onArtifactChange) {
                            onArtifactChange(newArtifactId);
                        }
                    }
                } else if (artifactType === 'user_input' && artifactId) {
                    // Update existing user_input artifact
                    const response = await fetch(`/api/artifacts/${artifactId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text })
                    });

                    if (response.ok) {
                        const updatedArtifact = await response.json();
                        newArtifactId = updatedArtifact.id;
                        setArtifactId(newArtifactId);

                        // Notify parent of artifact change (ID might change due to versioning)
                        if (onArtifactChange && newArtifactId !== artifactId) {
                            onArtifactChange(newArtifactId);
                        }
                    }
                } else if (!artifactId) {
                    // Create new user_input artifact for manual input
                    const response = await fetch('/api/artifacts/user-input', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text: text,
                            sourceArtifactId: null
                        })
                    });

                    if (response.ok) {
                        const newArtifact = await response.json();
                        newArtifactId = newArtifact.id;
                        setArtifactId(newArtifactId);
                        setArtifactType('user_input');

                        // Notify parent of artifact creation
                        if (onArtifactChange) {
                            onArtifactChange(newArtifactId);
                        }
                    }
                }
            } catch (error) {
                console.error('Error saving artifact:', error);
            } finally {
                setIsSaving(false);
            }
        }, 1000); // 1 second debounce
    }, [artifactId, artifactType, readOnly, onArtifactChange]);

    // Handle text changes
    const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setValue(newValue);

        // Notify parent of value change immediately
        if (onValueChange) {
            onValueChange(newValue);
        }

        // Trigger debounced save
        if (newValue.trim()) {
            debouncedSave(newValue);
        }
    }, [onValueChange, debouncedSave]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    // Determine if content has been modified from original brainstorm
    const isModified = artifactType === 'user_input' ||
        (artifactType === 'brainstorm_idea' && value !== originalBrainstormTextRef.current);

    return (
        <div style={{ marginBottom: '24px' }}>
            <Text strong style={{ display: 'block', marginBottom: '12px', fontSize: '16px' }}>
                故事灵感
            </Text>

            <div style={{ position: 'relative' }}>
                <TextArea
                    rows={8}
                    value={value}
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

                {(isLoading || isSaving) && (
                    <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}>
                        <Spin size="small" />
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                            {isLoading ? '加载中...' : '保存中...'}
                        </Text>
                    </div>
                )}
            </div>

            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                    {readOnly ? '故事灵感（只读）' : placeholder}
                </Text>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {artifactType && (
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                            {artifactType === 'brainstorm_idea' ? 'AI生成' : '用户输入'}
                        </Text>
                    )}

                    {!readOnly && isModified && (
                        <Text type="warning" style={{ fontSize: '12px' }}>
                            已修改
                        </Text>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StoryInspirationEditor; 