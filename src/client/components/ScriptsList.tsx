import React, { useState, useEffect } from 'react';
import { List, Card, Tag, Button, Typography, Space, message } from 'antd';
import { PlayCircleOutlined, EyeOutlined, FileTextOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { OutlineSessionSummary } from '../../server/services/OutlineService';

const { Text, Title } = Typography;

const ScriptsList: React.FC = () => {
    const [scripts, setScripts] = useState<OutlineSessionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        loadScripts();
    }, []);

    const loadScripts = async () => {
        try {
            setLoading(true);
            const outlineSessions = await apiService.getOutlineSessions();
            setScripts(outlineSessions);
        } catch (error) {
            console.error('Error loading scripts:', error);
            message.error('加载剧本列表失败');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'processing';
            case 'completed':
                return 'success';
            case 'failed':
                return 'error';
            default:
                return 'default';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'active':
                return '创作中';
            case 'completed':
                return '已完成';
            case 'failed':
                return '创作失败';
            default:
                return '未知状态';
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('zh-CN');
    };

    const handleViewScript = (script: OutlineSessionSummary) => {
        // Navigate to the script detail view
        navigate(`/scripts/${script.id}`);
    };

    const handleStartEpisodeGeneration = (script: OutlineSessionSummary) => {
        // Navigate to episode generation page
        navigate(`/scripts/${script.id}/episodes`);
    };

    return (
        <div>
            <List
                loading={loading}
                itemLayout="vertical"
                dataSource={scripts}
                locale={{
                    emptyText: '暂无剧本创作记录'
                }}
                renderItem={(script) => (
                    <List.Item key={script.id}>
                        <Card
                            hoverable
                            style={{
                                backgroundColor: '#1a1a1a',
                                border: '1px solid #3a3a3a'
                            }}
                            bodyStyle={{ padding: '16px' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <FileTextOutlined style={{ color: '#1890ff' }} />
                                            <Title level={5} style={{ margin: 0, color: '#fff' }}>
                                                {script.title || '未命名剧本'}
                                            </Title>
                                            <Tag color={getStatusColor(script.status)}>
                                                {getStatusText(script.status)}
                                            </Tag>
                                        </div>

                                        {script.genre && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Tag color="blue">{script.genre}</Tag>
                                            </div>
                                        )}

                                        <Text style={{ color: '#aaa' }}>
                                            {script.source_idea_title && (
                                                <span>来源: {script.source_idea_title}</span>
                                            )}
                                        </Text>

                                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            {script.total_episodes && (
                                                <Text style={{ color: '#888' }}>
                                                    {script.total_episodes} 集
                                                </Text>
                                            )}
                                            {script.episode_duration && (
                                                <Text style={{ color: '#888' }}>
                                                    {script.episode_duration} 分钟/集
                                                </Text>
                                            )}
                                            <Text style={{ color: '#888' }}>
                                                {formatDate(script.created_at)}
                                            </Text>
                                        </div>
                                    </Space>
                                </div>

                                <Space>
                                    <Button
                                        type="primary"
                                        icon={<EyeOutlined />}
                                        onClick={() => handleViewScript(script)}
                                    >
                                        查看大纲
                                    </Button>
                                    {script.status === 'completed' && (
                                        <Button
                                            icon={<PlayCircleOutlined />}
                                            onClick={() => handleStartEpisodeGeneration(script)}
                                        >
                                            开始每集撰写
                                        </Button>
                                    )}
                                </Space>
                            </div>
                        </Card>
                    </List.Item>
                )}
            />
        </div>
    );
};

export default ScriptsList; 