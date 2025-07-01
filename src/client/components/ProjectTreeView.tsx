import React, { useMemo, useCallback, useEffect } from 'react';
import { Tree, Typography, Space, Tag } from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
    FileTextOutlined,
    BulbOutlined,
    BookOutlined,
    VideoCameraOutlined,
    EditOutlined,
    CheckCircleOutlined,
    LoadingOutlined,
    ExclamationCircleOutlined
} from '@ant-design/icons';
import { useWorkflowNodes } from '../hooks/useLineageResolution';
import { useEffectiveBrainstormIdeas } from '../hooks/useLineageResolution';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useCurrentSection, type CurrentSection } from '../hooks/useCurrentSection';

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
    const { workflowNodes, isLoading: workflowLoading } = useWorkflowNodes();
    const { ideas, isLoading: ideasLoading } = useEffectiveBrainstormIdeas();
    const projectData = useProjectData();
    const currentSection = useCurrentSection();

    // Function to determine if a tree node should be highlighted
    const shouldHighlightNode = useCallback((navigationTarget?: string): boolean => {
        if (!currentSection || !navigationTarget) {
            return false;
        }

        // Map navigation targets to sections (same logic as WorkflowVisualization)
        const navigationTargetToSection: Record<string, CurrentSection> = {
            '#brainstorm-ideas': 'brainstorm-ideas',
            '#selected-idea': 'brainstorm-ideas', // Selected idea is part of brainstorm section
            '#story-outline': 'story-outline'
        };

        const nodeSection = navigationTargetToSection[navigationTarget];
        return nodeSection === currentSection;
    }, [currentSection]);

    // Build tree data structure
    const treeData: ProjectTreeNode[] = useMemo(() => {
        if (workflowLoading || ideasLoading) {
            return [];
        }

        const rootNode: ProjectTreeNode = {
            key: 'project-root',
            title: (
                <Space>
                    <FileTextOutlined />
                    <Text strong>创作项目</Text>
                </Space>
            ),
            icon: <FileTextOutlined />,
            selectable: false,
            children: []
        };

        // Add brainstorm section if we have ideas
        if (ideas.length > 0) {
            const isHighlighted = shouldHighlightNode('#brainstorm-ideas');
            const brainstormNode: ProjectTreeNode = {
                key: 'brainstorm-section',
                title: (
                    <Space style={{
                        padding: isHighlighted ? '4px 8px' : '0',
                        borderRadius: '6px',
                        background: isHighlighted ?
                            'linear-gradient(135deg, rgba(24, 144, 255, 0.25) 0%, rgba(64, 169, 255, 0.15) 100%)' :
                            'none',
                        border: isHighlighted ? '1px solid rgba(24, 144, 255, 0.4)' : 'none',
                        boxShadow: isHighlighted ?
                            '0 0 20px rgba(24, 144, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)' :
                            'none',
                        transition: 'all 0.2s ease-in-out',
                        display: 'inline-flex',
                        alignItems: 'center'
                    }}>
                        <Text style={{
                            color: isHighlighted ? '#ffffff' : '#fff',
                            fontWeight: isHighlighted ? 700 : 500,
                            textShadow: isHighlighted ? '0 0 8px rgba(24, 144, 255, 0.8)' : 'none'
                        }}>
                            创意构思
                        </Text>
                        <Tag
                            color={isHighlighted ? "blue" : "default"}
                            style={{
                                boxShadow: isHighlighted ? '0 0 8px rgba(24, 144, 255, 0.4)' : 'none',
                                border: isHighlighted ? '1px solid rgba(24, 144, 255, 0.6)' : undefined,
                                marginLeft: '8px'
                            }}
                        >
                            {ideas.length}
                        </Tag>
                    </Space>
                ),
                icon: <BulbOutlined style={{
                    color: isHighlighted ? '#40a9ff' : '#666',
                    filter: isHighlighted ? 'drop-shadow(0 0 4px rgba(24, 144, 255, 0.6))' : 'none'
                }} />,
                selectable: true,
                navigationTarget: '#brainstorm-ideas',
                children: []
            };

            // Add individual ideas as children
            ideas.forEach((idea, index) => {
                // Extract title from artifact data
                let ideaTitle = `创意 ${index + 1}`;
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
                } catch (error) {
                    console.error('Error parsing idea data:', error);
                }
                const isEdited = idea.artifactId !== idea.originalArtifactId;
                const ideaHighlighted = shouldHighlightNode('#brainstorm-ideas');

                brainstormNode.children!.push({
                    key: `brainstorm-idea-${idea.artifactId}`,
                    title: (
                        <Space>
                            <Text style={{
                                color: ideaHighlighted ? '#1890ff' : '#fff',
                                fontWeight: ideaHighlighted ? 500 : 400
                            }}>
                                {ideaTitle}
                            </Text>
                            {isEdited && <EditOutlined style={{
                                color: ideaHighlighted ? '#40a9ff' : '#1890ff',
                                fontSize: '12px'
                            }} />}
                        </Space>
                    ),
                    icon: <BulbOutlined style={{
                        fontSize: '14px',
                        color: ideaHighlighted ? '#1890ff' : undefined
                    }} />,
                    selectable: true,
                    navigationTarget: '#brainstorm-ideas'
                });
            });

            rootNode.children!.push(brainstormNode);
        }

        // Add workflow nodes (outline, episodes, scripts)
        const workflowWorkflow = workflowNodes.filter(node =>
            node.type !== 'brainstorm_collection' && node.type !== 'brainstorm_idea'
        );

        workflowWorkflow.forEach(node => {
            let icon: React.ReactNode;
            let title: string;
            let children: ProjectTreeNode[] = [];
            const nodeHighlighted = shouldHighlightNode(node.navigationTarget);

            switch (node.type) {
                case 'outline':
                    icon = <BookOutlined style={{ color: nodeHighlighted ? '#722ed1' : undefined }} />;
                    title = '时间顺序大纲';

                    // Add outline sections as children
                    try {
                        const outlineArtifact = projectData.artifacts.find(a => a.id === node.artifactId);
                        if (outlineArtifact) {
                            const outlineData = JSON.parse(outlineArtifact.data);

                            // Add characters section if available
                            if (outlineData.characters && Array.isArray(outlineData.characters)) {
                                children.push({
                                    key: `outline-characters-${node.artifactId}`,
                                    title: (
                                        <Space>
                                            <Text style={{
                                                color: nodeHighlighted ? '#722ed1' : '#fff',
                                                fontWeight: nodeHighlighted ? 500 : 400
                                            }}>
                                                角色设定
                                            </Text>
                                            <Tag color={nodeHighlighted ? "purple" : "default"}>{outlineData.characters.length}</Tag>
                                        </Space>
                                    ),
                                    icon: <FileTextOutlined style={{
                                        fontSize: '14px',
                                        color: nodeHighlighted ? '#722ed1' : '#888'
                                    }} />,
                                    selectable: true,
                                    navigationTarget: '#story-outline'
                                });
                            }

                            // Add synopsis stages if available
                            if (outlineData.synopsis_stages && Array.isArray(outlineData.synopsis_stages)) {
                                children.push({
                                    key: `outline-synopsis-${node.artifactId}`,
                                    title: (
                                        <Space>
                                            <Text style={{
                                                color: nodeHighlighted ? '#722ed1' : '#fff',
                                                fontWeight: nodeHighlighted ? 500 : 400
                                            }}>
                                                剧情安排
                                            </Text>
                                            <Tag color={nodeHighlighted ? "green" : "default"}>{outlineData.synopsis_stages.length}</Tag>
                                        </Space>
                                    ),
                                    icon: <FileTextOutlined style={{
                                        fontSize: '14px',
                                        color: nodeHighlighted ? '#722ed1' : '#888'
                                    }} />,
                                    selectable: true,
                                    navigationTarget: '#story-outline'
                                });
                            }

                            // Add selling points if available
                            if (outlineData.selling_points && Array.isArray(outlineData.selling_points)) {
                                children.push({
                                    key: `outline-selling-${node.artifactId}`,
                                    title: (
                                        <Space>
                                            <Text style={{
                                                color: nodeHighlighted ? '#722ed1' : '#fff',
                                                fontWeight: nodeHighlighted ? 500 : 400
                                            }}>
                                                卖点分析
                                            </Text>
                                            <Tag color={nodeHighlighted ? "orange" : "default"}>{outlineData.selling_points.length}</Tag>
                                        </Space>
                                    ),
                                    icon: <FileTextOutlined style={{
                                        fontSize: '14px',
                                        color: nodeHighlighted ? '#722ed1' : '#888'
                                    }} />,
                                    selectable: true,
                                    navigationTarget: '#story-outline'
                                });
                            }
                        }
                    } catch (error) {
                        console.error('Error parsing outline data:', error);
                    }
                    break;

                case 'episode':
                    icon = <VideoCameraOutlined style={{ color: nodeHighlighted ? '#fa541c' : undefined }} />;
                    title = '分集剧本';
                    break;

                case 'script':
                    icon = <FileTextOutlined style={{ color: nodeHighlighted ? '#13c2c2' : undefined }} />;
                    title = '剧本';
                    break;

                default:
                    icon = <FileTextOutlined style={{ color: nodeHighlighted ? '#1890ff' : undefined }} />;
                    title = node.title;
            }

            // Add status indicator
            const statusIcon = node.status === 'processing' ? (
                <LoadingOutlined style={{ color: '#1890ff', fontSize: '12px' }} />
            ) : node.status === 'failed' ? (
                <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: '12px' }} />
            ) : (
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '12px' }} />
            );

            // Get theme colors for different node types
            const getThemeColors = (nodeType: string) => {
                switch (nodeType) {
                    case 'outline':
                        return {
                            primary: '#722ed1',
                            light: '#9254de',
                            glow: 'rgba(114, 46, 209, 0.3)',
                            bgGlow: 'rgba(114, 46, 209, 0.25)',
                            bgLight: 'rgba(146, 84, 222, 0.15)'
                        };
                    case 'episode':
                        return {
                            primary: '#fa541c',
                            light: '#ff7a45',
                            glow: 'rgba(250, 84, 28, 0.3)',
                            bgGlow: 'rgba(250, 84, 28, 0.25)',
                            bgLight: 'rgba(255, 122, 69, 0.15)'
                        };
                    case 'script':
                        return {
                            primary: '#13c2c2',
                            light: '#36cfc9',
                            glow: 'rgba(19, 194, 194, 0.3)',
                            bgGlow: 'rgba(19, 194, 194, 0.25)',
                            bgLight: 'rgba(54, 207, 201, 0.15)'
                        };
                    default:
                        return {
                            primary: '#1890ff',
                            light: '#40a9ff',
                            glow: 'rgba(24, 144, 255, 0.3)',
                            bgGlow: 'rgba(24, 144, 255, 0.25)',
                            bgLight: 'rgba(64, 169, 255, 0.15)'
                        };
                }
            };

            const colors = getThemeColors(node.type);

            const treeNode: ProjectTreeNode = {
                key: `workflow-${node.id}`,
                title: (
                    <Space style={{
                        padding: nodeHighlighted ? '4px 8px' : '0',
                        borderRadius: '6px',
                        background: nodeHighlighted ?
                            `linear-gradient(135deg, ${colors.bgGlow} 0%, ${colors.bgLight} 100%)` :
                            'none',
                        border: nodeHighlighted ? `1px solid ${colors.glow.replace('0.3', '0.4')}` : 'none',
                        boxShadow: nodeHighlighted ?
                            `0 0 20px ${colors.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.1)` :
                            'none',
                        transition: 'all 0.2s ease-in-out',
                        display: 'inline-flex',
                        alignItems: 'center'
                    }}>
                        <Text style={{
                            color: nodeHighlighted ? '#ffffff' : '#fff',
                            fontWeight: nodeHighlighted ? 700 : 500,
                            textShadow: nodeHighlighted ? `0 0 8px ${colors.glow}` : 'none'
                        }}>
                            {title}
                        </Text>
                        {statusIcon}
                    </Space>
                ),
                icon,
                selectable: true,
                navigationTarget: node.navigationTarget,
                status: node.status,
                children: children.length > 0 ? children : undefined
            };

            rootNode.children!.push(treeNode);
        });

        return [rootNode];
    }, [workflowNodes, ideas, workflowLoading, ideasLoading, projectData.artifacts, currentSection, shouldHighlightNode]);

    // Debug current section changes
    useEffect(() => {
        console.log('[ProjectTreeView] Current section changed:', currentSection);
    }, [currentSection]);

    // Handle tree node selection
    const handleSelect = useCallback((selectedKeys: React.Key[], info: any) => {
        const node = info.node as ProjectTreeNode;
        if (node.navigationTarget) {
            // Try to scroll to existing element on current page
            const targetElement = document.querySelector(node.navigationTarget);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                    inline: 'nearest'
                });

                // Update URL hash for bookmarkable navigation
                const hash = node.navigationTarget;
                if (hash.startsWith('#')) {
                    window.history.replaceState(null, '', hash);
                }
            } else {
                console.log(`Navigation target not found: ${node.navigationTarget}`);
            }
        }
    }, []);

    // Handle tree node expansion
    const handleExpand = useCallback((expandedKeys: React.Key[]) => {
        // Could store expanded state in localStorage if needed
        console.log('Expanded keys:', expandedKeys);
    }, []);

    // Show loading state
    if (workflowLoading || ideasLoading) {
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
    if (treeData.length === 0 || !treeData[0].children || treeData[0].children.length === 0) {
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