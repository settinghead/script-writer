import React from 'react';
import { Row, Col, Alert, Button, Space } from 'antd';
import { ReloadOutlined, ExportOutlined } from '@ant-design/icons';
import { DynamicStreamingUI, outlineFieldRegistry } from './shared/streaming';

interface OutlineCharacter {
    name: string;
    type?: string;
    description: string;
    age?: string;
    gender?: string;
    occupation?: string;
    personality_traits?: string[];
    character_arc?: string;
    relationships?: { [key: string]: string };
    key_scenes?: string[];
}

interface DynamicOutlineResultsProps {
    sessionId: string;
    components: {
        title?: string;
        genre?: string;
        target_audience?: {
            demographic?: string;
            core_themes?: string[];
        };
        selling_points?: string;
        satisfaction_points?: string[];
        setting?: string;
        synopsis?: string;
        synopsis_stages?: string[];
        characters?: OutlineCharacter[];
    };
    status: 'active' | 'completed' | 'failed';
    isStreaming?: boolean;
    isConnecting?: boolean;
    onStopStreaming?: () => void;
    onComponentUpdate?: (componentType: string, newValue: string, newArtifactId: string) => void;
    onRegenerate?: () => void;
    onExport?: () => void;
    // New props for real-time streaming
    streamingItems?: any[];
}

export const DynamicOutlineResults: React.FC<DynamicOutlineResultsProps> = ({
    sessionId,
    components,
    status,
    isStreaming = false,
    isConnecting = false,
    onStopStreaming,
    onComponentUpdate,
    onRegenerate,
    onExport,
    streamingItems = []
}) => {
    // Determine streaming status
    const streamingStatus = isConnecting ? 'idle' : isStreaming ? 'streaming' : 'completed';

    // Handle field edit
    const handleFieldEdit = async (path: string, value: any) => {
        console.log('Field edit requested:', path, value);
        
        if (onComponentUpdate) {
            try {
                // Convert path to component type
                const componentType = pathToComponentType(path);
                const newArtifactId = `artifact-${Date.now()}`;
                
                await onComponentUpdate(componentType, value, newArtifactId);
            } catch (error) {
                console.error('Error updating component:', error);
            }
        }
    };

    // Convert JSON path to component type for backend
    const pathToComponentType = (path: string): string => {
        if (path === 'title') return 'title';
        if (path === 'genre') return 'genre';
        if (path.startsWith('target_audience')) return 'target_audience';
        if (path === 'selling_points') return 'selling_points';
        if (path === 'satisfaction_points') return 'satisfaction_points';
        if (path.startsWith('setting')) return 'setting';
        if (path === 'synopsis') return 'synopsis';
        if (path === 'synopsis_stages') return 'synopsis_stages';
        if (path.startsWith('characters')) return 'characters';
        return 'unknown';
    };

    // Transform components data for streaming
    const streamingData = React.useMemo(() => {
        // Use real-time streaming items if available and streaming
        if (isStreaming && streamingItems.length > 0) {
            return streamingItems;
        }
        
        // Otherwise use components data
        if (!components) return [];
        
        // Convert the components object into a format that matches the streaming structure
        const transformedData = {
            ...components,
            // Convert selling_points from string to array if needed
            selling_points: typeof components.selling_points === 'string' 
                ? components.selling_points.split('\n').filter(p => p.trim())
                : components.selling_points,
            // Ensure other arrays are properly formatted
            satisfaction_points: components.satisfaction_points || [],
            synopsis_stages: components.synopsis_stages || [],
            characters: components.characters || []
        };
        
        return [transformedData];
    }, [components, streamingItems, isStreaming]);

    const getCompletedComponentsCount = () => {
        let count = 0;
        if (components.title) count++;
        if (components.genre) count++;
        if (components.target_audience) count++;
        if (components.selling_points) count++;
        if (components.satisfaction_points && components.satisfaction_points.length > 0) count++;
        if (components.setting) count++;
        if (components.synopsis) count++;
        if (components.synopsis_stages && components.synopsis_stages.length > 0) count++;
        if (components.characters && components.characters.length > 0) count++;
        return count;
    };

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Status */}
            {status === 'failed' && (
                <Alert
                    message="生成失败"
                    description="大纲生成过程中出现错误，请重新生成。"
                    type="error"
                    showIcon
                    style={{
                        backgroundColor: '#2d1b1b',
                        border: '1px solid #d32f2f',
                        color: '#fff'
                    }}
                />
            )}

            {/* Action Buttons */}
            <Row gutter={[16, 16]}>
                <Col>
                    <Button
                        type="default"
                        icon={<ReloadOutlined />}
                        onClick={onRegenerate}
                        disabled={isStreaming}
                        style={{
                            background: '#434343',
                            borderColor: '#434343',
                            color: '#d9d9d9'
                        }}
                    >
                        重新生成
                    </Button>
                </Col>
                <Col>
                    <Button
                        type="default"
                        icon={<ExportOutlined />}
                        onClick={onExport}
                        disabled={!components || Object.keys(components).length === 0}
                        style={{
                            background: '#434343',
                            borderColor: '#434343',
                            color: '#d9d9d9'
                        }}
                    >
                        导出大纲
                    </Button>
                </Col>
            </Row>

            {/* Dynamic streaming UI */}
            <DynamicStreamingUI
                fieldRegistry={outlineFieldRegistry}
                streamingData={streamingData}
                streamingStatus={streamingStatus}
                onStopStreaming={onStopStreaming}
                onFieldEdit={handleFieldEdit}
                className="outline-results"
            />

            {/* Empty state */}
            {!components || Object.keys(components).length === 0 ? (
                <div style={{ 
                    textAlign: 'center', 
                    padding: '40px', 
                    color: '#666',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #303030',
                    borderRadius: '8px'
                }}>
                    {isStreaming ? '正在生成大纲...' : '暂无大纲数据'}
                </div>
            ) : null}
        </Space>
    );
};

export default DynamicOutlineResults; 