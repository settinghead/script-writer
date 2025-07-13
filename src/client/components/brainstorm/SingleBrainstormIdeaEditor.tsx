import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Space } from 'antd';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useYJSField } from '../../transform-jsonDoc-framework/contexts/YJSJsonDocContext';
import { YJSTextField, YJSTextAreaField } from '../../transform-jsonDoc-framework/components/YJSField';
import { SectionWrapper, JsonDocDisplayWrapper } from '../shared';

const { Text } = Typography;

interface SingleBrainstormIdeaEditorProps {
    onViewOriginalIdeas?: () => void;
    isEditable?: boolean; // Global editability state from computation system
    currentStage?: string; // Current workflow stage
    brainstormIdea?: any; // The jsonDoc to display
    mode?: 'editable' | 'readonly'; // Display mode
}

/**
 * YJS-enabled editable form component for brainstorm ideas
 * This component is designed to be used within a YJSJsonDocProvider
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
                    fontSize={18}
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
    if (propsBrainstormIdea && propsBrainstormIdea.id) {
        const isEditable = propsIsEditable ?? false;
        const effectiveJsonDoc = propsBrainstormIdea;

        return (
            <SectionWrapper
                schemaType={"brainstorm_idea"}
                title="初始创意"
                sectionId="ideation-edit"
                jsonDocId={effectiveJsonDoc.id}
            >
                <div style={{ marginTop: '24px', position: 'relative' }}>
                    <JsonDocDisplayWrapper
                        jsonDoc={effectiveJsonDoc}
                        isEditable={isEditable}
                        title="选中的创意"
                        icon="💡"
                        editableComponent={EditableBrainstormForm}
                        schemaType="brainstorm_idea"
                        enableClickToEdit={true}
                    />
                </div>
            </SectionWrapper>
        );
    }

    // Otherwise, find the latest brainstorm idea from project data
    const latestBrainstormIdea = useMemo(() => {
        if (!projectData || !projectData.jsonDocs || projectData.jsonDocs === "pending" || projectData.jsonDocs === "error") {
            return null;
        }

        const brainstormIdeaJsonDocs = projectData.jsonDocs.filter(
            (jsonDoc: any) => jsonDoc.schema_type === 'brainstorm_idea'
        );

        if (brainstormIdeaJsonDocs.length === 0) {
            return null;
        }

        // Sort by created_at and get the most recent one
        const sortedJsonDocs = brainstormIdeaJsonDocs.sort(
            (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return sortedJsonDocs[0];
    }, [projectData]);

    // Determine editability for fallback mode
    const isEditable = useMemo(() => {
        if (!latestBrainstormIdea || currentStage !== 'idea_editing') return false;

        // Check if this jsonDoc has descendants (is used as input in any transform)
        if (projectData.transformInputs === "pending" || projectData.transformInputs === "error") {
            return false;
        }

        const transformInputs = projectData.transformInputs as any[];
        const hasDescendants = transformInputs.some(input =>
            input.jsonDoc_id === latestBrainstormIdea.id
        );

        // Only editable if it's user_input and has no descendants
        return latestBrainstormIdea.origin_type === 'user_input' && !hasDescendants && (propsIsEditable ?? true);
    }, [latestBrainstormIdea, currentStage, projectData.transformInputs, propsIsEditable]);

    return (
        <SectionWrapper
            schemaType={"brainstorm_idea"}
            title="初始创意"
            sectionId="ideation-edit"
            jsonDocId={latestBrainstormIdea?.id}
        >
            <div style={{ marginTop: '24px', position: 'relative' }}>
                <JsonDocDisplayWrapper
                    jsonDoc={latestBrainstormIdea}
                    isEditable={isEditable}
                    title="当前创意"
                    icon="💡"
                    editableComponent={EditableBrainstormForm}
                    schemaType="brainstorm_idea"
                    enableClickToEdit={true}
                />
            </div>
        </SectionWrapper>
    );
}; 