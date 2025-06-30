import React from 'react';
import { Card, Typography } from 'antd';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { getArtifactAtPath } from '../../../common/utils/lineageResolution';

const { Text } = Typography;

export const BrainstormIdeaEditor: React.FC<{
    artifactId: string;
    artifactPath: string;
    originalCollectionId: string;
    index: number;
    isSelected: boolean;
    isChosen: boolean;
    ideaOutlines: any[];
    onIdeaClick: (collectionId: string, index: number) => void;
}> = ({ artifactId, artifactPath, originalCollectionId, index, isSelected, isChosen, ideaOutlines, onIdeaClick }) => {
    const projectData = useProjectData();

    // Get the artifact data to display
    const artifact = projectData.getArtifactById(artifactId);
    let ideaData: any = null;

    if (artifact) {
        try {
            const parsedData = JSON.parse(artifact.data);
            ideaData = artifactPath === '$' ? parsedData : getArtifactAtPath(artifact, artifactPath);
        } catch (error) {
            console.warn('Failed to parse artifact data:', error);
        }
    }

    // Don't render anything if we don't have data
    if (!ideaData) {
        return null;
    }

    const title = ideaData.title || `创意 ${index + 1}`;
    const body = ideaData.body || '';

    // Check if this is a derived artifact (has been edited)
    const hasBeenEdited = artifact?.origin_type === 'user_input' || artifact?.isEditable || false;

    return (
        <Card
            key={`${artifactId}-${index}`}
            style={{
                backgroundColor: isChosen ? '#2d3f2d' : (isSelected ? '#2d3436' : '#262626'),
                border: isChosen ? '2px solid #52c41a' : (isSelected ? '1px solid #1890ff' : '1px solid #434343'),
                transition: 'all 0.2s ease',
                animation: 'fadeIn 0.3s ease-out',
                position: 'relative',
                opacity: isChosen ? 1 : 0.8
            }}
            styles={{ body: { padding: '12px' } }}
            hoverable={!isSelected && !isChosen}
            onMouseEnter={(e) => {
                if (!isSelected && !isChosen) {
                    e.currentTarget.style.borderColor = '#1890ff';
                    e.currentTarget.style.backgroundColor = '#2d3436';
                }
            }}
            onMouseLeave={(e) => {
                if (!isSelected && !isChosen) {
                    e.currentTarget.style.borderColor = '#434343';
                    e.currentTarget.style.backgroundColor = '#262626';
                }
            }}
            onClick={() => !isChosen && onIdeaClick(originalCollectionId, index)}
        >
            {/* Status indicator */}
            <div style={{ marginBottom: '8px' }}>
                <Text style={{
                    fontSize: '10px',
                    color: isChosen ? '#52c41a' : (hasBeenEdited ? '#52c41a' : '#1890ff'),
                    fontWeight: 'bold'
                }}>
                    {isChosen ? '✏️ 正在编辑' : (hasBeenEdited ? '📝 已编辑版本' : 'AI生成')}
                </Text>
            </div>

            {/* Idea content */}
            <div style={{ marginBottom: '8px' }}>
                <div style={{ marginBottom: '4px' }}>
                    <Text style={{
                        fontSize: '12px',
                        color: '#d9d9d9',
                        fontWeight: 'bold',
                        opacity: isChosen ? 0.6 : 1
                    }}>
                        {title}
                    </Text>
                </div>
                <div>
                    <Text style={{
                        fontSize: '11px',
                        color: '#b0b0b0',
                        lineHeight: '1.4',
                        opacity: isChosen ? 0.6 : 1
                    }}>
                        {body.length > 150 ? `${body.substring(0, 150)}...` : body}
                    </Text>
                </div>
            </div>

            {/* Click hint for non-chosen ideas */}
            {!isChosen && (
                <div style={{
                    textAlign: 'center',
                    paddingTop: '8px',
                    borderTop: '1px solid #434343'
                }}>
                    <Text style={{
                        fontSize: '10px',
                        color: '#888',
                        fontStyle: 'italic'
                    }}>
                        点击编辑
                    </Text>
                </div>
            )}

            {/* Chosen idea indicator */}
            {isChosen && (
                <div style={{
                    textAlign: 'center',
                    paddingTop: '8px',
                    borderTop: '1px solid #52c41a'
                }}>
                    <Text style={{
                        fontSize: '10px',
                        color: '#52c41a',
                        fontWeight: 'bold'
                    }}>
                        已选中进行编辑
                    </Text>
                </div>
            )}
        </Card>
    );
};
