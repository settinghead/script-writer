import { Kysely } from 'kysely';
import { DB } from '../database/types';
import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
import {
    buildLineageGraph,
    type LineageGraph
} from '../../common/transform-jsondoc-framework/lineageResolution';
import {
    computeCanonicalJsondocsFromLineage,
    extractCanonicalJsondocIds,
    type CanonicalJsondocContext
} from '../../common/canonicalJsondocLogic';

export interface ProjectCanonicalData {
    lineageGraph: LineageGraph;
    canonicalContext: CanonicalJsondocContext;
    canonicalIds: Set<string>;
}

/**
 * Service for determining canonical jsondocs - those that should be displayed in UI
 * and have active particles. Uses the same logic as the frontend action computation.
 */
export class CanonicalJsondocService {
    constructor(
        private db: Kysely<DB>,
        private jsondocRepo: TransformJsondocRepository,
        private transformRepo: TransformJsondocRepository,
    ) { }

    /**
     * Compute complete canonical data for a project including lineage graph and canonical context
     * This centralizes the common pattern used across multiple server services
     */
    async getProjectCanonicalData(projectId: string): Promise<ProjectCanonicalData> {
        try {
            // Load all project data
            const [jsondocs, transforms, humanTransforms, transformInputs, transformOutputs] = await Promise.all([
                this.jsondocRepo.getAllProjectJsondocsForLineage(projectId),
                this.jsondocRepo.getAllProjectTransformsForLineage(projectId),
                this.jsondocRepo.getAllProjectHumanTransformsForLineage(projectId),
                this.jsondocRepo.getAllProjectTransformInputsForLineage(projectId),
                this.jsondocRepo.getAllProjectTransformOutputsForLineage(projectId)
            ]);

            // Build lineage graph
            const lineageGraph = buildLineageGraph(
                jsondocs,
                transforms,
                humanTransforms,
                transformInputs,
                transformOutputs
            );

            // Compute canonical context
            const canonicalContext = computeCanonicalJsondocsFromLineage(
                lineageGraph,
                jsondocs,
                transforms,
                humanTransforms,
                transformInputs,
                transformOutputs
            );

            // Extract canonical IDs
            const canonicalIds = extractCanonicalJsondocIds(canonicalContext);

            return {
                lineageGraph,
                canonicalContext,
                canonicalIds
            };
        } catch (error) {
            console.error(`[CanonicalJsondocService] Failed to compute canonical data for project ${projectId}:`, error);
            // Return empty/default values
            return {
                lineageGraph: {
                    nodes: new Map(),
                    edges: new Map(),
                    rootNodes: new Set(),
                    paths: new Map()
                },
                canonicalContext: {
                    canonicalBrainstormIdea: null,
                    canonicalBrainstormCollection: null,
                    canonicalOutlineSettings: null,
                    canonicalChronicles: null,
                    canonicalEpisodePlanning: null,
                    canonicalBrainstormInput: null,
                    canonicalEpisodeSynopsisList: [],
                    canonicalEpisodeScriptsList: [],
                    hasActiveTransforms: false,
                    activeTransforms: [],
                    lineageGraph: { nodes: new Map(), edges: new Map(), rootNodes: new Set(), paths: new Map() },
                    rootNodes: [],
                    leafNodes: []
                },
                canonicalIds: new Set()
            };
        }
    }

    /**
     * Legacy method - now uses the centralized computation
     */
    async getCanonicalJsondocIds(projectId: string): Promise<Set<string>> {
        const canonicalData = await this.getProjectCanonicalData(projectId);
        return canonicalData.canonicalIds;
    }

    /**
     * Check if a specific jsondoc is canonical (should be displayed in UI)
     */
    async isJsondocCanonical(jsondocId: string, projectId: string): Promise<boolean> {
        const canonicalIds = await this.getCanonicalJsondocIds(projectId);
        return canonicalIds.has(jsondocId);
    }

    /**
     * Maybe supply an auto-generated project title if not manually overridden.
     */
    async maybeSupplyProjectTitle(projectId: string): Promise<void> {
        try {
            // Check project override flag first
            const projectRow: any = await this.db
                .selectFrom('projects')
                .selectAll()
                .where('id', '=', projectId)
                .executeTakeFirst();

            if (!projectRow) return;
            if (projectRow.project_title_manual_override) return;

            // Load lineage-dependent data
            const [jsondocs, transforms, humanTransforms, transformInputs, transformOutputs] = await Promise.all([
                this.jsondocRepo.getAllProjectJsondocsForLineage(projectId),
                this.jsondocRepo.getAllProjectTransformsForLineage(projectId),
                this.jsondocRepo.getAllProjectHumanTransformsForLineage(projectId),
                this.jsondocRepo.getAllProjectTransformInputsForLineage(projectId),
                this.jsondocRepo.getAllProjectTransformOutputsForLineage(projectId)
            ]);

            const lineageGraph = buildLineageGraph(
                jsondocs,
                transforms,
                humanTransforms,
                transformInputs,
                transformOutputs
            );

            const { deduceProjectTitle } = await import('../../common/utils/projectTitleDeduction.js');
            const title = deduceProjectTitle(lineageGraph as any, jsondocs as any);

            if (title && title.trim().length > 0 && title !== projectRow.title) {
                await this.db
                    .updateTable('projects')
                    .set({ title, updated_at: new Date() } as any)
                    .where('id', '=', projectId)
                    .execute();
            }
        } catch (error) {
            console.error('[CanonicalJsondocService] maybeSupplyProjectTitle failed:', error);
        }
    }
} 