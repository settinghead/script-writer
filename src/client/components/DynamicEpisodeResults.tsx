import React, { useMemo } from 'react';
import { Space, Typography, Divider } from 'antd';
import { DynamicStreamingUI } from './shared/streaming/DynamicStreamingUI';
import { TopProgressBar } from './shared/TopProgressBar';
import { episodeFieldRegistry } from './shared/streaming/fieldRegistries';
import { EpisodeSynopsisV1 } from '../../common/types';

const { Title } = Typography;

interface DynamicEpisodeResultsProps {
  episodes: EpisodeSynopsisV1[];
  isStreaming?: boolean;
  streamingItems?: any[];
  streamingStatus?: 'idle' | 'connecting' | 'streaming' | 'completed' | 'error';
  isThinking?: boolean;
  onStopStreaming?: () => void;
  onEpisodeEdit?: (episodeNumber: number, field: string, value: any) => Promise<void>;
  expectedEpisodeCount?: number; // Expected total number of episodes for progress calculation
}

export const DynamicEpisodeResults: React.FC<DynamicEpisodeResultsProps> = ({
  episodes,
  isStreaming = false,
  streamingItems = [],
  streamingStatus = 'idle',
  isThinking = false,
  onStopStreaming,
  onEpisodeEdit,
  expectedEpisodeCount
}) => {
  // Transform episodes data for streaming
  const streamingData = useMemo(() => {
    // Use real-time streaming items if available and streaming
    if (isStreaming && streamingItems.length > 0) {
      return streamingItems;
    }

    // Otherwise use episodes data
    return episodes || [];
  }, [episodes, streamingItems, isStreaming]);

  // Handle field save
  const handleFieldSave = async (fieldPath: string, newValue: any, itemIndex?: number) => {
    if (onEpisodeEdit && typeof itemIndex === 'number') {
      const episode = streamingData[itemIndex];
      if (episode) {
        await onEpisodeEdit(episode.episodeNumber, fieldPath, newValue);
      }
    }
  };

  // Calculate progress for the top progress bar
  const totalExpected = expectedEpisodeCount || streamingData.length;
  const progress = totalExpected > 0 ? Math.min((streamingData.length / totalExpected) * 100, 100) : 0;

  return (
    <div className={isStreaming ? 'episode-generating' : ''} style={{ position: 'relative' }}>
      {/* Top Progress Bar */}
      <TopProgressBar
        isStreaming={isStreaming}
        progress={progress}
        currentCount={streamingData.length}
        totalCount={totalExpected}
        itemLabel="集"
        visible={isStreaming || streamingData.length > 0}
      />
      
      <div style={{ padding: '20px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Header */}
          <div>
            <Title level={3} style={{ color: '#fff', marginBottom: '8px' }}>
              剧集大纲生成结果
            </Title>
            <div style={{ color: '#888', fontSize: '14px' }}>
              共 {streamingData.length} 集剧集大纲
              {isStreaming && ` · 正在生成中...`}
            </div>
          </div>

        <Divider style={{ borderColor: '#404040' }} />

        {/* Dynamic Episode Streaming UI */}
        <DynamicStreamingUI
          fieldRegistry={episodeFieldRegistry}
          streamingData={streamingData}
          streamingStatus={streamingStatus}
          isThinking={isThinking}
          onStopStreaming={onStopStreaming}
          onFieldEdit={handleFieldSave}
          className="episode-results"
          itemContainerStyle={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #404040',
            borderRadius: '8px',
            marginBottom: '20px',
            padding: '16px'
          }}
          itemHeaderStyle={{
            borderBottom: '1px solid #404040',
            paddingBottom: '12px',
            marginBottom: '16px'
          }}
          itemTitleFormatter={(item, index) => `第${item.episodeNumber || (index + 1)}集: ${item.title || '剧集标题'}`}
        />
      </Space>
    </div>
    </div>
  );
}; 