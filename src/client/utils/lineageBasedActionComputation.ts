import React from 'react';
import {
    LineageGraph,
    type WorkflowNode
} from '../../common/transform-jsondoc-framework/lineageResolution';
import type {
    ElectricJsondoc,
    ElectricTransform,
    ElectricHumanTransform,
    ElectricTransformInput,
    ElectricTransformOutput
} from '../../common/types';
import {
    CanonicalJsondocContext,
    computeCanonicalJsondocsFromLineage
} from '../../common/canonicalJsondocLogic';

// Import action components
import BrainstormCreationActions from '../components/actions/BrainstormCreationActions';
import BrainstormInputForm from '../components/actions/BrainstormInputForm';
import BrainstormIdeaSelection from '../components/actions/BrainstormIdeaSelection';
import OutlineGenerationForm from '../components/actions/OutlineGenerationForm';
import ChroniclesGenerationAction from '../components/actions/ChroniclesGenerationAction';
import EpisodePlanningAction from '../components/actions/EpisodePlanningAction';
import EpisodeGenerationAction from '../components/actions/EpisodeGenerationAction';
import EpisodeSynopsisGenerationAction from '../components/actions/EpisodeSynopsisGenerationAction';
import EpisodeScriptGenerationAction from '../components/actions/EpisodeScriptGenerationAction';

// Action item definition
export interface ActionItem {
    id: string;
    type: 'form' | 'button' | 'selection';
    title: string;
    description?: string;
    component: React.ComponentType<any>;
    props: Record<string, any>;
    enabled: boolean;
    priority: number; // For ordering (lower = higher priority)
}

// New props interface for action components
export interface ActionComponentProps {
    projectId: string;
    onSuccess?: (result?: any) => void;
    onError?: (error: Error) => void;

    // Canonical jsondocs (no more parsing needed)
    jsondocs: {
        brainstormIdea?: ElectricJsondoc;
        brainstormCollection?: ElectricJsondoc;
        outlineSettings?: ElectricJsondoc;
        chronicles?: ElectricJsondoc;
        episodePlanning?: ElectricJsondoc;
        brainstormInput?: ElectricJsondoc;
    };

    // Workflow context
    workflowContext: {
        hasActiveTransforms: boolean;
        workflowNodes: WorkflowNode[];
    };

    // Additional context if needed
    metadata?: Record<string, any>;
}

// Lineage-based action context (extends the shared canonical context)
export interface LineageBasedActionContext extends CanonicalJsondocContext {
    // Additional frontend-specific context can be added here if needed
}

// Result of action computation
export interface ComputedActions {
    actionContext: LineageBasedActionContext;
    actions: ActionItem[];
}

/**
 * Main function to compute available actions from lineage graph
 */
export function computeActionsFromLineage(
    lineageGraph: LineageGraph,
    jsondocs: ElectricJsondoc[],
    transforms: ElectricTransform[],
    humanTransforms: ElectricHumanTransform[],
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[]
): ComputedActions {
    // 1. Use shared canonical jsondoc logic
    const canonicalContext = computeCanonicalJsondocsFromLineage(
        lineageGraph,
        jsondocs,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    // 2. Extend with frontend-specific context if needed
    const actionContext: LineageBasedActionContext = {
        ...canonicalContext
        // Add frontend-specific extensions here if needed
    };

    // 3. Generate actions based on context
    const actions = generateActionsFromContext(actionContext);

    return {
        actionContext,
        actions,
    };
}

// Helper function to parse episode range like "1-3" to [1, 2, 3]
function parseEpisodeRange(episodeRange: string): number[] {
    const parts = episodeRange.split('-');
    if (parts.length !== 2) return [];

    const start = parseInt(parts[0]);
    const end = parseInt(parts[1]);

    if (isNaN(start) || isNaN(end) || start > end) return [];

    const episodes = [];
    for (let i = start; i <= end; i++) {
        episodes.push(i);
    }
    return episodes;
}

/**
 * Generate actions for a specific workflow stage
 */
function generateActionsFromContext(context: LineageBasedActionContext): ActionItem[] {
    if (context.hasActiveTransforms) {
        return [];
    }

    const actions: ActionItem[] = [];

    // Add brainstorm creation actions only if no input and no existing ideas
    if (!context.canonicalBrainstormInput && !context.canonicalBrainstormIdea && !context.canonicalBrainstormCollection) {
        actions.push({
            id: 'brainstorm_creation',
            type: 'button',
            title: '创建头脑风暴',
            description: '使用AI辅助生成创意想法',
            component: BrainstormCreationActions,
            props: {
                jsondocs: {
                    brainstormIdea: context.canonicalBrainstormIdea,
                    brainstormCollection: context.canonicalBrainstormCollection,
                    outlineSettings: context.canonicalOutlineSettings,
                    chronicles: context.canonicalChronicles,
                    episodePlanning: context.canonicalEpisodePlanning,
                    brainstormInput: context.canonicalBrainstormInput
                },
                workflowContext: {
                    hasActiveTransforms: context.hasActiveTransforms,
                    workflowNodes: context.workflowNodes
                }
            },
            enabled: true,
            priority: 1
        });
    }

    // Add brainstorm input form if we have brainstorm input but no collection/ideas yet
    if (context.canonicalBrainstormInput && !context.canonicalBrainstormCollection && !context.canonicalBrainstormIdea) {
        actions.push({
            id: 'brainstorm_input_form',
            type: 'form',
            title: '生成头脑风暴',
            description: '基于设定的参数生成创意想法',
            component: BrainstormInputForm,
            props: {
                jsondocs: {
                    brainstormIdea: context.canonicalBrainstormIdea,
                    brainstormCollection: context.canonicalBrainstormCollection,
                    outlineSettings: context.canonicalOutlineSettings,
                    chronicles: context.canonicalChronicles,
                    episodePlanning: context.canonicalEpisodePlanning,
                    brainstormInput: context.canonicalBrainstormInput
                },
                workflowContext: {
                    hasActiveTransforms: context.hasActiveTransforms,
                    workflowNodes: context.workflowNodes
                }
            },
            enabled: true,
            priority: 1
        });
    }

    // Add brainstorm idea selection if we have a collection but no individual idea
    if (context.canonicalBrainstormCollection && !context.canonicalBrainstormIdea) {
        actions.push({
            id: '灵感创意_selection',
            type: 'selection',
            title: '选择创意',
            description: '从生成的创意中选择一个继续开发',
            component: BrainstormIdeaSelection,
            props: {
                jsondocs: {
                    brainstormIdea: context.canonicalBrainstormIdea,
                    brainstormCollection: context.canonicalBrainstormCollection,
                    outlineSettings: context.canonicalOutlineSettings,
                    chronicles: context.canonicalChronicles,
                    episodePlanning: context.canonicalEpisodePlanning,
                    brainstormInput: context.canonicalBrainstormInput
                },
                workflowContext: {
                    hasActiveTransforms: context.hasActiveTransforms,
                    workflowNodes: context.workflowNodes
                }
            },
            enabled: true,
            priority: 1
        });
    }

    // Add outline generation if we have a brainstorm idea but no outline
    if (context.canonicalBrainstormIdea && !context.canonicalOutlineSettings) {
        actions.push({
            id: 'outline_generation',
            type: 'form',
            title: '生成大纲',
            description: '基于选中的创意生成详细大纲',
            component: OutlineGenerationForm,
            props: {
                jsondocs: {
                    brainstormIdea: context.canonicalBrainstormIdea,
                    brainstormCollection: context.canonicalBrainstormCollection,
                    outlineSettings: context.canonicalOutlineSettings,
                    chronicles: context.canonicalChronicles,
                    episodePlanning: context.canonicalEpisodePlanning,
                    brainstormInput: context.canonicalBrainstormInput
                },
                workflowContext: {
                    hasActiveTransforms: context.hasActiveTransforms,
                    workflowNodes: context.workflowNodes
                }
            },
            enabled: true,
            priority: 1
        });
    }

    // Add chronicles generation if we have outline but no chronicles
    if (context.canonicalOutlineSettings && !context.canonicalChronicles) {
        actions.push({
            id: 'chronicles_generation',
            type: 'button',
            title: '生成分集概要',
            description: '基于大纲生成分集概要',
            component: ChroniclesGenerationAction,
            props: {
                jsondocs: {
                    brainstormIdea: context.canonicalBrainstormIdea,
                    brainstormCollection: context.canonicalBrainstormCollection,
                    outlineSettings: context.canonicalOutlineSettings,
                    chronicles: context.canonicalChronicles,
                    episodePlanning: context.canonicalEpisodePlanning,
                    brainstormInput: context.canonicalBrainstormInput
                },
                workflowContext: {
                    hasActiveTransforms: context.hasActiveTransforms,
                    workflowNodes: context.workflowNodes
                }
            },
            enabled: true,
            priority: 1
        });
    }

    // Add episode planning generation if we have chronicles but no episode planning
    if (context.canonicalChronicles && !context.canonicalEpisodePlanning) {
        actions.push({
            id: '分集结构_generation',
            type: 'form',
            title: '生成分集结构',
            description: '基于时间顺序大纲生成分集结构',
            component: EpisodePlanningAction,
            props: {
                jsondocs: {
                    brainstormIdea: context.canonicalBrainstormIdea,
                    brainstormCollection: context.canonicalBrainstormCollection,
                    outlineSettings: context.canonicalOutlineSettings,
                    chronicles: context.canonicalChronicles,
                    episodePlanning: context.canonicalEpisodePlanning,
                    brainstormInput: context.canonicalBrainstormInput
                },
                workflowContext: {
                    hasActiveTransforms: context.hasActiveTransforms,
                    workflowNodes: context.workflowNodes
                }
            },
            enabled: true,
            priority: 1
        });
    }

    // Episode synopsis generation - after episode planning, before script generation
    if (context.canonicalEpisodePlanning && context.canonicalEpisodeSynopsisList.length === 0) {
        // First group - get from episode planning
        try {
            const episodePlanningData = typeof context.canonicalEpisodePlanning.data === 'string'
                ? JSON.parse(context.canonicalEpisodePlanning.data)
                : context.canonicalEpisodePlanning.data;
            const firstGroup = episodePlanningData.episodeGroups?.[0];

            if (firstGroup) {
                actions.push({
                    id: '单集大纲生成',
                    type: 'button',
                    title: `生成第${firstGroup.episodes}集单集大纲`,
                    description: `生成"${firstGroup.groupTitle}"的详细单集大纲`,
                    component: EpisodeSynopsisGenerationAction,
                    props: {
                        jsondocs: {
                            brainstormIdea: context.canonicalBrainstormIdea,
                            brainstormCollection: context.canonicalBrainstormCollection,
                            outlineSettings: context.canonicalOutlineSettings,
                            chronicles: context.canonicalChronicles,
                            episodePlanning: context.canonicalEpisodePlanning,
                            brainstormInput: context.canonicalBrainstormInput
                        },
                        workflowContext: {
                            hasActiveTransforms: context.hasActiveTransforms,
                            workflowNodes: context.workflowNodes
                        },
                        nextGroup: {
                            groupTitle: firstGroup.groupTitle,
                            episodeRange: firstGroup.episodes,
                            episodes: parseEpisodeRange(firstGroup.episodes)
                        }
                    },
                    enabled: true,
                    priority: 1
                });
            }
        } catch (error) {
            console.warn('Failed to parse episode planning data for synopsis generation:', error);
        }
    } else if (context.canonicalEpisodePlanning && context.canonicalEpisodeSynopsisList.length > 0) {
        // Check if we need next group - now based on individual episode numbers
        try {
            const episodePlanningData = typeof context.canonicalEpisodePlanning.data === 'string'
                ? JSON.parse(context.canonicalEpisodePlanning.data)
                : context.canonicalEpisodePlanning.data;
            const allGroups = episodePlanningData.episodeGroups || [];

            // Get all completed episode numbers from individual synopsis jsondocs
            const completedEpisodeNumbers = new Set(context.canonicalEpisodeSynopsisList.map(synopsis => {
                try {
                    const data = typeof synopsis.data === 'string' ? JSON.parse(synopsis.data) : synopsis.data;
                    return data.episodeNumber; // Now looking for individual episode numbers
                } catch {
                    return null;
                }
            }).filter(num => num !== null));

            // Find the next group that has episodes not yet completed
            const nextGroup = allGroups.find((group: any) => {
                const groupEpisodeNumbers = parseEpisodeRange(group.episodes);
                return groupEpisodeNumbers.some(episodeNum => !completedEpisodeNumbers.has(episodeNum));
            });

            if (nextGroup) {
                actions.push({
                    id: '单集大纲生成',
                    type: 'button',
                    title: `生成第${nextGroup.episodes}集单集大纲`,
                    description: `生成"${nextGroup.groupTitle}"的详细单集大纲`,
                    component: EpisodeSynopsisGenerationAction,
                    props: {
                        jsondocs: {
                            brainstormIdea: context.canonicalBrainstormIdea,
                            brainstormCollection: context.canonicalBrainstormCollection,
                            outlineSettings: context.canonicalOutlineSettings,
                            chronicles: context.canonicalChronicles,
                            episodePlanning: context.canonicalEpisodePlanning,
                            brainstormInput: context.canonicalBrainstormInput
                        },
                        workflowContext: {
                            hasActiveTransforms: context.hasActiveTransforms,
                            workflowNodes: context.workflowNodes
                        },
                        nextGroup: {
                            groupTitle: nextGroup.groupTitle,
                            episodeRange: nextGroup.episodes,
                            episodes: parseEpisodeRange(nextGroup.episodes)
                        }
                    },
                    enabled: true,
                    priority: 1
                });
            }
        } catch (error) {
            console.warn('Failed to parse episode planning data for next group detection:', error);
        }
    }

    // Episode script generation - sequential, next episode only
    if (context.canonicalEpisodeSynopsisList.length > 0) {
        // Find next episode that needs script generation
        const existingScriptEpisodes = new Set(
            context.canonicalEpisodeScriptsList.map(script => {
                try {
                    const data = typeof script.data === 'string' ? JSON.parse(script.data) : script.data;
                    return data.episodeNumber;
                } catch {
                    return null;
                }
            }).filter(num => num !== null)
        );

        // Find the next episode in sequence that has synopsis but no script
        const nextEpisodeForScript = context.canonicalEpisodeSynopsisList
            .map(synopsis => {
                try {
                    const data = typeof synopsis.data === 'string' ? JSON.parse(synopsis.data) : synopsis.data;
                    return { episodeNumber: data.episodeNumber, synopsis };
                } catch {
                    return null;
                }
            })
            .filter(item => item !== null)
            .sort((a, b) => a.episodeNumber - b.episodeNumber)
            .find(item => !existingScriptEpisodes.has(item.episodeNumber));

        if (nextEpisodeForScript) {
            // Find previous episode script for context (if exists)
            const previousEpisodeNumber = nextEpisodeForScript.episodeNumber - 1;
            const previousScript = context.canonicalEpisodeScriptsList.find(script => {
                try {
                    const data = typeof script.data === 'string' ? JSON.parse(script.data) : script.data;
                    return data.episodeNumber === previousEpisodeNumber;
                } catch {
                    return false;
                }
            });

            actions.push({
                id: '单集剧本_generation',
                type: 'button',
                title: `生成第${nextEpisodeForScript.episodeNumber}集剧本`,
                description: `基于分集大纲生成完整剧本内容`,
                component: EpisodeScriptGenerationAction,
                props: {
                    jsondocs: {
                        brainstormIdea: context.canonicalBrainstormIdea,
                        brainstormCollection: context.canonicalBrainstormCollection,
                        outlineSettings: context.canonicalOutlineSettings,
                        chronicles: context.canonicalChronicles,
                        episodePlanning: context.canonicalEpisodePlanning,
                        brainstormInput: context.canonicalBrainstormInput,
                        episodeSynopsis: nextEpisodeForScript.synopsis,
                        previousEpisodeScript: previousScript
                    },
                    workflowContext: {
                        hasActiveTransforms: context.hasActiveTransforms,
                        workflowNodes: context.workflowNodes
                    },
                    targetEpisode: {
                        episodeNumber: nextEpisodeForScript.episodeNumber,
                        synopsisId: nextEpisodeForScript.synopsis.id
                    }
                },
                enabled: true,
                priority: 1
            });
        }
    }

    return actions;
} 