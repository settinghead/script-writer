import React, { useMemo, useState, useEffect } from 'react';
import { Card, Button, Typography, message, Tag, Space, InputNumber, Input } from 'antd';
import { BulbOutlined, RightOutlined } from '@ant-design/icons';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useArtifactEditor } from '../hooks/useArtifactEditor';
import GenreSelectionPopup, { MAX_GENRE_SELECTIONS } from './GenreSelectionPopup';
import PlatformSelection from './PlatformSelection';

const { Text, Title } = Typography;

interface BrainstormInputEditorProps {
    projectId: string;
}

export const BrainstormInputEditor: React.FC<BrainstormInputEditorProps> = ({
    projectId
}) => {
    const projectData = useProjectData();
    const [genrePopupVisible, setGenrePopupVisible] = useState(false);

    // Local state for optimistic updates
    interface BrainstormData {
        platform: string;
        genre: string;
        genrePaths: string[][];
        other_requirements: string;
        numberOfIdeas: number;
    }

    const [localData, setLocalData] = useState<BrainstormData | null>(null);

    // Find the brainstorm input artifact
    const brainstormInputArtifact = useMemo(() => {
        if (!projectData.artifacts || projectData.artifacts.length === 0) {
            return null;
        }

        // Look for brainstorm_tool_input_schema artifacts
        return projectData.artifacts.find(artifact =>
            artifact.type === 'brainstorm_tool_input_schema'
        );
    }, [projectData.artifacts]);

    // Check if this artifact is a leaf node (no transforms use it as input)
    const isLeafNode = useMemo(() => {
        if (!brainstormInputArtifact) return false;

        // Check if any transforms use this artifact as input
        const hasDescendants = projectData.transformInputs.some(input =>
            input.artifact_id === brainstormInputArtifact.id
        );

        return !hasDescendants;
    }, [brainstormInputArtifact, projectData.transformInputs]);

    // Use the artifact editor hook
    const { handleFieldChange, isPending } = useArtifactEditor({
        artifactId: brainstormInputArtifact?.id || '',
        onSaveSuccess: () => {
            // Optional: show success message
        }
    });

    // Parse the current data from the artifact (only when artifact changes, not on every render)
    const serverData = useMemo(() => {
        if (!brainstormInputArtifact?.data) {
            return null;
        }

        try {
            let parsed;
            if (typeof brainstormInputArtifact.data === 'string') {
                parsed = JSON.parse(brainstormInputArtifact.data);
            } else {
                parsed = brainstormInputArtifact.data;
            }

            return parsed;
        } catch (error) {
            console.error('Error parsing artifact data:', error);
            return null;
        }
    }, [brainstormInputArtifact?.data]);

    // Initialize local data when server data changes
    useEffect(() => {
        if (serverData && !localData) {
            setLocalData({ ...serverData });
        }
    }, [serverData, localData]);

    // Use local data for UI, fallback to server data
    const currentData = localData || serverData;

    // Handle platform change
    const handlePlatformChange = (value: string) => {
        // Optimistic update
        setLocalData(prev => prev ? { ...prev, platform: value } : null);
        // Persist to server
        handleFieldChange('platform', value);
    };

    // Handle genre selection
    const handleGenreSelectionConfirm = (selection: { paths: string[][] }) => {
        const genreText = selection.paths.map(path => path.join(' > ')).join(', ');
        // Optimistic update
        setLocalData(prev => prev ? {
            ...prev,
            genrePaths: selection.paths,
            genre: genreText
        } : null);
        // Persist to server
        handleFieldChange('genrePaths', selection.paths);
        handleFieldChange('genre', genreText);
        setGenrePopupVisible(false);
    };

    // Handle requirements change
    const handleRequirementsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        // Optimistic update
        setLocalData(prev => prev ? { ...prev, other_requirements: value } : null);
        // Persist to server
        handleFieldChange('other_requirements', value);
    };

    // Handle number of ideas change
    const handleNumberOfIdeasChange = (value: number | null) => {
        const finalValue = value || 3;
        // Optimistic update
        setLocalData(prev => prev ? { ...prev, numberOfIdeas: finalValue } : null);
        // Persist to server
        handleFieldChange('numberOfIdeas', finalValue);
    };

    const handleStartBrainstorm = async () => {
        try {
            if (!currentData?.genre || !currentData?.genre.trim()) {
                message.warning('请先填写故事类型');
                return;
            }

            if (!currentData?.platform || !currentData?.platform.trim()) {
                message.warning('请先填写目标平台');
                return;
            }

            // Trigger brainstorm agent
            const response = await fetch(`/api/projects/${projectId}/agent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer debug-auth-token-script-writer-dev`
                },
                body: JSON.stringify({
                    userRequest: `基于artifact ID ${brainstormInputArtifact?.id} 的头脑风暴参数，生成${currentData.numberOfIdeas || 3}个创意想法。平台：${currentData.platform}，类型：${currentData.genre}${currentData.other_requirements ? `，其他要求：${currentData.other_requirements}` : ''}`,
                    projectId: projectId
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to start brainstorm');
            }

            message.success('头脑风暴已开始！请查看聊天面板了解进度。');
        } catch (error) {
            console.error('Error starting brainstorm:', error);
            message.error(`启动头脑风暴失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
    };

    // Check if genre selection is complete
    const isGenreSelectionComplete = () => {
        return currentData?.genrePaths && currentData.genrePaths.length > 0 &&
            currentData.genrePaths.every((path: string[]) => path.length > 0);
    };

    // Build genre display elements
    const buildGenreDisplayElements = (): React.ReactElement[] => {
        if (!currentData?.genrePaths) return [];

        return currentData.genrePaths.map((path: string[], index: number) => {
            const genreText = path.join(' > ');
            return (
                <Tag key={index} color="blue" style={{ marginBottom: 4 }}>
                    {genreText}
                </Tag>
            );
        });
    };

    // Don't render if no artifact exists or if it's not a leaf node
    if (!brainstormInputArtifact || !isLeafNode) {
        return null;
    }

    // Show loading state while data is being fetched
    if (!currentData) {
        return (
            <Card
                style={{
                    maxWidth: '800px',
                    margin: '0 auto 24px auto',
                    background: '#1a1a1a',
                    borderColor: '#1890ff',
                    borderWidth: '2px'
                }}
                headStyle={{
                    background: '#1a1a1a',
                    borderBottom: '1px solid #333',
                    color: '#fff'
                }}
                bodyStyle={{ background: '#1a1a1a' }}
            >
                <div style={{ padding: '24px', textAlign: 'center' }}>
                    <Title level={4} style={{ color: '#fff' }}>
                        <BulbOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                        配置头脑风暴参数
                    </Title>
                    <Text style={{ color: '#666' }}>正在加载...</Text>
                </div>
            </Card>
        );
    }

    return (
        <Card
            style={{
                maxWidth: '800px',
                margin: '0 auto 24px auto',
                background: '#1a1a1a',
                borderColor: '#1890ff',
                borderWidth: '2px'
            }}
            headStyle={{
                background: '#1a1a1a',
                borderBottom: '1px solid #333',
                color: '#fff'
            }}
            bodyStyle={{ background: '#1a1a1a' }}
        >
            <div style={{ padding: '24px' }}>
                <Title level={4} style={{ marginBottom: '24px', color: '#fff', textAlign: 'center' }}>
                    <BulbOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                    配置头脑风暴参数
                </Title>

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    maxWidth: '600px',
                    margin: '0 auto'
                }}>
                    {/* Platform Selection */}
                    <div>
                        <PlatformSelection
                            selectedPlatform={currentData.platform || ''}
                            onPlatformChange={handlePlatformChange}
                        />
                    </div>

                    {/* Genre Selection */}
                    <div>
                        <Text style={{ color: '#d9d9d9', marginBottom: '8px', display: 'block', fontWeight: 500 }}>
                            故事类型
                        </Text>

                        <div
                            onClick={() => setGenrePopupVisible(true)}
                            style={{
                                border: '1px solid #434343',
                                borderRadius: '6px',
                                padding: '8px 12px',
                                minHeight: '32px',
                                cursor: 'pointer',
                                background: '#141414',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'all 0.3s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#1890ff'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#434343'}
                        >
                            {currentData.genrePaths && currentData.genrePaths.length > 0 ? (
                                <div style={{ color: '#d9d9d9', cursor: 'pointer', flex: 1 }}>
                                    <Space wrap>
                                        {buildGenreDisplayElements()}
                                    </Space>
                                </div>
                            ) : (
                                <span style={{ color: '#666', cursor: 'pointer' }}>
                                    点击选择故事类型 (可多选, 最多{MAX_GENRE_SELECTIONS}个)
                                </span>
                            )}
                            <RightOutlined style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }} />
                        </div>
                    </div>

                    <GenreSelectionPopup
                        visible={genrePopupVisible}
                        onClose={() => setGenrePopupVisible(false)}
                        onSelect={handleGenreSelectionConfirm}
                        currentSelectionPaths={currentData.genrePaths || []}
                    />

                    {/* Number of Ideas Selection */}
                    <div>
                        <Text style={{ color: '#d9d9d9', marginBottom: '8px', display: 'block', fontWeight: 500 }}>
                            生成创意数量
                        </Text>
                        <InputNumber
                            min={1}
                            max={4}
                            value={currentData.numberOfIdeas || 3}
                            onChange={handleNumberOfIdeasChange}
                            style={{
                                width: '100%',
                                background: '#141414',
                                borderColor: '#434343',
                                color: '#d9d9d9'
                            }}
                            size="large"
                            placeholder="选择要生成的创意数量 (1-4)"
                        />
                        <Text style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            建议生成2-3个创意进行对比选择
                        </Text>
                    </div>

                    {/* Requirements Input */}
                    <div>
                        <Text style={{ color: '#d9d9d9', marginBottom: '8px', display: 'block', fontWeight: 500 }}>
                            其他要求 (可选)
                        </Text>
                        <Input.TextArea
                            value={currentData.other_requirements || ''}
                            onChange={handleRequirementsChange}
                            placeholder="请输入故事的具体要求，如角色设定、情节偏好等..."
                            rows={3}
                            style={{
                                background: '#141414',
                                border: '1px solid #434343',
                                color: '#d9d9d9'
                            }}
                        />
                    </div>

                    {/* Generate Button */}
                    <div style={{ textAlign: 'center', marginTop: '24px' }}>
                        <Button
                            type="primary"
                            size="large"
                            icon={<BulbOutlined />}
                            onClick={handleStartBrainstorm}
                            disabled={!isGenreSelectionComplete()}
                            style={{
                                width: '200px',
                                height: '48px',
                                fontSize: '16px',
                                borderRadius: '8px',
                                background: isGenreSelectionComplete() ? 'linear-gradient(135deg, #1890ff, #40a9ff)' : '#434343',
                                border: 'none'
                            }}
                        >
                            开始头脑风暴 ({currentData.numberOfIdeas || 3}个创意)
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
}; 