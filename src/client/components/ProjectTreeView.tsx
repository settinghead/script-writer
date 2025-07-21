import React, { useMemo, useCallback } from 'react';
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
import { useProjectInitialMode } from '../transform-jsondoc-framework/useLineageResolution';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useCurrentSection, type CurrentSection } from '../hooks/useCurrentSection';
import { useChosenBrainstormIdea } from '../hooks/useChosenBrainstormIdea';
import { computeCanonicalJsondocsFromLineage } from '../../common/canonicalJsondocLogic';

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
    const { chosenIdea } = useChosenBrainstormIdea();
    const { isInitialMode, isLoading: initialModeLoading } = useProjectInitialMode();
    const projectData = useProjectData();
    const currentSection = useCurrentSection();

    // Compute canonical context using the canonical logic
    const canonicalContext = useMemo(() => {
        if (projectData.jsondocs === "pending" || projectData.jsondocs === "error" ||
            projectData.transforms === "pending" || projectData.transforms === "error" ||
            projectData.humanTransforms === "pending" || projectData.humanTransforms === "error" ||
            projectData.transformInputs === "pending" || projectData.transformInputs === "error" ||
            projectData.transformOutputs === "pending" || projectData.transformOutputs === "error" ||
            projectData.lineageGraph === "pending" || projectData.lineageGraph === "error") {
            return null;
        }

        return computeCanonicalJsondocsFromLineage(
            projectData.lineageGraph,
            projectData.jsondocs,
            projectData.transforms,
            projectData.humanTransforms,
            projectData.transformInputs,
            projectData.transformOutputs
        );
    }, [projectData]);

    // Function to determine if a tree node should be highlighted
    const shouldHighlightNode = useCallback((navigationTarget?: string): boolean => {
        if (!currentSection || !navigationTarget) {
            return false;
        }

        // For ideation section, only highlight when we're specifically in the ideation area
        if (navigationTarget === '#ideation-edit') {
            // First check - if we're currently in brainstorm section, don't highlight ideation
            if (currentSection === 'ideas') {
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
            '#ideas': 'ideas',
            '#outline-settings': 'outline-settings',
            '#chronicles': 'chronicles',
            '#episode-planning': 'episode-planning',
            '#episode-synopsis': 'episode-synopsis'
        };

        const nodeSection = navigationTargetToSection[navigationTarget];
        return nodeSection === currentSection;
    }, [currentSection]);

    // Canonical jsondoc-based checks
    const jsondocChecks = useMemo(() => {
        if (!canonicalContext) {
            return {
                hasBrainstormIdeas: false,
                hasBrainstormInput: false,
                hasEditableBrainstormIdea: false,
                hasOutlineSettings: false,
                hasChronicles: false,
                hasEpisodePlanning: false,
                hasEpisodeSynopsis: false
            };
        }

        return {
            // Check for canonical brainstorm content (either idea or collection)
            hasBrainstormIdeas: !!(canonicalContext.canonicalBrainstormIdea || canonicalContext.canonicalBrainstormCollection),
            // Check for brainstorm input
            hasBrainstormInput: !!canonicalContext.canonicalBrainstormInput,
            // Check for editable brainstorm idea (user_input origin type)
            hasEditableBrainstormIdea: !!(canonicalContext.canonicalBrainstormIdea && canonicalContext.canonicalBrainstormIdea.origin_type === 'user_input'),
            // Check for outline settings
            hasOutlineSettings: !!canonicalContext.canonicalOutlineSettings,
            // Check for chronicles
            hasChronicles: !!canonicalContext.canonicalChronicles,
            // Check for episode planning
            hasEpisodePlanning: !!canonicalContext.canonicalEpisodePlanning,
            // Check for episode synopsis
            hasEpisodeSynopsis: canonicalContext.canonicalEpisodeSynopsisList.length > 0
        };
    }, [canonicalContext]);

    // Build simplified tree data structure with main sections - only show canonical content
    const treeData: ProjectTreeNode[] = useMemo(() => {
        if (initialModeLoading || !canonicalContext) {
            return [];
        }

        // If in initial mode (no jsondocs), show empty tree
        if (isInitialMode) {
            return [];
        }

        const sections: ProjectTreeNode[] = [];

        // 1. BRAINSTORM SECTION - only show if we have canonical brainstorm content
        if (jsondocChecks.hasBrainstormIdeas) {
            const brainstormHighlighted = shouldHighlightNode('#ideas');

            // Get canonical brainstorm title
            let brainstormTitle = '头脑风暴';
            let brainstormCount = 1; // Show as single canonical content

            try {
                if (canonicalContext.canonicalBrainstormIdea) {
                    const data = typeof canonicalContext.canonicalBrainstormIdea.data === 'string'
                        ? JSON.parse(canonicalContext.canonicalBrainstormIdea.data)
                        : canonicalContext.canonicalBrainstormIdea.data;
                    brainstormTitle = data.title || brainstormTitle;
                } else if (canonicalContext.canonicalBrainstormCollection) {
                    const data = typeof canonicalContext.canonicalBrainstormCollection.data === 'string'
                        ? JSON.parse(canonicalContext.canonicalBrainstormCollection.data)
                        : canonicalContext.canonicalBrainstormCollection.data;
                    if (data.ideas && Array.isArray(data.ideas)) {
                        brainstormCount = data.ideas.length;
                        brainstormTitle = `头脑风暴集合`;
                    }
                }
            } catch (error) {
                console.error('Error parsing canonical brainstorm data:', error);
            }

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
                            {brainstormTitle}
                        </Text>
                        {canonicalContext.canonicalBrainstormCollection && (
                            <Tag
                                color={brainstormHighlighted ? "blue" : "default"}
                                style={{
                                    boxShadow: brainstormHighlighted ? '0 0 8px rgba(24, 144, 255, 0.4)' : 'none',
                                    border: brainstormHighlighted ? '1px solid rgba(24, 144, 255, 0.6)' : undefined,
                                    marginLeft: '8px'
                                }}
                            >
                                {brainstormCount}
                            </Tag>
                        )}
                    </Space>
                ),
                icon: <BulbOutlined style={{
                    color: brainstormHighlighted ? '#40a9ff' : '#666',
                    filter: brainstormHighlighted ? 'drop-shadow(0 0 4px rgba(24, 144, 255, 0.6))' : 'none'
                }} />,
                selectable: true,
                navigationTarget: '#ideas'
            };

            sections.push(brainstormSection);
        }

        // 2. IDEATION EDITING SECTION - only if there's a chosen idea AND it's editable
        if (chosenIdea && jsondocChecks.hasEditableBrainstormIdea) {
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

        // 3. OUTLINE SETTINGS SECTION - only show if outline settings jsondocs exist
        if (jsondocChecks.hasOutlineSettings) {
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
                            剧本设定
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

        // 4. CHRONICLES SECTION - only show if chronicles jsondocs exist
        if (jsondocChecks.hasChronicles) {
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

        // 5. EPISODE PLANNING SECTION - only show if episode planning jsondocs exist
        if (jsondocChecks.hasEpisodePlanning) {
            const episodePlanningHighlighted = shouldHighlightNode('#episode-planning');

            const episodePlanningSection: ProjectTreeNode = {
                key: 'episode-planning-section',
                title: (
                    <Space style={{
                        padding: episodePlanningHighlighted ? '4px 8px' : '0',
                        borderRadius: '6px',
                        background: episodePlanningHighlighted ?
                            'linear-gradient(135deg, rgba(255, 87, 51, 0.25) 0%, rgba(255, 107, 74, 0.15) 100%)' :
                            'none',
                        border: episodePlanningHighlighted ? '1px solid rgba(255, 87, 51, 0.4)' : 'none',
                        boxShadow: episodePlanningHighlighted ?
                            '0 0 20px rgba(255, 87, 51, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)' :
                            'none',
                        transition: 'all 0.2s ease-in-out',
                        display: 'inline-flex',
                        alignItems: 'center'
                    }}>
                        <Text style={{
                            color: episodePlanningHighlighted ? '#ffffff' : '#fff',
                            fontWeight: episodePlanningHighlighted ? 700 : 500,
                            textShadow: episodePlanningHighlighted ? '0 0 8px rgba(255, 87, 51, 0.8)' : 'none'
                        }}>
                            剧集框架
                        </Text>
                        <CheckCircleOutlined style={{
                            color: episodePlanningHighlighted ? '#52c41a' : '#52c41a',
                            fontSize: '12px',
                            marginLeft: '4px'
                        }} />
                    </Space>
                ),
                icon: <FileTextOutlined style={{
                    color: episodePlanningHighlighted ? '#ff5733' : '#666',
                    filter: episodePlanningHighlighted ? 'drop-shadow(0 0 4px rgba(255, 87, 51, 0.6))' : 'none'
                }} />,
                selectable: true,
                navigationTarget: '#episode-planning'
            };

            sections.push(episodePlanningSection);
        }

        // 6. EPISODE SYNOPSIS SECTION - only show if episode synopsis jsondocs exist
        if (jsondocChecks.hasEpisodeSynopsis) {
            const episodeSynopsisHighlighted = shouldHighlightNode('#episode-synopsis');

            const episodeSynopsisSection: ProjectTreeNode = {
                key: 'episode-synopsis-section',
                title: (
                    <Space style={{
                        padding: episodeSynopsisHighlighted ? '4px 8px' : '0',
                        borderRadius: '6px',
                        background: episodeSynopsisHighlighted ?
                            'linear-gradient(135deg, rgba(24, 144, 255, 0.25) 0%, rgba(64, 169, 255, 0.15) 100%)' :
                            'none',
                        border: episodeSynopsisHighlighted ? '1px solid rgba(24, 144, 255, 0.4)' : 'none',
                        boxShadow: episodeSynopsisHighlighted ?
                            '0 0 20px rgba(24, 144, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)' :
                            'none',
                        transition: 'all 0.2s ease-in-out',
                        display: 'inline-flex',
                        alignItems: 'center'
                    }}>
                        <Text style={{
                            color: episodeSynopsisHighlighted ? '#ffffff' : '#fff',
                            fontWeight: episodeSynopsisHighlighted ? 700 : 500,
                            textShadow: episodeSynopsisHighlighted ? '0 0 8px rgba(24, 144, 255, 0.8)' : 'none'
                        }}>
                            每集大纲
                        </Text>
                        <CheckCircleOutlined style={{
                            color: episodeSynopsisHighlighted ? '#52c41a' : '#52c41a',
                            fontSize: '12px',
                            marginLeft: '4px'
                        }} />
                    </Space>
                ),
                icon: <BookOutlined style={{
                    color: episodeSynopsisHighlighted ? '#1890ff' : '#666',
                    filter: episodeSynopsisHighlighted ? 'drop-shadow(0 0 4px rgba(24, 144, 255, 0.6))' : 'none'
                }} />,
                selectable: true,
                navigationTarget: '#episode-synopsis'
            };

            sections.push(episodeSynopsisSection);
        }

        return sections;
    }, [canonicalContext, initialModeLoading, isInitialMode, chosenIdea, jsondocChecks, shouldHighlightNode]);

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