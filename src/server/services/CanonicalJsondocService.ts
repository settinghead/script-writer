import { Kysely } from 'kysely';
import { DB } from '../database/types';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { buildLineageGraph } from '../../common/transform-jsondoc-framework/lineageResolution';
import {
    computeCanonicalJsondocsFromLineage,
    extractCanonicalJsondocIds
} from '../../common/canonicalJsondocLogic';

/**
 * Service for determining canonical jsondocs - those that should be displayed in UI
 * and have active particles. Uses the same logic as the frontend action computation.
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
            // Get all project data using the correct method names
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

            // Use shared canonical jsondoc computation
            const canonicalContext = computeCanonicalJsondocsFromLineage(
                lineageGraph,
                jsondocs,
                transforms,
                humanTransforms,
                transformInputs,
                transformOutputs
            );

            // Extract canonical jsondoc IDs
            const canonicalIds = extractCanonicalJsondocIds(canonicalContext);

            return canonicalIds;

        } catch (error) {
            console.error(`[CanonicalJsondocService] Failed to compute canonical jsondocs for project ${projectId}:`, error);
            return new Set();
        }
    }

    /**
     * Check if a specific jsondoc is canonical (should be displayed in UI)
     */
    async isJsondocCanonical(jsondocId: string, projectId: string): Promise<boolean> {
        const canonicalIds = await this.getCanonicalJsondocIds(projectId);
        return canonicalIds.has(jsondocId);
    }
} 