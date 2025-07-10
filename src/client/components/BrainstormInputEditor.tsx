import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, Button, Typography, message, Tag, Space, InputNumber, Input } from 'antd';
import { BulbOutlined, RightOutlined } from '@ant-design/icons';
import { useProjectData } from '../contexts/ProjectDataContext';
import { YJSArtifactProvider, useYJSArtifactContext } from '../transform-artifact-framework/contexts/YJSArtifactContext';
import { YJSTextField, YJSTextAreaField } from '../transform-artifact-framework/components/YJSField';
import GenreSelectionPopup, { MAX_GENRE_SELECTIONS } from './GenreSelectionPopup';
import PlatformSelection from './PlatformSelection';

const { Text, Title } = Typography;

interface BrainstormInputEditorProps {
    projectId: string;
}

// Separate component that uses YJS context
const BrainstormInputForm: React.FC = () => {
    const { getField, setField, isLoading, artifact } = useYJSArtifactContext();
    const [genrePopupVisible, setGenrePopupVisible] = useState(false);

    // Get current values from YJS context
    const platform = getField('platform') || '';
    const genre = getField('genre') || '';
    const genrePaths = getField('genrePaths') || [];
    const other_requirements = getField('other_requirements') || '';
    const numberOfIdeas = getField('numberOfIdeas') || 3;

    // Handle platform change
    const handlePlatformChange = (value: string) => {
        setField('platform', value);
    };

    // Handle genre selection
    const handleGenreSelectionConfirm = (selection: { paths: string[][] }) => {
        const genreText = selection.paths.map(path => path.join(' > ')).join(', ');

        // Update both fields together
        setField('genrePaths', selection.paths);
        setField('genre', genreText);

        setGenrePopupVisible(false);
    };

    // Handle number of ideas change
    const handleNumberOfIdeasChange = (value: number | null) => {
        const finalValue = value || 3;
        setField('numberOfIdeas', finalValue);
    };

    // Check if genre selection is complete
    const isGenreSelectionComplete = () => {
        return genrePaths && genrePaths.length > 0 &&
            genrePaths.every((path: string[]) => path.length > 0);
    };

    // Build genre display elements
    const buildGenreDisplayElements = (): React.ReactElement[] => {
        if (!genrePaths || !Array.isArray(genrePaths)) return [];

        return genrePaths.map((path: string[], index: number) => {
            const genreText = path.join(' > ');
            return (
                <Tag key={index} color="blue" style={{ marginBottom: 4 }}>
                    {genreText}
                </Tag>
            );
        });
    };

    const handleStartBrainstorm = async () => {
        try {
            if (!genre || !genre.trim()) {
                message.warning('请先填写故事类型');
                return;
            }

            if (!platform || !platform.trim()) {
                message.warning('请先填写目标平台');
                return;
            }

            // Get project ID from artifact
            const projectId = artifact?.project_id;
            if (!projectId) {
                message.error('无法获取项目ID');
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
                    userRequest: `基于artifact ID ${artifact?.id} 的头脑风暴参数，生成${numberOfIdeas || 3}个创意想法。平台：${platform}，类型：${genre}${other_requirements ? `，其他要求：${other_requirements}` : ''}`,
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

    return (
        <div style={{ padding: '24px' }}>
            <Title level={4} style={{ marginBottom: '24px', color: '#fff', textAlign: 'center' }}>
                <BulbOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                头脑风暴要求
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
                        selectedPlatform={platform}
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
                        {genrePaths && genrePaths.length > 0 ? (
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
                    currentSelectionPaths={genrePaths || []}
                />

                {/* Number of Ideas Selection */}
                <div>
                    <Text style={{ color: '#d9d9d9', marginBottom: '8px', display: 'block', fontWeight: 500 }}>
                        生成创意数量
                    </Text>
                    <InputNumber
                        min={1}
                        max={4}
                        value={numberOfIdeas}
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

                {/* Requirements Input - Using YJS TextArea */}
                <div>
                    <Text style={{ color: '#d9d9d9', marginBottom: '8px', display: 'block', fontWeight: 500 }}>
                        其他要求 (可选)
                    </Text>
                    <YJSTextAreaField
                        path="other_requirements"
                        placeholder="请输入故事的具体要求，如角色设定、情节偏好等..."
                        rows={3}
                    />
                </div>

                {/* Action Buttons */}
                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                    <Button
                        type="primary"
                        size="large"
                        icon={<BulbOutlined />}
                        onClick={handleStartBrainstorm}
                        disabled={isLoading || !platform || !genre}
                        style={{
                            background: isGenreSelectionComplete() && platform ? '#1890ff' : '#434343',
                            borderColor: isGenreSelectionComplete() && platform ? '#1890ff' : '#434343',
                            height: '44px',
                            fontSize: '16px',
                            fontWeight: 500,
                            minWidth: '200px'
                        }}
                    >
                        开始头脑风暴
                    </Button>
                </div>
            </div>
        </div>
    );
};

// Compact view component for when ideas have been generated
const CompactBrainstormView: React.FC<{ currentData: any }> = ({ currentData }) => {
    return (
        <Card
            size="small"
            style={{
                maxWidth: '600px',
                margin: '0 auto 16px auto',
                background: '#1a1a1a',
                borderColor: '#434343',
                borderWidth: '1px'
            }}
            styles={{
                header: {
                    background: '#1a1a1a',
                    borderBottom: '1px solid #333',
                    color: '#fff',
                    minHeight: 'auto',
                    padding: '8px 16px'
                },
                body: { background: '#1a1a1a', padding: '12px 16px' }
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BulbOutlined style={{ color: '#52c41a', fontSize: '16px' }} />
                    <Text style={{ color: '#fff', fontWeight: 500 }}>头脑风暴要求</Text>
                </div>
            </div>
            <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <Text style={{ color: '#999', fontSize: '12px' }}>平台:</Text>
                <Tag color="blue" style={{ fontSize: '11px', padding: '0 6px', lineHeight: '18px' }}>{currentData.platform}</Tag>
                <Text style={{ color: '#999', fontSize: '12px' }}>类型:</Text>
                {currentData.genrePaths && currentData.genrePaths.length > 0 ? (
                    currentData.genrePaths.slice(0, 2).map((path: string[], index: number) => (
                        <Tag key={index} color="green" style={{ fontSize: '11px', padding: '0 6px', lineHeight: '18px' }}>
                            {path.join(' > ')}
                        </Tag>
                    ))
                ) : (
                    <Tag color="green" style={{ fontSize: '11px', padding: '0 6px', lineHeight: '18px' }}>{currentData.genre}</Tag>
                )}
                {currentData.genrePaths && currentData.genrePaths.length > 2 && (
                    <Text style={{ color: '#666', fontSize: '12px' }}>+{currentData.genrePaths.length - 2}个</Text>
                )}
                <Text style={{ color: '#999', fontSize: '12px' }}>数量:</Text>
                <Tag color="orange" style={{ fontSize: '11px', padding: '0 6px', lineHeight: '18px' }}>{currentData.numberOfIdeas}个</Tag>
            </div>
        </Card>
    );
};

export const BrainstormInputEditor: React.FC<BrainstormInputEditorProps> = ({
    projectId
}) => {
    const projectData = useProjectData();

    // Find the brainstorm input artifact
    const brainstormInputArtifact = useMemo(() => {
        if (!Array.isArray(projectData.artifacts) || projectData.artifacts.length === 0) {
            return null;
        }

        // Look for brainstorm_tool_input_schema artifacts
        return projectData.artifacts.find(artifact =>
            artifact.type === 'brainstorm_tool_input_schema'
        );
    }, [projectData.artifacts]);

    // Check if this artifact has been used to generate ideas (has descendants)
    const hasGeneratedIdeas = useMemo(() => {
        if (!brainstormInputArtifact) return false;
        if (!Array.isArray(projectData.transformInputs)) return false;

        // Check if any transforms use this artifact as input
        return projectData.transformInputs.some(input =>
            input.artifact_id === brainstormInputArtifact.id
        );
    }, [brainstormInputArtifact, projectData.transformInputs]);

    // Don't render if no artifact exists
    if (!brainstormInputArtifact) {
        return null;
    }

    // Parse current data for compact view
    const currentData = useMemo(() => {
        if (!brainstormInputArtifact?.data) return null;

        try {
            return typeof brainstormInputArtifact.data === 'string'
                ? JSON.parse(brainstormInputArtifact.data)
                : brainstormInputArtifact.data;
        } catch (error) {
            console.error('Error parsing artifact data:', error);
            return null;
        }
    }, [brainstormInputArtifact?.data]);

    // Show compact read-only view if ideas have been generated
    if (hasGeneratedIdeas && currentData) {
        return <CompactBrainstormView currentData={currentData} />;
    }

    // Show full editing form wrapped in YJS context
    return (
        <YJSArtifactProvider artifactId={brainstormInputArtifact.id} enableCollaboration={true}>
            <Card
                style={{
                    maxWidth: '800px',
                    margin: '0 auto 24px auto',
                    background: '#1a1a1a',
                    borderColor: '#1890ff',
                    borderWidth: '2px'
                }}
                styles={{
                    header: {
                        background: '#1a1a1a',
                        borderBottom: '1px solid #333',
                        color: '#fff'
                    },
                    body: { background: '#1a1a1a' }
                }}
            >
                <BrainstormInputForm />
            </Card>
        </YJSArtifactProvider>
    );
}; 