import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Alert, Button, Card, Typography, Space } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, ExclamationCircleOutlined, ExportOutlined } from '@ant-design/icons';
import { EditableTextField } from './shared';
import { TopProgressBar } from './shared/TopProgressBar';
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

// Enhanced stage structure interface
interface OutlineSynopsisStage {
    stageSynopsis: string;
    numberOfEpisodes: number;
    // Option A: Temporal Constraints
    timeframe?: string;
    startingCondition: string;
    endingCondition: string;
    // Option B: Event-Based Stage Boundaries
    stageStartEvent: string;
    stageEndEvent: string;
    keyMilestones: string[];
    // Option C: Relationship Progression Levels
    relationshipLevel: string;
    emotionalArc: string;
    externalPressure: string;
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
        synopsis_stages?: OutlineSynopsisStage[];
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
    activeSection?: string; // Add activeSection prop for scroll-to functionality
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
    createdAt,
    activeSection
}) => {
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [isExportModalVisible, setIsExportModalVisible] = useState(false);
    const [exportText, setExportText] = useState('');

    // Refs for each section to enable scrolling
    const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    // Scroll to active section when activeSection changes
    useEffect(() => {
        if (activeSection && sectionRefs.current[activeSection]) {
            sectionRefs.current[activeSection]?.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }, [activeSection]);

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
        <div className={isStreaming ? 'outline-generating' : ''} style={{ width: '100%' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Streaming Progress */}
            {(isStreaming || isConnecting) && (
                <TopProgressBar
                    isVisible={true}
                    isStreaming={isStreaming}
                    isConnecting={isConnecting}
                    currentCount={getCompletedComponentsCount()}
                    totalCount={9} // Total outline components (title, genre, target_audience, selling_points, satisfaction_points, setting, synopsis, synopsis_stages, characters)
                    itemLabel="大纲组件"
                    onStop={onStopStreaming || (() => { })}
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
                    <div ref={el => sectionRefs.current['title'] = el}>
                        <EditableTextField
                            value={components.title || ''}
                            artifactId={`outline_title_${sessionId}`}
                            artifactType="outline_title"
                            onChange={(newValue, newArtifactId) => handleFieldEdit('title', newValue, newArtifactId)}
                            placeholder="剧本标题将在这里显示..."
                            label="剧本标题"
                            className="text-lg font-semibold"
                        />
                    </div>
                </Col>

                {/* Genre */}
                <Col xs={24} lg={12}>
                    <div ref={el => sectionRefs.current['genre'] = el}>
                        <EditableTextField
                            value={components.genre || ''}
                            artifactId={`outline_genre_${sessionId}`}
                            artifactType="outline_genre"
                            onChange={(newValue, newArtifactId) => handleFieldEdit('genre', newValue, newArtifactId)}
                            placeholder="剧本类型将在这里显示..."
                            label="剧本类型"
                        />
                    </div>
                </Col>

                {/* Target Audience */}
                <Col xs={24} lg={12}>
                    <div ref={el => sectionRefs.current['target-audience'] = el}>
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
                    </div>
                </Col>

                {/* Selling Points */}
                <Col xs={24} lg={12}>
                    <div ref={el => sectionRefs.current['selling-points'] = el}>
                        <EditableTextField
                            value={components.selling_points || ''}
                            artifactId={`outline_selling_points_${sessionId}`}
                            artifactType="outline_selling_points"
                            onChange={(newValue, newArtifactId) => handleFieldEdit('selling_points', newValue, newArtifactId)}
                            placeholder="产品卖点将在这里显示..."
                            label="产品卖点"
                            multiline
                        />
                    </div>
                </Col>

                {/* Satisfaction Points */}
                <Col xs={24} lg={12}>
                    <div ref={el => sectionRefs.current['satisfaction-points'] = el}>
                        <EditableTextField
                            value={components.satisfaction_points ? components.satisfaction_points.join('\n') : ''}
                            artifactId={`outline_satisfaction_points_${sessionId}`}
                            artifactType="outline_satisfaction_points"
                            onChange={(newValue, newArtifactId) => handleFieldEdit('satisfaction_points', newValue, newArtifactId)}
                            placeholder="情感爽点将在这里显示..."
                            label="情感爽点"
                            multiline
                        />
                    </div>
                </Col>

                {/* Setting */}
                <Col span={24}>
                    <div ref={el => sectionRefs.current['setting'] = el}>
                        <EditableTextField
                            value={components.setting || ''}
                            artifactId={`outline_setting_${sessionId}`}
                            artifactType="outline_setting"
                            onChange={(newValue, newArtifactId) => handleFieldEdit('setting', newValue, newArtifactId)}
                            placeholder="故事设定将在这里显示..."
                            label="故事设定"
                            multiline
                        />
                    </div>
                </Col>  {/* Characters */}
                <Col span={24}>
                    <div ref={el => sectionRefs.current['characters'] = el}>
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


                {/* Synopsis Stages - Dynamic Streaming */}
                <Col span={24}>
                    <div ref={el => sectionRefs.current['synopsis-stages'] = el}>
                        <Text strong style={{ color: '#fff', marginBottom: '12px', display: 'block' }}>
                            分段故事梗概（约2000字）
                        </Text>

                        {/* 🔥 NEW: Use dynamic streaming field component for progressive rendering */}
                        <div id="stages-field-container">
                            {/* This will be populated by the dynamic field registry during streaming */}
                            {/* 🔥 FIX: Try stages field first, fallback to synopsis_stages */}
                            {((components as any).stages || components.synopsis_stages) && ((components as any).stages || components.synopsis_stages).length > 0 ? (
                                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                                    {((components as any).stages || components.synopsis_stages).map((stage, index) => {
                                        // 🔥 FIX: Transform string stages to object format
                                        const normalizedStage = typeof stage === 'string' 
                                            ? { 
                                                stageSynopsis: stage,
                                                numberOfEpisodes: Math.ceil((totalEpisodes || 60) / ((components as any).stages || components.synopsis_stages).length), // Distribute evenly
                                                startingCondition: '',
                                                endingCondition: '',
                                                stageStartEvent: '',
                                                stageEndEvent: '',
                                                keyMilestones: [],
                                                relationshipLevel: '',
                                                emotionalArc: '',
                                                externalPressure: ''
                                              }
                                            : stage;
                                        
                                        console.log(`🔍 [DEBUG] OutlineResults Stage ${index + 1}:`, {
                                            originalStage: stage,
                                            isString: typeof stage === 'string',
                                            normalizedStage: normalizedStage,
                                            numberOfEpisodes: normalizedStage.numberOfEpisodes,
                                            hasNumberOfEpisodes: normalizedStage.hasOwnProperty('numberOfEpisodes')
                                        });
                                        return (
                                        <Card
                                            key={index}
                                            title={`第${index + 1}阶段 (${normalizedStage.numberOfEpisodes || '未定'}集)`}
                                            size="small"
                                            style={{
                                                backgroundColor: '#1f1f1f',
                                                border: '1px solid #404040'
                                            }}
                                            headStyle={{
                                                backgroundColor: '#2a2a2a',
                                                borderBottom: '1px solid #404040',
                                                color: '#fff'
                                            }}
                                            bodyStyle={{ backgroundColor: '#1f1f1f', padding: '16px' }}
                                        >
                                            {/* Stage Synopsis */}
                                            <div style={{ marginBottom: '16px' }}>
                                                <EditableTextField
                                                    value={normalizedStage.stageSynopsis}
                                                    artifactId={`stage_synopsis_${sessionId}_${index}`}
                                                    artifactType="stage_synopsis"
                                                    onChange={(newValue, newArtifactId) => {
                                                        const updatedStages = [...(((components as any).stages || components.synopsis_stages) || [])];
                                                        updatedStages[index] = { ...normalizedStage, stageSynopsis: newValue };
                                                        handleFieldEdit('synopsis_stages', JSON.stringify(updatedStages), newArtifactId);
                                                    }}
                                                    placeholder="阶段梗概..."
                                                    label="阶段梗概"
                                                    multiline
                                                    size="small"
                                                />
                                            </div>

                                            {/* Temporal Constraints (Option A) */}
                                            <Row gutter={[12, 12]} style={{ marginBottom: '16px' }}>
                                                <Col span={24}>
                                                    <Text strong style={{ color: '#4CAF50', fontSize: '13px' }}>
                                                        ⏰ 时间约束
                                                    </Text>
                                                </Col>
                                                <Col xs={24} lg={8}>
                                                    <EditableTextField
                                                        value={stage.timeframe || ''}
                                                        artifactId={`stage_timeframe_${sessionId}_${index}`}
                                                        artifactType="stage_timeframe"
                                                        onChange={(newValue, newArtifactId) => {
                                                            const updatedStages = [...(components.synopsis_stages || [])];
                                                            updatedStages[index] = { ...stage, timeframe: newValue };
                                                            handleFieldEdit('synopsis_stages', JSON.stringify(updatedStages), newArtifactId);
                                                        }}
                                                        placeholder="时间跨度..."
                                                        label="时间跨度"
                                                        size="small"
                                                    />
                                                </Col>
                                                <Col xs={24} lg={8}>
                                                    <EditableTextField
                                                        value={stage.startingCondition}
                                                        artifactId={`stage_start_condition_${sessionId}_${index}`}
                                                        artifactType="stage_start_condition"
                                                        onChange={(newValue, newArtifactId) => {
                                                            const updatedStages = [...(components.synopsis_stages || [])];
                                                            updatedStages[index] = { ...stage, startingCondition: newValue };
                                                            handleFieldEdit('synopsis_stages', JSON.stringify(updatedStages), newArtifactId);
                                                        }}
                                                        placeholder="开始状态..."
                                                        label="开始状态"
                                                        size="small"
                                                    />
                                                </Col>
                                                <Col xs={24} lg={8}>
                                                    <EditableTextField
                                                        value={stage.endingCondition}
                                                        artifactId={`stage_end_condition_${sessionId}_${index}`}
                                                        artifactType="stage_end_condition"
                                                        onChange={(newValue, newArtifactId) => {
                                                            const updatedStages = [...(components.synopsis_stages || [])];
                                                            updatedStages[index] = { ...stage, endingCondition: newValue };
                                                            handleFieldEdit('synopsis_stages', JSON.stringify(updatedStages), newArtifactId);
                                                        }}
                                                        placeholder="结束状态..."
                                                        label="结束状态"
                                                        size="small"
                                                    />
                                                </Col>
                                            </Row>

                                            {/* Event Boundaries (Option B) */}
                                            <Row gutter={[12, 12]} style={{ marginBottom: '16px' }}>
                                                <Col span={24}>
                                                    <Text strong style={{ color: '#2196F3', fontSize: '13px' }}>
                                                        🎬 事件边界
                                                    </Text>
                                                </Col>
                                                <Col xs={24} lg={12}>
                                                    <EditableTextField
                                                        value={stage.stageStartEvent}
                                                        artifactId={`stage_start_event_${sessionId}_${index}`}
                                                        artifactType="stage_start_event"
                                                        onChange={(newValue, newArtifactId) => {
                                                            const updatedStages = [...(components.synopsis_stages || [])];
                                                            updatedStages[index] = { ...stage, stageStartEvent: newValue };
                                                            handleFieldEdit('synopsis_stages', JSON.stringify(updatedStages), newArtifactId);
                                                        }}
                                                        placeholder="起始事件..."
                                                        label="起始事件"
                                                        size="small"
                                                    />
                                                </Col>
                                                <Col xs={24} lg={12}>
                                                    <EditableTextField
                                                        value={stage.stageEndEvent}
                                                        artifactId={`stage_end_event_${sessionId}_${index}`}
                                                        artifactType="stage_end_event"
                                                        onChange={(newValue, newArtifactId) => {
                                                            const updatedStages = [...(components.synopsis_stages || [])];
                                                            updatedStages[index] = { ...stage, stageEndEvent: newValue };
                                                            handleFieldEdit('synopsis_stages', JSON.stringify(updatedStages), newArtifactId);
                                                        }}
                                                        placeholder="结束事件..."
                                                        label="结束事件"
                                                        size="small"
                                                    />
                                                </Col>
                                                <Col span={24}>
                                                    <EditableTextField
                                                        value={stage.keyMilestones ? stage.keyMilestones.join('\n') : ''}
                                                        artifactId={`stage_milestones_${sessionId}_${index}`}
                                                        artifactType="stage_milestones"
                                                        onChange={(newValue, newArtifactId) => {
                                                            const updatedStages = [...(components.synopsis_stages || [])];
                                                            updatedStages[index] = {
                                                                ...stage,
                                                                keyMilestones: newValue ? newValue.split('\n').map(m => m.trim()).filter(m => m) : []
                                                            };
                                                            handleFieldEdit('synopsis_stages', JSON.stringify(updatedStages), newArtifactId);
                                                        }}
                                                        placeholder="关键里程碑（每行一个）..."
                                                        label="关键里程碑"
                                                        multiline
                                                        size="small"
                                                    />
                                                </Col>
                                            </Row>

                                            {/* Relationship Progression (Option C) */}
                                            <Row gutter={[12, 12]}>
                                                <Col span={24}>
                                                    <Text strong style={{ color: '#FF9800', fontSize: '13px' }}>
                                                        💕 关系发展
                                                    </Text>
                                                </Col>
                                                <Col xs={24} lg={8}>
                                                    <EditableTextField
                                                        value={stage.relationshipLevel}
                                                        artifactId={`stage_relationship_${sessionId}_${index}`}
                                                        artifactType="stage_relationship"
                                                        onChange={(newValue, newArtifactId) => {
                                                            const updatedStages = [...(components.synopsis_stages || [])];
                                                            updatedStages[index] = { ...stage, relationshipLevel: newValue };
                                                            handleFieldEdit('synopsis_stages', JSON.stringify(updatedStages), newArtifactId);
                                                        }}
                                                        placeholder="关系变化..."
                                                        label="关系变化"
                                                        size="small"
                                                    />
                                                </Col>
                                                <Col xs={24} lg={8}>
                                                    <EditableTextField
                                                        value={stage.emotionalArc}
                                                        artifactId={`stage_emotion_${sessionId}_${index}`}
                                                        artifactType="stage_emotion"
                                                        onChange={(newValue, newArtifactId) => {
                                                            const updatedStages = [...(components.synopsis_stages || [])];
                                                            updatedStages[index] = { ...stage, emotionalArc: newValue };
                                                            handleFieldEdit('synopsis_stages', JSON.stringify(updatedStages), newArtifactId);
                                                        }}
                                                        placeholder="情感轨迹..."
                                                        label="情感轨迹"
                                                        size="small"
                                                    />
                                                </Col>
                                                <Col xs={24} lg={8}>
                                                    <EditableTextField
                                                        value={stage.externalPressure}
                                                        artifactId={`stage_pressure_${sessionId}_${index}`}
                                                        artifactType="stage_pressure"
                                                        onChange={(newValue, newArtifactId) => {
                                                            const updatedStages = [...(components.synopsis_stages || [])];
                                                            updatedStages[index] = { ...stage, externalPressure: newValue };
                                                            handleFieldEdit('synopsis_stages', JSON.stringify(updatedStages), newArtifactId);
                                                        }}
                                                        placeholder="外部压力..."
                                                        label="外部压力"
                                                        size="small"
                                                    />
                                                </Col>
                                            </Row>
                                        </Card>
                                        );
                                    })}
                                </Space>
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
                                    <Text type="secondary" style={{ color: '#888' }}>
                                        {isStreaming ? '分段故事梗概生成中...' : '分段故事梗概将在这里显示...'}
                                    </Text>
                                </Card>
                            )}
                        </div>
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
        </div>
    );
}; 