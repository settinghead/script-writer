import React, { useState } from 'react';
import { Card, Typography, Button, Space, Alert, Input, Divider } from 'antd';
import { useYJSArtifact } from '../../hooks/useYJSArtifact';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { apiService } from '../../services/apiService';

const { Title, Text, Paragraph } = Typography;

export const YJSDemo: React.FC = () => {
    const [testArtifactId, setTestArtifactId] = useState<string>('');
    const [isCreating, setIsCreating] = useState(false);
    const projectData = useProjectData();

    // Create a test artifact for YJS demo
    const createTestArtifact = async () => {
        setIsCreating(true);
        try {
            const testData = {
                title: 'YJS 测试文档',
                description: '这是一个用于测试 YJS 协作编辑的文档',
                content: {
                    text: '欢迎使用 YJS 协作编辑!',
                    items: ['项目 1', '项目 2', '项目 3'],
                    metadata: {
                        author: '测试用户',
                        created: new Date().toISOString(),
                        version: '1.0'
                    }
                }
            };

            const artifact = await apiService.createArtifact('yjs_test', testData);

            setTestArtifactId(artifact.id);
            console.log('Test artifact created:', artifact.id);
        } catch (error) {
            console.error('Failed to create test artifact:', error);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
            <Title level={2}>YJS 协作编辑演示</Title>

            <Alert
                message="YJS 基础功能已启用"
                description="YJS 协作编辑的基础功能已经启用。目前使用本地模式，暂时没有网络同步功能。"
                type="info"
                showIcon
                style={{ marginBottom: '24px' }}
            />

            <Card title="创建测试文档" style={{ marginBottom: '24px' }}>
                <Paragraph>
                    点击下面的按钮创建一个测试文档，用于演示 YJS 协作编辑功能。
                </Paragraph>
                <Space>
                    <Button
                        type="primary"
                        onClick={createTestArtifact}
                        loading={isCreating}
                    >
                        创建测试文档
                    </Button>
                    {testArtifactId && (
                        <Text type="secondary">
                            已创建文档 ID: {testArtifactId}
                        </Text>
                    )}
                </Space>
            </Card>

            {testArtifactId && (
                <YJSTestDocument artifactId={testArtifactId} />
            )}
        </div>
    );
};

// Component to test YJS functionality with a specific artifact
const YJSTestDocument: React.FC<{ artifactId: string }> = ({ artifactId }) => {
    const yjsHook = useYJSArtifact(artifactId, {
        enableCollaboration: true,
        syncIntervalMs: 1000
    });

    const { doc, data, updateField, isInitialized, isConnected } = yjsHook;

    const [newTitle, setNewTitle] = useState('');
    const [newItem, setNewItem] = useState('');

    const handleUpdateTitle = () => {
        if (newTitle.trim()) {
            updateField('title', newTitle.trim());
            setNewTitle('');
        }
    };

    const handleAddItem = () => {
        if (newItem.trim()) {
            const currentItems = data?.content?.items || [];
            const updatedItems = [...currentItems, newItem.trim()];
            updateField('content.items', updatedItems);
            setNewItem('');
        }
    };

    if (!isInitialized) {
        return (
            <Card title="YJS 文档加载中">
                <Text>正在初始化 YJS 文档...</Text>
            </Card>
        );
    }

    return (
        <Card title={`YJS 测试文档: ${data?.title || '未知标题'}`}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Connection Status */}
                <Alert
                    message={isConnected ? "已连接" : "未连接"}
                    description={isConnected ? "YJS 文档已成功初始化" : "YJS 文档连接失败"}
                    type={isConnected ? "success" : "error"}
                    showIcon
                />

                {/* Document Data Display */}
                <div>
                    <Title level={4}>当前文档数据:</Title>
                    <pre style={{
                        background: '#f5f5f5',
                        padding: '12px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        overflow: 'auto'
                    }}>
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </div>

                <Divider />

                {/* Update Title */}
                <div>
                    <Title level={4}>更新标题:</Title>
                    <Space>
                        <Input
                            placeholder="输入新标题"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onPressEnter={handleUpdateTitle}
                            style={{ width: '200px' }}
                        />
                        <Button type="primary" onClick={handleUpdateTitle}>
                            更新标题
                        </Button>
                    </Space>
                </div>

                {/* Add Item */}
                <div>
                    <Title level={4}>添加项目:</Title>
                    <Space>
                        <Input
                            placeholder="输入新项目"
                            value={newItem}
                            onChange={(e) => setNewItem(e.target.value)}
                            onPressEnter={handleAddItem}
                            style={{ width: '200px' }}
                        />
                        <Button type="primary" onClick={handleAddItem}>
                            添加项目
                        </Button>
                    </Space>
                </div>

                {/* Current Items */}
                {data?.content?.items && (
                    <div>
                        <Title level={4}>当前项目列表:</Title>
                        <ul>
                            {data.content.items.map((item: string, index: number) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Debug Info */}
                <div>
                    <Title level={4}>调试信息:</Title>
                    <ul>
                        <li>文档 ID: {artifactId}</li>
                        <li>YJS 文档: {doc ? '已初始化' : '未初始化'}</li>
                        <li>数据同步: {isConnected ? '正常' : '异常'}</li>
                        <li>字段数量: {Object.keys(data || {}).length}</li>
                    </ul>
                </div>
            </Space>
        </Card>
    );
}; 