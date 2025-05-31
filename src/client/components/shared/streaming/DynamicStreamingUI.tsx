import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Space, Button, Spin, Row, Col } from 'antd';
import { StopOutlined } from '@ant-design/icons';
import { 
  DynamicStreamingUIProps, 
  RenderedField, 
  FieldUpdate,
  FieldDefinition
} from './types';
import { StreamingFieldDetector, PathMatcher } from './StreamingFieldDetector';
// import { useLLMStreaming } from '../../../hooks/useLLMStreaming';

/**
 * StreamingFieldRenderer - Renders individual fields with proper containers
 */
const StreamingFieldRenderer: React.FC<{
  field: RenderedField;
  onEdit?: (value: any) => void;
}> = ({ field, onEdit }) => {
  const { definition, value, path } = field;
  const Component = definition.component;

  // Handle edit by calling onEdit with the field path
  const handleEdit = useCallback((newValue: any) => {
    if (onEdit) {
      onEdit(newValue);
    }
  }, [onEdit]);

  const fieldElement = (
    <Component
      value={value}
      path={path}
      onEdit={handleEdit}
      {...(definition.label && { label: definition.label })}
    />
  );

  // Apply container type
  switch (definition.containerType) {
    case 'card':
      return (
        <div
          key={field.id}
          style={{
            animation: 'fadeIn 0.3s ease-out',
            marginBottom: '12px'
          }}
        >
          {fieldElement}
        </div>
      );
    case 'section':
      return (
        <div
          key={field.id}
          style={{
            animation: 'fadeIn 0.3s ease-out',
            marginBottom: '24px',
            padding: '16px',
            backgroundColor: '#1a1a1a',
            border: '1px solid #303030',
            borderRadius: '8px'
          }}
        >
          {fieldElement}
        </div>
      );
    default:
      return (
        <div
          key={field.id}
          style={{
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          {fieldElement}
        </div>
      );
  }
};

/**
 * DynamicStreamingUI - Main component for dynamic field rendering
 */
export const DynamicStreamingUI: React.FC<DynamicStreamingUIProps> = ({
  fieldRegistry,
  transformId,
  onFieldEdit,
  data,
  streamingData = [],
  streamingStatus = 'idle',
  onStopStreaming,
  className = ''
}) => {
  const [renderedFields, setRenderedFields] = useState<RenderedField[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const detector = useRef(new StreamingFieldDetector());

  // Process initial data if provided
  useEffect(() => {
    if (data) {
      detector.current.reset();
      processData(data, false);
    }
  }, [data]);

  // Process streaming items
  useEffect(() => {
    if (streamingData.length > 0) {
      const latestItem = streamingData[streamingData.length - 1];
      processData(latestItem, streamingStatus === 'streaming');
    }
  }, [streamingData, streamingStatus]);

  const processData = (partialData: any, isStreaming: boolean) => {
    setIsProcessing(true);
    
    console.log('[DynamicStreamingUI] Processing data:', partialData);
    
    try {
      const updates = detector.current.processChunk(partialData);
      
      console.log('[DynamicStreamingUI] Field updates:', updates);
      
      updates.forEach(update => {
        if (update.type === 'new-field') {
          handleNewField(update, isStreaming);
        } else if (update.type === 'update-field') {
          handleFieldUpdate(update, isStreaming);
        }
      });
    } catch (error) {
      console.error('Error processing streaming data:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewField = (update: FieldUpdate, isStreaming: boolean) => {
    const pathMatch = PathMatcher.findMatchingDefinition(update.path, fieldRegistry);
    
    if (pathMatch) {
      const fieldId = PathMatcher.generateFieldId(
        update.path, 
        pathMatch.definition, 
        update.value
      );

      // Check if field already exists (shouldn't happen, but safety check)
      setRenderedFields(prev => {
        const exists = prev.some(field => field.id === fieldId);
        if (exists) return prev;

        const newField: RenderedField = {
          id: fieldId,
          path: update.path,
          definition: pathMatch.definition,
          value: update.value,
          groupKey: extractGroupKey(update.path, pathMatch.definition)
        };

        return [...prev, newField];
      });
    }
  };

  const handleFieldUpdate = (update: FieldUpdate, isStreaming: boolean) => {
    setRenderedFields(prev => prev.map(field => {
      if (field.path === update.path) {
        return {
          ...field,
          value: update.value
        };
      }
      return field;
    }));
  };

  const extractGroupKey = (path: string, definition: FieldDefinition): string | undefined => {
    // For array items, extract the parent path as group key
    const arrayMatch = path.match(/^(.+)\[\d+\]/);
    if (arrayMatch) {
      return arrayMatch[1];
    }
    return undefined;
  };

  const handleFieldEdit = (fieldPath: string) => (newValue: any) => {
    if (onFieldEdit) {
      onFieldEdit(fieldPath, newValue);
    }
  };

  // Group fields by their group key (for array items) or individual rendering
  const groupedFields = React.useMemo(() => {
    const groups: { [key: string]: RenderedField[] } = {};
    const ungrouped: RenderedField[] = [];

    renderedFields.forEach(field => {
      if (field.groupKey) {
        if (!groups[field.groupKey]) {
          groups[field.groupKey] = [];
        }
        groups[field.groupKey].push(field);
      } else {
        ungrouped.push(field);
      }
    });

    return { groups, ungrouped };
  }, [renderedFields]);

  // Sort fields within groups and ungrouped fields
  const sortFields = (fields: RenderedField[]): RenderedField[] => {
    return fields.sort((a, b) => {
      // Sort by definition order first, then by path
      const orderA = a.definition.order ?? 999;
      const orderB = b.definition.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.path.localeCompare(b.path);
    });
  };

  // Create ordered sections that respect global field order
  const orderedSections = React.useMemo(() => {
    const sections: Array<{ type: 'field' | 'group'; key: string; order: number; content: any }> = [];

    // Add ungrouped fields
    groupedFields.ungrouped.forEach(field => {
      sections.push({
        type: 'field',
        key: field.id,
        order: field.definition.order ?? 999,
        content: field
      });
    });

    // Add grouped fields (use the order of the first field in each group)
    Object.entries(groupedFields.groups).forEach(([groupKey, fields]) => {
      const groupOrder = fields[0]?.definition?.order ?? 999;
      sections.push({
        type: 'group',
        key: groupKey,
        order: groupOrder,
        content: { groupKey, fields }
      });
    });

    // Sort sections by order
    return sections.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.key.localeCompare(b.key);
    });
  }, [groupedFields]);

  const isStreaming = streamingStatus === 'streaming';
  const hasFields = renderedFields.length > 0;

  return (
    <div className={`dynamic-streaming-ui ${className}`}>
      {/* Streaming indicator */}
      {isStreaming && (
        <div style={{ 
          marginBottom: '16px', 
          padding: '12px', 
          backgroundColor: '#1a1a1a', 
          border: '1px solid #1890ff',
          borderRadius: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Spin size="small" />
            <span style={{ color: '#1890ff' }}>正在生成内容...</span>
          </div>
                     {onStopStreaming && (
             <Button
               size="small"
               icon={<StopOutlined />}
               onClick={onStopStreaming}
               style={{
                 background: '#ff4d4f',
                 borderColor: '#ff4d4f',
                 color: 'white'
               }}
             >
               停止
             </Button>
           )}
        </div>
      )}

      {/* Render all sections in correct order */}
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {orderedSections.map((section) => {
          if (section.type === 'field') {
            // Render individual field
            const field = section.content;
            return (
              <StreamingFieldRenderer
                key={field.id}
                field={field}
                onEdit={handleFieldEdit(field.path)}
              />
            );
          } else {
            // Render grouped fields
            const { groupKey, fields } = section.content;
            const layoutConfig = fields[0]?.definition?.layout;
            const useGrid = layoutConfig?.columns;
            
            return (
              <div key={groupKey} style={{ marginTop: section.order === 1 ? '0' : '16px' }}>
                <div style={{ 
                  marginBottom: '8px', 
                  fontSize: '14px', 
                  fontWeight: 'bold', 
                  color: '#fff' 
                }}>
                  {formatGroupTitle(groupKey)}
                </div>
                
                {useGrid ? (
                  <Row gutter={[16, 16]}>
                    {sortFields(fields).map(field => (
                      <Col key={field.id} {...layoutConfig.columns}>
                        <StreamingFieldRenderer
                          field={field}
                          onEdit={handleFieldEdit(field.path)}
                        />
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    {sortFields(fields).map(field => (
                      <StreamingFieldRenderer
                        key={field.id}
                        field={field}
                        onEdit={handleFieldEdit(field.path)}
                      />
                    ))}
                  </Space>
                )}
              </div>
            );
          }
        })}
      </Space>

      {/* Loading state when processing but no fields yet */}
      {isProcessing && !hasFields && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          color: '#666' 
        }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>正在处理数据...</div>
        </div>
      )}

      {/* Empty state */}
      {!hasFields && !isStreaming && !isProcessing && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          color: '#666' 
        }}>
          暂无数据
        </div>
      )}
    </div>
  );
};

/**
 * Format group title based on group key
 */
function formatGroupTitle(groupKey: string): string {
  const titleMap: { [key: string]: string } = {
    'characters': '角色',
    'synopsis_stages': '故事梗概',
    'selling_points': '产品卖点',
    'satisfaction_points': '情感爽点'
  };
  
  return titleMap[groupKey] || groupKey;
}

export default DynamicStreamingUI; 