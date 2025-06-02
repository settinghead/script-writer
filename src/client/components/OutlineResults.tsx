import React, { useState } from 'react';
import { Row, Col, Alert, Button, Card, Typography, Space } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, ExclamationCircleOutlined, ExportOutlined } from '@ant-design/icons';
import { EditableTextField, StreamingProgress } from './shared';
import { OutlineExportModal } from './shared/OutlineExportModal';
import { apiService } from '../services/apiService';
import { formatOutlineForExport, type OutlineExportData } from '../utils/outlineExporter';

const { Title, Text } = Typography;

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

interface OutlineResultsProps {
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
    // Additional props needed for export
    sourceArtifact?: {
        text: string;
        title?: string;
        type: string;
    };
    totalEpisodes?: number;
    episodeDuration?: number;
    createdAt?: string;
}

export const OutlineResults: React.FC<OutlineResultsProps> = ({
    sessionId,
    components,
    status,
    isStreaming = false,
    isConnecting = false,
    onStopStreaming,
    onComponentUpdate,
    sourceArtifact,
    totalEpisodes,
    episodeDuration,
    createdAt
}) => {
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [isExportModalVisible, setIsExportModalVisible] = useState(false);
    const [exportText, setExportText] = useState('');

    const handleFieldEdit = async (fieldType: string, newValue: string, newArtifactId: string) => {
        try {
            // Create new user_input artifact and human transform
            await apiService.updateOutlineComponent(sessionId, fieldType, newValue);

            // Notify parent component
            onComponentUpdate?.(fieldType, newValue, newArtifactId);

        } catch (error) {
            console.error('Error updating outline component:', error);
            throw error; // Re-throw to be handled by EditableTextField
        }
    };

    const handleRegenerate = async () => {
        if (isStreaming || isRegenerating) return;

        setIsRegenerating(true);
        try {
            await apiService.regenerateOutline(sessionId);
            // The streaming should start automatically
        } catch (error) {
            console.error('Error regenerating outline:', error);
            setIsRegenerating(false);
        }
    };

    const handleExport = () => {
        // Prepare export data
        const exportData: OutlineExportData = {
            sessionId,
            sourceArtifact: sourceArtifact || {
                text: '',
                type: 'unknown'
            },
            totalEpisodes,
            episodeDuration,
            components,
            createdAt: createdAt || new Date().toISOString()
        };

        // Generate formatted text
        const formattedText = formatOutlineForExport(exportData);
        setExportText(formattedText);
        setIsExportModalVisible(true);
    };

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
            {/* Streaming Progress */}
            {(isStreaming || isConnecting) && (
                <StreamingProgress
                    isStreaming={isStreaming}
                    isConnecting={isConnecting}
                    onStop={onStopStreaming || (() => { })}
                    itemCount={getCompletedComponentsCount()}
                    itemLabel="大纲组件"
                />
            )}

            {/* Status */}
            {status === 'failed' && (
                <Alert
                    message="生成失败"
                    description="大纲生成过程中出现错误，请重新生成。"
                    type="error"
                    showIcon
                    icon={<ExclamationCircleOutlined />}
                    style={{
                        backgroundColor: '#2d1b1b',
                        border: '1px solid #d32f2f',
                        color: '#fff'
                    }}
                />
            )}

            {/* Results Grid */}
            <Row gutter={[16, 16]}>
                {/* Title */}
                <Col span={24}>
                    <EditableTextField
                        value={components.title || ''}
                        artifactId={`outline_title_${sessionId}`}
                        artifactType="outline_title"
                        onChange={(newValue, newArtifactId) => handleFieldEdit('title', newValue, newArtifactId)}
                        placeholder="剧本标题将在这里显示..."
                        label="剧本标题"
                        className="text-lg font-semibold"
                    />
                </Col>

                {/* Genre */}
                <Col xs={24} lg={12}>
                    <EditableTextField
                        value={components.genre || ''}
                        artifactId={`outline_genre_${sessionId}`}
                        artifactType="outline_genre"
                        onChange={(newValue, newArtifactId) => handleFieldEdit('genre', newValue, newArtifactId)}
                        placeholder="剧本类型将在这里显示..."
                        label="剧本类型"
                    />
                </Col>

                {/* Target Audience */}
                <Col xs={24} lg={12}>
                    <EditableTextField
                        value={components.target_audience ?
                            `受众群体：${components.target_audience.demographic || ''}\n核心主题：${(components.target_audience.core_themes || []).join('、')}`
                            : ''}
                        artifactId={`outline_target_audience_${sessionId}`}
                        artifactType="outline_target_audience"
                        onChange={(newValue, newArtifactId) => handleFieldEdit('target_audience', newValue, newArtifactId)}
                        placeholder="目标受众将在这里显示..."
                        label="目标受众"
                        multiline
                    />
                </Col>

                {/* Selling Points */}
                <Col xs={24} lg={12}>
                    <EditableTextField
                        value={components.selling_points || ''}
                        artifactId={`outline_selling_points_${sessionId}`}
                        artifactType="outline_selling_points"
                        onChange={(newValue, newArtifactId) => handleFieldEdit('selling_points', newValue, newArtifactId)}
                        placeholder="产品卖点将在这里显示..."
                        label="产品卖点"
                        multiline
                    />
                </Col>

                {/* Satisfaction Points */}
                <Col xs={24} lg={12}>
                    <EditableTextField
                        value={components.satisfaction_points ? components.satisfaction_points.join('\n') : ''}
                        artifactId={`outline_satisfaction_points_${sessionId}`}
                        artifactType="outline_satisfaction_points"
                        onChange={(newValue, newArtifactId) => handleFieldEdit('satisfaction_points', newValue, newArtifactId)}
                        placeholder="情感爽点将在这里显示..."
                        label="情感爽点"
                        multiline
                    />
                </Col>

                {/* Setting */}
                <Col span={24}>
                    <EditableTextField
                        value={components.setting || ''}
                        artifactId={`outline_setting_${sessionId}`}
                        artifactType="outline_setting"
                        onChange={(newValue, newArtifactId) => handleFieldEdit('setting', newValue, newArtifactId)}
                        placeholder="故事设定将在这里显示..."
                        label="故事设定"
                        multiline
                    />
                </Col>


                {/* Synopsis Stages */}
                <Col span={24}>
                    <EditableTextField
                        value={components.synopsis_stages ? components.synopsis_stages.join('\n\n') : ''}
                        artifactId={`outline_synopsis_stages_${sessionId}`}
                        artifactType="outline_synopsis_stages"
                        onChange={(newValue, newArtifactId) => handleFieldEdit('synopsis_stages', newValue, newArtifactId)}
                        placeholder="分段故事梗概将在这里显示..."
                        label="分段故事梗概（约2000字）"
                        multiline
                    />
                </Col>

                {/* Characters */}
                <Col span={24}>
                    <div>
                        <Text strong style={{ color: '#fff', marginBottom: '12px', display: 'block' }}>
                            角色设定
                        </Text>

                        {components.characters && components.characters.length > 0 ? (
                            <Row gutter={[16, 16]}>
                                {components.characters.map((character, index) => (
                                    <Col xs={24} md={12} key={index}>
                                        <Card
                                            size="small"
                                            style={{
                                                backgroundColor: '#1f1f1f',
                                                border: '1px solid #404040',
                                                height: '100%'
                                            }}
                                            bodyStyle={{ backgroundColor: '#1f1f1f', padding: '12px' }}
                                        >
                                            {/* Header: Name and Type */}
                                            <Row gutter={8} style={{ marginBottom: '8px' }}>
                                                <Col span={14}>
                                                    <EditableTextField
                                                        value={character.name}
                                                        artifactId={`character_name_${sessionId}_${index}`}
                                                        artifactType="character_name"
                                                        onChange={(newValue, newArtifactId) => {
                                                            const updatedCharacters = [...(components.characters || [])];
                                                            updatedCharacters[index] = { ...character, name: newValue };
                                                            handleFieldEdit('characters', JSON.stringify(updatedCharacters), newArtifactId);
                                                        }}
                                                        placeholder="角色姓名..."
                                                        label="姓名"
                                                        className="font-medium"
                                                        size="small"
                                                    />
                                                </Col>
                                                <Col span={10}>
                                                    <EditableTextField
                                                        value={character.type || ''}
                                                        artifactId={`character_type_${sessionId}_${index}`}
                                                        artifactType="character_type"
                                                        onChange={(newValue, newArtifactId) => {
                                                            const updatedCharacters = [...(components.characters || [])];
                                                            updatedCharacters[index] = { ...character, type: newValue };
                                                            handleFieldEdit('characters', JSON.stringify(updatedCharacters), newArtifactId);
                                                        }}
                                                        placeholder="类型..."
                                                        label="类型"
                                                        size="small"
                                                    />
                                                </Col>
                                            </Row>

                                            {/* Basic info row */}
                                            <Row gutter={6} style={{ marginBottom: '8px' }}>
                                                <Col span={8}>
                                                    <EditableTextField
                                                        value={character.age || ''}
                                                        artifactId={`character_age_${sessionId}_${index}`}
                                                        artifactType="character_age"
                                                        onChange={(newValue, newArtifactId) => {
                                                            const updatedCharacters = [...(components.characters || [])];
                                                            updatedCharacters[index] = { ...character, age: newValue };
                                                            handleFieldEdit('characters', JSON.stringify(updatedCharacters), newArtifactId);
                                                        }}
                                                        placeholder="年龄..."
                                                        label="年龄"
                                                        size="small"
                                                    />
                                                </Col>
                                                <Col span={8}>
                                                    <EditableTextField
                                                        value={character.gender || ''}
                                                        artifactId={`character_gender_${sessionId}_${index}`}
                                                        artifactType="character_gender"
                                                        onChange={(newValue, newArtifactId) => {
                                                            const updatedCharacters = [...(components.characters || [])];
                                                            updatedCharacters[index] = { ...character, gender: newValue };
                                                            handleFieldEdit('characters', JSON.stringify(updatedCharacters), newArtifactId);
                                                        }}
                                                        placeholder="性别..."
                                                        label="性别"
                                                        size="small"
                                                    />
                                                </Col>
                                                <Col span={8}>
                                                    <EditableTextField
                                                        value={character.occupation || ''}
                                                        artifactId={`character_occupation_${sessionId}_${index}`}
                                                        artifactType="character_occupation"
                                                        onChange={(newValue, newArtifactId) => {
                                                            const updatedCharacters = [...(components.characters || [])];
                                                            updatedCharacters[index] = { ...character, occupation: newValue };
                                                            handleFieldEdit('characters', JSON.stringify(updatedCharacters), newArtifactId);
                                                        }}
                                                        placeholder="职业..."
                                                        label="职业"
                                                        size="small"
                                                    />
                                                </Col>
                                            </Row>

                                            {/* Description */}
                                            <div style={{ marginBottom: '8px' }}>
                                                <EditableTextField
                                                    value={character.description}
                                                    artifactId={`character_desc_${sessionId}_${index}`}
                                                    artifactType="character_description"
                                                    onChange={(newValue, newArtifactId) => {
                                                        const updatedCharacters = [...(components.characters || [])];
                                                        updatedCharacters[index] = { ...character, description: newValue };
                                                        handleFieldEdit('characters', JSON.stringify(updatedCharacters), newArtifactId);
                                                    }}
                                                    placeholder="角色描述..."
                                                    label="描述"
                                                    multiline
                                                    size="small"
                                                />
                                            </div>

                                            {/* Personality Traits */}
                                            <div style={{ marginBottom: '8px' }}>
                                                <EditableTextField
                                                    value={character.personality_traits ? character.personality_traits.join('、') : ''}
                                                    artifactId={`character_traits_${sessionId}_${index}`}
                                                    artifactType="character_traits"
                                                    onChange={(newValue, newArtifactId) => {
                                                        const updatedCharacters = [...(components.characters || [])];
                                                        updatedCharacters[index] = {
                                                            ...character,
                                                            personality_traits: newValue ? newValue.split('、').map(t => t.trim()) : undefined
                                                        };
                                                        handleFieldEdit('characters', JSON.stringify(updatedCharacters), newArtifactId);
                                                    }}
                                                    placeholder="性格特点（用、分隔）..."
                                                    label="性格特点"
                                                    size="small"
                                                />
                                            </div>

                                            {/* Character Arc */}
                                            <div>
                                                <EditableTextField
                                                    value={character.character_arc || ''}
                                                    artifactId={`character_arc_${sessionId}_${index}`}
                                                    artifactType="character_arc"
                                                    onChange={(newValue, newArtifactId) => {
                                                        const updatedCharacters = [...(components.characters || [])];
                                                        updatedCharacters[index] = { ...character, character_arc: newValue };
                                                        handleFieldEdit('characters', JSON.stringify(updatedCharacters), newArtifactId);
                                                    }}
                                                    placeholder="人物成长轨迹..."
                                                    label="成长轨迹"
                                                    multiline
                                                    size="small"
                                                />
                                            </div>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        ) : (
                            <Card
                                style={{
                                    textAlign: 'center',
                                    padding: '24px 20px',
                                    backgroundColor: '#1f1f1f',
                                    border: '1px solid #404040'
                                }}
                                bodyStyle={{ backgroundColor: '#1f1f1f' }}
                            >
                                <Text type="secondary" style={{ color: '#888' }}>角色设定将在这里显示...</Text>
                            </Card>
                        )}
                    </div>
                </Col>
            </Row>

            {/* Actions */}
            {status === 'completed' && (
                <div style={{ textAlign: 'right', paddingTop: '20px', borderTop: '1px solid #303030' }}>
                    <Space>
                        <Button
                            onClick={handleExport}
                            icon={<ExportOutlined />}
                            type="default"
                        >
                            导出大纲
                        </Button>
                        <Button
                            onClick={handleRegenerate}
                            disabled={isRegenerating || isStreaming}
                            loading={isRegenerating}
                            icon={<ReloadOutlined />}
                            type="default"
                        >
                            {isRegenerating ? '重新生成中...' : '重新生成大纲'}
                        </Button>
                    </Space>
                </div>
            )}

            {/* Progress Info */}
            {status === 'completed' && !isStreaming && (
                <Alert
                    message="大纲生成完成"
                    description="所有内容都可以点击进行编辑。每次编辑都会保存完整的修改历史。"
                    type="success"
                    showIcon
                    icon={<CheckCircleOutlined />}
                    style={{
                        backgroundColor: '#1b2d1b',
                        border: '1px solid #4caf50',
                        color: '#fff'
                    }}
                />
            )}

            {/* Export Modal */}
            <OutlineExportModal
                visible={isExportModalVisible}
                onClose={() => setIsExportModalVisible(false)}
                exportText={exportText}
                title="导出大纲"
            />
        </Space>
    );
}; 