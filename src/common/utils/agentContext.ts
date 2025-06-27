import {
    extractEffectiveBrainstormIdeas,
    convertEffectiveIdeasToIdeaWithTitle
} from './lineageResolution';
import type {
    ElectricArtifact,
    ElectricTransform,
    ElectricHumanTransform,
    ElectricTransformInput,
    ElectricTransformOutput
} from '../types';

export interface ProjectDataForContext {
    artifacts: ElectricArtifact[];
    transforms: ElectricTransform[];
    humanTransforms: ElectricHumanTransform[];
    transformInputs: ElectricTransformInput[];
    transformOutputs: ElectricTransformOutput[];
}

/**
 * Prepare prompt context with effective brainstorm ideas using principled lineage resolution
 */
export function prepareAgentPromptContext({
    artifacts,
    transforms,
    humanTransforms,
    transformInputs,
    transformOutputs
}: ProjectDataForContext): string {
    try {
        // Use principled lineage resolution to get effective brainstorm ideas
        const effectiveIdeas = extractEffectiveBrainstormIdeas(
            artifacts,
            transforms,
            humanTransforms,
            transformInputs,
            transformOutputs
        );

        if (effectiveIdeas.length === 0) {
            return '当前项目还没有故事创意。';
        }

        // Convert to IdeaWithTitle format for easier handling
        const ideaList = convertEffectiveIdeasToIdeaWithTitle(effectiveIdeas, artifacts);

        let contextString = '**当前项目的故事创意：**\n\n';

        // Format ideas for LLM consumption
        ideaList.forEach((idea, index) => {
            const statusIndicator = idea.artifactId !== idea.originalArtifactId ? ' [已编辑]' : ' [AI生成]';
            const title = idea.title || `想法 ${index + 1}`;
            const body = idea.body || '内容加载中...';

            contextString += `${index + 1}. **${title}**${statusIndicator} (ID: ${idea.artifactId})\n`;
            contextString += `   ${body}\n\n`;
        });


        return contextString;

    } catch (error) {
        console.error('[prepareAgentPromptContext] Error preparing prompt context:', error);
        return '无法获取项目背景信息。';
    }
} 