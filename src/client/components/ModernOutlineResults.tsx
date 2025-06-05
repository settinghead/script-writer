import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Space, Alert, Spin, Collapse, Tag, Progress } from 'antd';
import { StopOutlined, ReloadOutlined, EditOutlined, ExportOutlined } from '@ant-design/icons';
import { useOutlineStream } from '../hooks/useStreamObject';
import type { Outline } from '../../common/schemas/streaming';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface ModernOutlineResultsProps {
  sourceArtifactId: string;
  totalEpisodes?: number;
  episodeDuration?: number;
  cascadedParams?: {
    platform: string;
    genre_paths: string[][];
    genre_proportions: number[];
    requirements: string;
  };
  onComplete?: (outline: Outline) => void;
  autoStart?: boolean;
}

/**
 * Modern outline component using AI SDK streamObject
 * Replaces complex manual JSON parsing with clean, typed streaming
 */
export const ModernOutlineResults: React.FC<ModernOutlineResultsProps> = ({
  sourceArtifactId,
  totalEpisodes = 30,
  episodeDuration = 2,
  cascadedParams,
  onComplete,
  autoStart = true
}) => {
  const [activeKeys, setActiveKeys] = useState<string[]>(['title', 'characters', 'synopsis_stages']);

  // Use the new streamObject hook
  const outlineStream = useOutlineStream((outline) => {
    console.log('Outline generation completed:', outline);
    onComplete?.(outline);
  });

  // Auto-start when component mounts
  useEffect(() => {
    if (autoStart && sourceArtifactId && !outlineStream.object) {
      handleGenerate();
    }
  }, [autoStart, sourceArtifactId]);

  const handleGenerate = () => {
    outlineStream.submit({
      sourceArtifactId,
      totalEpisodes,
      episodeDuration,
      cascadedParams
    });
  };

  const handleRegenerate = () => {
    outlineStream.submit({
      sourceArtifactId,
      totalEpisodes,
      episodeDuration,
      cascadedParams
    });
  };

  // Calculate streaming progress
  const getStreamingProgress = () => {
    if (!outlineStream.isStreaming || !outlineStream.object) return 0;
    
    const outline = outlineStream.object;
    let completedFields = 0;
    const totalFields = 7; // title, genre, selling_points, satisfaction_points, setting, characters, synopsis_stages
    
    if (outline.title) completedFields++;
    if (outline.genre) completedFields++;
    if (outline.selling_points?.length > 0) completedFields++;
    if (outline.satisfaction_points?.length > 0) completedFields++;
    if (outline.setting) completedFields++;
    if (outline.characters?.length > 0) completedFields++;
    if (outline.synopsis_stages?.length > 0) completedFields++;
    
    return Math.round((completedFields / totalFields) * 100);
  };

  if (outlineStream.error) {
    return (
      <Alert
        message="大纲生成失败"
        description={outlineStream.error.message}
        type="error"
        showIcon
        action={
          <Button size="small" onClick={handleRegenerate}>
            重新生成
          </Button>
        }
        style={{ margin: '16px 0' }}
      />
    );
  }

  if (outlineStream.isLoading && !outlineStream.object) {
    return (
      <Card style={{ margin: '16px 0', textAlign: 'center' }}>
        <Space direction="vertical" size="large">
          <Spin size="large" />
          <div>
            <Text strong>正在生成故事大纲...</Text>
            <br />
            <Text type="secondary">AI正在分析您的创意并构建完整的故事框架</Text>
          </div>
          {outlineStream.isStreaming && (
            <Button 
              danger 
              icon={<StopOutlined />} 
              onClick={outlineStream.stop}
            >
              停止生成
            </Button>
          )}
        </Space>
      </Card>
    );
  }

  if (!outlineStream.object && !outlineStream.isLoading) {
    return (
      <Card style={{ margin: '16px 0', textAlign: 'center' }}>
        <Space direction="vertical">
          <Text>点击开始生成故事大纲</Text>
          <Button type="primary" onClick={handleGenerate}>
            开始生成大纲
          </Button>
        </Space>
      </Card>
    );
  }

  const outline = outlineStream.object;
  if (!outline) return null;

  return (
    <div style={{ margin: '16px 0' }}>
      {/* Header with controls */}
      <Card style={{ marginBottom: '16px' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Title level={4} style={{ margin: 0 }}>📋 故事大纲</Title>
            {outlineStream.isStreaming && (
              <>
                <Spin size="small" />
                <Text type="secondary">生成中 ({getStreamingProgress()}%)</Text>
              </>
            )}
          </Space>
          <Space>
            {outlineStream.isStreaming && (
              <Button 
                size="small" 
                danger 
                icon={<StopOutlined />} 
                onClick={outlineStream.stop}
              >
                停止
              </Button>
            )}
            <Button 
              size="small" 
              icon={<ReloadOutlined />} 
              onClick={handleRegenerate}
              disabled={outlineStream.isStreaming}
            >
              重新生成
            </Button>
            <Button 
              size="small" 
              icon={<ExportOutlined />}
              disabled={outlineStream.isStreaming}
            >
              导出
            </Button>
          </Space>
        </Space>

        {/* Progress bar for streaming */}
        {outlineStream.isStreaming && (
          <Progress 
            percent={getStreamingProgress()} 
            size="small" 
            style={{ marginTop: '8px' }}
            showInfo={false}
          />
        )}
      </Card>

      {/* Outline content */}
      <Collapse 
        activeKey={activeKeys} 
        onChange={(keys) => setActiveKeys(keys as string[])}
        ghost
      >
        {/* Title and Basic Info */}
        <Panel header="基本信息" key="title">
          <Space direction="vertical" style={{ width: '100%' }}>
            {outline.title && (
              <div>
                <Text strong>剧名：</Text>
                <Title level={5} style={{ margin: '4px 0', color: '#1890ff' }}>
                  {outline.title}
                </Title>
              </div>
            )}
            
            {outline.genre && (
              <div>
                <Text strong>题材类型：</Text>
                <Tag color="blue" style={{ marginLeft: '8px' }}>{outline.genre}</Tag>
              </div>
            )}

            {outline.target_audience && (
              <div>
                <Text strong>目标受众：</Text>
                <br />
                {outline.target_audience.demographic && (
                  <Text>主要群体：{outline.target_audience.demographic}</Text>
                )}
                {outline.target_audience.core_themes && (
                  <div style={{ marginTop: '4px' }}>
                    <Text>核心主题：</Text>
                    {outline.target_audience.core_themes.map((theme, index) => (
                      <Tag key={index} style={{ margin: '2px' }}>{theme}</Tag>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Space>
        </Panel>

        {/* Selling Points */}
        {outline.selling_points && outline.selling_points.length > 0 && (
          <Panel header="产品卖点" key="selling_points">
            <Space direction="vertical" size="small">
              {outline.selling_points.map((point, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <Text strong style={{ marginRight: '8px', minWidth: '16px' }}>
                    {index + 1}.
                  </Text>
                  <Text>{point}</Text>
                </div>
              ))}
            </Space>
          </Panel>
        )}

        {/* Satisfaction Points */}
        {outline.satisfaction_points && outline.satisfaction_points.length > 0 && (
          <Panel header="情感爽点" key="satisfaction_points">
            <Space direction="vertical" size="small">
              {outline.satisfaction_points.map((point, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <Text strong style={{ marginRight: '8px', minWidth: '16px' }}>
                    {index + 1}.
                  </Text>
                  <Text>{point}</Text>
                </div>
              ))}
            </Space>
          </Panel>
        )}

        {/* Characters */}
        {outline.characters && outline.characters.length > 0 && (
          <Panel header={`角色设定 (${outline.characters.length})`} key="characters">
            <Space direction="vertical" size="medium" style={{ width: '100%' }}>
              {outline.characters.map((character, index) => (
                <Card 
                  key={index} 
                  size="small" 
                  style={{ backgroundColor: '#fafafa' }}
                >
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: '16px' }}>{character.name}</Text>
                      <Tag color="geekblue">{character.type}</Tag>
                    </div>
                    
                    <Text>{character.description}</Text>
                    
                    {(character.age || character.gender || character.occupation) && (
                      <Space wrap>
                        {character.age && <Tag>年龄: {character.age}</Tag>}
                        {character.gender && <Tag>性别: {character.gender}</Tag>}
                        {character.occupation && <Tag>职业: {character.occupation}</Tag>}
                      </Space>
                    )}
                  </Space>
                </Card>
              ))}
            </Space>
          </Panel>
        )}

        {/* Synopsis Stages */}
        {outline.synopsis_stages && outline.synopsis_stages.length > 0 && (
          <Panel header={`分段故事梗概 (${outline.synopsis_stages.length}个阶段)`} key="synopsis_stages">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {outline.synopsis_stages.map((stage, index) => (
                <Card 
                  key={index} 
                  title={`第 ${index + 1} 阶段 (${stage.numberOfEpisodes} 集)`}
                  size="small"
                  extra={
                    stage.timeframe && (
                      <Tag color="orange">{stage.timeframe}</Tag>
                    )
                  }
                >
                  <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                    {stage.stageSynopsis}
                  </Paragraph>
                  
                  {/* Additional stage details if available */}
                  {(stage.startingCondition || stage.endingCondition) && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0f0f0' }}>
                      {stage.startingCondition && (
                        <div style={{ marginBottom: '4px' }}>
                          <Text strong>开始状态：</Text>
                          <Text type="secondary">{stage.startingCondition}</Text>
                        </div>
                      )}
                      {stage.endingCondition && (
                        <div>
                          <Text strong>结束状态：</Text>
                          <Text type="secondary">{stage.endingCondition}</Text>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </Space>
          </Panel>
        )}
      </Collapse>

      {/* Streaming indicator */}
      {outlineStream.isStreaming && (
        <Card style={{ marginTop: '16px', textAlign: 'center', backgroundColor: '#f6ffed', borderColor: '#52c41a' }}>
          <Space>
            <Spin size="small" />
            <Text style={{ color: '#52c41a' }}>
              AI正在构建故事框架，内容将实时更新...
            </Text>
          </Space>
        </Card>
      )}
    </div>
  );
}; 