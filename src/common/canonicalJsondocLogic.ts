import {
    LineageGraph,
    findMainWorkflowPath,
    type WorkflowNode
} from './transform-jsondoc-framework/lineageResolution';
import type {
    ElectricJsondoc,
    ElectricTransform,
    ElectricHumanTransform,
    ElectricTransformInput,
    ElectricTransformOutput
} from './types';
import { applyPatch, deepClone } from 'fast-json-patch';

// Core canonical jsondoc context (without React components)
export interface CanonicalJsondocContext {
    // Canonical jsondocs by type (most recent/derived version for each type)
    canonicalBrainstormIdea: ElectricJsondoc | null;
    canonicalBrainstormCollection: ElectricJsondoc | null;
    canonicalOutlineSettings: ElectricJsondoc | null;
    canonicalChronicles: ElectricJsondoc | null;
    canonicalEpisodePlanning: ElectricJsondoc | null;
    canonicalBrainstormInput: ElectricJsondoc | null;
    canonicalEpisodeSynopsisList: ElectricJsondoc[]; // All episode synopsis jsondocs
    canonicalEpisodeScriptsList: ElectricJsondoc[]; // All episode script jsondocs

    // Workflow state
    workflowNodes: WorkflowNode[];

    // Transform state
    hasActiveTransforms: boolean;
    activeTransforms: ElectricTransform[];

    // Lineage metadata
    lineageGraph: LineageGraph;
    rootNodes: string[];
    leafNodes: string[];
}

// Canonical patch context for patch approval workflows
export interface CanonicalPatchContext {
    aiPatchTransformId: string;
    canonicalPatches: ElectricJsondoc[]; // All canonical json_patch jsondocs from this transform
    originalJsondoc: ElectricJsondoc; // The original jsondoc being edited
    originalJsondocType: string; // Schema type of the original jsondoc
}

/**
 * Core function to compute canonical jsondocs from lineage graph
 * This is the DRY logic that both frontend and backend can use
 * 
 * General principle: For each schema type, find the most recent/derived version
 * that represents the canonical state. Prioritize:
 * 1. Derived jsondocs (created from patch approval) over originals
 * 2. User input jsondocs over AI generated ones
 * 3. More recent jsondocs over older ones
 * 4. Leaf nodes (no descendants) over non-leaf nodes
 */
export function computeCanonicalJsondocsFromLineage(
    lineageGraph: LineageGraph,
    jsondocs: ElectricJsondoc[],
    transforms: ElectricTransform[],
    humanTransforms: ElectricHumanTransform[],
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[]
): CanonicalJsondocContext {

    // Find canonical jsondoc for each schema type
    const canonicalBrainstormIdea = findCanonicalJsondocByType(lineageGraph, jsondocs, '灵感创意');

    // Special logic: Don't include brainstorm_collection if a brainstorm idea has been selected via human transform
    let canonicalBrainstormCollection = findCanonicalJsondocByType(lineageGraph, jsondocs, 'brainstorm_collection');
    let canonicalBrainstormInput = findCanonicalJsondocByType(lineageGraph, jsondocs, 'brainstorm_input_params');

    // BUSINESS RULE: If there's any canonical brainstorm idea (we've committed to an idea),
    // then hide the brainstorm collection and brainstorm input params from context
    if (canonicalBrainstormIdea && canonicalBrainstormCollection) {
        canonicalBrainstormCollection = null;
    }
    if (canonicalBrainstormIdea && canonicalBrainstormInput) {
        canonicalBrainstormInput = null;
    }
    const canonicalOutlineSettings = findCanonicalJsondocByType(lineageGraph, jsondocs, '剧本设定');
    const canonicalChronicles = findCanonicalJsondocByType(lineageGraph, jsondocs, 'chronicles');
    const canonicalEpisodePlanning = findCanonicalJsondocByType(lineageGraph, jsondocs, 'episode_planning');

    // Find canonical episode synopsis for each episode number
    const canonicalEpisodeSynopsisList = findCanonicalEpisodeSynopsisByEpisode(lineageGraph, jsondocs);

    return {
        canonicalBrainstormIdea,
        canonicalBrainstormCollection,
        canonicalOutlineSettings,
        canonicalChronicles,
        canonicalEpisodePlanning,
        canonicalBrainstormInput,
        canonicalEpisodeSynopsisList,
        canonicalEpisodeScriptsList: findCanonicalEpisodeScriptsByEpisode(lineageGraph, jsondocs),
        workflowNodes: findMainWorkflowPath(jsondocs, lineageGraph),
        hasActiveTransforms: transforms.some(t => t.status === 'running' || t.status === 'pending'),
        activeTransforms: transforms.filter(t => t.status === 'running' || t.status === 'pending'),
        lineageGraph,
        rootNodes: Array.from(lineageGraph.rootNodes),
        leafNodes: findAllLeafNodes(lineageGraph)
    };
}

/**
 * Compute canonical patch context for a given ai_patch transform
 * This finds all canonical json_patch jsondocs and traces back to the original jsondoc
 */
export function computeCanonicalPatchContext(
    aiPatchTransformId: string,
    jsondocs: ElectricJsondoc[],
    transforms: ElectricTransform[],
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[]
): CanonicalPatchContext {
    // Debug logging to identify undefined parameters
    console.log(`[computeCanonicalPatchContext] Parameters:`, {
        aiPatchTransformId,
        jsondocs: jsondocs ? jsondocs.length : 'undefined',
        transforms: transforms ? transforms.length : 'undefined',
        transformInputs: transformInputs ? transformInputs.length : 'undefined',
        transformOutputs: transformOutputs ? transformOutputs.length : 'undefined'
    });

    // 1. Find the ai_patch transform
    const aiPatchTransform = transforms.find(t => t.id === aiPatchTransformId && t.type === 'ai_patch');
    if (!aiPatchTransform) {
        throw new Error(`AI patch transform not found: ${aiPatchTransformId}`);
    }

    // 2. Find all json_patch jsondocs created by this transform (canonical patches)
    const transformOutputsForPatch = transformOutputs.filter(to => to.transform_id === aiPatchTransformId);
    const canonicalPatches = transformOutputsForPatch
        .map(output => jsondocs.find(j => j.id === output.jsondoc_id))
        .filter((jsondoc): jsondoc is ElectricJsondoc =>
            jsondoc !== undefined && jsondoc.schema_type === 'json_patch'
        );

    if (canonicalPatches.length === 0) {
        throw new Error(`No canonical patches found for ai_patch transform: ${aiPatchTransformId}`);
    }

    // 3. Trace back to find the original jsondoc being edited
    // Get the inputs to the ai_patch transform
    const transformInputsForPatch = transformInputs.filter(ti => ti.transform_id === aiPatchTransformId);

    // Find the original jsondoc (should be the non-patch input)
    let originalJsondoc: ElectricJsondoc | null = null;

    for (const input of transformInputsForPatch) {
        const inputJsondoc = jsondocs.find(j => j.id === input.jsondoc_id);
        if (inputJsondoc && inputJsondoc.schema_type !== 'json_patch') {
            // This is likely the original jsondoc being edited
            originalJsondoc = inputJsondoc;
            break;
        }
    }

    if (!originalJsondoc) {
        throw new Error(`Original jsondoc not found for ai_patch transform: ${aiPatchTransformId}`);
    }

    return {
        aiPatchTransformId,
        canonicalPatches,
        originalJsondoc,
        originalJsondocType: originalJsondoc.schema_type
    };
}

/**
 * Apply canonical patches to original jsondoc data to create new derived content
 * This is the core logic for patch approval - applies all approved patches in sequence
 */
export function applyCanonicalPatches(
    originalJsondocData: any,
    canonicalPatches: ElectricJsondoc[]
): any {
    // Start with a deep clone of the original data
    let derivedData = deepClone(originalJsondocData);

    // Sort patches by their index if available, otherwise by creation time
    const sortedPatches = canonicalPatches.sort((a, b) => {
        // Try to get patch index from the data
        const aPatchIndex = (a.data as any)?.patchIndex ?? 0;
        const bPatchIndex = (b.data as any)?.patchIndex ?? 0;

        if (aPatchIndex !== bPatchIndex) {
            return aPatchIndex - bPatchIndex;
        }

        // Fallback to creation time
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    // Apply each patch in sequence
    for (const patchJsondoc of sortedPatches) {
        try {
            // Handle both string and object formats for patch data
            let patchData = patchJsondoc.data as any;
            if (typeof patchData === 'string') {
                try {
                    patchData = JSON.parse(patchData);
                } catch (parseError) {
                    console.warn(`Failed to parse patch data for jsondoc ${patchJsondoc.id}:`, parseError);
                    continue;
                }
            }

            console.log(`[DEBUG] Processing patch ${patchJsondoc.id}`);
            console.log(`[DEBUG] patchData type: ${typeof patchData}`);
            console.log(`[DEBUG] patchData.patches exists: ${'patches' in patchData}`);
            console.log(`[DEBUG] patchData.patches type: ${typeof patchData.patches}`);
            console.log(`[DEBUG] patchData.patches is array: ${Array.isArray(patchData.patches)}`);

            if (!patchData.patches || !Array.isArray(patchData.patches)) {
                console.warn(`Invalid patch format in jsondoc ${patchJsondoc.id}`);
                console.warn(`  - patchData.patches: ${patchData.patches}`);
                console.warn(`  - isArray: ${Array.isArray(patchData.patches)}`);
                continue;
            }

            // Apply this patch's operations
            const patchOperations = patchData.patches;
            console.log(`[DEBUG] About to apply ${patchOperations.length} operations:`, JSON.stringify(patchOperations, null, 2));
            console.log(`[DEBUG] Current derivedData before patch:`, JSON.stringify(derivedData, null, 2));

            const patchResult = applyPatch(derivedData, patchOperations, true); // validate = true

            console.log(`[DEBUG] Patch result:`, {
                hasNewDocument: !!patchResult.newDocument,
                hasErrors: patchResult.newDocument === null
            });

            if (patchResult.newDocument) {
                derivedData = patchResult.newDocument;
                console.log(`[DEBUG] Updated derivedData:`, JSON.stringify(derivedData, null, 2));
            }

            console.log(`Applied patch ${patchJsondoc.id} with ${patchOperations.length} operations`);

        } catch (error) {
            console.error(`Failed to apply patch ${patchJsondoc.id}:`, error);
            // Continue with other patches instead of failing completely
        }
    }

    return derivedData;
}

/**
 * Extract all canonical jsondoc IDs from the context
 * These are the jsondocs that should be displayed in UI and have active particles
 */
export function extractCanonicalJsondocIds(context: CanonicalJsondocContext): Set<string> {
    const canonicalIds = new Set<string>();

    // Add all canonical jsondocs
    if (context.canonicalBrainstormIdea) {
        canonicalIds.add(context.canonicalBrainstormIdea.id);
    }
    if (context.canonicalBrainstormCollection) {
        canonicalIds.add(context.canonicalBrainstormCollection.id);
    }
    if (context.canonicalOutlineSettings) {
        canonicalIds.add(context.canonicalOutlineSettings.id);
    }
    if (context.canonicalChronicles) {
        canonicalIds.add(context.canonicalChronicles.id);
    }
    if (context.canonicalEpisodePlanning) {
        canonicalIds.add(context.canonicalEpisodePlanning.id);
    }
    if (context.canonicalBrainstormInput) {
        canonicalIds.add(context.canonicalBrainstormInput.id);
    }

    // IMPORTANT: Add all canonical episode synopsis jsondocs
    context.canonicalEpisodeSynopsisList.forEach(episodeSynopsis => {
        canonicalIds.add(episodeSynopsis.id);
    });

    // IMPORTANT: Add all canonical episode script jsondocs
    context.canonicalEpisodeScriptsList.forEach(episodeScript => {
        canonicalIds.add(episodeScript.id);
    });

    return canonicalIds;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Find the canonical jsondoc of a specific type using smart prioritization
 * 
 * Prioritization logic:
 * 1. Derived jsondocs (with applied patches) over originals
 * 2. User input jsondocs over AI generated ones  
 * 3. Leaf nodes (no descendants) over non-leaf nodes
 * 4. More recent jsondocs over older ones
 */
function findCanonicalJsondocByType(
    lineageGraph: LineageGraph,
    jsondocs: ElectricJsondoc[],
    schemaType: string
): ElectricJsondoc | null {
    // Find all jsondocs of this type
    const candidateJsondocs = jsondocs.filter(a => a.schema_type === schemaType);

    if (candidateJsondocs.length === 0) return null;

    // Special handling for 单集大纲: always include all jsondocs regardless of lineage graph status
    // This is because episode synopsis jsondocs can be orphaned from lineage but still canonical
    if (schemaType === '单集大纲') {
        return findBestJsondocByPriority(candidateJsondocs, lineageGraph);
    }

    // Special handling for 单集剧本: always include all jsondocs regardless of lineage graph status
    // This is because episode script jsondocs can be orphaned from lineage but still canonical
    if (schemaType === '单集剧本') {
        return findBestJsondocByPriority(candidateJsondocs, lineageGraph);
    }

    // Filter to only include jsondocs that are in the lineage graph (canonical jsondocs)
    const canonicalJsondocs = candidateJsondocs.filter(jsondoc => {
        const node = lineageGraph.nodes.get(jsondoc.id);
        return node != null;
    });

    if (canonicalJsondocs.length === 0) {
        // If no jsondocs are in lineage graph, fall back to all candidates
        // This handles cases where jsondocs exist but aren't connected to transforms yet
        return findBestJsondocByPriority(candidateJsondocs, lineageGraph);
    }

    return findBestJsondocByPriority(canonicalJsondocs, lineageGraph);
}

/**
 * Find the best jsondoc from candidates using prioritization logic
 */
function findBestJsondocByPriority(
    candidates: ElectricJsondoc[],
    lineageGraph: LineageGraph
): ElectricJsondoc | null {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // Separate derived jsondocs (with applied patches) from regular ones
    const derivedJsondocs = candidates.filter(jsondoc => {
        try {
            const metadata = typeof jsondoc.metadata === 'string'
                ? JSON.parse(jsondoc.metadata)
                : jsondoc.metadata;
            return metadata && metadata.applied_patches && Array.isArray(metadata.applied_patches);
        } catch {
            return false;
        }
    });

    const regularJsondocs = candidates.filter(jsondoc => !derivedJsondocs.includes(jsondoc));

    // If we have derived jsondocs, prioritize them
    if (derivedJsondocs.length > 0) {
        return findMostRecentJsondoc(derivedJsondocs);
    }

    // For regular jsondocs, prioritize leaf nodes, then user input, then most recent
    const leafJsondocs = regularJsondocs.filter(jsondoc => {
        const node = lineageGraph.nodes.get(jsondoc.id);
        return node && node.isLeaf;
    });

    if (leafJsondocs.length > 0) {
        // Among leaf nodes, prioritize user_input, then most recent
        const userInputLeafs = leafJsondocs.filter(j => j.origin_type === 'user_input');
        if (userInputLeafs.length > 0) {
            return findMostRecentJsondoc(userInputLeafs);
        }
        return findMostRecentJsondoc(leafJsondocs);
    }

    // If no leaf nodes, use all regular jsondocs
    const userInputJsondocs = regularJsondocs.filter(j => j.origin_type === 'user_input');
    if (userInputJsondocs.length > 0) {
        return findMostRecentJsondoc(userInputJsondocs);
    }

    return findMostRecentJsondoc(regularJsondocs);
}

/**
 * Find the most recent jsondoc from a list
 */
function findMostRecentJsondoc(jsondocs: ElectricJsondoc[]): ElectricJsondoc | null {
    if (jsondocs.length === 0) return null;

    jsondocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return jsondocs[0];
}

/**
 * Find canonical episode synopsis jsondocs grouped by episode number
 * For each episode number, find the most derived/recent version using the same logic as other canonical jsondocs
 * 
 * IMPORTANT: Episode synopsis jsondocs are always considered canonical regardless of lineage graph status
 * because they can be orphaned from the lineage but still represent valid canonical content
 */
function findCanonicalEpisodeSynopsisByEpisode(
    lineageGraph: LineageGraph,
    jsondocs: ElectricJsondoc[]
): ElectricJsondoc[] {
    // Get all episode synopsis jsondocs (always include all, regardless of lineage graph status)
    const episodeSynopsisJsondocs = jsondocs.filter(j => j.schema_type === '单集大纲');


    if (episodeSynopsisJsondocs.length === 0) return [];

    // Group by episode number
    const episodeGroups = new Map<number, ElectricJsondoc[]>();

    for (const jsondoc of episodeSynopsisJsondocs) {
        try {
            const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
            const episodeNumber = data.episodeNumber || 0;

            if (!episodeGroups.has(episodeNumber)) {
                episodeGroups.set(episodeNumber, []);
            }
            episodeGroups.get(episodeNumber)!.push(jsondoc);
        } catch (error) {
            console.warn('Failed to parse episode synopsis data for grouping:', error);
            // Include in episode 0 as fallback
            if (!episodeGroups.has(0)) {
                episodeGroups.set(0, []);
            }
            episodeGroups.get(0)!.push(jsondoc);
        }
    }


    // Find canonical jsondoc for each episode using the same prioritization logic
    const canonicalEpisodes: ElectricJsondoc[] = [];

    for (const [episodeNumber, candidates] of episodeGroups.entries()) {
        const canonical = findBestJsondocByPriority(candidates, lineageGraph);
        if (canonical) {
            canonicalEpisodes.push(canonical);
        }
    }

    // Sort by episode number for consistent ordering
    canonicalEpisodes.sort((a, b) => {
        try {
            const aData = typeof a.data === 'string' ? JSON.parse(a.data) : a.data;
            const bData = typeof b.data === 'string' ? JSON.parse(b.data) : b.data;
            const aEpisodeNumber = aData.episodeNumber || 0;
            const bEpisodeNumber = bData.episodeNumber || 0;
            return aEpisodeNumber - bEpisodeNumber;
        } catch {
            return 0;
        }
    });

    return canonicalEpisodes;
}

/**
 * Find canonical episode script jsondocs grouped by episode number
 * For each episode number, find the most derived/recent version using the same logic as other canonical jsondocs
 * 
 * IMPORTANT: Episode script jsondocs are always considered canonical regardless of lineage graph status
 * because they can be orphaned from the lineage but still represent valid canonical content
 */
function findCanonicalEpisodeScriptsByEpisode(
    lineageGraph: LineageGraph,
    jsondocs: ElectricJsondoc[]
): ElectricJsondoc[] {
    // Get all episode script jsondocs (always include all, regardless of lineage graph status)
    const episodeScriptJsondocs = jsondocs.filter(j => j.schema_type === '单集剧本');


    if (episodeScriptJsondocs.length === 0) return [];

    // Group by episode number
    const episodeGroups = new Map<number, ElectricJsondoc[]>();

    for (const jsondoc of episodeScriptJsondocs) {
        try {
            const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
            const episodeNumber = data.episodeNumber || 0;

            if (!episodeGroups.has(episodeNumber)) {
                episodeGroups.set(episodeNumber, []);
            }
            episodeGroups.get(episodeNumber)!.push(jsondoc);
        } catch (error) {
            console.warn('Failed to parse episode script data for grouping:', error);
            // Include in episode 0 as fallback
            if (!episodeGroups.has(0)) {
                episodeGroups.set(0, []);
            }
            episodeGroups.get(0)!.push(jsondoc);
        }
    }


    // Find canonical jsondoc for each episode using the same prioritization logic
    const canonicalEpisodes: ElectricJsondoc[] = [];

    for (const [episodeNumber, candidates] of episodeGroups.entries()) {
        const canonical = findBestJsondocByPriority(candidates, lineageGraph);
        if (canonical) {
            canonicalEpisodes.push(canonical);
        }
    }

    // Sort by episode number for consistent ordering
    canonicalEpisodes.sort((a, b) => {
        try {
            const aData = typeof a.data === 'string' ? JSON.parse(a.data) : a.data;
            const bData = typeof b.data === 'string' ? JSON.parse(b.data) : b.data;
            const aEpisodeNumber = aData.episodeNumber || 0;
            const bEpisodeNumber = bData.episodeNumber || 0;
            return aEpisodeNumber - bEpisodeNumber;
        } catch {
            return 0;
        }
    });

    return canonicalEpisodes;
}

/**
 * Find all leaf nodes in the lineage graph
 */
function findAllLeafNodes(lineageGraph: LineageGraph): string[] {
    const leafNodes: string[] = [];

    for (const [jsondocId, node] of lineageGraph.nodes) {
        if (node.isLeaf) {
            leafNodes.push(jsondocId);
        }
    }

    return leafNodes;
} 