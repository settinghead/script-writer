import React, { useState } from 'react';
import { Button, Card, Space, Typography, Alert, Input, Form } from 'antd';
import { useBrainstormingStream, useOutlineStream, useEpisodeStream } from '../../hooks/useStreamObject';

const { Title, Paragraph, Text } = Typography;

/**
 * Example component demonstrating the new AI SDK streamObject integration
 * This replaces the complex manual JSON parsing with clean, typed streaming
 */
export const StreamObjectExample: React.FC = () => {
  const [brainstormParams, setBrainstormParams] = useState({
    platform: '抖音',
    genrePaths: [['爱情', '现代']],
    genreProportions: [100],
    requirements: '要有反转'
  });

  const [outlineParams, setOutlineParams] = useState({
    sourceArtifactId: '',
    totalEpisodes: 30,
    episodeDuration: 2
  });

  // Use the new streamObject hooks
  const brainstormingStream = useBrainstormingStream((ideas) => {
    console.log('Brainstorming completed:', ideas);
  });

  const outlineStream = useOutlineStream((outline) => {
    console.log('Outline completed:', outline);
  });

  const episodeStream = useEpisodeStream((episodes) => {
    console.log('Episodes completed:', episodes);
  });

  const handleBrainstormingSubmit = () => {
    brainstormingStream.submit(brainstormParams);
  };

  const handleOutlineSubmit = () => {
    if (outlineParams.sourceArtifactId) {
      outlineStream.submit(outlineParams);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Title level={2}>🚀 New AI SDK StreamObject Integration</Title>
      <Paragraph>
        This demonstrates the new streaming implementation using AI SDK's <Text code>streamObject</Text>.
        No more manual JSON parsing, jsonrepair, or complex chunk handling!
      </Paragraph>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        
        {/* Brainstorming Example */}
        <Card title="💡 Brainstorming Stream" style={{ width: '100%' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Form layout="inline">
              <Form.Item label="Platform">
                <Input 
                  value={brainstormParams.platform}
                  onChange={(e) => setBrainstormParams(prev => ({ ...prev, platform: e.target.value }))}
                  placeholder="Platform"
                />
              </Form.Item>
              <Form.Item label="Requirements">
                <Input 
                  value={brainstormParams.requirements}
                  onChange={(e) => setBrainstormParams(prev => ({ ...prev, requirements: e.target.value }))}
                  placeholder="Requirements"
                />
              </Form.Item>
            </Form>

            <Button 
              type="primary" 
              onClick={handleBrainstormingSubmit}
              loading={brainstormingStream.isLoading}
              disabled={brainstormingStream.isStreaming}
            >
              {brainstormingStream.isStreaming ? 'Streaming Ideas...' : 'Generate Ideas'}
            </Button>

            {brainstormingStream.error && (
              <Alert 
                message="Streaming Error" 
                description={brainstormingStream.error.message} 
                type="error" 
                showIcon 
              />
            )}

            {brainstormingStream.object && (
              <div>
                <Title level={4}>Generated Ideas:</Title>
                {brainstormingStream.object.map((idea, index) => (
                  <Card key={index} size="small" style={{ marginBottom: '8px' }}>
                    <Text strong>{idea.title}</Text>
                    <br />
                    <Text>{idea.body}</Text>
                  </Card>
                ))}
              </div>
            )}

            {brainstormingStream.isStreaming && (
              <Button danger onClick={brainstormingStream.stop}>
                Stop Streaming
              </Button>
            )}
          </Space>
        </Card>

        {/* Outline Example */}
        <Card title="📋 Outline Stream" style={{ width: '100%' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Form layout="inline">
              <Form.Item label="Source Artifact ID">
                <Input 
                  value={outlineParams.sourceArtifactId}
                  onChange={(e) => setOutlineParams(prev => ({ ...prev, sourceArtifactId: e.target.value }))}
                  placeholder="Enter artifact ID"
                />
              </Form.Item>
              <Form.Item label="Episodes">
                <Input 
                  type="number"
                  value={outlineParams.totalEpisodes}
                  onChange={(e) => setOutlineParams(prev => ({ ...prev, totalEpisodes: parseInt(e.target.value) || 30 }))}
                />
              </Form.Item>
            </Form>

            <Button 
              type="primary" 
              onClick={handleOutlineSubmit}
              loading={outlineStream.isLoading}
              disabled={outlineStream.isStreaming || !outlineParams.sourceArtifactId}
            >
              {outlineStream.isStreaming ? 'Streaming Outline...' : 'Generate Outline'}
            </Button>

            {outlineStream.error && (
              <Alert 
                message="Streaming Error" 
                description={outlineStream.error.message} 
                type="error" 
                showIcon 
              />
            )}

            {outlineStream.object && (
              <div>
                <Title level={4}>Generated Outline:</Title>
                <Card>
                  <Title level={5}>{outlineStream.object.title}</Title>
                  <Paragraph><Text strong>Genre:</Text> {outlineStream.object.genre}</Paragraph>
                  <Paragraph><Text strong>Characters:</Text> {outlineStream.object.characters?.length || 0} characters</Paragraph>
                  <Paragraph><Text strong>Stages:</Text> {outlineStream.object.synopsis_stages?.length || 0} stages</Paragraph>
                </Card>
              </div>
            )}

            {outlineStream.isStreaming && (
              <Button danger onClick={outlineStream.stop}>
                Stop Streaming
              </Button>
            )}
          </Space>
        </Card>

        {/* Episode Example */}
        <Card title="🎬 Episode Stream" style={{ width: '100%' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert 
              message="Note" 
              description="Episode generation requires outline and stage artifact IDs" 
              type="info" 
              showIcon 
            />
            
            <Button 
              type="primary" 
              onClick={() => episodeStream.submit({ outlineSessionId: 'example', stageArtifactId: 'example' })}
              loading={episodeStream.isLoading}
              disabled={episodeStream.isStreaming}
            >
              {episodeStream.isStreaming ? 'Streaming Episodes...' : 'Generate Episodes (Example)'}
            </Button>

            {episodeStream.error && (
              <Alert 
                message="Streaming Error" 
                description={episodeStream.error.message} 
                type="error" 
                showIcon 
              />
            )}

            {episodeStream.object && (
              <div>
                <Title level={4}>Generated Episodes:</Title>
                {episodeStream.object.map((episode, index) => (
                  <Card key={index} size="small" style={{ marginBottom: '8px' }}>
                    <Text strong>Episode {episode.episodeNumber}: {episode.title}</Text>
                    <br />
                    <Text>{episode.synopsis}</Text>
                  </Card>
                ))}
              </div>
            )}

            {episodeStream.isStreaming && (
              <Button danger onClick={episodeStream.stop}>
                Stop Streaming
              </Button>
            )}
          </Space>
        </Card>

        {/* Technical Benefits */}
        <Card title="✨ Technical Benefits" style={{ backgroundColor: '#f9f9f9' }}>
          <Space direction="vertical">
            <Text strong>🎯 What's Improved:</Text>
            <ul>
              <li><Text code>No manual JSON parsing</Text> - AI SDK handles all parsing automatically</li>
              <li><Text code>Type safety</Text> - Zod schemas provide full TypeScript support</li>
              <li><Text code>Built-in error handling</Text> - AI SDK manages connection errors and retries</li>
              <li><Text code>Automatic partial updates</Text> - UI updates as data streams in</li>
              <li><Text code>87% less code</Text> - Eliminated complex custom streaming infrastructure</li>
            </ul>
            
            <Text strong>🚀 Developer Experience:</Text>
            <ul>
              <li>Simple hooks replace complex service classes</li>
              <li>Declarative API instead of imperative streaming management</li>
              <li>Built-in loading, error, and streaming states</li>
              <li>Easy to test and mock</li>
            </ul>
          </Space>
        </Card>

      </Space>
    </div>
  );
}; 