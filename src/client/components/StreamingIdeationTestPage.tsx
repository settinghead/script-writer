import React from 'react';
import { Button, Card, Typography, Spin, Alert, Flex, Empty } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { IdeationInput, IdeationOutput } from '../../common/transform_schemas';
import ansiColors from 'ansi-colors';

const { Title, Paragraph } = Typography;

const streamingQueryKey = ['streaming-ideation-test'];

interface StreamingState {
  status: 'idle' | 'streaming' | 'completed' | 'error';
  ideas: IdeationOutput | null;
  error: string | null;
  eventSource: EventSource | null;
}

const useStreamingIdeation = () => {
  const queryClient = useQueryClient();

  const startStreaming = (input: IdeationInput) => {
    // Close previous connection if it exists
    const previousState = queryClient.getQueryData<StreamingState>(streamingQueryKey);
    previousState?.eventSource?.close();

    const queryParams = new URLSearchParams(input as Record<string, string>).toString();
    const es = new EventSource(`/api/ideation/stream/test?${queryParams}`, { withCredentials: true });

    queryClient.setQueryData<StreamingState>(streamingQueryKey, {
      status: 'streaming',
      ideas: null,
      error: null,
      eventSource: es,
    });

    es.onopen = () => {
      console.log(ansiColors.cyan('SSE Connection opened.'));
    };

    es.onmessage = (event) => {
      const partialResult = JSON.parse(event.data);
      queryClient.setQueryData<StreamingState>(streamingQueryKey, (oldData) => ({
        ...(oldData!),
        ideas: partialResult,
      }));
    };
    
    es.addEventListener('done', () => {
        console.log(ansiColors.green('SSE "done" event received.'));
        queryClient.setQueryData<StreamingState>(streamingQueryKey, (oldData) => ({
            ...(oldData!),
            status: 'completed',
        }));
        es.close();
    });

    es.onerror = (err) => {
      const currentState = queryClient.getQueryData<StreamingState>(streamingQueryKey);
      if (currentState?.status !== 'completed') {
          console.error(ansiColors.red('EventSource error:'), err);
          queryClient.setQueryData<StreamingState>(streamingQueryKey, (oldData) => ({
            ...(oldData!),
            status: 'error',
            error: 'An unexpected error occurred.',
          }));
      }
      es.close();
    };
  };
  
  const stopStreaming = () => {
      const currentState = queryClient.getQueryData<StreamingState>(streamingQueryKey);
      if (currentState?.eventSource) {
          currentState.eventSource.close();
          queryClient.setQueryData<StreamingState>(streamingQueryKey, (oldData) => ({
            ...(oldData!),
            status: 'idle'
          }));
          console.log('Streaming stopped by user.');
      }
  };

  return { startStreaming, stopStreaming };
};

const StreamingIdeationTestPage: React.FC = () => {
    const { startStreaming, stopStreaming } = useStreamingIdeation();
    
    const { data } = useQuery<StreamingState>({
        queryKey: streamingQueryKey,
        queryFn: () => Promise.resolve({ status: 'idle', ideas: null, error: null, eventSource: null }),
        initialData: { status: 'idle', ideas: null, error: null, eventSource: null },
        staleTime: Infinity,
        gcTime: Infinity,
    });

    const { status, ideas, error } = data;

    const handleStart = () => {
        const testInput: IdeationInput = {
            platform: '抖音',
            genre: '虐恋',
            main_story_points: '青梅竹马, 政治联姻, 追妻火葬场',
            plot_keywords: '破镜难圆, 悲剧结局',
            style_modifiers: '情感细腻, 氛围感强',
        };
        startStreaming(testInput);
    };

    return (
        <Card title={<Title level={4}>Streaming Ideation Test</Title>} style={{ margin: '20px' }}>
            <Paragraph>
                Click the button below to start a streaming request.
            </Paragraph>
            <Flex gap="small">
                <Button
                    type="primary"
                    onClick={handleStart}
                    disabled={status === 'streaming'}
                    loading={status === 'streaming'}
                >
                    {status === 'streaming' ? 'Generating...' : 'Start Generating'}
                </Button>
                <Button
                    onClick={stopStreaming}
                    disabled={status !== 'streaming'}
                >
                    Stop
                </Button>
            </Flex>
            
            <div style={{ marginTop: '20px' }}>
                {status === 'streaming' && !ideas && <Spin tip="Connecting to stream..." />}
                
                {status === 'error' && (
                    <Alert message={error} type="error" showIcon />
                )}

                {ideas && ideas.length > 0 ? (
                    <Flex wrap="wrap" gap="middle" style={{marginTop: '20px'}}>
                        {ideas.map((idea, index) => (
                            <Card 
                                key={index} 
                                title={idea.title || 'Generating Title...'} 
                                style={{ flex: '1 1 300px', minWidth: '300px' }}
                                loading={!idea.body}
                            >
                                <Paragraph style={{ minHeight: '100px' }}>
                                    {idea.body}
                                </Paragraph>
                            </Card>
                        ))}
                    </Flex>
                ) : (
                    status === 'completed' && ideas && ideas.length === 0 && <Empty description="No ideas were generated." style={{marginTop: '20px'}} />
                )}
            </div>
        </Card>
    );
};

export default StreamingIdeationTestPage; 