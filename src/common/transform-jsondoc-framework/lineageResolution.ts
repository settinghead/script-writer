/**
 * Core Lineage Resolution Algorithm
 * 
 * This module provides pure functions for resolving complex jsondoc lineages
 * in the script-writer application. It handles chains like:
 * 
 * brainstorm_collection[0] → human_transform → user_input → llm_transform → brainstorm_idea
 */

import type {
    ElectricJsondoc,
    ElectricTransform,
    ElectricHumanTransform,
    ElectricTransformInput,
    ElectricTransformOutput,
    TypedJsondoc
} from '../types';

// ============================================================================
// Data Structures
// ============================================================================

export type LineageNodeBase = {
    path?: string;
    depth: number;
    isLeaf: boolean;
    type: 'jsondoc' | 'transform';
    createdAt: string; // NEW: Add timestamp for chronological narrative
}

export type LineageNodeJsondoc = LineageNodeBase & {
    type: 'jsondoc';
    jsondocId: string;
    sourceTransform: LineageNodeTransform | "none";
    jsondoc: ElectricJsondoc; // NEW: Include the actual jsondoc object
}

export type LineageNodeTransform = LineageNodeBase & {
    type: 'transform';
    transformId: string;
    transformType: 'human' | 'llm';
    sourceJsondocs: LineageNodeJsondoc[];
    transform: ElectricTransform; // NEW: Include the actual transform object
}

export type LineageNode = LineageNodeJsondoc | LineageNodeTransform;



export interface LineageGraph {
    nodes: Map<string, LineageNode>;
    edges: Map<string, string[]>; // jsondocId -> [childJsondocIds]
    paths: Map<string, LineageNode[]>; // path -> [nodes in lineage]
    rootNodes: Set<string>; // Jsondocs with no incoming transforms
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export interface LineageResolutionResult {
    jsondocId: string | null;
    path?: string;
    depth: number;
    lineagePath: LineageNode[];
    createdAt?: string; // NEW: Add timestamp for chronological narrative
}

// ============================================================================
// Core Algorithm Functions
// ============================================================================

/**
 * Build a complete lineage graph from project jsondocs and transforms
 */
export function buildLineageGraph(
    jsondocs: ElectricJsondoc[],
    transforms: ElectricTransform[],
    humanTransforms: ElectricHumanTransform[],
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[]
): LineageGraph {

    // Internal phase types for multi-pass algorithm
    type PhaseOneJsondocNode = Omit<LineageNodeJsondoc, 'sourceTransform'> & {
        sourceTransformId: string | "none";
    };

    type PhaseOneTransformNode = Omit<LineageNodeTransform, 'sourceJsondocs'> & {
        sourceJsondocIds: string[];
    };

    type PhaseOneNode = PhaseOneJsondocNode | PhaseOneTransformNode;

    const phaseOneNodes = new Map<string, PhaseOneNode>();
    const edges = new Map<string, string[]>();
    const paths = new Map<string, LineageNode[]>();
    const rootNodes = new Set<string>();

    // Step 1: Initialize all jsondocs as nodes and determine root nodes
    const allJsondocIds = new Set(jsondocs.map(a => a.id));
    const jsondocsWithIncomingTransforms = new Set<string>();

    // Find all jsondocs that have incoming transforms
    for (const output of transformOutputs) {
        if (allJsondocIds.has(output.jsondoc_id)) {
            jsondocsWithIncomingTransforms.add(output.jsondoc_id);
        }
    }

    // Initialize jsondoc nodes with sourceTransformId (Phase 1)
    for (const jsondoc of jsondocs) {
        const isRoot = !jsondocsWithIncomingTransforms.has(jsondoc.id);
        if (isRoot) {
            rootNodes.add(jsondoc.id);
        }

        // Find the source transform for this jsondoc
        const sourceTransformId = transformOutputs.find(output =>
            output.jsondoc_id === jsondoc.id
        )?.transform_id || "none";

        phaseOneNodes.set(jsondoc.id, {
            type: 'jsondoc',
            jsondocId: jsondoc.id,
            depth: 0,
            isLeaf: true, // Will be updated if we find outgoing transforms
            path: undefined,
            sourceTransformId,
            createdAt: jsondoc.created_at,
            jsondoc: jsondoc
        } as PhaseOneJsondocNode);
    }

    // Step 1.5: Handle JSONPath-aware transform inputs
    for (const input of transformInputs) {
        const jsondocPath = (input as any).jsondoc_path || '$'; // NEW: Get jsondoc_path field

        if (jsondocPath !== '$') {
            // Create path-specific lineage tracking for any sub-jsondoc operations
            const pathKey = `${input.jsondoc_id}:${jsondocPath}`;
            if (!paths.has(pathKey)) {
                paths.set(pathKey, []);
            }
        }
        // If jsondocPath === '$', it's operating on the whole jsondoc (existing behavior)
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

            // Check if all input jsondocs for this transform have been processed
            const inputs = transformInputs.filter(ti => ti.transform_id === transformId);
            const canProcess = inputs.every(input => {
                const inputNode = phaseOneNodes.get(input.jsondoc_id);
                // Can process if the input node exists and either:
                // 1. It's a root node (no incoming transforms), or
                // 2. All transforms that produce this input have been processed
                return inputNode && (
                    rootNodes.has(input.jsondoc_id) ||
                    !hasUnprocessedIncomingTransforms(input.jsondoc_id, transformInputs, transformOutputs, processedTransforms)
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
        if (phaseOneNode.type === 'jsondoc') {
            const jsondocNode = phaseOneNode as PhaseOneJsondocNode;

            // Create jsondoc node (sourceTransform will be populated in second pass)
            const finalJsondocNode: LineageNodeJsondoc = {
                type: 'jsondoc' as const,
                jsondocId: jsondocNode.jsondocId,
                path: jsondocNode.path,
                depth: jsondocNode.depth,
                isLeaf: jsondocNode.isLeaf,
                sourceTransform: "none", // Will be populated in second pass
                jsondoc: jsondocNode.jsondoc,
                createdAt: jsondocNode.createdAt
            };

            nodes.set(nodeId, finalJsondocNode);
        } else {
            const transformNode = phaseOneNode as PhaseOneTransformNode;

            // Create transform node (sourceJsondocs will be populated in second pass)
            const finalTransformNode: LineageNodeTransform = {
                type: 'transform' as const,
                transformId: transformNode.transformId,
                transformType: transformNode.transformType,
                path: transformNode.path,
                depth: transformNode.depth,
                isLeaf: transformNode.isLeaf,
                sourceJsondocs: [], // Will be populated in second pass
                transform: transformNode.transform,
                createdAt: transformNode.createdAt
            };

            nodes.set(nodeId, finalTransformNode);
        }
    }

    // Second pass: Populate references now that all nodes exist
    for (const [nodeId, phaseOneNode] of phaseOneNodes) {
        if (phaseOneNode.type === 'jsondoc') {
            const jsondocNode = phaseOneNode as PhaseOneJsondocNode;
            const finalJsondocNode = nodes.get(nodeId) as LineageNodeJsondoc;

            // Resolve sourceTransform reference
            if (jsondocNode.sourceTransformId !== "none") {
                const sourceTransformNode = nodes.get(jsondocNode.sourceTransformId) as LineageNodeTransform | undefined;
                if (sourceTransformNode && sourceTransformNode.type === 'transform') {
                    finalJsondocNode.sourceTransform = sourceTransformNode;
                } else {
                    console.warn(`Warning: Could not resolve sourceTransform ${jsondocNode.sourceTransformId} for jsondoc ${nodeId}`);
                    finalJsondocNode.sourceTransform = "none";
                }
            }
        } else {
            const transformNode = phaseOneNode as PhaseOneTransformNode;
            const finalTransformNode = nodes.get(nodeId) as LineageNodeTransform;

            // Resolve sourceJsondocs references
            const sourceJsondocs: LineageNodeJsondoc[] = [];
            for (const jsondocId of transformNode.sourceJsondocIds) {
                const jsondocNode = nodes.get(jsondocId) as LineageNodeJsondoc | undefined;
                if (jsondocNode && jsondocNode.type === 'jsondoc') {
                    sourceJsondocs.push(jsondocNode);
                } else {
                    console.warn(`Warning: Could not resolve sourceJsondoc ${jsondocId} for transform ${nodeId}`);
                }
            }
            finalTransformNode.sourceJsondocs = sourceJsondocs;
        }
    }

    // Step 4: Update paths to use final nodes
    const finalPaths = new Map<string, LineageNode[]>();
    for (const [pathKey, phaseOnePath] of paths) {
        const finalPath: LineageNode[] = [];
        for (const phaseOneNode of phaseOnePath) {
            const finalNode = nodes.get(phaseOneNode.type === 'jsondoc' ? phaseOneNode.jsondocId : phaseOneNode.transformId);
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

// Helper function to check if an jsondoc has unprocessed incoming transforms
function hasUnprocessedIncomingTransforms(
    jsondocId: string,
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[],
    processedTransforms: Set<string>
): boolean {
    // Find all transforms that produce this jsondoc
    const producingTransforms = transformOutputs
        .filter(output => output.jsondoc_id === jsondocId)
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

    // Collect source jsondoc IDs for this transform
    const sourceJsondocIds = inputs.map(input => input.jsondoc_id);

    // Create transform node (Phase 1)
    phaseOneNodes.set(transformId, {
        type: 'transform',
        transformId: transformId,
        transformType: 'human',
        depth: 0, // Will be calculated based on sources
        isLeaf: false,
        path: humanTransform.derivation_path,
        sourceJsondocIds,
        createdAt: transform.created_at,
        transform: transform
    });

    for (const input of inputs) {
        for (const output of outputs) {
            const sourceId = input.jsondoc_id;
            const targetId = output.jsondoc_id;
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

                // Also add the output jsondoc to the path lineage
                // This ensures that findLatestJsondoc can find the edited jsondoc
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
            const inputNode = phaseOneNodes.get(input.jsondoc_id);
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

    // Collect source jsondoc IDs for this transform
    const sourceJsondocIds = inputs.map(input => input.jsondoc_id);

    // Create transform node (Phase 1)
    phaseOneNodes.set(transformId, {
        type: 'transform',
        transformId: transformId,
        transformType: 'llm',
        depth: 0, // Will be calculated based on sources
        isLeaf: false,
        path: transformPath,
        sourceJsondocIds,
        createdAt: transform.created_at,
        transform: transform
    });

    for (const input of inputs) {
        for (const output of outputs) {
            const sourceId = input.jsondoc_id;
            const targetId = output.jsondoc_id;

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

                    // Also create a path key for the target jsondoc to maintain lineage
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
            const inputNode = phaseOneNodes.get(input.jsondoc_id);
            return Math.max(max, inputNode?.depth ?? 0);
        }, 0);
        transformNode.depth = maxInputDepth + 1;
    }
}

/**
 * Find the latest (most recent) jsondoc in a lineage chain
 */
export function findLatestJsondoc(
    sourceJsondocId: string,
    path: string | undefined,
    graph: LineageGraph,
    jsondocs?: ElectricJsondoc[]
): LineageResolutionResult {
    const sourceNode = graph.nodes.get(sourceJsondocId);
    if (!sourceNode) {
        return {
            jsondocId: null,
            path: path,
            depth: 0,
            lineagePath: []
        };
    }

    // If we have a specific path, look for path-specific lineage
    if (path && path !== '$') {
        const pathKey = `${sourceJsondocId}:${path}`;
        const pathLineage = graph.paths.get(pathKey);

        if (pathLineage && pathLineage.length > 0) {
            // Find the deepest jsondoc node in the path lineage
            const jsondocNodes = pathLineage.filter(node => node.type === 'jsondoc');

            if (jsondocNodes.length > 0) {
                const deepestJsondoc = jsondocNodes.reduce((deepest, current) =>
                    current.depth > deepest.depth ? current : deepest
                );
                return {
                    jsondocId: deepestJsondoc.jsondocId,
                    path: path,
                    depth: deepestJsondoc.depth,
                    lineagePath: pathLineage
                };
            } else {
                return {
                    jsondocId: sourceJsondocId,
                    path: path,
                    depth: 0,
                    lineagePath: pathLineage
                };
            }
        } else {
            // No path-specific lineage found - return original jsondoc for this path
            // This is the key fix: don't traverse to deepest leaf, just return the original
            return {
                jsondocId: sourceJsondocId,
                path: path,
                depth: sourceNode.depth,
                lineagePath: [sourceNode]
            };
        }
    } else {
        // No path specified, traverse from root to find deepest leaf
        return traverseToLeaf(sourceJsondocId, graph, new Set(), jsondocs);
    }
}

/**
 * Traverse from an jsondoc to its deepest leaf node
 */
function traverseToLeaf(
    jsondocId: string,
    graph: LineageGraph,
    visited: Set<string> = new Set(),
    jsondocs?: ElectricJsondoc[]
): LineageResolutionResult {
    // Prevent infinite loops
    if (visited.has(jsondocId)) {
        return {
            jsondocId: null,
            depth: 0,
            lineagePath: []
        };
    }
    visited.add(jsondocId);

    const node = graph.nodes.get(jsondocId);
    if (!node) {
        return {
            jsondocId: null,
            depth: 0,
            lineagePath: []
        };
    }

    // If this is a leaf node, return it
    if (node.isLeaf) {
        const jsondoc = jsondocs?.find(a => a.id === jsondocId);
        return {
            jsondocId: jsondocId,
            depth: node.depth,
            lineagePath: [node],
            createdAt: node.createdAt
        };
    }

    // Find all children and traverse to the deepest one
    const children = graph.edges.get(jsondocId) || [];

    let deepestResult: LineageResolutionResult = {
        jsondocId: jsondocId,
        depth: node.depth,
        lineagePath: [node],
        createdAt: node.createdAt
    };

    for (const childId of children) {
        const childResult = traverseToLeaf(childId, graph, new Set(visited), jsondocs);

        // Use tie-breaking logic when depths are equal
        if (childResult.depth > deepestResult.depth) {
            deepestResult = {
                jsondocId: childResult.jsondocId,
                depth: childResult.depth,
                lineagePath: [node, ...childResult.lineagePath],
                createdAt: childResult.createdAt
            };
        } else if (childResult.depth === deepestResult.depth && childResult.jsondocId && deepestResult.jsondocId) {
            // Tie-breaking: prioritize user_input jsondocs over ai_generated ones
            const childJsondoc = jsondocs?.find(a => a.id === childResult.jsondocId);
            const currentJsondoc = jsondocs?.find(a => a.id === deepestResult.jsondocId);

            if (childJsondoc && currentJsondoc) {
                const childIsUserInput = childJsondoc.origin_type === 'user_input';
                const currentIsUserInput = currentJsondoc.origin_type === 'user_input';

                // Prefer user_input over ai_generated
                if (childIsUserInput && !currentIsUserInput) {
                    deepestResult = {
                        jsondocId: childResult.jsondocId,
                        depth: childResult.depth,
                        lineagePath: [node, ...childResult.lineagePath],
                        createdAt: childResult.createdAt
                    };
                }
                // If both are user_input or both are ai_generated, keep the current one (first-wins)
            }
        }
    }

    const finalJsondoc = jsondocs?.find(a => a.id === deepestResult.jsondocId);
    return {
        ...deepestResult,
        createdAt: finalJsondoc?.created_at || ''
    };
}

/**
 * Get the complete lineage path from a source jsondoc
 */
export function getLineagePath(
    jsondocId: string,
    graph: LineageGraph,
    jsondocs?: ElectricJsondoc[]
): LineageNode[] {
    const result = traverseToLeaf(jsondocId, graph, new Set(), jsondocs);
    return result.lineagePath;
}

/**
 * Validate the integrity of a lineage graph
 */
export function validateLineageIntegrity(graph: LineageGraph): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for orphaned nodes
    // for (const [jsondocId, node] of graph.nodes) {
    //     if (!graph.rootNodes.has(jsondocId) && !hasIncomingEdges(jsondocId, graph)) {
    //         warnings.push(`Jsondoc ${jsondocId} appears to be orphaned`);
    //     }
    // }

    // Check for circular references
    for (const rootId of graph.rootNodes) {
        if (hasCircularReference(rootId, graph)) {
            errors.push(`Circular reference detected starting from ${rootId}`);
        }
    }

    // Check for missing jsondocs referenced in edges
    for (const [sourceId, targets] of graph.edges) {
        if (!graph.nodes.has(sourceId)) {
            errors.push(`Source jsondoc ${sourceId} referenced in edges but not in nodes`);
        }
        for (const targetId of targets) {
            if (!graph.nodes.has(targetId)) {
                errors.push(`Target jsondoc ${targetId} referenced in edges but not in nodes`);
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
 * Check if an jsondoc has incoming edges (transforms that produce it)
 */
function hasIncomingEdges(jsondocId: string, graph: LineageGraph): boolean {
    for (const targets of graph.edges.values()) {
        if (targets.includes(jsondocId)) {
            return true;
        }
    }
    return false;
}

/**
 * Check for circular references starting from a given jsondoc
 */
function hasCircularReference(
    jsondocId: string,
    graph: LineageGraph,
    visited: Set<string> = new Set()
): boolean {
    if (visited.has(jsondocId)) {
        return true;
    }

    visited.add(jsondocId);
    const children = graph.edges.get(jsondocId) || [];

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
            const nodeId = node.type === 'jsondoc' ? node.jsondocId : node.transformId;
            return connectedNodes.has(nodeId);
        });
        if (hasConnectedNode) {
            // Include all nodes in this path
            pathNodes.forEach(node => {
                const nodeId = node.type === 'jsondoc' ? node.jsondocId : node.transformId;
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
            const nodeId = node.type === 'jsondoc' ? node.jsondocId : node.transformId;
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
 * Find all leaf nodes of a specific jsondoc type
 */
export function findLeafNodesByType(
    graph: LineageGraph,
    jsondocs: ElectricJsondoc[],
    jsondocType: string
): ElectricJsondoc[] {
    const leafJsondocs: ElectricJsondoc[] = [];
    const jsondocMap = new Map(jsondocs.map(a => [a.id, a]));

    // Find all leaf nodes in the graph
    for (const [jsondocId, node] of graph.nodes) {
        if (node.isLeaf) {
            const jsondoc = jsondocMap.get(jsondocId);
            if (jsondoc && jsondoc.schema_type === jsondocType) {
                leafJsondocs.push(jsondoc);
            }
        }
    }

    return leafJsondocs;
}

/**
 * Find all leaf brainstorm idea jsondocs from the lineage graph
 */
export function findLatestBrainstormIdeas(
    graph: LineageGraph,
    jsondocs: ElectricJsondoc[]
): ElectricJsondoc[] {
    return findLeafNodesByType(graph, jsondocs, 'brainstorm_idea');
}

/**
 * Find all leaf brainstorm idea jsondocs with lineage information
 */
export function findLatestBrainstormIdeasWithLineage(
    graph: LineageGraph,
    jsondocs: import('../types').ElectricJsondoc[]
): import('../types').ElectricJsondocWithLineage[] {
    const latestBrainstormIdeas = findLeafNodesByType(graph, jsondocs, 'brainstorm_idea');
    return addLineageToJsondocs(latestBrainstormIdeas, graph);
}



/**
 * Add lineage information to jsondocs based on the lineage graph
 */
export function addLineageToJsondocs(
    jsondocs: import('../types').ElectricJsondoc[],
    graph: LineageGraph
): import('../types').ElectricJsondocWithLineage[] {
    return jsondocs.map(jsondoc => {
        const node = graph.nodes.get(jsondoc.id);

        if (!node || node.type !== 'jsondoc') {
            return {
                ...jsondoc,
                sourceTransform: 'none',
                isEditable: false
            };
        }

        const sourceTransform = node.sourceTransform;

        if (sourceTransform === 'none') {
            return {
                ...jsondoc,
                sourceTransform: 'none',
                isEditable: false
            };
        }

        return {
            ...jsondoc,
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
// NEW: JSONPath-Based Jsondoc Resolution
// ============================================================================

/**
 * Find the latest jsondoc for a specific JSONPath within a source jsondoc
 */
export function findLatestJsondocForPath(
    sourceJsondocId: string,
    jsondocPath: string,
    graph: LineageGraph
): LineageResolutionResult {
    // 1. Find all transforms that used this jsondoc + path as input
    const pathKey = `${sourceJsondocId}:${jsondocPath}`;
    const pathLineage = graph.paths.get(pathKey);

    if (pathLineage && pathLineage.length > 0) {
        // 2. Follow lineage to find latest derived jsondoc
        const latestTransform = pathLineage[pathLineage.length - 1];
        if (latestTransform.type === 'transform') {
            // Find the output jsondoc of this transform
            const transformNode = latestTransform as LineageNodeTransform;
            // For now, assume single output - could be enhanced for multiple outputs
            const outputJsondocId = graph.edges.get(transformNode.transformId)?.[0];
            if (outputJsondocId) {
                return {
                    jsondocId: outputJsondocId,
                    path: '$', // Output is typically a complete jsondoc
                    depth: latestTransform.depth + 1,
                    lineagePath: pathLineage
                };
            }
        }
    }

    // 3. If no edits found, return original jsondoc + path
    return {
        jsondocId: sourceJsondocId,
        path: jsondocPath,
        depth: 0,
        lineagePath: []
    };
}

/**
 * Generic function to get jsondoc data at a specific JSONPath
 */
export function getJsondocAtPath(
    jsondoc: ElectricJsondoc,
    jsondocPath: string
): any | null {
    if (jsondocPath === '$') {
        return JSON.parse(jsondoc.data);
    }

    try {
        const data = JSON.parse(jsondoc.data);

        // Handle $.ideas[n] pattern for brainstorm collections
        const ideaMatch = jsondocPath.match(/^\$\.ideas\[(\d+)\]$/);
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
        const nestedFieldMatch = jsondocPath.match(/^\$\.ideas\[(\d+)\]\.([a-zA-Z_][a-zA-Z0-9_]*)$/);
        if (nestedFieldMatch) {
            const index = parseInt(nestedFieldMatch[1]);
            const field = nestedFieldMatch[2];
            if (data.ideas && Array.isArray(data.ideas) && data.ideas[index]) {
                return data.ideas[index][field] || null;
            }
            return null;
        }

        // Handle simple field paths like $.title, $.body
        const fieldMatch = jsondocPath.match(/^\$\.([a-zA-Z_][a-zA-Z0-9_]*)$/);
        if (fieldMatch) {
            const field = fieldMatch[1];
            return data[field] || null;
        }

        return null;
    } catch (error) {
        console.error('Error parsing jsondoc data:', error);
        return null;
    }
}

/**
 * Get the latest version for a specific path within an jsondoc
 */
export function getLatestVersionForPath(
    jsondocId: string,
    jsondocPath: string,
    graph: LineageGraph
): string | null {
    const result = findLatestJsondocForPath(jsondocId, jsondocPath, graph);
    return result.jsondocId === jsondocId ? null : result.jsondocId;
}

// ============================================================================
// NEW: Principled Brainstorm Idea Resolution
// ============================================================================

export interface EffectiveBrainstormIdea {
    jsondocId: string;
    jsondocPath: string; // Path within the jsondoc ($ for standalone, $.ideas[n] for collection items)
    originalJsondocId: string; // The root collection or standalone idea this derives from
    index: number; // Index within the original collection (or 0 for standalone)
    isFromCollection: boolean;
}

/**
 * Find all effective brainstorm ideas using principled lineage graph traversal
 * This replaces the patchy table lookup approach with a proper graph-based solution
 */
export function findEffectiveBrainstormIdeas(
    graph: LineageGraph,
    jsondocs: ElectricJsondoc[]
): EffectiveBrainstormIdea[] {
    const results: EffectiveBrainstormIdea[] = [];
    const jsondocMap = new Map(jsondocs.map(a => [a.id, a]));





    // Step 1: Find all relevant brainstorm nodes (both leaf and non-leaf)
    // Collections can be non-leaf but still need processing for unconsumed ideas
    const relevantNodes = Array.from(graph.nodes.entries())
        .filter(([_, node]) => {
            if (node.type !== 'jsondoc') return false;

            const jsondoc = jsondocMap.get((node as LineageNodeJsondoc).jsondocId);
            const isBrainstormType = jsondoc && (
                jsondoc.schema_type === 'brainstorm_idea' || jsondoc.schema_type === 'brainstorm_collection'
            );

            // Include all brainstorm types regardless of leaf status
            // - brainstorm_idea: only if leaf (final versions)
            // - brainstorm_idea_collection: always (may have unconsumed ideas)
            const shouldInclude = isBrainstormType && (
                ((jsondoc.schema_type === 'brainstorm_idea') && node.isLeaf) ||
                ((jsondoc.schema_type === 'brainstorm_collection') && node.isLeaf) ||
                (jsondoc.schema_type === 'brainstorm_collection')
            );


            return shouldInclude;
        })
        .map(([jsondocId, node]) => ({ jsondocId, node: node as LineageNodeJsondoc }));



    for (const { jsondocId, node } of relevantNodes) {
        const jsondoc = jsondocMap.get(jsondocId);
        if (!jsondoc) continue;

        if (jsondoc.schema_type === 'brainstorm_collection') {
            // Step 2a: Collection leaf - check which ideas are still "available"
            const consumedPaths = findConsumedCollectionPaths(jsondocId, graph);
            const collectionIdeas = extractCollectionIdeas(jsondoc, consumedPaths);
            results.push(...collectionIdeas);

        } else if (jsondoc.schema_type === 'brainstorm_idea') {
            // Step 2b: Standalone idea leaf - check if it originated from a collection
            const originInfo = traceToCollectionOrigin(jsondocId, graph, jsondocMap);

            if (originInfo.isFromCollection) {
                results.push({
                    jsondocId,
                    jsondocPath: '$', // Standalone jsondoc uses whole jsondoc
                    originalJsondocId: originInfo.originalCollectionId!,
                    index: originInfo.collectionIndex!,
                    isFromCollection: true
                });
            } else {
                results.push({
                    jsondocId,
                    jsondocPath: '$',
                    originalJsondocId: jsondocId,
                    index: 0,
                    isFromCollection: false
                });
            }
        }
    }

    // CRITICAL: Sort results to preserve original collection ordering
    // This ensures that derived jsondocs (human edits) appear in the same position
    // as their original collection items, maintaining consistent UI ordering
    results.sort((a, b) => {
        // First sort by original collection ID (to group ideas from same collection)
        if (a.originalJsondocId !== b.originalJsondocId) {
            return a.originalJsondocId.localeCompare(b.originalJsondocId);
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
    collectionJsondoc: ElectricJsondoc,
    consumedPaths: Set<string>
): EffectiveBrainstormIdea[] {
    const results: EffectiveBrainstormIdea[] = [];

    try {
        const collectionData = JSON.parse(collectionJsondoc.data);
        if (!collectionData.ideas || !Array.isArray(collectionData.ideas)) {
            return results;
        }

        for (let i = 0; i < collectionData.ideas.length; i++) {
            const ideaPath = `$.ideas[${i}]`;

            if (!consumedPaths.has(ideaPath)) {
                // This idea hasn't been consumed, so it's still "available"
                results.push({
                    jsondocId: collectionJsondoc.id,
                    jsondocPath: ideaPath,
                    originalJsondocId: collectionJsondoc.id,
                    index: i,
                    isFromCollection: true
                });
            }
        }
    } catch (error) {
        console.error(`Error parsing collection data for ${collectionJsondoc.id}:`, error);
    }

    return results;
}

/**
 * Trace a standalone idea back to see if it originated from a collection
 */
function traceToCollectionOrigin(
    ideaId: string,
    graph: LineageGraph,
    jsondocMap: Map<string, ElectricJsondoc>
): {
    isFromCollection: boolean;
    originalCollectionId?: string;
    originalPath?: string;
    collectionIndex?: number;
} {
    const node = graph.nodes.get(ideaId);
    if (!node || node.type !== 'jsondoc') {
        return { isFromCollection: false };
    }

    // Trace back through the lineage
    let currentNode: LineageNodeJsondoc = node;
    let traceDepth = 0;

    while (currentNode.sourceTransform !== 'none' && traceDepth < 10) { // Prevent infinite loops
        traceDepth++;
        const sourceTransform = currentNode.sourceTransform;



        // Check all source jsondocs of this transform
        for (const sourceJsondoc of sourceTransform.sourceJsondocs) {
            const sourceJsondocData = jsondocMap.get(sourceJsondoc.jsondocId);

            if (sourceJsondocData?.schema_type === 'brainstorm_collection') {
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
                    originalCollectionId: sourceJsondoc.jsondocId,
                    originalPath: sourceTransform.path,
                    collectionIndex
                };
            }

            // Continue tracing if this source jsondoc also has a source transform
            if (sourceJsondoc.sourceTransform !== 'none') {
                currentNode = sourceJsondoc;
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
    jsondocId?: string;
    originalJsondocId?: string;
    jsondocPath: string;
    index?: number;
    debugInfo?: string;
}

// ============================================================================
// NEW: Workflow Map/ToC Data Structures
// ============================================================================

export interface WorkflowNode {
    id: string;
    schemaType: TypedJsondoc['schema_type'];
    title: string;
    jsondocId: string;
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
    jsondocs: ElectricJsondoc[]
): IdeaWithTitle[] {
    const jsondocMap = new Map(jsondocs.map(a => [a.id, a]));

    return effectiveIdeas.map((effectiveIdea): IdeaWithTitle => {
        // Get the actual data for this idea
        let title = '';
        let body = '';

        const jsondoc = jsondocMap.get(effectiveIdea.jsondocId);
        if (jsondoc) {
            try {
                if (effectiveIdea.jsondocPath === '$') {
                    // Standalone jsondoc - use full data
                    const data = JSON.parse(jsondoc.data);
                    title = data.title || '';
                    body = data.body || '';
                } else {
                    // Collection jsondoc - extract specific idea
                    const data = JSON.parse(jsondoc.data);
                    if (data.ideas && Array.isArray(data.ideas) && data.ideas[effectiveIdea.index]) {
                        title = data.ideas[effectiveIdea.index].title || '';
                        body = data.ideas[effectiveIdea.index].body || '';
                    }
                }
            } catch (parseError) {
                console.error(`Error parsing jsondoc data for ${effectiveIdea.jsondocId}:`, parseError);
            }
        }

        return {
            title,
            body,
            jsondocId: effectiveIdea.jsondocId,
            originalJsondocId: effectiveIdea.originalJsondocId,
            jsondocPath: effectiveIdea.jsondocPath,
            index: effectiveIdea.index
        };
    });
}

/**
 * Extract effective brainstorm ideas from raw project data
 * This is a pure function that handles the core lineage resolution logic
 */
export function extractEffectiveBrainstormIdeas(
    jsondocs: ElectricJsondoc[],
    transforms: ElectricTransform[],
    humanTransforms: ElectricHumanTransform[],
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[]
): EffectiveBrainstormIdea[] {
    try {
        // Build the lineage graph
        const graph = buildLineageGraph(
            jsondocs,
            transforms,
            humanTransforms,
            transformInputs,
            transformOutputs
        );

        // Use principled resolution to find all effective brainstorm ideas
        return findEffectiveBrainstormIdeas(graph, jsondocs);

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
    jsondocs: ElectricJsondoc[],
    graph: LineageGraph
): WorkflowNode[] {
    const workflowNodes: WorkflowNode[] = [];



    try {
        // Step 1: Find the main outline (only one allowed per project)
        const outlineJsondocs = jsondocs.filter(a =>
            a.schema_type === 'outline_settings'
        );

        // Sort by creation date to get the latest/main outline
        const mainOutline = outlineJsondocs
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        if (!mainOutline) {
            // No outline yet - show brainstorm collection(s) only
            return createBrainstormOnlyWorkflow(jsondocs);
        }

        // Step 2: Trace back from outline to find the main path
        const mainPath = traceMainPathFromOutline(mainOutline, graph, jsondocs);

        // Step 3: Convert jsondocs to workflow nodes
        const workflowNodes = createWorkflowNodes(mainPath);

        return workflowNodes;

    } catch (error) {
        console.error('[findMainWorkflowPath] Error:', error);
        // Fallback: show brainstorm collections only
        return createBrainstormOnlyWorkflow(jsondocs);
    }
}

/**
 * Create workflow when only brainstorm data exists (no outline yet)
 */
function createBrainstormOnlyWorkflow(jsondocs: ElectricJsondoc[]): WorkflowNode[] {
    // Look for brainstorm input jsondocs
    const brainstormInputs = jsondocs.filter(a =>
        a.schema_type === 'brainstorm_input_params'
    );

    // Look for brainstorm collections and ideas
    const brainstormCollections = jsondocs.filter(a =>
        a.schema_type === 'brainstorm_collection' ||
        a.schema_type === 'brainstorm_idea'
    );

    // FIXED LOGIC: Properly handle the workflow progression
    let primaryJsondoc: ElectricJsondoc | null = null;
    let nodeType: WorkflowNode['schemaType'];
    let title: string;
    let navigationTarget: string;

    if (brainstormInputs.length > 0 && brainstormCollections.length > 0) {
        // Case 1: Both input AND collection exist -> user is in selection stage
        // Get the latest collection (the result of the brainstorm input)
        primaryJsondoc = brainstormCollections
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        // Determine node type based on collection type
        if (primaryJsondoc.schema_type === 'brainstorm_idea' && primaryJsondoc.origin_type === 'user_input') {
            // Single manually entered idea
            nodeType = 'brainstorm_idea';

            // Try to extract title from the jsondoc data
            try {
                const data = JSON.parse(primaryJsondoc.data);
                title = data.title || '选中创意';
            } catch {
                title = '选中创意';
            }

            navigationTarget = '#ideation-edit';
        } else {
            // AI-generated collection - user needs to select from ideas
            nodeType = 'brainstorm_collection';
            title = '创意构思';
            navigationTarget = '#ideas';
        }
    } else if (brainstormInputs.length > 0) {
        // Case 2: Only input exists (no collection yet) -> user is in input stage
        primaryJsondoc = brainstormInputs
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        nodeType = 'brainstorm_input_params';
        title = '头脑风暴输入';
        navigationTarget = '#brainstorm-input';
    } else if (brainstormCollections.length > 0) {
        // Case 3: Only collection exists (manual entry path) -> user is in collection stage
        primaryJsondoc = brainstormCollections
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        // Determine workflow node type based on jsondoc type
        if (primaryJsondoc.schema_type === 'brainstorm_idea' && primaryJsondoc.origin_type === 'user_input') {
            // Single manually entered idea
            nodeType = 'brainstorm_idea';

            // Try to extract title from the jsondoc data
            try {
                const data = JSON.parse(primaryJsondoc.data);
                title = data.title || '选中创意';
            } catch {
                title = '选中创意';
            }

            navigationTarget = '#ideation-edit';
        } else {
            // AI-generated collection or other types
            nodeType = 'brainstorm_collection';
            title = '创意构思';
            navigationTarget = '#ideas';
        }
    } else {
        // No brainstorm jsondocs found
        return [];
    }

    if (!primaryJsondoc) {
        return [];
    }

    return [{
        id: `workflow-node-${primaryJsondoc.id}`,
        schemaType: nodeType,
        title: title,
        jsondocId: primaryJsondoc.id,
        position: { x: 90, y: 50 },
        isMain: true,
        isActive: true,
        navigationTarget: navigationTarget,
        createdAt: primaryJsondoc.created_at,
        status: primaryJsondoc.streaming_status === 'streaming' ? 'processing' : 'completed'
    }];
}

/**
 * Trace back from outline to find the main jsondoc path
 */
function traceMainPathFromOutline(
    outlineJsondoc: ElectricJsondoc,
    graph: LineageGraph,
    jsondocs: ElectricJsondoc[]
): ElectricJsondoc[] {
    const path: ElectricJsondoc[] = [outlineJsondoc];

    // Get the lineage node for this outline
    const outlineNode = graph.nodes.get(outlineJsondoc.id);
    if (!outlineNode || outlineNode.type !== 'jsondoc') {
        return path;
    }

    // Step 1: Trace back through source transforms to find earlier jsondocs
    let currentNode = outlineNode as LineageNodeJsondoc;
    const visited = new Set<string>([outlineJsondoc.id]);

    while (currentNode.sourceTransform !== 'none' && currentNode.sourceTransform) {
        const sourceTransform = currentNode.sourceTransform;

        // Find the most relevant source jsondoc (usually the first one)
        for (const sourceJsondoc of sourceTransform.sourceJsondocs) {
            if (visited.has(sourceJsondoc.jsondocId)) {
                continue; // Avoid cycles
            }

            const jsondoc = jsondocs.find(a => a.id === sourceJsondoc.jsondocId);
            if (jsondoc) {
                path.unshift(jsondoc); // Add to beginning to maintain order
                visited.add(jsondoc.id);
                currentNode = sourceJsondoc;
                break;
            }
        }

        // Safety check to prevent infinite loops
        if (path.length > 10) {
            break;
        }
    }

    // Step 2: Trace forward from outline to find later jsondocs (like chronicles)
    const forwardPath = traceForwardFromJsondoc(outlineJsondoc, graph, jsondocs, visited);
    path.push(...forwardPath);

    return path;
}

/**
 * Trace forward from an jsondoc to find jsondocs that were created from it
 */
function traceForwardFromJsondoc(
    sourceJsondoc: ElectricJsondoc,
    graph: LineageGraph,
    jsondocs: ElectricJsondoc[],
    visited: Set<string>
): ElectricJsondoc[] {
    const forwardPath: ElectricJsondoc[] = [];
    const edges = graph.edges.get(sourceJsondoc.id);



    if (!edges || edges.length === 0) {
        return forwardPath;
    }

    // Find the most relevant next jsondoc (usually the latest one)
    // Only follow main workflow jsondocs, not individual edits
    for (const nextJsondocId of edges) {
        if (visited.has(nextJsondocId)) {
            continue; // Avoid cycles
        }

        const nextJsondoc = jsondocs.find(a => a.id === nextJsondocId);
        if (nextJsondoc) {
            // Only include main workflow jsondocs, not individual stage edits
            const isMainWorkflowJsondoc =
                nextJsondoc.schema_type === 'brainstorm_collection' ||
                nextJsondoc.schema_type === 'brainstorm_idea' ||
                nextJsondoc.schema_type === 'outline_settings' ||
                nextJsondoc.schema_type === 'chronicles';



            if (isMainWorkflowJsondoc) {
                forwardPath.push(nextJsondoc);
                visited.add(nextJsondocId);

                // Recursively trace forward from this jsondoc
                const furtherPath = traceForwardFromJsondoc(nextJsondoc, graph, jsondocs, visited);
                forwardPath.push(...furtherPath);

                // For now, only follow the first path to avoid complexity
                break;
            }
        }
    }

    return forwardPath;
}

/**
 * Convert jsondoc path to workflow nodes
 */
function createWorkflowNodes(jsondocPath: ElectricJsondoc[]): WorkflowNode[] {
    const workflowNodes: WorkflowNode[] = [];
    let yPosition = 50;

    for (let i = 0; i < jsondocPath.length; i++) {
        const jsondoc = jsondocPath[i];
        const node = createWorkflowNodeFromJsondoc(jsondoc, yPosition, i === jsondocPath.length - 1);
        if (node) {
            workflowNodes.push(node);
            yPosition += 120; // Space between nodes
        }
    }

    return workflowNodes;
}

/**
 * Create a single workflow node from an jsondoc
 */
function createWorkflowNodeFromJsondoc(
    jsondoc: ElectricJsondoc,
    yPosition: number,
    isLatest: boolean
): WorkflowNode | null {
    let nodeType: WorkflowNode['schemaType'];
    let title: string;
    let navigationTarget: string;

    // Determine node type and properties based on jsondoc
    if (jsondoc.schema_type === 'brainstorm_collection') {
        nodeType = 'brainstorm_collection';
        title = '创意构思';
        navigationTarget = '#ideas';
    } else if (jsondoc.schema_type === 'brainstorm_idea') {
        nodeType = 'brainstorm_idea';

        // Try to extract title from data
        try {
            const data = JSON.parse(jsondoc.data);
            title = data.title || '选中创意';
        } catch {
            title = '选中创意';
        }

        navigationTarget = '#selected-idea';
    } else if (
        jsondoc.schema_type === 'outline_settings') {
        nodeType = 'outline_settings';

        // Try to extract title from outline data
        try {
            const data = JSON.parse(jsondoc.data);
            title = data.title || '时间顺序大纲';
        } catch {
            title = '时间顺序大纲';
        }

        navigationTarget = '#story-outline';
    } else if (jsondoc.schema_type === 'chronicles') {
        nodeType = 'chronicles';
        title = '分集概要';
        navigationTarget = '#chronicles';
    } else {
        // Unknown jsondoc type
        return null;
    }

    return {
        id: `workflow-node-${jsondoc.id}`,
        schemaType: nodeType,
        title,
        jsondocId: jsondoc.id,
        position: { x: 90, y: yPosition },
        isMain: true,
        isActive: isLatest, // Only the latest node is "active"
        navigationTarget,
        createdAt: jsondoc.created_at,
        status: jsondoc.streaming_status === 'streaming' ? 'processing' : 'completed'
    };
}

/**
 * Find parent jsondocs of a specific schema type by traversing the lineage graph backwards
 */
export function findParentJsondocsBySchemaType(
    sourceJsondocId: string,
    targetSchemaType: string,
    graph: LineageGraph,
    jsondocs: ElectricJsondoc[]
): ElectricJsondoc[] {
    const results: ElectricJsondoc[] = [];
    const jsondocMap = new Map(jsondocs.map(a => [a.id, a]));
    const visited = new Set<string>();

    function traverseBackwards(jsondocId: string) {
        if (visited.has(jsondocId)) {
            return;
        }
        visited.add(jsondocId);

        const node = graph.nodes.get(jsondocId);
        if (!node || node.type !== 'jsondoc') {
            return;
        }

        const jsondoc = jsondocMap.get(jsondocId);
        if (!jsondoc) {
            return;
        }

        // Check if this jsondoc matches the target schema type
        if (jsondoc.schema_type === targetSchemaType) {
            results.push(jsondoc);
        }

        // Traverse backwards through source transforms
        const jsondocNode = node as LineageNodeJsondoc;
        if (jsondocNode.sourceTransform !== 'none') {
            const sourceTransform = jsondocNode.sourceTransform;

            // Recursively check all source jsondocs
            for (const sourceJsondoc of sourceTransform.sourceJsondocs) {
                traverseBackwards(sourceJsondoc.jsondocId);
            }
        }
    }

    traverseBackwards(sourceJsondocId);
    return results;
}

/**
 * Check if a specific path within an jsondoc has been overridden by a human transform
 */
export function hasHumanTransformForPath(
    sourceJsondocId: string,
    jsondocPath: string,
    graph: LineageGraph
): { hasTransform: boolean; overrideJsondocId?: string } {
    // Look for path-specific lineage
    const pathKey = `${sourceJsondocId}:${jsondocPath}`;
    const pathLineage = graph.paths.get(pathKey);

    if (pathLineage && pathLineage.length > 0) {
        // Find if there's a human transform in the lineage
        const humanTransforms = pathLineage.filter(node =>
            node.type === 'transform' &&
            (node as LineageNodeTransform).transformType === 'human'
        );

        if (humanTransforms.length > 0) {
            // Find the jsondoc created by the latest human transform
            const latestHumanTransform = humanTransforms[humanTransforms.length - 1] as LineageNodeTransform;

            // Find the output jsondoc of this transform
            const edges = Array.from(graph.edges.entries());
            for (const [sourceId, targets] of edges) {
                if (sourceId === sourceJsondocId) {
                    // Look for jsondocs that were created by this transform
                    for (const targetId of targets) {
                        const targetNode = graph.nodes.get(targetId);
                        if (targetNode && targetNode.type === 'jsondoc') {
                            const targetJsondocNode = targetNode as LineageNodeJsondoc;
                            if (targetJsondocNode.sourceTransform !== 'none' &&
                                targetJsondocNode.sourceTransform.transformId === latestHumanTransform.transformId) {
                                return {
                                    hasTransform: true,
                                    overrideJsondocId: targetId
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