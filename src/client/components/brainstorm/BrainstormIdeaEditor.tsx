import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography, Spin, Card, Tag } from 'antd';
import { EyeOutlined, CheckOutlined, FileTextOutlined } from '@ant-design/icons';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { ArtifactEditor } from '../shared/ArtifactEditor';
import { BRAINSTORM_IDEA_FIELDS } from '../shared/fieldConfigs';

const { Text } = Typography;

export const BrainstormIdeaEditor: React.FC<{
    artifactId: string;
    artifactPath: string;
    originalCollectionId: string;
    index: number;
    isSelected: boolean;
    ideaOutlines: any[];
    onIdeaClick: (collectionId: string, index: number) => void;
}> = ({ artifactId, artifactPath, originalCollectionId, index, isSelected, ideaOutlines, onIdeaClick, }) => {
    const [showSavedCheckmark, setShowSavedCheckmark] = useState(false);
    const projectData = useProjectData();

    // Determine the correct transform name based on artifact type and path
    const artifact = projectData.getArtifactById(artifactId);

    // For standalone brainstorm ideas (path '$'), use edit_brainstorm_idea
    // For collection ideas (path like '$.ideas[0]'), use edit_brainstorm_collection_idea
    const transformName = artifactPath === '$' ? 'edit_brainstorm_idea' : 'edit_brainstorm_collection_idea';

    // Check if this is a derived artifact (has been edited)
    const hasBeenEdited = artifact?.type === 'user_input' || artifact?.isEditable || false;

    // Handle successful save - show checkmark briefly
    const handleSaveSuccess = useCallback(() => {
        setShowSavedCheckmark(true);
        setTimeout(() => {
            setShowSavedCheckmark(false);
        }, 2000); // Show checkmark for 2 seconds
    }, []);

    return (
        <Card
            key={`${artifactId}-${index}`}
            style={{
                backgroundColor: isSelected ? '#2d3436' : '#262626',
                border: isSelected ? '1px solid #1890ff' : '1px solid #434343',
                transition: 'all 0.2s ease',
                animation: 'fadeIn 0.3s ease-out',
                position: 'relative'
            }}
            styles={{ body: { padding: '12px' } }}
            hoverable={!isSelected}
            onMouseEnter={(e) => {
                if (!isSelected) {
                    e.currentTarget.style.borderColor = '#1890ff';
                    e.currentTarget.style.backgroundColor = '#2d3436';
                }
            }}
            onMouseLeave={(e) => {
                if (!isSelected) {
                    e.currentTarget.style.borderColor = '#434343';
                    e.currentTarget.style.backgroundColor = '#262626';
                }
            }}
            onClick={() => onIdeaClick(originalCollectionId, index)}
        >
            {/* Saved checkmark overlay */}
            {showSavedCheckmark && (
                <div
                    style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        zIndex: 10,
                        background: '#52c41a',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'fadeInOut 2s ease-in-out'
                    }}
                >
                    <CheckOutlined style={{ color: 'white', fontSize: '12px' }} />
                </div>
            )}

            {/* Idea content using ArtifactEditor */}
            <ArtifactEditor
                artifactId={artifactId}
                path={artifactPath}
                fields={BRAINSTORM_IDEA_FIELDS}
                statusLabel={hasBeenEdited ? "📝 已编辑版本" : "AI生成"}
                statusColor={hasBeenEdited ? "#52c41a" : "#1890ff"}
                transformName={transformName}
                onSaveSuccess={handleSaveSuccess}
            />


            {/* Generate outline button */}
            <GenerateOutlineButton artifactId={artifactId} />

            {/* Associated outlines */}
            <IdeaOutlines
                ideaId={artifactId}
                outlines={ideaOutlines}
                isLoading={false}
            />
        </Card>
    );
};


// Component to check for human transforms and show outline generation button
const GenerateOutlineButton: React.FC<{
    artifactId: string;
}> = ({ artifactId }) => {
    const projectData = useProjectData();

    // Check if the artifact has been edited (has human source transform)
    const artifact = projectData.getArtifactById(artifactId);
    const hasEditTransform = artifact?.isEditable || false;

    const handleGenerateOutline = () => {
        alert('not implemented');
    };

    // Only show button if user has edited the idea
    if (!hasEditTransform) {
        return null;
    }

    return (
        <>
            <Button
                type="primary"
                size="small"
                icon={<FileTextOutlined />}
                onClick={handleGenerateOutline}
                style={{
                    marginTop: '12px',
                    marginBottom: '12px',
                    background: 'linear-gradient(100deg, #40a9ff, rgb(22, 106, 184))',
                    border: 'none',
                    borderRadius: '4px',
                    padding: "20px 20px",
                    fontSize: "18px"
                }}
            >
                用这个灵感继续 &gt;&gt;
            </Button>
            （生成叙事大纲）
        </>
    );
};

// Component to display associated outlines for an idea
const IdeaOutlines: React.FC<{
    ideaId: string;
    outlines: any[];
    isLoading: boolean;
}> = ({ ideaId, outlines, isLoading }) => {
    const navigate = useNavigate();

    if (isLoading) {
        return (
            <div style={{ padding: '8px', textAlign: 'center' }}>
                <Spin size="small" />
                <Text type="secondary" style={{ marginLeft: '8px', fontSize: '12px' }}>
                    加载关联大纲...
                </Text>
            </div>
        );
    }

    if (outlines.length === 0) {
        return (
            <></>
        );
    }

    return (
        <div style={{ padding: '8px' }}>
            <Text style={{ fontSize: '12px', fontWeight: 'bold', color: '#d9d9d9' }}>
                关联大纲 ({outlines.length})
            </Text>
            <div style={{ marginTop: '4px' }}>
                {outlines.map((outline, index) => (
                    <div
                        key={outline.sessionId}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 8px',
                            marginBottom: '4px',
                            background: '#262626',
                            borderRadius: '4px',
                            border: '1px solid #434343'
                        }}
                    >
                        <div style={{ flex: 1 }}>
                            <Text style={{ fontSize: '12px', color: '#d9d9d9' }}>
                                {outline.title || '未命名大纲'}
                            </Text>
                            {outline.genre && (
                                <Tag style={{ marginLeft: '4px', fontSize: '10px', padding: '0 4px', height: '18px', lineHeight: '16px' }}>
                                    {outline.genre}
                                </Tag>
                            )}
                            {outline.status && (
                                <Tag
                                    color={outline.status === 'completed' ? 'green' : outline.status === 'failed' ? 'red' : 'blue'}
                                    style={{ marginLeft: '4px', fontSize: '10px', padding: '0 4px', height: '18px', lineHeight: '16px' }}
                                >
                                    {outline.status === 'completed' ? '已完成' :
                                        outline.status === 'failed' ? '失败' : '进行中'}
                                </Tag>
                            )}
                        </div>
                        <Button
                            size="small"
                            type="text"
                            icon={<EyeOutlined />}
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent event bubbling to parent card
                                navigate(`/projects/${outline.sessionId}/outline`);
                            }}
                            style={{ color: '#1890ff', fontSize: '12px' }}
                        >
                            查看
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
};
