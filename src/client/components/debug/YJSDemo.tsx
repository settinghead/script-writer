import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Typography, Alert, Divider, Input, Tag, Spin } from 'antd';
import { YJSArtifactProvider } from '../../transform-artifact-framework/contexts/YJSArtifactContext';
import { YJSTextField, YJSTextAreaField, YJSArrayField } from '../../transform-artifact-framework/components/YJSField';
import { useProjectData } from '../../contexts/ProjectDataContext';

const { Title, Text } = Typography;

// Demo content component that uses the YJS context
const YJSDemoContent: React.FC<{ artifactId: string }> = ({ artifactId }) => {
    return (
        <YJSArtifactProvider artifactId={artifactId} enableCollaboration={true}>
            <YJSDemoFields />
        </YJSArtifactProvider>
    );
};

// Fields component that consumes the YJS context
const YJSDemoFields: React.FC = () => {
    return (
        <>
            <Card title="基础文本字段" style={{ marginBottom: '24px' }}>
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <div>
                        <Text strong>标题: </Text>
                        <YJSTextField
                            path="title"
                            placeholder="输入标题..."
                        />
                    </div>

                    <div>
                        <Text strong>描述: </Text>
                        <YJSTextAreaField
                            path="description"
                            placeholder="输入描述..."
                            rows={4}
                        />
                    </div>
                </Space>
            </Card>

            <Card title="数组字段" style={{ marginBottom: '24px' }}>
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <div>
                        <Text strong>主题标签: </Text>
                        <YJSArrayField
                            path="themes"
                            placeholder="每行一个主题..."
                        />
                    </div>

                    <div>
                        <Text strong>卖点: </Text>
                        <YJSArrayField
                            path="selling_points"
                            placeholder="每行一个卖点..."
                        />
                    </div>
                </Space>
            </Card>

            <Card title="嵌套字段" style={{ marginBottom: '24px' }}>
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <div>
                        <Text strong>类型: </Text>
                        <YJSTextField
                            path="settings.genre"
                            placeholder="选择类型..."
                        />
                    </div>

                    <div>
                        <Text strong>集数: </Text>
                        <YJSTextField
                            path="settings.episodes"
                            placeholder="输入集数..."
                        />
                    </div>

                    <div>
                        <Text strong>平台: </Text>
                        <YJSTextField
                            path="settings.platform"
                            placeholder="选择平台..."
                        />
                    </div>
                </Space>
            </Card>

            <Card title="复杂嵌套数据" style={{ marginBottom: '24px' }}>
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <div>
                        <Text strong>男主姓名: </Text>
                        <YJSTextField
                            path="characters.male_lead.name"
                            placeholder="男主角姓名..."
                        />
                    </div>

                    <div>
                        <Text strong>男主设定: </Text>
                        <YJSTextAreaField
                            path="characters.male_lead.description"
                            placeholder="男主角人物设定..."
                            rows={3}
                        />
                    </div>

                    <div>
                        <Text strong>女主姓名: </Text>
                        <YJSTextField
                            path="characters.female_lead.name"
                            placeholder="女主角姓名..."
                        />
                    </div>

                    <div>
                        <Text strong>女主设定: </Text>
                        <YJSTextAreaField
                            path="characters.female_lead.description"
                            placeholder="女主角人物设定..."
                            rows={3}
                        />
                    </div>
                </Space>
            </Card>
        </>
    );
};

export const YJSDemo: React.FC = () => {
    const [testArtifactId, setTestArtifactId] = useState<string | null>(null);
    const [customArtifactId, setCustomArtifactId] = useState<string>('');
    const [isCreating, setIsCreating] = useState(false);
    const projectData = useProjectData();

    // Get current project ID from URL or context
    const currentProjectId = React.useMemo(() => {
        // First try to get from URL (most reliable)
        const projectFromUrl = window.location.pathname.match(/\/projects\/([^\/]+)/)?.[1];
        if (projectFromUrl) {
            return projectFromUrl;
        }

        // Fallback to artifacts if available
        if (Array.isArray(projectData.artifacts) && projectData.artifacts.length > 0) {
            return projectData.artifacts[0].project_id;
        }

        // Last resort fallbacks
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('projectId') || 'test-project-yjs';
    }, [projectData.artifacts]);

    // Find or create a test artifact for YJS demo
    useEffect(() => {
        if (Array.isArray(projectData.artifacts)) {
            const existingArtifact = projectData.artifacts.find((a: any) => {
                // Handle both string and object data formats
                let artifactData = a.data;
                if (typeof artifactData === 'string') {
                    try {
                        artifactData = JSON.parse(artifactData);
                    } catch (e) {
                        return false;
                    }
                }

                const isMatch = artifactData &&
                    typeof artifactData === 'object' &&
                    artifactData.title === 'YJS Demo Artifact';

                return isMatch;
            });

            if (existingArtifact) {
                setTestArtifactId(existingArtifact.id);
            }
        }
    }, [projectData.artifacts, currentProjectId]);

    // Initialize demo data by creating a test artifact
    const createTestArtifact = async () => {
        setIsCreating(true);
        try {
            // Create a test artifact for YJS demo with rich demo data
            const response = await fetch('/api/artifacts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                },
                body: JSON.stringify({
                    projectId: currentProjectId,
                    type: 'user_input',
                    data: {
                        title: 'YJS Demo Artifact',
                        description: '这是一个使用 YJS 协作编辑的测试项目，展示了实时协作编辑的功能。多个用户可以同时编辑这个文档，所有修改都会实时同步。',
                        themes: ['现代甜宠', '霸总追妻', '双向救赎'],
                        selling_points: ['高颜值男女主', '甜蜜互动', '反转剧情'],
                        settings: {
                            genre: '现代甜宠',
                            episodes: 60,
                            platform: '抖音'
                        },
                        characters: {
                            male_lead: {
                                name: '陆景琛',
                                description: '冷酷霸道的商业帝国继承人，外表高冷内心温柔，对女主一见钟情后展开追求攻势。'
                            },
                            female_lead: {
                                name: '苏晚晚',
                                description: '独立坚强的设计师，有着不为人知的过往，初期对男主有误解后逐渐被其真心打动。'
                            }
                        }
                    },
                    typeVersion: 'v1',
                    metadata: { demo: true }
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.artifact && result.artifact.id) {
                    setTestArtifactId(result.artifact.id);

                    // Force a small delay to allow Electric SQL to sync
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } else {
                    console.error('Artifact creation succeeded but no artifact ID returned:', result);
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('Failed to create test artifact:', errorData);
            }
        } catch (error) {
            console.error('Error creating test artifact:', error);
        } finally {
            setIsCreating(false);
        }
    };

    // Show loading while data is still loading
    if (projectData.isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                <Spin size="large" />
            </div>
        );
    }

    const artifactId = customArtifactId || testArtifactId;

    return (
        <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
            <Title level={2}>YJS 协作编辑演示</Title>

            <Card title="选择测试文档" style={{ marginBottom: '24px' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                        <Text strong>当前文档 ID: </Text>
                        <Tag color="blue">{artifactId || '未选择'}</Tag>
                    </div>

                    <div>
                        <Text>自定义文档 ID: </Text>
                        <Input
                            value={customArtifactId}
                            onChange={(e) => setCustomArtifactId(e.target.value)}
                            placeholder="输入文档 ID 或留空使用默认"
                            style={{ width: '400px', marginLeft: '8px' }}
                        />
                    </div>

                    {!testArtifactId && (
                        <Button
                            type="primary"
                            onClick={createTestArtifact}
                            loading={isCreating}
                        >
                            创建演示文档
                        </Button>
                    )}
                </Space>
            </Card>

            {artifactId ? (
                <YJSDemoContent artifactId={artifactId} />
            ) : (
                <Alert
                    message="没有找到演示文档"
                    description="请创建一个演示文档或输入现有文档 ID 来测试 YJS 功能"
                    type="warning"
                    showIcon
                />
            )}

            <Divider />

            <Alert
                message="YJS 协作编辑使用说明"
                description={
                    <ul>
                        <li><strong>实时协作:</strong> 在多个浏览器窗口中打开相同页面可测试实时协作编辑</li>
                        <li><strong>字段编辑:</strong> 点击任意字段开始编辑，支持文本、多行文本和数组</li>
                        <li><strong>自动保存:</strong> 输入时会自动保存，无需手动保存</li>
                        <li><strong>键盘操作:</strong> Enter 完成编辑，Escape 取消编辑</li>
                        <li><strong>数组编辑:</strong> 每行一个项目，空行会被自动过滤</li>
                        <li><strong>嵌套路径:</strong> 支持 JSON 路径如 "characters.male_lead.name"</li>
                    </ul>
                }
                type="info"
                showIcon
            />
        </div>
    );
}; 