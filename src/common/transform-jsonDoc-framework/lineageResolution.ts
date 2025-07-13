/**
 * Core Lineage Resolution Algorithm
 * 
 * This module provides pure functions for resolving complex jsonDoc lineages
 * in the script-writer application. It handles chains like:
 * 
 * brainstorm_collection[0] → human_transform → user_input → llm_transform → brainstorm_idea
 */

import type {
    ElectricJsonDoc,
    ElectricTransform,
    ElectricHumanTransform,
    ElectricTransformInput,
    ElectricTransformOutput,
    TypedJsonDoc
} from '../types';

// ============================================================================
// Data Structures
// ============================================================================

export type LineageNodeBase = {
    path?: string;
    depth: number;
    isLeaf: boolean;
    type: 'jsonDoc' | 'transform';
    createdAt: string; // NEW: Add timestamp for chronological narrative
}

export type LineageNodeJsonDoc = LineageNodeBase & {
    type: 'jsonDoc';
    jsonDocId: string;
    sourceTransform: LineageNodeTransform | "none";
    jsonDoc: ElectricJsonDoc; // NEW: Include the actual jsonDoc object
}

export type LineageNodeTransform = LineageNodeBase & {
    type: 'transform';
    transformId: string;
    transformType: 'human' | 'llm';
    sourceJsonDocs: LineageNodeJsonDoc[];
    transform: ElectricTransform; // NEW: Include the actual transform object
}

export type LineageNode = LineageNodeJsonDoc | LineageNodeTransform;



export interface LineageGraph {
    nodes: Map<string, LineageNode>;
    edges: Map<string, string[]>; // jsonDocId -> [childJsonDocIds]
    paths: Map<string, LineageNode[]>; // path -> [nodes in lineage]
    rootNodes: Set<string>; // JsonDocs with no incoming transforms
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export interface LineageResolutionResult {
    jsonDocId: string | null;
    path?: string;
    depth: number;
    lineagePath: LineageNode[];
    createdAt?: string; // NEW: Add timestamp for chronological narrative
}

// ============================================================================
// Core Algorithm Functions
// ============================================================================

/**
 * Build a complete lineage graph from project jsonDocs and transforms
 */
export function buildLineageGraph(
    jsonDocs: ElectricJsonDoc[],
    transforms: ElectricTransform[],
    humanTransforms: ElectricHumanTransform[],
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[]
): LineageGraph {

    // Internal phase types for multi-pass algorithm
    type PhaseOneJsonDocNode = Omit<LineageNodeJsonDoc, 'sourceTransform'> & {
        sourceTransformId: string | "none";
    };

    type PhaseOneTransformNode = Omit<LineageNodeTransform, 'sourceJsonDocs'> & {
        sourceJsonDocIds: string[];
    };

    type PhaseOneNode = PhaseOneJsonDocNode | PhaseOneTransformNode;

    const phaseOneNodes = new Map<string, PhaseOneNode>();
    const edges = new Map<string, string[]>();
    const paths = new Map<string, LineageNode[]>();
    const rootNodes = new Set<string>();

    // Step 1: Initialize all jsonDocs as nodes and determine root nodes
    const allJsonDocIds = new Set(jsonDocs.map(a => a.id));
    const jsonDocsWithIncomingTransforms = new Set<string>();

    // Find all jsonDocs that have incoming transforms
    for (const output of transformOutputs) {
        if (allJsonDocIds.has(output.jsonDoc_id)) {
            jsonDocsWithIncomingTransforms.add(output.jsonDoc_id);
        }
    }

    // Initialize jsonDoc nodes with sourceTransformId (Phase 1)
    for (const jsonDoc of jsonDocs) {
        const isRoot = !jsonDocsWithIncomingTransforms.has(jsonDoc.id);
        if (isRoot) {
            rootNodes.add(jsonDoc.id);
        }

        // Find the source transform for this jsonDoc
        const sourceTransformId = transformOutputs.find(output =>
            output.jsonDoc_id === jsonDoc.id
        )?.transform_id || "none";

        phaseOneNodes.set(jsonDoc.id, {
            type: 'jsonDoc',
            jsonDocId: jsonDoc.id,
            depth: 0,
            isLeaf: true, // Will be updated if we find outgoing transforms
            path: undefined,
            sourceTransformId,
            createdAt: jsonDoc.created_at,
            jsonDoc: jsonDoc
        } as PhaseOneJsonDocNode);
    }

    // Step 1.5: Handle JSONPath-aware transform inputs
    for (const input of transformInputs) {
        const jsonDocPath = (input as any).jsonDoc_path || '$'; // NEW: Get jsonDoc_path field

        if (jsonDocPath !== '$') {
            // Create path-specific lineage tracking for any sub-jsonDoc operations
            const pathKey = `${input.jsonDoc_id}:${jsonDocPath}`;
            if (!paths.has(pathKey)) {
                paths.set(pathKey, []);
            }
        }
        // If jsonDocPath === '$', it's operating on the whole jsonDoc (existing behavior)
    }

    // Step 2: Process all transforms in dependency order (Phase 1)
    // We need to process transforms in topological order to ensure depths are calculated correctly
    const processedTransforms = new Set<string>();
    const pendingTransforms = [...transforms.filter(t => t.status !== 'failed')]; // Skip failed transforms

    while (pendingTransforms.length > 0) {
        const initialLength = pendingTransforms.length;

        for (let i = pendingTransforms.length - 1; i >= 0; i--) {
            const transform = pendingTransforms[i];
            const transformId = transform.id;

            // Skip failed transforms
            if (transform.status === 'failed') {
                console.log(`[LineageResolution] Skipping failed transform: ${transformId}`);
                pendingTransforms.splice(i, 1);
                continue;
            }

            // Check if all input jsonDocs for this transform have been processed
            const inputs = transformInputs.filter(ti => ti.transform_id === transformId);
            const canProcess = inputs.every(input => {
                const inputNode = phaseOneNodes.get(input.jsonDoc_id);
                // Can process if the input node exists and either:
                // 1. It's a root node (no incoming transforms), or
                // 2. All transforms that produce this input have been processed
                return inputNode && (
                    rootNodes.has(input.jsonDoc_id) ||
                    !hasUnprocessedIncomingTransforms(input.jsonDoc_id, transformInputs, transformOutputs, processedTransforms)
                );
            });

            if (canProcess) {
                // Process this transform (Phase 1)
                if (transform.type === 'human') {
                    processHumanTransformPhaseOne(transform, humanTransforms, transformInputs, transformOutputs, phaseOneNodes, edges, paths, rootNodes);
                } else if (transform.type === 'llm') {
                    processLLMTransformPhaseOne(transform, transformInputs, transformOutputs, phaseOneNodes, edges, paths, rootNodes);
                }

                processedTransforms.add(transformId);
                pendingTransforms.splice(i, 1);
            }
        }

        // If we didn't process any transforms in this iteration, we have a cycle or missing dependencies
        if (pendingTransforms.length === initialLength) {
            // console.warn('Warning: Could not process all transforms due to cycles or missing dependencies:',
            //     pendingTransforms.map(t => t.id));
            break;
        }
    }

    // Step 3: Convert Phase 1 nodes to final nodes by resolving references (Phase 2)
    const nodes = new Map<string, LineageNode>();

    // First pass: Create all nodes with basic info
    for (const [nodeId, phaseOneNode] of phaseOneNodes) {
        if (phaseOneNode.type === 'jsonDoc') {
            const jsonDocNode = phaseOneNode as PhaseOneJsonDocNode;

            // Create jsonDoc node (sourceTransform will be populated in second pass)
            const finalJsonDocNode: LineageNodeJsonDoc = {
                type: 'jsonDoc' as const,
                jsonDocId: jsonDocNode.jsonDocId,
                path: jsonDocNode.path,
                depth: jsonDocNode.depth,
                isLeaf: jsonDocNode.isLeaf,
                sourceTransform: "none", // Will be populated in second pass
                jsonDoc: jsonDocNode.jsonDoc,
                createdAt: jsonDocNode.createdAt
            };

            nodes.set(nodeId, finalJsonDocNode);
        } else {
            const transformNode = phaseOneNode as PhaseOneTransformNode;

            // Create transform node (sourceJsonDocs will be populated in second pass)
            const finalTransformNode: LineageNodeTransform = {
                type: 'transform' as const,
                transformId: transformNode.transformId,
                transformType: transformNode.transformType,
                path: transformNode.path,
                depth: transformNode.depth,
                isLeaf: transformNode.isLeaf,
                sourceJsonDocs: [], // Will be populated in second pass
                transform: transformNode.transform,
                createdAt: transformNode.createdAt
            };

            nodes.set(nodeId, finalTransformNode);
        }
    }

    // Second pass: Populate references now that all nodes exist
    for (const [nodeId, phaseOneNode] of phaseOneNodes) {
        if (phaseOneNode.type === 'jsonDoc') {
            const jsonDocNode = phaseOneNode as PhaseOneJsonDocNode;
            const finalJsonDocNode = nodes.get(nodeId) as LineageNodeJsonDoc;

            // Resolve sourceTransform reference
            if (jsonDocNode.sourceTransformId !== "none") {
                const sourceTransformNode = nodes.get(jsonDocNode.sourceTransformId) as LineageNodeTransform | undefined;
                if (sourceTransformNode && sourceTransformNode.type === 'transform') {
                    finalJsonDocNode.sourceTransform = sourceTransformNode;
                } else {
                    console.warn(`Warning: Could not resolve sourceTransform ${jsonDocNode.sourceTransformId} for jsonDoc ${nodeId}`);
                    finalJsonDocNode.sourceTransform = "none";
                }
            }
        } else {
            const transformNode = phaseOneNode as PhaseOneTransformNode;
            const finalTransformNode = nodes.get(nodeId) as LineageNodeTransform;

            // Resolve sourceJsonDocs references
            const sourceJsonDocs: LineageNodeJsonDoc[] = [];
            for (const jsonDocId of transformNode.sourceJsonDocIds) {
                const jsonDocNode = nodes.get(jsonDocId) as LineageNodeJsonDoc | undefined;
                if (jsonDocNode && jsonDocNode.type === 'jsonDoc') {
                    sourceJsonDocs.push(jsonDocNode);
                } else {
                    console.warn(`Warning: Could not resolve sourceJsonDoc ${jsonDocId} for transform ${nodeId}`);
                }
            }
            finalTransformNode.sourceJsonDocs = sourceJsonDocs;
        }
    }

    // Step 4: Update paths to use final nodes
    const finalPaths = new Map<string, LineageNode[]>();
    for (const [pathKey, phaseOnePath] of paths) {
        const finalPath: LineageNode[] = [];
        for (const phaseOneNode of phaseOnePath) {
            const finalNode = nodes.get(phaseOneNode.type === 'jsonDoc' ? phaseOneNode.jsonDocId : phaseOneNode.transformId);
            if (finalNode) {
                finalPath.push(finalNode);
            }
        }
        finalPaths.set(pathKey, finalPath);
    }

    const finalGraph = {
        nodes,
        edges,
        paths: finalPaths,
        rootNodes
    };

    // Validate the graph integrity for debugging
    const validation = validateLineageIntegrity(finalGraph);

    if (!validation.isValid) {
        console.warn('[buildLineageGraph] Graph integrity issues detected:', validation.errors);
    }
    if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => console.warn('[buildLineageGraph] Warning:', warning));
    }

    // TODO: Add orphan filtering in the future when it's more robust
    // For now, return the complete graph to maintain backward compatibility
    return finalGraph;
}

// Helper function to check if an jsonDoc has unprocessed incoming transforms
function hasUnprocessedIncomingTransforms(
    jsonDocId: string,
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[],
    processedTransforms: Set<string>
): boolean {
    // Find all transforms that produce this jsonDoc
    const producingTransforms = transformOutputs
        .filter(output => output.jsonDoc_id === jsonDocId)
        .map(output => output.transform_id);

    // Check if any of these transforms haven't been processed yet
    return producingTransforms.some(transformId => !processedTransforms.has(transformId));
}

// Helper function to process human transforms (Phase 1)
function processHumanTransformPhaseOne(
    transform: ElectricTransform,
    humanTransforms: ElectricHumanTransform[],
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[],
    phaseOneNodes: Map<string, any>, // PhaseOneNode but we can't reference it here
    edges: Map<string, string[]>,
    paths: Map<string, any[]>, // Will be converted to LineageNode[] later
    rootNodes: Set<string>
): void {
    const transformId = transform.id;
    const humanTransform = humanTransforms.find(ht => ht.transform_id === transformId);

    if (!humanTransform) return;

    const inputs = transformInputs.filter(ti => ti.transform_id === transformId);
    const outputs = transformOutputs.filter(to => to.transform_id === transformId);

    // Collect source jsonDoc IDs for this transform
    const sourceJsonDocIds = inputs.map(input => input.jsonDoc_id);

    // Create transform node (Phase 1)
    phaseOneNodes.set(transformId, {
        type: 'transform',
        transformId: transformId,
        transformType: 'human',
        depth: 0, // Will be calculated based on sources
        isLeaf: false,
        path: humanTransform.derivation_path,
        sourceJsonDocIds,
        createdAt: transform.created_at,
        transform: transform
    });

    for (const input of inputs) {
        for (const output of outputs) {
            const sourceId = input.jsonDoc_id;
            const targetId = output.jsonDoc_id;
            const path = humanTransform.derivation_path;

            // Create edge
            if (!edges.has(sourceId)) {
                edges.set(sourceId, []);
            }
            edges.get(sourceId)!.push(targetId);

            // Update source node (no longer a leaf)
            const sourceNode = phaseOneNodes.get(sourceId);
            if (sourceNode) {
                sourceNode.isLeaf = false;
            }

            // Update target node depth and path
            const targetNode = phaseOneNodes.get(targetId);
            if (targetNode) {
                targetNode.path = path;
                targetNode.depth = (sourceNode?.depth ?? 0) + 1;
            }

            // Remove target from root nodes (it has an incoming transform)
            rootNodes.delete(targetId);

            // Track path-based lineage (will be converted later)
            const pathKey = `${sourceId}:${path}`;
            if (!paths.has(pathKey)) {
                paths.set(pathKey, []);
            }
            const transformNode = phaseOneNodes.get(transformId);
            if (transformNode) {
                paths.get(pathKey)!.push(transformNode);

                // Also add the output jsonDoc to the path lineage
                // This ensures that findLatestJsonDoc can find the edited jsonDoc
                const outputNode = phaseOneNodes.get(targetId);
                if (outputNode) {
                    paths.get(pathKey)!.push(outputNode);
                }
            }
        }
    }

    // Update transform node depth based on max input depth
    const transformNode = phaseOneNodes.get(transformId);
    if (transformNode) {
        const maxInputDepth = inputs.reduce((max, input) => {
            const inputNode = phaseOneNodes.get(input.jsonDoc_id);
            return Math.max(max, inputNode?.depth ?? 0);
        }, 0);
        transformNode.depth = maxInputDepth + 1;
    }
}

// Helper function to process LLM transforms (Phase 1)
function processLLMTransformPhaseOne(
    transform: ElectricTransform,
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[],
    phaseOneNodes: Map<string, any>, // PhaseOneNode but we can't reference it here
    edges: Map<string, string[]>,
    paths: Map<string, any[]>, // Will be converted to LineageNode[] later
    rootNodes: Set<string>
): void {
    const transformId = transform.id;
    const inputs = transformInputs.filter(ti => ti.transform_id === transformId);
    const outputs = transformOutputs.filter(to => to.transform_id === transformId);

    // Extract path from transform execution context (for BrainstormEditTool)
    let transformPath: string | undefined;
    try {
        if (transform.execution_context) {
            const executionContext = typeof transform.execution_context === 'string'
                ? JSON.parse(transform.execution_context)
                : transform.execution_context;
            transformPath = executionContext?.derivation_path;
        }
    } catch (e) {
        // Ignore parsing errors
    }

    // Collect source jsonDoc IDs for this transform
    const sourceJsonDocIds = inputs.map(input => input.jsonDoc_id);

    // Create transform node (Phase 1)
    phaseOneNodes.set(transformId, {
        type: 'transform',
        transformId: transformId,
        transformType: 'llm',
        depth: 0, // Will be calculated based on sources
        isLeaf: false,
        path: transformPath,
        sourceJsonDocIds,
        createdAt: transform.created_at,
        transform: transform
    });

    for (const input of inputs) {
        for (const output of outputs) {
            const sourceId = input.jsonDoc_id;
            const targetId = output.jsonDoc_id;

            // Create edge
            if (!edges.has(sourceId)) {
                edges.set(sourceId, []);
            }
            edges.get(sourceId)!.push(targetId);

            // Update source node (no longer a leaf)
            const sourceNode = phaseOneNodes.get(sourceId);
            if (sourceNode) {
                sourceNode.isLeaf = false;
            }

            // Update target node
            const targetNode = phaseOneNodes.get(targetId);
            if (targetNode) {
                targetNode.depth = (sourceNode?.depth ?? 0) + 1;

                // Use path from transform execution context if available, otherwise inherit from source
                if (transformPath) {
                    targetNode.path = transformPath;
                } else if (sourceNode?.path !== undefined) {
                    targetNode.path = sourceNode.path;
                }
            }

            // Remove target from root nodes
            rootNodes.delete(targetId);

            // Create path lineage using the determined path (will be converted later)
            const activePath = transformPath || sourceNode?.path;
            if (activePath) {
                const pathKey = `${sourceId}:${activePath}`;
                const existingPath = paths.get(pathKey) || [];
                const transformNode = phaseOneNodes.get(transformId);
                if (transformNode) {
                    paths.set(pathKey, [...existingPath, transformNode]);

                    // Also create a path key for the target jsonDoc to maintain lineage
                    const targetPathKey = `${targetId}:${activePath}`;
                    paths.set(targetPathKey, [transformNode]);
                }
            }
        }
    }

    // Update transform node depth based on max input depth
    const transformNode = phaseOneNodes.get(transformId);
    if (transformNode) {
        const maxInputDepth = inputs.reduce((max, input) => {
            const inputNode = phaseOneNodes.get(input.jsonDoc_id);
            return Math.max(max, inputNode?.depth ?? 0);
        }, 0);
        transformNode.depth = maxInputDepth + 1;
    }
}

/**
 * Find the latest (most recent) jsonDoc in a lineage chain
 */
export function findLatestJsonDoc(
    sourceJsonDocId: string,
    path: string | undefined,
    graph: LineageGraph,
    jsonDocs?: ElectricJsonDoc[]
): LineageResolutionResult {
    const sourceNode = graph.nodes.get(sourceJsonDocId);
    if (!sourceNode) {
        return {
            jsonDocId: null,
            path: path,
            depth: 0,
            lineagePath: []
        };
    }

    // If we have a specific path, look for path-specific lineage
    if (path && path !== '$') {
        const pathKey = `${sourceJsonDocId}:${path}`;
        const pathLineage = graph.paths.get(pathKey);

        if (pathLineage && pathLineage.length > 0) {
            // Find the deepest jsonDoc node in the path lineage
            const jsonDocNodes = pathLineage.filter(node => node.type === 'jsonDoc');

            if (jsonDocNodes.length > 0) {
                const deepestJsonDoc = jsonDocNodes.reduce((deepest, current) =>
                    current.depth > deepest.depth ? current : deepest
                );
                return {
                    jsonDocId: deepestJsonDoc.jsonDocId,
                    path: path,
                    depth: deepestJsonDoc.depth,
                    lineagePath: pathLineage
                };
            } else {
                return {
                    jsonDocId: sourceJsonDocId,
                    path: path,
                    depth: 0,
                    lineagePath: pathLineage
                };
            }
        } else {
            // No path-specific lineage found - return original jsonDoc for this path
            // This is the key fix: don't traverse to deepest leaf, just return the original
            return {
                jsonDocId: sourceJsonDocId,
                path: path,
                depth: sourceNode.depth,
                lineagePath: [sourceNode]
            };
        }
    } else {
        // No path specified, traverse from root to find deepest leaf
        return traverseToLeaf(sourceJsonDocId, graph, new Set(), jsonDocs);
    }
}

/**
 * Traverse from an jsonDoc to its deepest leaf node
 */
function traverseToLeaf(
    jsonDocId: string,
    graph: LineageGraph,
    visited: Set<string> = new Set(),
    jsonDocs?: ElectricJsonDoc[]
): LineageResolutionResult {
    // Prevent infinite loops
    if (visited.has(jsonDocId)) {
        return {
            jsonDocId: null,
            depth: 0,
            lineagePath: []
        };
    }
    visited.add(jsonDocId);

    const node = graph.nodes.get(jsonDocId);
    if (!node) {
        return {
            jsonDocId: null,
            depth: 0,
            lineagePath: []
        };
    }

    // If this is a leaf node, return it
    if (node.isLeaf) {
        const jsonDoc = jsonDocs?.find(a => a.id === jsonDocId);
        return {
            jsonDocId: jsonDocId,
            depth: node.depth,
            lineagePath: [node],
            createdAt: node.createdAt
        };
    }

    // Find all children and traverse to the deepest one
    const children = graph.edges.get(jsonDocId) || [];

    let deepestResult: LineageResolutionResult = {
        jsonDocId: jsonDocId,
        depth: node.depth,
        lineagePath: [node],
        createdAt: node.createdAt
    };

    for (const childId of children) {
        const childResult = traverseToLeaf(childId, graph, new Set(visited), jsonDocs);

        // Use tie-breaking logic when depths are equal
        if (childResult.depth > deepestResult.depth) {
            deepestResult = {
                jsonDocId: childResult.jsonDocId,
                depth: childResult.depth,
                lineagePath: [node, ...childResult.lineagePath],
                createdAt: childResult.createdAt
            };
        } else if (childResult.depth === deepestResult.depth && childResult.jsonDocId && deepestResult.jsonDocId) {
            // Tie-breaking: prioritize user_input jsonDocs over ai_generated ones
            const childJsonDoc = jsonDocs?.find(a => a.id === childResult.jsonDocId);
            const currentJsonDoc = jsonDocs?.find(a => a.id === deepestResult.jsonDocId);

            if (childJsonDoc && currentJsonDoc) {
                const childIsUserInput = childJsonDoc.origin_type === 'user_input';
                const currentIsUserInput = currentJsonDoc.origin_type === 'user_input';

                // Prefer user_input over ai_generated
                if (childIsUserInput && !currentIsUserInput) {
                    deepestResult = {
                        jsonDocId: childResult.jsonDocId,
                        depth: childResult.depth,
                        lineagePath: [node, ...childResult.lineagePath],
                        createdAt: childResult.createdAt
                    };
                }
                // If both are user_input or both are ai_generated, keep the current one (first-wins)
            }
        }
    }

    const finalJsonDoc = jsonDocs?.find(a => a.id === deepestResult.jsonDocId);
    return {
        ...deepestResult,
        createdAt: finalJsonDoc?.created_at || ''
    };
}

/**
 * Get the complete lineage path from a source jsonDoc
 */
export function getLineagePath(
    jsonDocId: string,
    graph: LineageGraph,
    jsonDocs?: ElectricJsonDoc[]
): LineageNode[] {
    const result = traverseToLeaf(jsonDocId, graph, new Set(), jsonDocs);
    return result.lineagePath;
}

/**
 * Validate the integrity of a lineage graph
 */
export function validateLineageIntegrity(graph: LineageGraph): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for orphaned nodes
    for (const [jsonDocId, node] of graph.nodes) {
        if (!graph.rootNodes.has(jsonDocId) && !hasIncomingEdges(jsonDocId, graph)) {
            warnings.push(`JsonDoc ${jsonDocId} appears to be orphaned`);
        }
    }

    // Check for circular references
    for (const rootId of graph.rootNodes) {
        if (hasCircularReference(rootId, graph)) {
            errors.push(`Circular reference detected starting from ${rootId}`);
        }
    }

    // Check for missing jsonDocs referenced in edges
    for (const [sourceId, targets] of graph.edges) {
        if (!graph.nodes.has(sourceId)) {
            errors.push(`Source jsonDoc ${sourceId} referenced in edges but not in nodes`);
        }
        for (const targetId of targets) {
            if (!graph.nodes.has(targetId)) {
                errors.push(`Target jsonDoc ${targetId} referenced in edges but not in nodes`);
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Check if an jsonDoc has incoming edges (transforms that produce it)
 */
function hasIncomingEdges(jsonDocId: string, graph: LineageGraph): boolean {
    for (const targets of graph.edges.values()) {
        if (targets.includes(jsonDocId)) {
            return true;
        }
    }
    return false;
}

/**
 * Check for circular references starting from a given jsonDoc
 */
function hasCircularReference(
    jsonDocId: string,
    graph: LineageGraph,
    visited: Set<string> = new Set()
): boolean {
    if (visited.has(jsonDocId)) {
        return true;
    }

    visited.add(jsonDocId);
    const children = graph.edges.get(jsonDocId) || [];

    for (const childId of children) {
        if (hasCircularReference(childId, graph, new Set(visited))) {
            return true;
        }
    }

    return false;
}

/**
 * Filter out orphaned nodes from the lineage graph
 * Similar to RawGraphVisualization's filtering logic
 * 
 * Note: This function is conservative and only removes truly orphaned nodes
 * to avoid breaking existing functionality. Transform nodes are kept if they
 * have any connection to the graph.
 */
function filterOrphanedNodes(graph: LineageGraph): LineageGraph {
    const connectedNodes = new Set<string>();

    // Step 1: Start from root nodes and traverse forward
    const toVisit = [...graph.rootNodes];
    const visited = new Set<string>();

    while (toVisit.length > 0) {
        const nodeId = toVisit.pop()!;
        if (visited.has(nodeId)) continue;

        visited.add(nodeId);
        connectedNodes.add(nodeId);

        // Add children to visit queue
        const children = graph.edges.get(nodeId) || [];
        for (const childId of children) {
            if (!visited.has(childId)) {
                toVisit.push(childId);
            }
        }
    }

    // Step 2: Include all nodes that participate in edges (bidirectional connectivity)
    for (const [sourceId, targets] of graph.edges) {
        // If either source or any target is connected, include all of them
        const hasConnectedNode = connectedNodes.has(sourceId) || targets.some(t => connectedNodes.has(t));
        if (hasConnectedNode) {
            connectedNodes.add(sourceId);
            targets.forEach(t => connectedNodes.add(t));
        }
    }

    // Step 3: Include all nodes that appear in paths (path-based connectivity)
    for (const pathNodes of graph.paths.values()) {
        const hasConnectedNode = pathNodes.some(node => {
            const nodeId = node.type === 'jsonDoc' ? node.jsonDocId : node.transformId;
            return connectedNodes.has(nodeId);
        });
        if (hasConnectedNode) {
            // Include all nodes in this path
            pathNodes.forEach(node => {
                const nodeId = node.type === 'jsonDoc' ? node.jsonDocId : node.transformId;
                connectedNodes.add(nodeId);
            });
        }
    }

    // Step 4: If the filtering would remove too many nodes, skip filtering
    // This is a safety check to prevent breaking existing functionality
    const originalNodeCount = graph.nodes.size;
    const filteredNodeCount = connectedNodes.size;

    if (filteredNodeCount < originalNodeCount * 0.5) {
        // If we're removing more than 50% of nodes, something might be wrong
        // Return the original graph to be safe
        console.warn(`[filterOrphanedNodes] Filtering would remove ${originalNodeCount - filteredNodeCount} out of ${originalNodeCount} nodes. Skipping filtering for safety.`);
        return graph;
    }

    // Step 5: Build clean graph with only connected nodes
    const cleanNodes = new Map<string, LineageNode>();
    const cleanEdges = new Map<string, string[]>();
    const cleanPaths = new Map<string, LineageNode[]>();

    for (const nodeId of connectedNodes) {
        const node = graph.nodes.get(nodeId);
        if (node) {
            cleanNodes.set(nodeId, node);
        }
    }

    for (const [sourceId, targets] of graph.edges) {
        if (connectedNodes.has(sourceId)) {
            const cleanTargets = targets.filter(targetId => connectedNodes.has(targetId));
            if (cleanTargets.length > 0) {
                cleanEdges.set(sourceId, cleanTargets);
            }
        }
    }

    for (const [pathKey, pathNodes] of graph.paths) {
        const cleanPathNodes = pathNodes.filter(node => {
            const nodeId = node.type === 'jsonDoc' ? node.jsonDocId : node.transformId;
            return connectedNodes.has(nodeId);
        });
        if (cleanPathNodes.length > 0) {
            cleanPaths.set(pathKey, cleanPathNodes);
        }
    }

    const cleanRootNodes = new Set<string>();
    for (const rootId of graph.rootNodes) {
        if (connectedNodes.has(rootId)) {
            cleanRootNodes.add(rootId);
        }
    }

    return {
        nodes: cleanNodes,
        edges: cleanEdges,
        paths: cleanPaths,
        rootNodes: cleanRootNodes
    };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Find all leaf nodes of a specific jsonDoc type
 */
export function findLeafNodesByType(
    graph: LineageGraph,
    jsonDocs: ElectricJsonDoc[],
    jsonDocType: string
): ElectricJsonDoc[] {
    const leafJsonDocs: ElectricJsonDoc[] = [];
    const jsonDocMap = new Map(jsonDocs.map(a => [a.id, a]));

    // Find all leaf nodes in the graph
    for (const [jsonDocId, node] of graph.nodes) {
        if (node.isLeaf) {
            const jsonDoc = jsonDocMap.get(jsonDocId);
            if (jsonDoc && jsonDoc.schema_type === jsonDocType) {
                leafJsonDocs.push(jsonDoc);
            }
        }
    }

    return leafJsonDocs;
}

/**
 * Find all leaf brainstorm idea jsonDocs from the lineage graph
 */
export function findLatestBrainstormIdeas(
    graph: LineageGraph,
    jsonDocs: ElectricJsonDoc[]
): ElectricJsonDoc[] {
    return findLeafNodesByType(graph, jsonDocs, 'brainstorm_idea');
}

/**
 * Find all leaf brainstorm idea jsonDocs with lineage information
 */
export function findLatestBrainstormIdeasWithLineage(
    graph: LineageGraph,
    jsonDocs: import('../types').ElectricJsonDoc[]
): import('../types').ElectricJsonDocWithLineage[] {
    const latestBrainstormIdeas = findLeafNodesByType(graph, jsonDocs, 'brainstorm_idea');
    return addLineageToJsonDocs(latestBrainstormIdeas, graph);
}



/**
 * Add lineage information to jsonDocs based on the lineage graph
 */
export function addLineageToJsonDocs(
    jsonDocs: import('../types').ElectricJsonDoc[],
    graph: LineageGraph
): import('../types').ElectricJsonDocWithLineage[] {
    return jsonDocs.map(jsonDoc => {
        const node = graph.nodes.get(jsonDoc.id);

        if (!node || node.type !== 'jsonDoc') {
            return {
                ...jsonDoc,
                sourceTransform: 'none',
                isEditable: false
            };
        }

        const sourceTransform = node.sourceTransform;

        if (sourceTransform === 'none') {
            return {
                ...jsonDoc,
                sourceTransform: 'none',
                isEditable: false
            };
        }

        return {
            ...jsonDoc,
            sourceTransform: {
                id: sourceTransform.transformId,
                type: sourceTransform.transformType,
                transformType: sourceTransform.transformType
            },
            isEditable: sourceTransform.transformType === 'human'
        };
    });
}

// ============================================================================
// NEW: JSONPath-Based JsonDoc Resolution
// ============================================================================

/**
 * Find the latest jsonDoc for a specific JSONPath within a source jsonDoc
 */
export function findLatestJsonDocForPath(
    sourceJsonDocId: string,
    jsonDocPath: string,
    graph: LineageGraph
): LineageResolutionResult {
    // 1. Find all transforms that used this jsonDoc + path as input
    const pathKey = `${sourceJsonDocId}:${jsonDocPath}`;
    const pathLineage = graph.paths.get(pathKey);

    if (pathLineage && pathLineage.length > 0) {
        // 2. Follow lineage to find latest derived jsonDoc
        const latestTransform = pathLineage[pathLineage.length - 1];
        if (latestTransform.type === 'transform') {
            // Find the output jsonDoc of this transform
            const transformNode = latestTransform as LineageNodeTransform;
            // For now, assume single output - could be enhanced for multiple outputs
            const outputJsonDocId = graph.edges.get(transformNode.transformId)?.[0];
            if (outputJsonDocId) {
                return {
                    jsonDocId: outputJsonDocId,
                    path: '$', // Output is typically a complete jsonDoc
                    depth: latestTransform.depth + 1,
                    lineagePath: pathLineage
                };
            }
        }
    }

    // 3. If no edits found, return original jsonDoc + path
    return {
        jsonDocId: sourceJsonDocId,
        path: jsonDocPath,
        depth: 0,
        lineagePath: []
    };
}

/**
 * Generic function to get jsonDoc data at a specific JSONPath
 */
export function getJsonDocAtPath(
    jsonDoc: ElectricJsonDoc,
    jsonDocPath: string
): any | null {
    if (jsonDocPath === '$') {
        return JSON.parse(jsonDoc.data);
    }

    try {
        const data = JSON.parse(jsonDoc.data);

        // Handle $.ideas[n] pattern for brainstorm collections
        const ideaMatch = jsonDocPath.match(/^\$\.ideas\[(\d+)\]$/);
        if (ideaMatch) {
            const index = parseInt(ideaMatch[1]);
            if (data.ideas && Array.isArray(data.ideas) && data.ideas[index]) {
                return {
                    title: data.ideas[index].title,
                    body: data.ideas[index].body
                };
            }
            return null;
        }

        // Handle nested field paths like $.ideas[n].title, $.ideas[n].body
        const nestedFieldMatch = jsonDocPath.match(/^\$\.ideas\[(\d+)\]\.([a-zA-Z_][a-zA-Z0-9_]*)$/);
        if (nestedFieldMatch) {
            const index = parseInt(nestedFieldMatch[1]);
            const field = nestedFieldMatch[2];
            if (data.ideas && Array.isArray(data.ideas) && data.ideas[index]) {
                return data.ideas[index][field] || null;
            }
            return null;
        }

        // Handle simple field paths like $.title, $.body
        const fieldMatch = jsonDocPath.match(/^\$\.([a-zA-Z_][a-zA-Z0-9_]*)$/);
        if (fieldMatch) {
            const field = fieldMatch[1];
            return data[field] || null;
        }

        return null;
    } catch (error) {
        console.error('Error parsing jsonDoc data:', error);
        return null;
    }
}

/**
 * Get the latest version for a specific path within an jsonDoc
 */
export function getLatestVersionForPath(
    jsonDocId: string,
    jsonDocPath: string,
    graph: LineageGraph
): string | null {
    const result = findLatestJsonDocForPath(jsonDocId, jsonDocPath, graph);
    return result.jsonDocId === jsonDocId ? null : result.jsonDocId;
}

// ============================================================================
// NEW: Principled Brainstorm Idea Resolution
// ============================================================================

export interface EffectiveBrainstormIdea {
    jsonDocId: string;
    jsonDocPath: string; // Path within the jsonDoc ($ for standalone, $.ideas[n] for collection items)
    originalJsonDocId: string; // The root collection or standalone idea this derives from
    index: number; // Index within the original collection (or 0 for standalone)
    isFromCollection: boolean;
}

/**
 * Find all effective brainstorm ideas using principled lineage graph traversal
 * This replaces the patchy table lookup approach with a proper graph-based solution
 */
export function findEffectiveBrainstormIdeas(
    graph: LineageGraph,
    jsonDocs: ElectricJsonDoc[]
): EffectiveBrainstormIdea[] {
    const results: EffectiveBrainstormIdea[] = [];
    const jsonDocMap = new Map(jsonDocs.map(a => [a.id, a]));





    // Step 1: Find all relevant brainstorm nodes (both leaf and non-leaf)
    // Collections can be non-leaf but still need processing for unconsumed ideas
    const relevantNodes = Array.from(graph.nodes.entries())
        .filter(([_, node]) => {
            if (node.type !== 'jsonDoc') return false;

            const jsonDoc = jsonDocMap.get((node as LineageNodeJsonDoc).jsonDocId);
            const isBrainstormType = jsonDoc && (
                jsonDoc.schema_type === 'brainstorm_idea' || jsonDoc.schema_type === 'brainstorm_collection'
            );

            // Include all brainstorm types regardless of leaf status
            // - brainstorm_idea: only if leaf (final versions)
            // - brainstorm_idea_collection: always (may have unconsumed ideas)
            const shouldInclude = isBrainstormType && (
                ((jsonDoc.schema_type === 'brainstorm_idea') && node.isLeaf) ||
                ((jsonDoc.schema_type === 'brainstorm_collection') && node.isLeaf) ||
                (jsonDoc.schema_type === 'brainstorm_collection')
            );


            return shouldInclude;
        })
        .map(([jsonDocId, node]) => ({ jsonDocId, node: node as LineageNodeJsonDoc }));



    for (const { jsonDocId, node } of relevantNodes) {
        const jsonDoc = jsonDocMap.get(jsonDocId);
        if (!jsonDoc) continue;

        if (jsonDoc.schema_type === 'brainstorm_collection') {
            // Step 2a: Collection leaf - check which ideas are still "available"
            const consumedPaths = findConsumedCollectionPaths(jsonDocId, graph);
            const collectionIdeas = extractCollectionIdeas(jsonDoc, consumedPaths);
            results.push(...collectionIdeas);

        } else if (jsonDoc.schema_type === 'brainstorm_idea') {
            // Step 2b: Standalone idea leaf - check if it originated from a collection
            const originInfo = traceToCollectionOrigin(jsonDocId, graph, jsonDocMap);

            if (originInfo.isFromCollection) {
                results.push({
                    jsonDocId,
                    jsonDocPath: '$', // Standalone jsonDoc uses whole jsonDoc
                    originalJsonDocId: originInfo.originalCollectionId!,
                    index: originInfo.collectionIndex!,
                    isFromCollection: true
                });
            } else {
                results.push({
                    jsonDocId,
                    jsonDocPath: '$',
                    originalJsonDocId: jsonDocId,
                    index: 0,
                    isFromCollection: false
                });
            }
        }
    }

    // CRITICAL: Sort results to preserve original collection ordering
    // This ensures that derived jsonDocs (human edits) appear in the same position
    // as their original collection items, maintaining consistent UI ordering
    results.sort((a, b) => {
        // First sort by original collection ID (to group ideas from same collection)
        if (a.originalJsonDocId !== b.originalJsonDocId) {
            return a.originalJsonDocId.localeCompare(b.originalJsonDocId);
        }

        // Then sort by index within the collection (preserves original ordering)
        return a.index - b.index;
    });
    return results;
}

/**
 * Find which collection paths have been "consumed" by transforms
 */
function findConsumedCollectionPaths(collectionId: string, graph: LineageGraph): Set<string> {
    const consumedPaths = new Set<string>();

    // Look through all path entries to find ones that start with this collection
    for (const [pathKey, _] of graph.paths) {
        if (pathKey.startsWith(`${collectionId}:`)) {
            const path = pathKey.split(':')[1];
            consumedPaths.add(path);
        }
    }

    return consumedPaths;
}

/**
 * Extract available ideas from a collection, excluding consumed ones
 */
function extractCollectionIdeas(
    collectionJsonDoc: ElectricJsonDoc,
    consumedPaths: Set<string>
): EffectiveBrainstormIdea[] {
    const results: EffectiveBrainstormIdea[] = [];

    try {
        const collectionData = JSON.parse(collectionJsonDoc.data);
        if (!collectionData.ideas || !Array.isArray(collectionData.ideas)) {
            return results;
        }

        for (let i = 0; i < collectionData.ideas.length; i++) {
            const ideaPath = `$.ideas[${i}]`;

            if (!consumedPaths.has(ideaPath)) {
                // This idea hasn't been consumed, so it's still "available"
                results.push({
                    jsonDocId: collectionJsonDoc.id,
                    jsonDocPath: ideaPath,
                    originalJsonDocId: collectionJsonDoc.id,
                    index: i,
                    isFromCollection: true
                });
            }
        }
    } catch (error) {
        console.error(`Error parsing collection data for ${collectionJsonDoc.id}:`, error);
    }

    return results;
}

/**
 * Trace a standalone idea back to see if it originated from a collection
 */
function traceToCollectionOrigin(
    ideaId: string,
    graph: LineageGraph,
    jsonDocMap: Map<string, ElectricJsonDoc>
): {
    isFromCollection: boolean;
    originalCollectionId?: string;
    originalPath?: string;
    collectionIndex?: number;
} {
    const node = graph.nodes.get(ideaId);
    if (!node || node.type !== 'jsonDoc') {
        return { isFromCollection: false };
    }

    // Trace back through the lineage
    let currentNode: LineageNodeJsonDoc = node;
    let traceDepth = 0;

    while (currentNode.sourceTransform !== 'none' && traceDepth < 10) { // Prevent infinite loops
        traceDepth++;
        const sourceTransform = currentNode.sourceTransform;



        // Check all source jsonDocs of this transform
        for (const sourceJsonDoc of sourceTransform.sourceJsonDocs) {
            const sourceJsonDocData = jsonDocMap.get(sourceJsonDoc.jsonDocId);

            if (sourceJsonDocData?.schema_type === 'brainstorm_collection') {
                // Found a collection origin!
                // Extract index from the path if available
                let collectionIndex = 0;
                if (sourceTransform.path) {
                    const match = sourceTransform.path.match(/\$\.ideas\[(\d+)\]/);
                    if (match) {
                        collectionIndex = parseInt(match[1]);
                    }
                }

                return {
                    isFromCollection: true,
                    originalCollectionId: sourceJsonDoc.jsonDocId,
                    originalPath: sourceTransform.path,
                    collectionIndex
                };
            }

            // Continue tracing if this source jsonDoc also has a source transform
            if (sourceJsonDoc.sourceTransform !== 'none') {
                currentNode = sourceJsonDoc;
                break; // Continue with this path
            }
        }

        // If we get here, we've exhausted the lineage without finding a collection
        break;
    }

    return { isFromCollection: false };
}

// Define the IdeaWithTitle interface here to avoid import issues
export interface IdeaWithTitle {
    title: string;
    body: string;
    jsonDocId?: string;
    originalJsonDocId?: string;
    jsonDocPath: string;
    index?: number;
    debugInfo?: string;
}

// ============================================================================
// NEW: Workflow Map/ToC Data Structures
// ============================================================================

export interface WorkflowNode {
    id: string;
    schemaType: TypedJsonDoc['schema_type'];
    title: string;
    jsonDocId: string;
    position: { x: number; y: number };
    isMain: boolean;
    isActive: boolean;
    navigationTarget: string; // anchor or route
    createdAt: string;
    status?: 'completed' | 'processing' | 'failed';
}

/**
 * Convert effective brainstorm ideas to IdeaWithTitle format
 * This is a pure function that handles the data conversion logic
 */
export function convertEffectiveIdeasToIdeaWithTitle(
    effectiveIdeas: EffectiveBrainstormIdea[],
    jsonDocs: ElectricJsonDoc[]
): IdeaWithTitle[] {
    const jsonDocMap = new Map(jsonDocs.map(a => [a.id, a]));

    return effectiveIdeas.map((effectiveIdea): IdeaWithTitle => {
        // Get the actual data for this idea
        let title = '';
        let body = '';

        const jsonDoc = jsonDocMap.get(effectiveIdea.jsonDocId);
        if (jsonDoc) {
            try {
                if (effectiveIdea.jsonDocPath === '$') {
                    // Standalone jsonDoc - use full data
                    const data = JSON.parse(jsonDoc.data);
                    title = data.title || '';
                    body = data.body || '';
                } else {
                    // Collection jsonDoc - extract specific idea
                    const data = JSON.parse(jsonDoc.data);
                    if (data.ideas && Array.isArray(data.ideas) && data.ideas[effectiveIdea.index]) {
                        title = data.ideas[effectiveIdea.index].title || '';
                        body = data.ideas[effectiveIdea.index].body || '';
                    }
                }
            } catch (parseError) {
                console.error(`Error parsing jsonDoc data for ${effectiveIdea.jsonDocId}:`, parseError);
            }
        }

        return {
            title,
            body,
            jsonDocId: effectiveIdea.jsonDocId,
            originalJsonDocId: effectiveIdea.originalJsonDocId,
            jsonDocPath: effectiveIdea.jsonDocPath,
            index: effectiveIdea.index
        };
    });
}

/**
 * Extract effective brainstorm ideas from raw project data
 * This is a pure function that handles the core lineage resolution logic
 */
export function extractEffectiveBrainstormIdeas(
    jsonDocs: ElectricJsonDoc[],
    transforms: ElectricTransform[],
    humanTransforms: ElectricHumanTransform[],
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[]
): EffectiveBrainstormIdea[] {
    try {
        // Build the lineage graph
        const graph = buildLineageGraph(
            jsonDocs,
            transforms,
            humanTransforms,
            transformInputs,
            transformOutputs
        );

        // Use principled resolution to find all effective brainstorm ideas
        return findEffectiveBrainstormIdeas(graph, jsonDocs);

    } catch (err) {
        const error = err instanceof Error ? err : new Error('Effective brainstorm ideas extraction failed');
        console.error('[extractEffectiveBrainstormIdeas] Error:', error);
        throw error; // Re-throw so caller can handle
    }
}

// ============================================================================
// NEW: Main Workflow Path Algorithm
// ============================================================================

/**
 * Find the main workflow path for the project
 * GUIDING PRINCIPLE: Always capture the "main" thing - the primary workflow path
 * that represents the user's chosen direction.
 */
export function findMainWorkflowPath(
    jsonDocs: ElectricJsonDoc[],
    graph: LineageGraph
): WorkflowNode[] {
    const workflowNodes: WorkflowNode[] = [];



    try {
        // Step 1: Find the main outline (only one allowed per project)
        const outlineJsonDocs = jsonDocs.filter(a =>
            a.schema_type === 'outline_settings'
        );

        // Sort by creation date to get the latest/main outline
        const mainOutline = outlineJsonDocs
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        if (!mainOutline) {
            // No outline yet - show brainstorm collection(s) only
            return createBrainstormOnlyWorkflow(jsonDocs);
        }

        // Step 2: Trace back from outline to find the main path
        const mainPath = traceMainPathFromOutline(mainOutline, graph, jsonDocs);

        // Step 3: Convert jsonDocs to workflow nodes
        const workflowNodes = createWorkflowNodes(mainPath);

        return workflowNodes;

    } catch (error) {
        console.error('[findMainWorkflowPath] Error:', error);
        // Fallback: show brainstorm collections only
        return createBrainstormOnlyWorkflow(jsonDocs);
    }
}

/**
 * Create workflow when only brainstorm data exists (no outline yet)
 */
function createBrainstormOnlyWorkflow(jsonDocs: ElectricJsonDoc[]): WorkflowNode[] {
    // Look for brainstorm input jsonDocs
    const brainstormInputs = jsonDocs.filter(a =>
        a.schema_type === 'brainstorm_input_params'
    );

    // Look for brainstorm collections and ideas
    const brainstormCollections = jsonDocs.filter(a =>
        a.schema_type === 'brainstorm_collection' ||
        a.schema_type === 'brainstorm_idea'
    );

    // FIXED LOGIC: Properly handle the workflow progression
    let primaryJsonDoc: ElectricJsonDoc | null = null;
    let nodeType: WorkflowNode['schemaType'];
    let title: string;
    let navigationTarget: string;

    if (brainstormInputs.length > 0 && brainstormCollections.length > 0) {
        // Case 1: Both input AND collection exist -> user is in selection stage
        // Get the latest collection (the result of the brainstorm input)
        primaryJsonDoc = brainstormCollections
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        // Determine node type based on collection type
        if (primaryJsonDoc.schema_type === 'brainstorm_idea' && primaryJsonDoc.origin_type === 'user_input') {
            // Single manually entered idea
            nodeType = 'brainstorm_idea';

            // Try to extract title from the jsonDoc data
            try {
                const data = JSON.parse(primaryJsonDoc.data);
                title = data.title || '选中创意';
            } catch {
                title = '选中创意';
            }

            navigationTarget = '#ideation-edit';
        } else {
            // AI-generated collection - user needs to select from ideas
            nodeType = 'brainstorm_collection';
            title = '创意构思';
            navigationTarget = '#brainstorm-ideas';
        }
    } else if (brainstormInputs.length > 0) {
        // Case 2: Only input exists (no collection yet) -> user is in input stage
        primaryJsonDoc = brainstormInputs
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        nodeType = 'brainstorm_input_params';
        title = '头脑风暴输入';
        navigationTarget = '#brainstorm-input';
    } else if (brainstormCollections.length > 0) {
        // Case 3: Only collection exists (manual entry path) -> user is in collection stage
        primaryJsonDoc = brainstormCollections
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        // Determine workflow node type based on jsonDoc type
        if (primaryJsonDoc.schema_type === 'brainstorm_idea' && primaryJsonDoc.origin_type === 'user_input') {
            // Single manually entered idea
            nodeType = 'brainstorm_idea';

            // Try to extract title from the jsonDoc data
            try {
                const data = JSON.parse(primaryJsonDoc.data);
                title = data.title || '选中创意';
            } catch {
                title = '选中创意';
            }

            navigationTarget = '#ideation-edit';
        } else {
            // AI-generated collection or other types
            nodeType = 'brainstorm_collection';
            title = '创意构思';
            navigationTarget = '#brainstorm-ideas';
        }
    } else {
        // No brainstorm jsonDocs found
        return [];
    }

    if (!primaryJsonDoc) {
        return [];
    }

    return [{
        id: `workflow-node-${primaryJsonDoc.id}`,
        schemaType: nodeType,
        title: title,
        jsonDocId: primaryJsonDoc.id,
        position: { x: 90, y: 50 },
        isMain: true,
        isActive: true,
        navigationTarget: navigationTarget,
        createdAt: primaryJsonDoc.created_at,
        status: primaryJsonDoc.streaming_status === 'streaming' ? 'processing' : 'completed'
    }];
}

/**
 * Trace back from outline to find the main jsonDoc path
 */
function traceMainPathFromOutline(
    outlineJsonDoc: ElectricJsonDoc,
    graph: LineageGraph,
    jsonDocs: ElectricJsonDoc[]
): ElectricJsonDoc[] {
    const path: ElectricJsonDoc[] = [outlineJsonDoc];

    // Get the lineage node for this outline
    const outlineNode = graph.nodes.get(outlineJsonDoc.id);
    if (!outlineNode || outlineNode.type !== 'jsonDoc') {
        return path;
    }

    // Step 1: Trace back through source transforms to find earlier jsonDocs
    let currentNode = outlineNode as LineageNodeJsonDoc;
    const visited = new Set<string>([outlineJsonDoc.id]);

    while (currentNode.sourceTransform !== 'none' && currentNode.sourceTransform) {
        const sourceTransform = currentNode.sourceTransform;

        // Find the most relevant source jsonDoc (usually the first one)
        for (const sourceJsonDoc of sourceTransform.sourceJsonDocs) {
            if (visited.has(sourceJsonDoc.jsonDocId)) {
                continue; // Avoid cycles
            }

            const jsonDoc = jsonDocs.find(a => a.id === sourceJsonDoc.jsonDocId);
            if (jsonDoc) {
                path.unshift(jsonDoc); // Add to beginning to maintain order
                visited.add(jsonDoc.id);
                currentNode = sourceJsonDoc;
                break;
            }
        }

        // Safety check to prevent infinite loops
        if (path.length > 10) {
            break;
        }
    }

    // Step 2: Trace forward from outline to find later jsonDocs (like chronicles)
    const forwardPath = traceForwardFromJsonDoc(outlineJsonDoc, graph, jsonDocs, visited);
    path.push(...forwardPath);

    return path;
}

/**
 * Trace forward from an jsonDoc to find jsonDocs that were created from it
 */
function traceForwardFromJsonDoc(
    sourceJsonDoc: ElectricJsonDoc,
    graph: LineageGraph,
    jsonDocs: ElectricJsonDoc[],
    visited: Set<string>
): ElectricJsonDoc[] {
    const forwardPath: ElectricJsonDoc[] = [];
    const edges = graph.edges.get(sourceJsonDoc.id);



    if (!edges || edges.length === 0) {
        return forwardPath;
    }

    // Find the most relevant next jsonDoc (usually the latest one)
    // Only follow main workflow jsonDocs, not individual edits
    for (const nextJsonDocId of edges) {
        if (visited.has(nextJsonDocId)) {
            continue; // Avoid cycles
        }

        const nextJsonDoc = jsonDocs.find(a => a.id === nextJsonDocId);
        if (nextJsonDoc) {
            // Only include main workflow jsonDocs, not individual stage edits
            const isMainWorkflowJsonDoc =
                nextJsonDoc.schema_type === 'brainstorm_collection' ||
                nextJsonDoc.schema_type === 'brainstorm_idea' ||
                nextJsonDoc.schema_type === 'outline_settings' ||
                nextJsonDoc.schema_type === 'chronicles';



            if (isMainWorkflowJsonDoc) {
                forwardPath.push(nextJsonDoc);
                visited.add(nextJsonDocId);

                // Recursively trace forward from this jsonDoc
                const furtherPath = traceForwardFromJsonDoc(nextJsonDoc, graph, jsonDocs, visited);
                forwardPath.push(...furtherPath);

                // For now, only follow the first path to avoid complexity
                break;
            }
        }
    }

    return forwardPath;
}

/**
 * Convert jsonDoc path to workflow nodes
 */
function createWorkflowNodes(jsonDocPath: ElectricJsonDoc[]): WorkflowNode[] {
    const workflowNodes: WorkflowNode[] = [];
    let yPosition = 50;

    for (let i = 0; i < jsonDocPath.length; i++) {
        const jsonDoc = jsonDocPath[i];
        const node = createWorkflowNodeFromJsonDoc(jsonDoc, yPosition, i === jsonDocPath.length - 1);
        if (node) {
            workflowNodes.push(node);
            yPosition += 120; // Space between nodes
        }
    }

    return workflowNodes;
}

/**
 * Create a single workflow node from an jsonDoc
 */
function createWorkflowNodeFromJsonDoc(
    jsonDoc: ElectricJsonDoc,
    yPosition: number,
    isLatest: boolean
): WorkflowNode | null {
    let nodeType: WorkflowNode['schemaType'];
    let title: string;
    let navigationTarget: string;

    // Determine node type and properties based on jsonDoc
    if (jsonDoc.schema_type === 'brainstorm_collection') {
        nodeType = 'brainstorm_collection';
        title = '创意构思';
        navigationTarget = '#brainstorm-ideas';
    } else if (jsonDoc.schema_type === 'brainstorm_idea') {
        nodeType = 'brainstorm_idea';

        // Try to extract title from data
        try {
            const data = JSON.parse(jsonDoc.data);
            title = data.title || '选中创意';
        } catch {
            title = '选中创意';
        }

        navigationTarget = '#selected-idea';
    } else if (
        jsonDoc.schema_type === 'outline_settings') {
        nodeType = 'outline_settings';

        // Try to extract title from outline data
        try {
            const data = JSON.parse(jsonDoc.data);
            title = data.title || '时间顺序大纲';
        } catch {
            title = '时间顺序大纲';
        }

        navigationTarget = '#story-outline';
    } else if (jsonDoc.schema_type === 'chronicles') {
        nodeType = 'chronicles';
        title = '分集概要';
        navigationTarget = '#chronicles';
    } else {
        // Unknown jsonDoc type
        return null;
    }

    return {
        id: `workflow-node-${jsonDoc.id}`,
        schemaType: nodeType,
        title,
        jsonDocId: jsonDoc.id,
        position: { x: 90, y: yPosition },
        isMain: true,
        isActive: isLatest, // Only the latest node is "active"
        navigationTarget,
        createdAt: jsonDoc.created_at,
        status: jsonDoc.streaming_status === 'streaming' ? 'processing' : 'completed'
    };
}

/**
 * Find parent jsonDocs of a specific schema type by traversing the lineage graph backwards
 */
export function findParentJsonDocsBySchemaType(
    sourceJsonDocId: string,
    targetSchemaType: string,
    graph: LineageGraph,
    jsonDocs: ElectricJsonDoc[]
): ElectricJsonDoc[] {
    const results: ElectricJsonDoc[] = [];
    const jsonDocMap = new Map(jsonDocs.map(a => [a.id, a]));
    const visited = new Set<string>();

    function traverseBackwards(jsonDocId: string) {
        if (visited.has(jsonDocId)) {
            return;
        }
        visited.add(jsonDocId);

        const node = graph.nodes.get(jsonDocId);
        if (!node || node.type !== 'jsonDoc') {
            return;
        }

        const jsonDoc = jsonDocMap.get(jsonDocId);
        if (!jsonDoc) {
            return;
        }

        // Check if this jsonDoc matches the target schema type
        if (jsonDoc.schema_type === targetSchemaType) {
            results.push(jsonDoc);
        }

        // Traverse backwards through source transforms
        const jsonDocNode = node as LineageNodeJsonDoc;
        if (jsonDocNode.sourceTransform !== 'none') {
            const sourceTransform = jsonDocNode.sourceTransform;

            // Recursively check all source jsonDocs
            for (const sourceJsonDoc of sourceTransform.sourceJsonDocs) {
                traverseBackwards(sourceJsonDoc.jsonDocId);
            }
        }
    }

    traverseBackwards(sourceJsonDocId);
    return results;
}

/**
 * Check if a specific path within an jsonDoc has been overridden by a human transform
 */
export function hasHumanTransformForPath(
    sourceJsonDocId: string,
    jsonDocPath: string,
    graph: LineageGraph
): { hasTransform: boolean; overrideJsonDocId?: string } {
    // Look for path-specific lineage
    const pathKey = `${sourceJsonDocId}:${jsonDocPath}`;
    const pathLineage = graph.paths.get(pathKey);

    if (pathLineage && pathLineage.length > 0) {
        // Find if there's a human transform in the lineage
        const humanTransforms = pathLineage.filter(node =>
            node.type === 'transform' &&
            (node as LineageNodeTransform).transformType === 'human'
        );

        if (humanTransforms.length > 0) {
            // Find the jsonDoc created by the latest human transform
            const latestHumanTransform = humanTransforms[humanTransforms.length - 1] as LineageNodeTransform;

            // Find the output jsonDoc of this transform
            const edges = Array.from(graph.edges.entries());
            for (const [sourceId, targets] of edges) {
                if (sourceId === sourceJsonDocId) {
                    // Look for jsonDocs that were created by this transform
                    for (const targetId of targets) {
                        const targetNode = graph.nodes.get(targetId);
                        if (targetNode && targetNode.type === 'jsonDoc') {
                            const targetJsonDocNode = targetNode as LineageNodeJsonDoc;
                            if (targetJsonDocNode.sourceTransform !== 'none' &&
                                targetJsonDocNode.sourceTransform.transformId === latestHumanTransform.transformId) {
                                return {
                                    hasTransform: true,
                                    overrideJsonDocId: targetId
                                };
                            }
                        }
                    }
                }
            }

            return { hasTransform: true };
        }
    }

    return { hasTransform: false };
} 