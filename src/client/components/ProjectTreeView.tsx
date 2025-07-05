import React, { useMemo, useCallback, useEffect } from 'react';
import { Tree, Typography, Space, Tag } from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
    FileTextOutlined,
    BulbOutlined,
    BookOutlined,
    EditOutlined,
    CheckCircleOutlined,
    LoadingOutlined,
    StarFilled,
    SettingOutlined,
    ClockCircleOutlined
} from '@ant-design/icons';
import { useEffectiveBrainstormIdeas, useProjectInitialMode } from '../transform-artifact-framework/useLineageResolution';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useCurrentSection, type CurrentSection } from '../hooks/useCurrentSection';
import { useChosenBrainstormIdea } from '../hooks/useChosenBrainstormIdea';

const { Text } = Typography;

interface ProjectTreeViewProps {
    width?: number;
}

interface ProjectTreeNode extends DataNode {
    key: string;
    title: React.ReactNode;
    icon?: React.ReactNode;
    children?: ProjectTreeNode[];
    selectable?: boolean;
    navigationTarget?: string;
    status?: 'completed' | 'processing' | 'failed';
}

const ProjectTreeView: React.FC<ProjectTreeViewProps> = ({ width = 300 }) => {
    const { ideas, isLoading: ideasLoading } = useEffectiveBrainstormIdeas();
    const { chosenIdea } = useChosenBrainstormIdea();
    const { isInitialMode, isLoading: initialModeLoading } = useProjectInitialMode();
    const projectData = useProjectData();
    const currentSection = useCurrentSection();

    // Function to determine if a tree node should be highlighted
    const shouldHighlightNode = useCallback((navigationTarget?: string): boolean => {
        if (!currentSection || !navigationTarget) {
            return false;
        }

        // For ideation section, only highlight when we're specifically in the ideation area
        if (navigationTarget === '#ideation-edit') {
            // First check - if we're currently in brainstorm section, don't highlight ideation
            if (currentSection === 'brainstorm-ideas') {
                return false;
            }

            // Second check - ideation element must be prominently visible (>50% visibility)
            const ideationElement = document.getElementById('ideation-edit');
            if (!ideationElement) return false;

            const rect = ideationElement.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const isIdeationVisible = rect.top < viewportHeight && rect.bottom > 0;
            const ideationIntersectionRatio = isIdeationVisible ?
                Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)) / rect.height : 0;

            // Only highlight ideation if it has prominent visibility (>50%) and center is in upper half of viewport
            const elementCenter = rect.top + (rect.height / 2);
            const isInUpperHalf = elementCenter < (viewportHeight / 2);

            return ideationIntersectionRatio > 0.5 && isInUpperHalf;
        }

        // For other sections, use the standard mapping
        const navigationTargetToSection: Record<string, CurrentSection> = {
            '#brainstorm-ideas': 'brainstorm-ideas',
            '#outline-settings': 'outline-settings',
            '#chronicles': 'chronicles'
        };

        const nodeSection = navigationTargetToSection[navigationTarget];
        return nodeSection === currentSection;
    }, [currentSection]);

    // Strict artifact-based checks
    const artifactChecks = useMemo(() => {
        // Check for brainstorm artifacts
        const hasBrainstormIdeas = ideas.length > 0;

        // Check for brainstorm tool input (creation step)
        const hasBrainstormInput = projectData.artifacts.some(artifact =>
            artifact.type === 'brainstorm_tool_input_schema'
        );

        // Check for editable brainstorm idea (editing step)
        const hasEditableBrainstormIdea = projectData.artifacts.some(artifact =>
            (artifact.schema_type === 'brainstorm_idea' || artifact.type === 'brainstorm_idea') &&
            artifact.origin_type === 'user_input'
        );

        // Check for outline settings artifacts
        const hasOutlineSettings = projectData.artifacts.some(artifact =>
            artifact.schema_type === 'outline_settings_schema'
        );

        // Check for chronicles artifacts
        const hasChronicles = projectData.artifacts.some(artifact =>
            artifact.schema_type === 'chronicles_schema'
        );

        return {
            hasBrainstormIdeas,
            hasBrainstormInput,
            hasEditableBrainstormIdea,
            hasOutlineSettings,
            hasChronicles
        };
    }, [ideas, projectData.artifacts]);

    // Build simplified tree data structure with main sections - only show sections with actual artifacts
    const treeData: ProjectTreeNode[] = useMemo(() => {
        if (ideasLoading || initialModeLoading) {
            return [];
        }

        // If in initial mode (no artifacts), show empty tree
        if (isInitialMode) {
            return [];
        }

        const sections: ProjectTreeNode[] = [];

        // 1. BRAINSTORM SECTION - only show if we have brainstorm ideas
        if (artifactChecks.hasBrainstormIdeas) {
            const brainstormHighlighted = shouldHighlightNode('#brainstorm-ideas');
            const brainstormChildren: ProjectTreeNode[] = [];

            // Add individual brainstorm ideas as children
            ideas.forEach((idea, index) => {
                let ideaTitle = `创意 ${index + 1}`;
                let isChosen = false;
                let isEdited = false;

                try {
                    const artifact = projectData.artifacts.find(a => a.id === idea.artifactId);
                    if (artifact) {
                        const data = JSON.parse(artifact.data);
                        if (idea.artifactPath === '$') {
                            ideaTitle = data.title || ideaTitle;
                        } else if (data.ideas && Array.isArray(data.ideas) && data.ideas[idea.index]) {
                            ideaTitle = data.ideas[idea.index].title || ideaTitle;
                        }
                    }

                    // Check if this is the chosen idea
                    isChosen = chosenIdea?.originalArtifactId === idea.originalArtifactId &&
                        chosenIdea?.index === idea.index;

                    // Check if edited
                    isEdited = idea.artifactId !== idea.originalArtifactId;
                } catch (error) {
                    console.error('Error parsing idea data:', error);
                }

                brainstormChildren.push({
                    key: `brainstorm-idea-${idea.artifactId}-${idea.index}`,
                    title: (
                        <Space>
                            {isChosen && <StarFilled style={{ color: '#faad14', fontSize: '12px' }} />}
                            <Text style={{
                                color: brainstormHighlighted ? '#1890ff' : '#fff',
                                fontWeight: brainstormHighlighted ? 500 : 400
                            }}>
                                {ideaTitle}
                            </Text>
                            {isEdited && <EditOutlined style={{
                                color: brainstormHighlighted ? '#40a9ff' : '#1890ff',
                                fontSize: '12px'
                            }} />}
                        </Space>
                    ),
                    icon: <BulbOutlined style={{
                        fontSize: '14px',
                        color: brainstormHighlighted ? '#1890ff' : '#888'
                    }} />,
                    selectable: true,
                    navigationTarget: '#brainstorm-ideas'
                });
            });

            const brainstormSection: ProjectTreeNode = {
                key: 'brainstorm-section',
                title: (
                    <Space style={{
                        padding: brainstormHighlighted ? '4px 8px' : '0',
                        borderRadius: '6px',
                        background: brainstormHighlighted ?
                            'linear-gradient(135deg, rgba(24, 144, 255, 0.25) 0%, rgba(64, 169, 255, 0.15) 100%)' :
                            'none',
                        border: brainstormHighlighted ? '1px solid rgba(24, 144, 255, 0.4)' : 'none',
                        boxShadow: brainstormHighlighted ?
                            '0 0 20px rgba(24, 144, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)' :
                            'none',
                        transition: 'all 0.2s ease-in-out',
                        display: 'inline-flex',
                        alignItems: 'center'
                    }}>
                        <Text style={{
                            color: brainstormHighlighted ? '#ffffff' : '#fff',
                            fontWeight: brainstormHighlighted ? 700 : 500,
                            textShadow: brainstormHighlighted ? '0 0 8px rgba(24, 144, 255, 0.8)' : 'none'
                        }}>
                            头脑风暴
                        </Text>
                        <Tag
                            color={brainstormHighlighted ? "blue" : "default"}
                            style={{
                                boxShadow: brainstormHighlighted ? '0 0 8px rgba(24, 144, 255, 0.4)' : 'none',
                                border: brainstormHighlighted ? '1px solid rgba(24, 144, 255, 0.6)' : undefined,
                                marginLeft: '8px'
                            }}
                        >
                            {ideas.length}
                        </Tag>
                    </Space>
                ),
                icon: <BulbOutlined style={{
                    color: brainstormHighlighted ? '#40a9ff' : '#666',
                    filter: brainstormHighlighted ? 'drop-shadow(0 0 4px rgba(24, 144, 255, 0.6))' : 'none'
                }} />,
                selectable: true,
                navigationTarget: '#brainstorm-ideas',
                children: brainstormChildren.length > 0 ? brainstormChildren : undefined
            };

            sections.push(brainstormSection);
        }

        // 2. IDEATION EDITING SECTION - only if there's a chosen idea AND it's editable
        if (chosenIdea && artifactChecks.hasEditableBrainstormIdea) {
            const ideationHighlighted = shouldHighlightNode('#ideation-edit');

            const ideationSection: ProjectTreeNode = {
                key: 'ideation-section',
                title: (
                    <Space style={{
                        padding: ideationHighlighted ? '4px 8px' : '0',
                        borderRadius: '6px',
                        background: ideationHighlighted ?
                            'linear-gradient(135deg, rgba(82, 196, 26, 0.25) 0%, rgba(135, 208, 104, 0.15) 100%)' :
                            'none',
                        border: ideationHighlighted ? '1px solid rgba(82, 196, 26, 0.4)' : 'none',
                        boxShadow: ideationHighlighted ?
                            '0 0 20px rgba(82, 196, 26, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)' :
                            'none',
                        transition: 'all 0.2s ease-in-out',
                        display: 'inline-flex',
                        alignItems: 'center'
                    }}>
                        <Text style={{
                            color: ideationHighlighted ? '#ffffff' : '#fff',
                            fontWeight: ideationHighlighted ? 700 : 500,
                            textShadow: ideationHighlighted ? '0 0 8px rgba(82, 196, 26, 0.8)' : 'none'
                        }}>
                            编辑选中创意
                        </Text>
                    </Space>
                ),
                icon: <EditOutlined style={{
                    color: ideationHighlighted ? '#52c41a' : '#666',
                    filter: ideationHighlighted ? 'drop-shadow(0 0 4px rgba(82, 196, 26, 0.6))' : 'none'
                }} />,
                selectable: true,
                navigationTarget: '#ideation-edit'
            };

            sections.push(ideationSection);
        }

        // 3. OUTLINE SETTINGS SECTION - only show if outline settings artifacts exist
        if (artifactChecks.hasOutlineSettings) {
            const outlineSettingsHighlighted = shouldHighlightNode('#outline-settings');

            const outlineSettingsSection: ProjectTreeNode = {
                key: 'outline-settings-section',
                title: (
                    <Space style={{
                        padding: outlineSettingsHighlighted ? '4px 8px' : '0',
                        borderRadius: '6px',
                        background: outlineSettingsHighlighted ?
                            'linear-gradient(135deg, rgba(250, 173, 20, 0.25) 0%, rgba(255, 197, 61, 0.15) 100%)' :
                            'none',
                        border: outlineSettingsHighlighted ? '1px solid rgba(250, 173, 20, 0.4)' : 'none',
                        boxShadow: outlineSettingsHighlighted ?
                            '0 0 20px rgba(250, 173, 20, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)' :
                            'none',
                        transition: 'all 0.2s ease-in-out',
                        display: 'inline-flex',
                        alignItems: 'center'
                    }}>
                        <Text style={{
                            color: outlineSettingsHighlighted ? '#ffffff' : '#fff',
                            fontWeight: outlineSettingsHighlighted ? 700 : 500,
                            textShadow: outlineSettingsHighlighted ? '0 0 8px rgba(250, 173, 20, 0.8)' : 'none'
                        }}>
                            剧本框架
                        </Text>
                        <CheckCircleOutlined style={{
                            color: outlineSettingsHighlighted ? '#52c41a' : '#52c41a',
                            fontSize: '12px',
                            marginLeft: '4px'
                        }} />
                    </Space>
                ),
                icon: <SettingOutlined style={{
                    color: outlineSettingsHighlighted ? '#faad14' : '#666',
                    filter: outlineSettingsHighlighted ? 'drop-shadow(0 0 4px rgba(250, 173, 20, 0.6))' : 'none'
                }} />,
                selectable: true,
                navigationTarget: '#outline-settings'
            };

            sections.push(outlineSettingsSection);
        }

        // 4. CHRONICLES SECTION - only show if chronicles artifacts exist
        if (artifactChecks.hasChronicles) {
            const chroniclesHighlighted = shouldHighlightNode('#chronicles');

            const chroniclesSection: ProjectTreeNode = {
                key: 'chronicles-section',
                title: (
                    <Space style={{
                        padding: chroniclesHighlighted ? '4px 8px' : '0',
                        borderRadius: '6px',
                        background: chroniclesHighlighted ?
                            'linear-gradient(135deg, rgba(114, 46, 209, 0.25) 0%, rgba(165, 55, 253, 0.15) 100%)' :
                            'none',
                        border: chroniclesHighlighted ? '1px solid rgba(114, 46, 209, 0.4)' : 'none',
                        boxShadow: chroniclesHighlighted ?
                            '0 0 20px rgba(114, 46, 209, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)' :
                            'none',
                        transition: 'all 0.2s ease-in-out',
                        display: 'inline-flex',
                        alignItems: 'center'
                    }}>
                        <Text style={{
                            color: chroniclesHighlighted ? '#ffffff' : '#fff',
                            fontWeight: chroniclesHighlighted ? 700 : 500,
                            textShadow: chroniclesHighlighted ? '0 0 8px rgba(114, 46, 209, 0.8)' : 'none'
                        }}>
                            时间顺序大纲
                        </Text>
                        <CheckCircleOutlined style={{
                            color: chroniclesHighlighted ? '#52c41a' : '#52c41a',
                            fontSize: '12px',
                            marginLeft: '4px'
                        }} />
                    </Space>
                ),
                icon: <ClockCircleOutlined style={{
                    color: chroniclesHighlighted ? '#722ed1' : '#666',
                    filter: chroniclesHighlighted ? 'drop-shadow(0 0 4px rgba(114, 46, 209, 0.6))' : 'none'
                }} />,
                selectable: true,
                navigationTarget: '#chronicles'
            };

            sections.push(chroniclesSection);
        }

        return sections;
    }, [ideas, ideasLoading, initialModeLoading, isInitialMode, chosenIdea, artifactChecks, shouldHighlightNode, projectData.artifacts]);

    // Handle tree node selection - scroll to corresponding section
    const handleSelect = useCallback((selectedKeys: React.Key[], info: any) => {
        if (selectedKeys.length === 0) return;

        const node = info.node as ProjectTreeNode;
        if (node.navigationTarget) {
            const targetElement = document.querySelector(node.navigationTarget);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    }, []);

    // Show empty tree when in initial mode or no sections exist
    if (isInitialMode || treeData.length === 0) {
        return (
            <></>
        );
    }

    return (
        <div
            style={{
                width,
                height: '100%',
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(8px)',
                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '16px 8px',
                overflow: 'auto'
            }}
        >
            <Tree
                treeData={treeData}
                showIcon={true}
                selectable={true}
                onSelect={handleSelect}
                style={{
                    background: 'transparent',
                    color: '#fff'
                }}
                expandedKeys={treeData.map(node => node.key)}
                defaultExpandAll={true}
            />
        </div>
    );
};

export default ProjectTreeView; 