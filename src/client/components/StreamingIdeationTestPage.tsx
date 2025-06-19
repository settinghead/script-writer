import React, { useState, useRef } from 'react';
import { Button, Card, Typography, Spin, Alert } from 'antd';
import type { IdeationInput } from '../../common/transform_schemas';
import c from 'ansi-colors';

const { Title, Paragraph } = Typography;
const { cyan, green, red } = c;

const StreamingIdeationTestPage: React.FC = () => {
  const [ideas, setIdeas] = useState<any[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'streaming' | 'completed' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const startStreaming = () => {
    // Cleanup previous connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setIdeas(null);
    setError(null);
    setStatus('streaming');

    const testInput: IdeationInput = {
      platform: '抖音',
      genre: '虐恋',
      main_story_points: '青梅竹马, 政治联姻, 追妻火葬场',
      plot_keywords: '破镜难圆, 悲剧结局',
      style_modifiers: '情感细腻, 氛围感强',
    };

    const queryParams = new URLSearchParams(testInput as Record<string, string>).toString();
    const es = new EventSource(`/api/ideation/stream/test?${queryParams}`, { withCredentials: true });
    eventSourceRef.current = es;

    es.onopen = () => {
      console.log(cyan('SSE Connection opened.'));
    };

    es.onmessage = (event) => {
      const partialResult = JSON.parse(event.data);
      setIdeas(partialResult);
      console.log('Received partial data:', partialResult);
    };

    es.addEventListener('done', () => {
        console.log(green('SSE "done" event received. Stream completed successfully.'));
        setStatus('completed');
        es.close();
    });

    es.onerror = (err) => {
      // Now this will only catch actual errors, not the end-of-stream signal
      console.error(red('EventSource failed:'), err);
      setError('An unexpected error occurred with the connection.');
      setStatus('error');
      es.close();
    };
  };
  
  const stopStreaming = () => {
    if (eventSourceRef.current) {
        eventSourceRef.current.close();
        console.log('Streaming stopped by user.');
        setStatus('idle');
    }
  }

  return (
    <Card title={<Title level={4}>Streaming Ideation Test</Title>} style={{ margin: '20px' }}>
      <Paragraph>
        Click the button below to start a streaming request to the backend. The results will appear below in real-time.
      </Paragraph>
      <Button
        type="primary"
        onClick={startStreaming}
        disabled={status === 'streaming'}
        loading={status === 'streaming'}
      >
        {status === 'streaming' ? 'Generating...' : 'Start Generating'}
      </Button>
       <Button
        onClick={stopStreaming}
        disabled={status !== 'streaming'}
        style={{marginLeft: 8}}
      >
        Stop
      </Button>

      {status === 'error' && (
        <Alert message={error} type="error" showIcon style={{ marginTop: '20px' }} />
      )}

      {ideas && (
        <Card style={{ marginTop: '20px', backgroundColor: '#222' }}>
          <pre style={{ color: '#eee', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {JSON.stringify(ideas, null, 2)}
          </pre>
        </Card>
      )}
    </Card>
  );
};

export default StreamingIdeationTestPage; 