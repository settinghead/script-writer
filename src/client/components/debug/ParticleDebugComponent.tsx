import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Input, Slider, Card, List, Tag, Typography, Space, Spin, Alert, Button, Divider, Tabs } from 'antd';
import { SearchOutlined, FileTextOutlined, ReloadOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useParticleSearch, useParticleList } from '../../hooks/useParticleSearch';
import { useDebounce } from '../../hooks/useDebounce';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

interface ParticleDebugComponentProps {
    projectId: string;
}

interface ParticleResult {
    id: string;
    title: string;
    type: string;
    content_preview: string;
    jsondoc_id: string;
    path: string;
    similarity?: number;
}

export const ParticleDebugComponent: React.FC<ParticleDebugComponentProps> = ({ projectId }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState('');
    const [threshold, setThreshold] = useState(0.0);
    const [limit, setLimit] = useState(20);
    const [rawResults, setRawResults] = useState<ParticleResult[]>([]);
    const [isManualSearch, setIsManualSearch] = useState(false);

    // Get active tab from URL params, default to 'search'
    const activeTab = searchParams.get('particle-tab') || 'search';

    // Handle tab change and persist to URL
    const handleTabChange = useCallback((key: string) => {
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.set('particle-tab', key);
        setSearchParams(newSearchParams);
    }, [searchParams, setSearchParams]);

    const debouncedQuery = useDebounce(searchQuery, 500);

    // Use the existing hook for auto-search
    const { particles, loading, error, searchParticles, clearResults } = useParticleSearch({
        projectId,
        limit: 50 // Get more results for filtering
    });

    // Use the new hook for listing all particles
    const {
        particles: allParticles,
        loading: listLoading,
        error: listError,
        fetchParticles,
        refresh
    } = useParticleList({
        projectId,
        limit: 100
    });

    // Manual search function for testing
    const handleManualSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setRawResults([]);
            return;
        }

        setIsManualSearch(true);
        try {
            const params = new URLSearchParams({
                query: query.trim(),
                projectId,
                limit: '50'
            });

            const response = await fetch(`/api/particles/search?${params.toString()}`);

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }

            const results = await response.json();
            setRawResults(results);
        } catch (err) {
            console.error('Manual search failed:', err);
            setRawResults([]);
        } finally {
            setIsManualSearch(false);
        }
    }, [projectId]);

    // Auto-trigger search when debounced query changes
    React.useEffect(() => {
        if (debouncedQuery.trim()) {
            searchParticles(debouncedQuery);
            handleManualSearch(debouncedQuery);
        } else {
            clearResults();
            setRawResults([]);
        }
    }, [debouncedQuery, searchParticles, clearResults, handleManualSearch]);

    // Fetch particles when list tab is selected
    useEffect(() => {
        if (activeTab === 'list') {
            fetchParticles();
        }
    }, [activeTab, fetchParticles]);

    // Filter results based on threshold
    const filteredResults = rawResults.filter(result => {
        if (result.similarity === undefined) return true;
        return result.similarity >= threshold;
    });

    // Health check function
    const checkParticleHealth = useCallback(async () => {
        try {
            const response = await fetch('/api/particles/health');
            const health = await response.json();
            console.log('Particle System Health:', health);
            return health;
        } catch (err) {
            console.error('Health check failed:', err);
            return null;
        }
    }, []);

    // Render a particle list item
    const renderParticleItem = (particle: ParticleResult, showSimilarity: boolean = false) => (
        <List.Item style={{ borderBottomColor: '#434343' }}>
            <List.Item.Meta
                avatar={
                    <div style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: '#1890ff',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <FileTextOutlined style={{ color: '#fff', fontSize: '18px' }} />
                    </div>
                }
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Text style={{ color: '#fff', fontWeight: 500 }}>
                            {particle.title}
                        </Text>
                        <Tag color="blue">{particle.type}</Tag>
                        {showSimilarity && particle.similarity !== undefined && (
                            <Tag color={particle.similarity >= 0.7 ? 'green' : particle.similarity >= 0.4 ? 'orange' : 'red'}>
                                {(particle.similarity * 100).toFixed(1)}%
                            </Tag>
                        )}
                    </div>
                }
                description={
                    <div>
                        <Paragraph
                            style={{ color: '#ccc', marginBottom: '8px' }}
                            ellipsis={{ rows: 2, expandable: true }}
                        >
                            {particle.content_preview}
                        </Paragraph>
                        <Space>
                            <Text style={{ color: '#888', fontSize: '12px' }}>
                                ID: {particle.id}
                            </Text>
                            <Text style={{ color: '#888', fontSize: '12px' }}>
                                路径: {particle.path}
                            </Text>
                            <Text style={{ color: '#888', fontSize: '12px' }}>
                                来源JSONDoc: {particle.jsondoc_id}
                            </Text>
                        </Space>
                    </div>
                }
            />
        </List.Item>
    );

    return (
        <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
            <div style={{ marginBottom: '24px' }}>
                <Title level={3} style={{ color: '#fff', marginBottom: '8px' }}>
                    粒子嵌入搜索调试
                </Title>
                <Text type="secondary">
                    测试粒子系统的语义搜索功能，调整相似度阈值来过滤结果
                </Text>
            </div>

            <Tabs
                activeKey={activeTab}
                onChange={handleTabChange}
                style={{ height: '100%' }}
                tabBarStyle={{ color: '#fff' }}
                items={[
                    {
                        key: 'search',
                        label: (
                            <Space>
                                <SearchOutlined />
                                <span>语义搜索</span>
                            </Space>
                        ),
                        children: (
                            <div style={{ height: '100%', overflow: 'auto' }}>
                                {/* Search Controls */}
                                <Card
                                    title="搜索控制"
                                    style={{ marginBottom: '16px', backgroundColor: '#2a2a2a', borderColor: '#434343' }}
                                    headStyle={{ color: '#fff', borderBottomColor: '#434343' }}
                                    bodyStyle={{ backgroundColor: '#2a2a2a' }}
                                >
                                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                                        <div>
                                            <Text style={{ color: '#fff', marginBottom: '8px', display: 'block' }}>
                                                搜索查询
                                            </Text>
                                            <Search
                                                placeholder="输入搜索关键词..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                onSearch={handleManualSearch}
                                                loading={loading || isManualSearch}
                                                style={{ width: '100%' }}
                                                size="large"
                                            />
                                        </div>

                                        <div>
                                            <Text style={{ color: '#fff', marginBottom: '8px', display: 'block' }}>
                                                相似度阈值: {threshold.toFixed(2)}
                                            </Text>
                                            <Slider
                                                min={0}
                                                max={1}
                                                step={0.01}
                                                value={threshold}
                                                onChange={setThreshold}
                                                marks={{
                                                    0: '0.00',
                                                    0.25: '0.25',
                                                    0.5: '0.50',
                                                    0.75: '0.75',
                                                    1: '1.00'
                                                }}
                                                tooltip={{ formatter: (value) => `${value?.toFixed(2)}` }}
                                            />
                                        </div>

                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <Button
                                                icon={<ReloadOutlined />}
                                                onClick={checkParticleHealth}
                                                type="default"
                                            >
                                                健康检查
                                            </Button>
                                            <Text style={{ color: '#888' }}>
                                                限制: {limit} 条结果
                                            </Text>
                                        </div>
                                    </Space>
                                </Card>

                                {/* Error Display */}
                                {error && (
                                    <Alert
                                        message="搜索错误"
                                        description={error}
                                        type="error"
                                        style={{ marginBottom: '16px' }}
                                    />
                                )}

                                {/* Search Results */}
                                <Card
                                    title="搜索结果"
                                    style={{ marginBottom: '16px', backgroundColor: '#2a2a2a', borderColor: '#434343' }}
                                    headStyle={{ color: '#fff', borderBottomColor: '#434343' }}
                                    bodyStyle={{ backgroundColor: '#2a2a2a' }}
                                    extra={
                                        <Space>
                                            <Text style={{ color: '#888' }}>
                                                原始: {rawResults.length} | 过滤后: {filteredResults.length}
                                            </Text>
                                            {(loading || isManualSearch) && <Spin size="small" />}
                                        </Space>
                                    }
                                >
                                    {!searchQuery.trim() ? (
                                        <Text style={{ color: '#888' }}>
                                            输入搜索关键词开始测试...
                                        </Text>
                                    ) : filteredResults.length === 0 && !loading && !isManualSearch ? (
                                        <Text style={{ color: '#888' }}>
                                            没有找到匹配的粒子
                                        </Text>
                                    ) : (
                                        <List
                                            dataSource={filteredResults}
                                            renderItem={(particle) => renderParticleItem(particle, true)}
                                            pagination={{
                                                pageSize: 10,
                                                showSizeChanger: true,
                                                showQuickJumper: true,
                                                showTotal: (total, range) => `${range[0]}-${range[1]} 共 ${total} 条`,
                                                style: { textAlign: 'center', marginTop: '16px' }
                                            }}
                                        />
                                    )}
                                </Card>
                            </div>
                        )
                    },
                    {
                        key: 'list',
                        label: (
                            <Space>
                                <UnorderedListOutlined />
                                <span>全部粒子</span>
                            </Space>
                        ),
                        children: (
                            <div style={{ height: '100%', overflow: 'auto' }}>
                                {/* List Controls */}
                                <Card
                                    title="粒子列表"
                                    style={{ marginBottom: '16px', backgroundColor: '#2a2a2a', borderColor: '#434343' }}
                                    headStyle={{ color: '#fff', borderBottomColor: '#434343' }}
                                    bodyStyle={{ backgroundColor: '#2a2a2a' }}
                                    extra={
                                        <Space>
                                            <Text style={{ color: '#888' }}>
                                                共 {allParticles.length} 个粒子
                                            </Text>
                                            <Button
                                                icon={<ReloadOutlined />}
                                                onClick={refresh}
                                                loading={listLoading}
                                                size="small"
                                            >
                                                刷新
                                            </Button>
                                        </Space>
                                    }
                                >
                                    <Text style={{ color: '#ccc' }}>
                                        显示当前项目中的所有活跃粒子，按创建时间倒序排列
                                    </Text>
                                </Card>

                                {/* Error Display */}
                                {listError && (
                                    <Alert
                                        message="加载错误"
                                        description={listError}
                                        type="error"
                                        style={{ marginBottom: '16px' }}
                                    />
                                )}

                                {/* Particle List */}
                                <Card
                                    title="粒子列表"
                                    style={{ backgroundColor: '#2a2a2a', borderColor: '#434343' }}
                                    headStyle={{ color: '#fff', borderBottomColor: '#434343' }}
                                    bodyStyle={{ backgroundColor: '#2a2a2a' }}
                                    extra={
                                        listLoading && <Spin size="small" />
                                    }
                                >
                                    {allParticles.length === 0 && !listLoading ? (
                                        <Text style={{ color: '#888' }}>
                                            当前项目中没有粒子
                                        </Text>
                                    ) : (
                                        <List
                                            dataSource={allParticles}
                                            renderItem={(particle) => renderParticleItem(particle, false)}
                                            pagination={{
                                                pageSize: 20,
                                                showSizeChanger: true,
                                                showQuickJumper: true,
                                                showTotal: (total, range) => `${range[0]}-${range[1]} 共 ${total} 条`,
                                                style: { textAlign: 'center', marginTop: '16px' }
                                            }}
                                        />
                                    )}
                                </Card>
                            </div>
                        )
                    }
                ]}
            />

            {/* Debug Info */}
            <Card
                title="调试信息"
                style={{ marginTop: '16px', backgroundColor: '#2a2a2a', borderColor: '#434343' }}
                headStyle={{ color: '#fff', borderBottomColor: '#434343' }}
                bodyStyle={{ backgroundColor: '#2a2a2a' }}
            >
                <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                        <Text style={{ color: '#fff' }}>项目ID: </Text>
                        <Text code style={{ backgroundColor: '#1a1a1a', color: '#52c41a' }}>{projectId}</Text>
                    </div>
                    <div>
                        <Text style={{ color: '#fff' }}>当前查询: </Text>
                        <Text code style={{ backgroundColor: '#1a1a1a', color: '#52c41a' }}>
                            {searchQuery || '(空)'}
                        </Text>
                    </div>
                    <div>
                        <Text style={{ color: '#fff' }}>相似度阈值: </Text>
                        <Text code style={{ backgroundColor: '#1a1a1a', color: '#52c41a' }}>
                            {threshold.toFixed(2)}
                        </Text>
                    </div>
                    <div>
                        <Text style={{ color: '#fff' }}>API端点: </Text>
                        <Text code style={{ backgroundColor: '#1a1a1a', color: '#52c41a' }}>
                            /api/particles/search | /api/particles/list
                        </Text>
                    </div>
                </Space>
            </Card>
        </div>
    );
}; 