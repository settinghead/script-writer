import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Space } from 'antd';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { YJSTextField, YJSTextAreaField } from '../../transform-artifact-framework/components/YJSField';
import { SectionWrapper, ArtifactSchemaType, ArtifactDisplayWrapper } from '../shared';

const { Text } = Typography;

interface SingleBrainstormIdeaEditorProps {
    onViewOriginalIdeas?: () => void;
    isEditable?: boolean; // Global editability state from computation system
    currentStage?: string; // Current workflow stage
    brainstormIdea?: any; // The artifact to display
    mode?: 'editable' | 'readonly'; // Display mode
}

/**
 * YJS-enabled editable form component for brainstorm ideas
 * This component is designed to be used within a YJSArtifactProvider
 */
const EditableBrainstormForm: React.FC = () => {
    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
                <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '8px' }}>
                    创意标题
                </Text>
                <YJSTextField
                    path="title"
                    placeholder="输入创意标题..."
                />
            </div>

            <div>
                <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '8px' }}>
                    创意内容
                </Text>
                <YJSTextAreaField
                    path="body"
                    placeholder="详细描述你的创意想法..."
                    rows={6}
                />
            </div>
        </Space>
    );
};

export const SingleBrainstormIdeaEditor: React.FC<SingleBrainstormIdeaEditorProps> = ({
    onViewOriginalIdeas,
    isEditable: propsIsEditable,
    currentStage = 'idea_editing',
    brainstormIdea: propsBrainstormIdea,
    mode: propsMode
}) => {
    const { projectId } = useParams<{ projectId: string }>();
    const projectData = useProjectData();

    // If we have props from actionComputation, use them directly
    if (propsBrainstormIdea) {
        const isEditable = propsIsEditable ?? false;
        const effectiveArtifact = propsBrainstormIdea;

        return (
            <SectionWrapper
                schemaType={ArtifactSchemaType.BRAINSTORM_ITEM}
                title="初始创意"
                sectionId="ideation-edit"
                artifactId={effectiveArtifact?.id}
            >
                <div style={{ marginTop: '24px', position: 'relative' }}>
                    <ArtifactDisplayWrapper
                        artifact={effectiveArtifact}
                        isEditable={isEditable}
                        title="选中的创意"
                        icon="💡"
                        editableComponent={EditableBrainstormForm}
                        schemaType="brainstorm_item_schema"
                        enableClickToEdit={true}
                    />
                </div>
            </SectionWrapper>
        );
    }

    // Fallback: Find the latest brainstorm idea artifact from project data
    const latestBrainstormIdea = useMemo(() => {
        // Check if data is ready
        if (projectData.artifacts === "pending" || projectData.artifacts === "error") {
            return null;
        }

        // Get all brainstorm idea artifacts (both user_input and ai_generated)
        const brainstormIdeaArtifacts = projectData.artifacts.filter(artifact =>
            artifact.schema_type === 'brainstorm_item_schema' || artifact.type === 'brainstorm_item_schema' ||
            artifact.schema_type === 'brainstorm_idea' || artifact.type === 'brainstorm_idea'
        );

        if (brainstormIdeaArtifacts.length === 0) {
            return null;
        }

        // Sort by creation time to find the latest
        brainstormIdeaArtifacts.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return brainstormIdeaArtifacts[0];
    }, [projectData.artifacts]);

    // Determine editability for fallback mode
    const isEditable = useMemo(() => {
        if (!latestBrainstormIdea || currentStage !== 'idea_editing') return false;

        // Check if this artifact has descendants (is used as input in any transform)
        if (projectData.transformInputs === "pending" || projectData.transformInputs === "error") {
            return false;
        }

        const transformInputs = projectData.transformInputs as any[];
        const hasDescendants = transformInputs.some(input =>
            input.artifact_id === latestBrainstormIdea.id
        );

        // Only editable if it's user_input and has no descendants
        return latestBrainstormIdea.origin_type === 'user_input' && !hasDescendants && (propsIsEditable ?? true);
    }, [latestBrainstormIdea, currentStage, projectData.transformInputs, propsIsEditable]);

    return (
        <SectionWrapper
            schemaType={ArtifactSchemaType.BRAINSTORM_ITEM}
            title="初始创意"
            sectionId="ideation-edit"
            artifactId={latestBrainstormIdea?.id}
        >
            <div style={{ marginTop: '24px', position: 'relative' }}>
                <ArtifactDisplayWrapper
                    artifact={latestBrainstormIdea}
                    isEditable={isEditable}
                    title="当前创意"
                    icon="💡"
                    editableComponent={EditableBrainstormForm}
                    schemaType="brainstorm_item_schema"
                    enableClickToEdit={true}
                />
            </div>
        </SectionWrapper>
    );
}; 