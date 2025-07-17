import { Kysely } from 'kysely';
import { DB } from '../database/types';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { computeUnifiedWorkflowState } from '../../client/utils/actionComputation';
import { ProjectDataContextType } from '../../common/types';
import { buildLineageGraph, LineageGraph } from '../../common/transform-jsondoc-framework/lineageResolution';

/**
 * Service that determines which jsondocs are "canonical" or "active" - 
 * meaning they should be displayed in components and have active particles.
 * 
 * This reuses the same logic as actionComputation.ts to ensure consistency
 * between what's displayed in the UI and what has active particles.
 */
export class CanonicalJsondocService {
    constructor(
        private db: Kysely<DB>,
        private jsondocRepo: JsondocRepository,
        private transformRepo: TransformRepository
    ) { }

    /**
     * Get all canonical (active) jsondoc IDs for a project.
     * These are the jsondocs that should be displayed in components
     * and therefore should have active particles.
     */
    async getCanonicalJsondocIds(projectId: string): Promise<Set<string>> {
        try {
            // Build project data context similar to frontend
            const projectData = await this.buildProjectDataContext(projectId);

            // Use the same computation logic as the frontend
            const workflowState = computeUnifiedWorkflowState(projectData, projectId);

            // Extract jsondoc IDs from display components
            const canonicalIds = new Set<string>();

            for (const component of workflowState.displayComponents) {
                // Extract jsondoc IDs from component props
                if (component.props.jsondoc?.id) {
                    canonicalIds.add(component.props.jsondoc.id);
                }
                if (component.props.brainstormIdea?.id) {
                    canonicalIds.add(component.props.brainstormIdea.id);
                }
                if (component.props.outlineSettings?.id) {
                    canonicalIds.add(component.props.outlineSettings.id);
                }
                if (component.props.chronicles?.id) {
                    canonicalIds.add(component.props.chronicles.id);
                }

                // Handle ideas array from idea-collection component
                if (component.props.ideas && Array.isArray(component.props.ideas)) {
                    for (const idea of component.props.ideas) {
                        if (idea.id) {
                            canonicalIds.add(idea.id);
                        }
                    }
                }
            }

            // Also include jsondocs from workflow parameters
            const params = workflowState.parameters;
            if (params.brainstormInput?.id) {
                canonicalIds.add(params.brainstormInput.id);
            }
            if (params.chosenBrainstormIdea?.id) {
                canonicalIds.add(params.chosenBrainstormIdea.id);
            }
            if (params.latestOutlineSettings?.id) {
                canonicalIds.add(params.latestOutlineSettings.id);
            }
            if (params.latestChronicles?.id) {
                canonicalIds.add(params.latestChronicles.id);
            }
            if (params.effectiveBrainstormIdeas && Array.isArray(params.effectiveBrainstormIdeas)) {
                for (const idea of params.effectiveBrainstormIdeas) {
                    if (idea.id) {
                        canonicalIds.add(idea.id);
                    }
                }
            }

            return canonicalIds;

        } catch (error) {
            console.error(`[CanonicalJsondocService] Failed to compute canonical jsondocs for project ${projectId}:`, error);
            // Fallback: return empty set to deactivate all particles for this project
            return new Set<string>();
        }
    }

    /**
     * Check if a specific jsondoc is canonical (should have active particles)
     */
    async isJsondocCanonical(jsondocId: string, projectId: string): Promise<boolean> {
        const canonicalIds = await this.getCanonicalJsondocIds(projectId);
        return canonicalIds.has(jsondocId);
    }

    /**
     * Build project data context similar to what the frontend uses
     */
    private async buildProjectDataContext(projectId: string): Promise<ProjectDataContextType> {
        try {
            // Fetch all project data in parallel using the correct method names
            const [
                jsondocs,
                transforms,
                humanTransforms,
                transformInputs,
                transformOutputs,
                llmPrompts,
                llmTransforms
            ] = await Promise.all([
                this.jsondocRepo.getAllProjectJsondocsForLineage(projectId),
                this.jsondocRepo.getAllProjectTransformsForLineage(projectId),
                this.jsondocRepo.getAllProjectHumanTransformsForLineage(projectId),
                this.jsondocRepo.getAllProjectTransformInputsForLineage(projectId),
                this.jsondocRepo.getAllProjectTransformOutputsForLineage(projectId),
                // For now, return empty arrays for LLM data
                Promise.resolve([]),
                Promise.resolve([])
            ]);

            // Build lineage graph using the same logic as frontend
            const lineageGraph = buildLineageGraph(
                jsondocs,
                transforms,
                humanTransforms,
                transformInputs,
                transformOutputs
            );

            // Create a minimal ProjectDataContextType for computation
            return {
                jsondocs,
                transforms,
                humanTransforms,
                transformInputs,
                transformOutputs,
                llmPrompts,
                llmTransforms,
                lineageGraph,
                isLoading: false,
                isError: false,
                error: null,
                // Mock functions - not used in computation
                getIdeaCollections: () => jsondocs.filter(j => j.schema_type === 'brainstorm_collection'),
                getJsondocAtPath: () => null,
                getLatestVersionForPath: () => null,
                getLineageGraph: () => lineageGraph,
                getJsondocById: () => undefined,
                getTransformById: () => undefined,
                getHumanTransformsForJsondoc: () => [],
                getTransformInputsForTransform: () => [],
                getTransformOutputsForTransform: () => [],
                createTransform: {} as any,
                updateJsondoc: {} as any,
                createHumanTransform: {} as any,
                localUpdates: new Map(),
                addLocalUpdate: () => { },
                removeLocalUpdate: () => { },
                hasLocalUpdate: () => false,
                mutationStates: {
                    jsondocs: new Map(),
                    transforms: new Map(),
                    humanTransforms: new Map()
                },
                setEntityMutationState: () => { },
                clearEntityMutationState: () => { }
            };

        } catch (error) {
            console.error(`[CanonicalJsondocService] Failed to build project data context:`, error);
            // Return minimal context to prevent crashes
            const emptyLineageGraph: LineageGraph = {
                nodes: new Map(),
                edges: new Map(),
                paths: new Map(),
                rootNodes: new Set<string>()
            };
            return {
                jsondocs: [],
                transforms: [],
                humanTransforms: [],
                transformInputs: [],
                transformOutputs: [],
                llmPrompts: [],
                llmTransforms: [],
                lineageGraph: emptyLineageGraph,
                isLoading: false,
                isError: true,
                error: error instanceof Error ? error : new Error('Unknown error'),
                getIdeaCollections: () => [],
                getJsondocAtPath: () => null,
                getLatestVersionForPath: () => null,
                getLineageGraph: () => emptyLineageGraph,
                getJsondocById: () => undefined,
                getTransformById: () => undefined,
                getHumanTransformsForJsondoc: () => [],
                getTransformInputsForTransform: () => [],
                getTransformOutputsForTransform: () => [],
                createTransform: {} as any,
                updateJsondoc: {} as any,
                createHumanTransform: {} as any,
                localUpdates: new Map(),
                addLocalUpdate: () => { },
                removeLocalUpdate: () => { },
                hasLocalUpdate: () => false,
                mutationStates: {
                    jsondocs: new Map(),
                    transforms: new Map(),
                    humanTransforms: new Map()
                },
                setEntityMutationState: () => { },
                clearEntityMutationState: () => { }
            };
        }
    }

} 