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
    StarFilled
} from '@ant-design/icons';
import { useEffectiveBrainstormIdeas } from '../transform-artifact-framework/useLineageResolution';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useCurrentSection, type CurrentSection } from '../hooks/useCurrentSection';
import { useChosenBrainstormIdea } from '../hooks/useChosenBrainstormIdea';
import { useOutlineDescendants } from '../hooks/useOutlineDescendants';

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
            '#story-outline': 'story-outline'
        };

        const nodeSection = navigationTargetToSection[navigationTarget];
        return nodeSection === currentSection;
    }, [currentSection]);

    // Build simplified tree data structure with 3 main sections
    const treeData: ProjectTreeNode[] = useMemo(() => {
        if (ideasLoading) {
            return [];
        }

        const sections: ProjectTreeNode[] = [];

        // 1. BRAINSTORM SECTION
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

        // 2. IDEATION EDITING SECTION (only if there's a chosen idea)
        if (chosenIdea) {
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
                            灵感编辑
                        </Text>
                        <StarFilled style={{
                            color: ideationHighlighted ? '#faad14' : '#faad14',
                            fontSize: '12px',
                            marginLeft: '8px',
                            filter: ideationHighlighted ? 'drop-shadow(0 0 4px rgba(250, 173, 20, 0.6))' : 'none'
                        }} />
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

        // 3. OUTLINE SECTION
        const outlineHighlighted = shouldHighlightNode('#story-outline');
        const outlineChildren: ProjectTreeNode[] = [];

        // Check if we have outline data to show children
        const outlineArtifacts = projectData.artifacts.filter(a => a.type === 'outline');
        let hasOutlineContent = false;

        if (outlineArtifacts.length > 0) {
            try {
                const latestOutline = outlineArtifacts[outlineArtifacts.length - 1];
                const outlineData = JSON.parse(latestOutline.data);
                hasOutlineContent = true;

                // Add outline subsections
                if (outlineData.characters && Array.isArray(outlineData.characters) && outlineData.characters.length > 0) {
                    outlineChildren.push({
                        key: 'outline-characters',
                        title: (
                            <Space>
                                <Text style={{
                                    color: outlineHighlighted ? '#722ed1' : '#fff',
                                    fontWeight: outlineHighlighted ? 500 : 400
                                }}>
                                    角色设定
                                </Text>
                                <Tag color={outlineHighlighted ? "purple" : "default"}>{outlineData.characters.length}</Tag>
                            </Space>
                        ),
                        icon: <FileTextOutlined style={{
                            fontSize: '14px',
                            color: outlineHighlighted ? '#722ed1' : '#888'
                        }} />,
                        selectable: true,
                        navigationTarget: '#story-outline'
                    });
                }

                if (outlineData.stages && Array.isArray(outlineData.stages) && outlineData.stages.length > 0) {
                    outlineChildren.push({
                        key: 'outline-stages',
                        title: (
                            <Space>
                                <Text style={{
                                    color: outlineHighlighted ? '#722ed1' : '#fff',
                                    fontWeight: outlineHighlighted ? 500 : 400
                                }}>
                                    故事阶段
                                </Text>
                                <Tag color={outlineHighlighted ? "green" : "default"}>{outlineData.stages.length}</Tag>
                            </Space>
                        ),
                        icon: <FileTextOutlined style={{
                            fontSize: '14px',
                            color: outlineHighlighted ? '#722ed1' : '#888'
                        }} />,
                        selectable: true,
                        navigationTarget: '#story-outline'
                    });
                }

                if (outlineData.selling_points && Array.isArray(outlineData.selling_points) && outlineData.selling_points.length > 0) {
                    outlineChildren.push({
                        key: 'outline-selling',
                        title: (
                            <Space>
                                <Text style={{
                                    color: outlineHighlighted ? '#722ed1' : '#fff',
                                    fontWeight: outlineHighlighted ? 500 : 400
                                }}>
                                    卖点分析
                                </Text>
                                <Tag color={outlineHighlighted ? "orange" : "default"}>{outlineData.selling_points.length}</Tag>
                            </Space>
                        ),
                        icon: <FileTextOutlined style={{
                            fontSize: '14px',
                            color: outlineHighlighted ? '#722ed1' : '#888'
                        }} />,
                        selectable: true,
                        navigationTarget: '#story-outline'
                    });
                }
            } catch (error) {
                console.error('Error parsing outline data:', error);
            }
        }

        const outlineSection: ProjectTreeNode = {
            key: 'outline-section',
            title: (
                <Space style={{
                    padding: outlineHighlighted ? '4px 8px' : '0',
                    borderRadius: '6px',
                    background: outlineHighlighted ?
                        'linear-gradient(135deg, rgba(114, 46, 209, 0.25) 0%, rgba(146, 84, 222, 0.15) 100%)' :
                        'none',
                    border: outlineHighlighted ? '1px solid rgba(114, 46, 209, 0.4)' : 'none',
                    boxShadow: outlineHighlighted ?
                        '0 0 20px rgba(114, 46, 209, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)' :
                        'none',
                    transition: 'all 0.2s ease-in-out',
                    display: 'inline-flex',
                    alignItems: 'center'
                }}>
                    <Text style={{
                        color: outlineHighlighted ? '#ffffff' : '#fff',
                        fontWeight: outlineHighlighted ? 700 : 500,
                        textShadow: outlineHighlighted ? '0 0 8px rgba(114, 46, 209, 0.8)' : 'none'
                    }}>
                        时序大纲
                    </Text>
                    {hasOutlineContent ? (
                        <CheckCircleOutlined style={{
                            color: outlineHighlighted ? '#52c41a' : '#52c41a',
                            fontSize: '12px',
                            marginLeft: '8px',
                            filter: outlineHighlighted ? 'drop-shadow(0 0 4px rgba(82, 196, 26, 0.6))' : 'none'
                        }} />
                    ) : (
                        <Tag
                            color={outlineHighlighted ? "purple" : "default"}
                            style={{
                                boxShadow: outlineHighlighted ? '0 0 8px rgba(114, 46, 209, 0.4)' : 'none',
                                border: outlineHighlighted ? '1px solid rgba(114, 46, 209, 0.6)' : undefined,
                                marginLeft: '8px'
                            }}
                        >
                            待生成
                        </Tag>
                    )}
                </Space>
            ),
            icon: <BookOutlined style={{
                color: outlineHighlighted ? '#722ed1' : '#666',
                filter: outlineHighlighted ? 'drop-shadow(0 0 4px rgba(114, 46, 209, 0.6))' : 'none'
            }} />,
            selectable: true,
            navigationTarget: '#story-outline',
            children: outlineChildren.length > 0 ? outlineChildren : undefined
        };

        sections.push(outlineSection);

        return sections;
    }, [ideas, ideasLoading, projectData.artifacts, currentSection, shouldHighlightNode, chosenIdea]);

    // Debug current section changes
    useEffect(() => {
        console.log('[ProjectTreeView] Current section changed:', currentSection);
    }, [currentSection]);

    // Handle tree node selection with improved navigation
    const handleSelect = useCallback((selectedKeys: React.Key[], info: any) => {
        const node = info.node as ProjectTreeNode;
        if (node.navigationTarget) {
            const targetHash = node.navigationTarget;

            // Enhanced navigation logic
            let targetElement: Element | null = null;

            // Try to find target by ID first
            if (targetHash.startsWith('#')) {
                const elementId = targetHash.substring(1);
                targetElement = document.getElementById(elementId);
            }

            // If direct ID lookup fails, try other methods
            if (!targetElement) {
                // Try querySelector with the hash
                targetElement = document.querySelector(targetHash);
            }

            // If still not found, try to find sections by text content or other attributes
            if (!targetElement) {
                if (targetHash === '#brainstorm-ideas') {
                    // Look for brainstorm section by finding elements with brainstorm-related content
                    const textDividers = document.querySelectorAll('div');
                    for (const div of Array.from(textDividers)) {
                        if (div.textContent?.includes('头脑风暴')) {
                            targetElement = div;
                            break;
                        }
                    }
                } else if (targetHash === '#ideation-edit') {
                    // Look for ideation section
                    const textDividers = document.querySelectorAll('div');
                    for (const div of Array.from(textDividers)) {
                        if (div.textContent?.includes('灵感编辑')) {
                            targetElement = div;
                            break;
                        }
                    }
                } else if (targetHash === '#story-outline') {
                    // Look for outline section
                    const textDividers = document.querySelectorAll('div');
                    for (const div of Array.from(textDividers)) {
                        if (div.textContent?.includes('时序大纲')) {
                            targetElement = div;
                            break;
                        }
                    }
                }
            }

            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                    inline: 'nearest'
                });

                // Update URL hash for bookmarkable navigation
                if (targetHash.startsWith('#')) {
                    window.history.replaceState(null, '', targetHash);
                }

                console.log(`[ProjectTreeView] Navigated to: ${targetHash}`);
            } else {
                console.warn(`[ProjectTreeView] Navigation target not found: ${targetHash}`);
            }
        }
    }, []);

    // Handle tree node expansion
    const handleExpand = useCallback((expandedKeys: React.Key[]) => {
        console.log('Expanded keys:', expandedKeys);
    }, []);

    // Show loading state
    if (ideasLoading) {
        return (
            <div style={{
                height: '100%',
                width: `${width}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666'
            }}>
                <Space direction="vertical" align="center">
                    <LoadingOutlined style={{ fontSize: '24px' }} />
                    <Text type="secondary" style={{ fontSize: '12px' }}>加载项目结构...</Text>
                </Space>
            </div>
        );
    }

    // Show empty state
    if (treeData.length === 0) {
        return (
            <div style={{
                height: '100%',
                width: `${width}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666'
            }}>
                <Space direction="vertical" align="center">
                    <FileTextOutlined style={{ fontSize: '24px' }} />
                    <Text type="secondary" style={{ fontSize: '12px' }}>暂无项目内容</Text>
                </Space>
            </div>
        );
    }

    return (
        <div style={{
            height: '100%',
            width: `${width}px`,
            overflowY: 'auto',
            overflowX: 'hidden'
        }}>
            <Tree
                treeData={treeData}
                onSelect={handleSelect}
                onExpand={handleExpand}
                defaultExpandAll
                showIcon
                className="project-tree-dark"
                style={{
                    background: 'transparent',
                    color: '#fff'
                }}
                titleRender={(node) => node.title}
            />

            <style>{`
                .project-tree-dark .ant-tree {
                    background: transparent !important;
                    color: #fff !important;
                }
                .project-tree-dark .ant-tree-node-content-wrapper {
                    color: #fff !important;
                }
                .project-tree-dark .ant-tree-node-content-wrapper:hover {
                    background-color: rgba(255, 255, 255, 0.1) !important;
                }
                
                .project-tree-dark .ant-tree-switcher {
                    color: #666 !important;
                }
                .project-tree-dark .ant-tree-switcher:hover {
                    color: #1890ff !important;
                }
            `}</style>
        </div>
    );
};

export default ProjectTreeView; 