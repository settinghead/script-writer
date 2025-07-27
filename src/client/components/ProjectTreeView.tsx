import React, { useMemo, useCallback, useEffect, useState } from 'react';
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
    ClockCircleOutlined,
    PlayCircleOutlined
} from '@ant-design/icons';
import { useProjectInitialMode } from '../transform-jsondoc-framework/useLineageResolution';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useCurrentSection, type CurrentSection } from '../hooks/useCurrentSection';
import { useChosenBrainstormIdea } from '../hooks/useChosenBrainstormIdea';
import { useScrollSync } from '../contexts/ScrollSyncContext';

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
    const { currentPosition, scrollTo } = useScrollSync();

    // State for expanded keys and selected keys
    const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
    const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);

    // Use pre-computed canonical context from project data
    const canonicalContext = projectData.canonicalContext === "pending" || projectData.canonicalContext === "error"
        ? null
        : projectData.canonicalContext;

    // Extract all episodes from canonical episode synopsis list at the top level
    const allEpisodes = useMemo(() => {
        const episodes = [];
        if (canonicalContext?.canonicalEpisodeSynopsisList) {
            for (const synopsisJsondoc of canonicalContext.canonicalEpisodeSynopsisList) {
                try {
                    const data = typeof synopsisJsondoc.data === 'string'
                        ? JSON.parse(synopsisJsondoc.data)
                        : synopsisJsondoc.data;
                    if (data.episodes && Array.isArray(data.episodes)) {
                        episodes.push(...data.episodes.map((episode: any) => ({
                            ...episode,
                            groupTitle: data.groupTitle,
                            episodeRange: data.episodeRange,
                            jsondocId: synopsisJsondoc.id
                        })));
                    } else if (data.episodeNumber) {
                        episodes.push({
                            ...data,
                            jsondocId: synopsisJsondoc.id
                        });
                    }
                } catch (error) {
                    console.warn('Failed to parse episode synopsis data:', error);
                }
            }
        }
        return episodes.sort((a: any, b: any) => a.episodeNumber - b.episodeNumber);
    }, [canonicalContext?.canonicalEpisodeSynopsisList]);

    // Extract all scripts similarly
    const allScripts = useMemo(() => {
        const scripts = [];
        if (canonicalContext?.canonicalEpisodeScriptsList) {
            for (const scriptJsondoc of canonicalContext.canonicalEpisodeScriptsList) {
                try {
                    const data = typeof scriptJsondoc.data === 'string'
                        ? JSON.parse(scriptJsondoc.data)
                        : scriptJsondoc.data;
                    if (data.episodes && Array.isArray(data.episodes)) {
                        scripts.push(...data.episodes.map((episode: any) => ({
                            ...episode,
                            groupTitle: data.groupTitle,
                            episodeRange: data.episodeRange,
                            jsondocId: scriptJsondoc.id
                        })));
                    } else if (data.episodeNumber) {
                        scripts.push({
                            ...data,
                            jsondocId: scriptJsondoc.id
                        });
                    }
                } catch (error) {
                    console.warn('Failed to parse episode script data:', error);
                }
            }
        }
        return scripts.sort((a: any, b: any) => a.episodeNumber - b.episodeNumber);
    }, [canonicalContext?.canonicalEpisodeScriptsList]);

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
            '#ideation-edit': 'ideation-edit',
            '#剧本设定': '剧本设定',
            '#chronicles': 'chronicles',
            '#episode-planning': 'episode-planning',
            '#episode-content': 'episode-content'
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
            // Check for 剧本设定
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

        // 3. 剧本设定 SECTION - only show if 剧本设定 jsondocs exist
        if (jsondocChecks.hasOutlineSettings) {
            const outlineSettingsHighlighted = shouldHighlightNode('#剧本设定');

            const outlineSettingsSection: ProjectTreeNode = {
                key: '剧本设定-section',
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
                navigationTarget: '#剧本设定'
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
                            分集结构
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

        // 6. EPISODE CONTENT SECTION - with hierarchical episodes including scripts
        if (jsondocChecks.hasEpisodeSynopsis || (canonicalContext?.canonicalEpisodeScriptsList?.length ?? 0) > 0) {
            // Get unique sorted episode numbers from both synopses and scripts
            const episodeNumbers = [...new Set([
                ...allEpisodes.map(e => e.episodeNumber),
                ...allScripts.map(s => s.episodeNumber)
            ])].sort((a, b) => a - b);

            // Build episode children nodes with sub-nodes for synopsis and script
            const episodeChildren: ProjectTreeNode[] = episodeNumbers.map((num) => {
                const synopsis = allEpisodes.find(e => e.episodeNumber === num);
                const script = allScripts.find(s => s.episodeNumber === num);
                const episodeId = `episode-${num}`;
                const isEpisodeHighlighted = currentPosition?.section === 'episode-content' &&
                    currentPosition?.subId?.startsWith(episodeId);

                // Get episode title from synopsis data
                let episodeTitle = `第${num}集`;
                if (synopsis && synopsis.title) {
                    episodeTitle = `第${num}集: ${synopsis.title}`;
                }

                // Sub-children for synopsis and script
                const subChildren: ProjectTreeNode[] = [];

                if (synopsis) {
                    const synopsisId = `${episodeId}-synopsis`;
                    const isSynopsisHighlighted = currentPosition?.subId === synopsisId;
                    subChildren.push({
                        key: synopsisId,
                        title: (
                            <Text style={{
                                color: isSynopsisHighlighted ? '#ffffff' : '#ccc',
                                fontWeight: isSynopsisHighlighted ? 600 : 400,
                                padding: isSynopsisHighlighted ? '2px 6px' : '0',
                                borderRadius: '4px',
                                background: isSynopsisHighlighted ?
                                    'linear-gradient(135deg, rgba(24, 144, 255, 0.3) 0%, rgba(64, 169, 255, 0.2) 100%)' :
                                    'none',
                                border: isSynopsisHighlighted ? '1px solid rgba(24, 144, 255, 0.5)' : 'none',
                                transition: 'all 0.2s ease-in-out',
                                display: 'inline-block'
                            }}>
                                📖 大纲
                            </Text>
                        ),
                        selectable: true,
                        navigationTarget: `#${synopsisId}`,
                    });
                }

                if (script) {
                    const scriptId = `${episodeId}-script`;
                    const isScriptHighlighted = currentPosition?.subId === scriptId;
                    subChildren.push({
                        key: scriptId,
                        title: (
                            <Text style={{
                                color: isScriptHighlighted ? '#ffffff' : '#ccc',
                                fontWeight: isScriptHighlighted ? 600 : 400,
                                padding: isScriptHighlighted ? '2px 6px' : '0',
                                borderRadius: '4px',
                                background: isScriptHighlighted ?
                                    'linear-gradient(135deg, rgba(24, 144, 255, 0.3) 0%, rgba(64, 169, 255, 0.2) 100%)' :
                                    'none',
                                border: isScriptHighlighted ? '1px solid rgba(24, 144, 255, 0.5)' : 'none',
                                transition: 'all 0.2s ease-in-out',
                                display: 'inline-block'
                            }}>
                                📝 剧本
                            </Text>
                        ),
                        selectable: true,
                        navigationTarget: `#${scriptId}`,
                    });
                }

                return {
                    key: episodeId,
                    title: (
                        <Space style={{
                            padding: isEpisodeHighlighted ? '2px 6px' : '0',
                            borderRadius: '4px',
                            background: isEpisodeHighlighted ?
                                'linear-gradient(135deg, rgba(24, 144, 255, 0.3) 0%, rgba(64, 169, 255, 0.2) 100%)' :
                                'none',
                            border: isEpisodeHighlighted ? '1px solid rgba(24, 144, 255, 0.5)' : 'none',
                            transition: 'all 0.2s ease-in-out',
                            display: 'inline-flex',
                            alignItems: 'center'
                        }}>
                            <Text style={{
                                color: isEpisodeHighlighted ? '#ffffff' : '#ccc',
                                fontSize: '13px',
                                fontWeight: isEpisodeHighlighted ? 600 : 400,
                                textShadow: isEpisodeHighlighted ? '0 0 6px rgba(24, 144, 255, 0.6)' : 'none'
                            }}>
                                {episodeTitle}
                            </Text>
                        </Space>
                    ),
                    icon: <PlayCircleOutlined style={{
                        color: isEpisodeHighlighted ? '#1890ff' : '#666',
                        fontSize: '12px',
                    }} />,
                    selectable: subChildren.length === 0,
                    navigationTarget: subChildren.length === 0 ? `#${episodeId}` : undefined,
                    children: subChildren.length > 0 ? subChildren : undefined,
                };
            });

            const episodeContentHighlighted = shouldHighlightNode('#episode-content') ||
                (currentPosition?.section === 'episode-content' && !currentPosition?.subId);

            const episodeContentSection: ProjectTreeNode = {
                key: 'episode-content-section',
                title: (
                    <Space style={{
                        padding: episodeContentHighlighted ? '4px 8px' : '0',
                        borderRadius: '6px',
                        background: episodeContentHighlighted ?
                            'linear-gradient(135deg, rgba(24, 144, 255, 0.25) 0%, rgba(64, 169, 255, 0.15) 100%)' :
                            'none',
                        border: episodeContentHighlighted ? '1px solid rgba(24, 144, 255, 0.4)' : 'none',
                        boxShadow: episodeContentHighlighted ?
                            '0 0 20px rgba(24, 144, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)' :
                            'none',
                        transition: 'all 0.2s ease-in-out',
                        display: 'inline-flex',
                        alignItems: 'center'
                    }}>
                        <Text style={{
                            color: episodeContentHighlighted ? '#ffffff' : '#fff',
                            fontWeight: episodeContentHighlighted ? 700 : 500,
                            textShadow: episodeContentHighlighted ? '0 0 8px rgba(24, 144, 255, 0.8)' : 'none'
                        }}>
                            分集内容
                        </Text>
                        <CheckCircleOutlined style={{
                            color: episodeContentHighlighted ? '#52c41a' : '#52c41a',
                            fontSize: '12px',
                            marginLeft: '4px'
                        }} />
                        {episodeNumbers.length > 0 && (
                            <Tag
                                color={episodeContentHighlighted ? "blue" : "default"}
                                style={{
                                    boxShadow: episodeContentHighlighted ? '0 0 8px rgba(24, 144, 255, 0.4)' : 'none',
                                    border: episodeContentHighlighted ? '1px solid rgba(24, 144, 255, 0.6)' : undefined,
                                    marginLeft: '8px'
                                }}
                            >
                                {episodeNumbers.length}集
                            </Tag>
                        )}
                    </Space>
                ),
                icon: <BookOutlined style={{
                    color: episodeContentHighlighted ? '#1890ff' : '#666',
                    filter: episodeContentHighlighted ? 'drop-shadow(0 0 4px rgba(24, 144, 255, 0.6))' : 'none'
                }} />,
                selectable: true,
                navigationTarget: '#episode-content',
                children: episodeChildren.length > 0 ? episodeChildren : undefined
            };

            sections.push(episodeContentSection);
        }

        return sections;
    }, [canonicalContext, initialModeLoading, isInitialMode, chosenIdea, jsondocChecks, shouldHighlightNode, currentPosition, allEpisodes, allScripts]);

    // Handle tree node selection - scroll using scroll sync system
    const handleSelect = useCallback((selectedKeys: React.Key[], info: any) => {
        if (selectedKeys.length === 0) return;

        const node = info.node as ProjectTreeNode;
        if (node.navigationTarget) {
            // Parse navigation target to determine section and subId
            if (node.navigationTarget.startsWith('#episode-')) {
                const targetId = node.navigationTarget.substring(1); // Remove '#'

                // Check if it's a sub-item (synopsis or script)
                if (targetId.includes('-synopsis') || targetId.includes('-script')) {
                    // Extract episode number and type
                    const match = targetId.match(/^episode-(\d+)-(synopsis|script)$/);
                    if (match) {
                        const episodeNumber = match[1];
                        const type = match[2];

                        // Scroll to the specific episode content with sub-type
                        scrollTo('episode-content', `episode-${episodeNumber}-${type}`);
                    }
                } else {
                    // Regular episode navigation
                    scrollTo('episode-content', targetId);
                }
            } else {
                // Section-level navigation
                const section = node.navigationTarget.substring(1); // Remove '#'
                const sectionMapping: Record<string, string> = {
                    'ideas': 'ideas',
                    'ideation-edit': 'ideation-edit',
                    '剧本设定': '剧本设定',
                    'chronicles': 'chronicles',
                    'episode-planning': 'episode-planning',
                    'episode-content': 'episode-content'
                };

                const mappedSection = sectionMapping[section] || section;
                scrollTo(mappedSection);
            }
        }
    }, [scrollTo]);

    // Sync tree state with current scroll position
    useEffect(() => {
        if (!currentPosition) return;

        const { section, subId } = currentPosition;

        // Update selected keys
        if (subId) {
            // Sub-item is selected
            setSelectedKeys([subId]);

            // Auto-expand parent section if needed
            const parentSectionKey = `${section}-section`;
            setExpandedKeys(prev => {
                if (!prev.includes(parentSectionKey)) {
                    return [...prev, parentSectionKey];
                }
                return prev;
            });
        } else {
            // Section is selected
            const sectionKey = `${section}-section`;
            setSelectedKeys([sectionKey]);
        }
    }, [currentPosition]);

    // Initialize expanded keys to show all sections by default
    useEffect(() => {
        if (treeData.length > 0 && expandedKeys.length === 0) {
            const allSectionKeys = treeData.map(node => node.key);
            // Also expand all episode nodes
            const episodeKeys: string[] = [];
            treeData.forEach(node => {
                if (node.children) {
                    node.children.forEach(child => {
                        episodeKeys.push(child.key);
                    });
                }
            });
            setExpandedKeys([...allSectionKeys, ...episodeKeys]);
        }
    }, [treeData, expandedKeys.length]);

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
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <div style={{
                flex: 1,
                overflow: 'auto',
                minHeight: 0 // Important for flex child to be scrollable
            }}>
                <Tree
                    treeData={treeData}
                    showIcon={true}
                    selectable={true}
                    onSelect={handleSelect}
                    selectedKeys={selectedKeys}
                    expandedKeys={expandedKeys}
                    onExpand={setExpandedKeys}
                    style={{
                        background: 'transparent',
                        color: '#fff'
                    }}
                />
            </div>
        </div>
    );
};

export default ProjectTreeView; 