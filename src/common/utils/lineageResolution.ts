/**
 * Core Lineage Resolution Algorithm
 * 
 * This module provides pure functions for resolving complex artifact lineages
 * in the script-writer application. It handles chains like:
 * 
 * brainstorm_collection[0] → human_transform → user_input → llm_transform → brainstorm_idea
 */

import { ElectricArtifact, ElectricTransform, ElectricHumanTransform, ElectricTransformInput, ElectricTransformOutput } from '../types';

// ============================================================================
// Data Structures
// ============================================================================

export type LineageNodeBase = {
    path?: string;
    depth: number;
    isLeaf: boolean;
    type: 'artifact' | 'transform';
}

export type LineageNodeArtifact = LineageNodeBase & {
    type: 'artifact';
    artifactId: string;
    artifactType: string;
    sourceTransform: LineageNodeTransform | "none";
}

export type LineageNodeTransform = LineageNodeBase & {
    type: 'transform';
    transformId: string;
    transformType: 'human' | 'llm';
    sourceArtifacts: LineageNodeArtifact[];
}

export type LineageNode = LineageNodeArtifact | LineageNodeTransform;



export interface LineageGraph {
    nodes: Map<string, LineageNode>;
    edges: Map<string, string[]>; // artifactId -> [childArtifactIds]
    paths: Map<string, LineageNode[]>; // path -> [nodes in lineage]
    rootNodes: Set<string>; // Artifacts with no incoming transforms
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export interface LineageResolutionResult {
    artifactId: string | null;
    path?: string;
    depth: number;
    lineagePath: LineageNode[];
}

// ============================================================================
// Core Algorithm Functions
// ============================================================================

/**
 * Build a complete lineage graph from project artifacts and transforms
 */
export function buildLineageGraph(
    artifacts: ElectricArtifact[],
    transforms: ElectricTransform[],
    humanTransforms: ElectricHumanTransform[],
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[]
): LineageGraph {
    // Internal phase types for multi-pass algorithm
    type PhaseOneArtifactNode = Omit<LineageNodeArtifact, 'sourceTransform'> & {
        sourceTransformId: string | "none";
    };

    type PhaseOneTransformNode = Omit<LineageNodeTransform, 'sourceArtifacts'> & {
        sourceArtifactIds: string[];
    };

    type PhaseOneNode = PhaseOneArtifactNode | PhaseOneTransformNode;

    const phaseOneNodes = new Map<string, PhaseOneNode>();
    const edges = new Map<string, string[]>();
    const paths = new Map<string, LineageNode[]>();
    const rootNodes = new Set<string>();

    // Step 1: Initialize all artifacts as nodes and determine root nodes
    const allArtifactIds = new Set(artifacts.map(a => a.id));
    const artifactsWithIncomingTransforms = new Set<string>();

    // Find all artifacts that have incoming transforms
    for (const output of transformOutputs) {
        if (allArtifactIds.has(output.artifact_id)) {
            artifactsWithIncomingTransforms.add(output.artifact_id);
        }
    }

    // Initialize artifact nodes with sourceTransformId (Phase 1)
    for (const artifact of artifacts) {
        const isRoot = !artifactsWithIncomingTransforms.has(artifact.id);
        if (isRoot) {
            rootNodes.add(artifact.id);
        }

        // Find the source transform for this artifact
        const sourceTransformId = transformOutputs.find(output =>
            output.artifact_id === artifact.id
        )?.transform_id || "none";

        phaseOneNodes.set(artifact.id, {
            type: 'artifact',
            artifactId: artifact.id,
            depth: 0,
            isLeaf: true, // Will be updated if we find outgoing transforms
            artifactType: artifact.type,
            path: undefined,
            sourceTransformId
        } as PhaseOneArtifactNode);
    }

    // Step 2: Process all transforms in dependency order (Phase 1)
    // We need to process transforms in topological order to ensure depths are calculated correctly
    const processedTransforms = new Set<string>();
    const pendingTransforms = [...transforms];

    while (pendingTransforms.length > 0) {
        const initialLength = pendingTransforms.length;

        for (let i = pendingTransforms.length - 1; i >= 0; i--) {
            const transform = pendingTransforms[i];
            const transformId = transform.id;

            // Check if all input artifacts for this transform have been processed
            const inputs = transformInputs.filter(ti => ti.transform_id === transformId);
            const canProcess = inputs.every(input => {
                const inputNode = phaseOneNodes.get(input.artifact_id);
                // Can process if the input node exists and either:
                // 1. It's a root node (no incoming transforms), or
                // 2. All transforms that produce this input have been processed
                return inputNode && (
                    rootNodes.has(input.artifact_id) ||
                    !hasUnprocessedIncomingTransforms(input.artifact_id, transformInputs, transformOutputs, processedTransforms)
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
            console.warn('Warning: Could not process all transforms due to cycles or missing dependencies:',
                pendingTransforms.map(t => t.id));
            break;
        }
    }

    // Step 3: Convert Phase 1 nodes to final nodes by resolving references (Phase 2)
    const nodes = new Map<string, LineageNode>();

    for (const [nodeId, phaseOneNode] of phaseOneNodes) {
        if (phaseOneNode.type === 'artifact') {
            const artifactNode = phaseOneNode as PhaseOneArtifactNode;

            // Resolve sourceTransform reference
            const sourceTransform = artifactNode.sourceTransformId === "none"
                ? "none"
                : phaseOneNodes.get(artifactNode.sourceTransformId) as PhaseOneTransformNode | undefined;

            if (artifactNode.sourceTransformId !== "none" && !sourceTransform) {
                console.warn(`Warning: Could not resolve sourceTransform ${artifactNode.sourceTransformId} for artifact ${nodeId}`);
            }

            // Type cast to final artifact node
            const finalArtifactNode: LineageNodeArtifact = {
                type: 'artifact' as const,
                artifactId: artifactNode.artifactId,
                artifactType: artifactNode.artifactType,
                path: artifactNode.path,
                depth: artifactNode.depth,
                isLeaf: artifactNode.isLeaf,
                sourceTransform: (sourceTransform && sourceTransform !== "none") ? {
                    type: 'transform' as const,
                    transformId: sourceTransform.transformId,
                    transformType: sourceTransform.transformType,
                    path: sourceTransform.path,
                    depth: sourceTransform.depth,
                    isLeaf: sourceTransform.isLeaf,
                    sourceArtifacts: [] // Will be populated in transform processing
                } as LineageNodeTransform : "none"
            };

            nodes.set(nodeId, finalArtifactNode);
        } else {
            const transformNode = phaseOneNode as PhaseOneTransformNode;

            // Resolve sourceArtifacts references
            const sourceArtifacts: LineageNodeArtifact[] = [];
            for (const artifactId of transformNode.sourceArtifactIds) {
                const artifactNode = nodes.get(artifactId) as LineageNodeArtifact | undefined;
                if (artifactNode && artifactNode.type === 'artifact') {
                    sourceArtifacts.push(artifactNode);
                } else {
                    console.warn(`Warning: Could not resolve sourceArtifact ${artifactId} for transform ${nodeId}`);
                }
            }

            // Type cast to final transform node
            const finalTransformNode: LineageNodeTransform = {
                type: 'transform' as const,
                transformId: transformNode.transformId,
                transformType: transformNode.transformType,
                path: transformNode.path,
                depth: transformNode.depth,
                isLeaf: transformNode.isLeaf,
                sourceArtifacts
            };

            nodes.set(nodeId, finalTransformNode);
        }
    }

    // Step 4: Update paths to use final nodes
    const finalPaths = new Map<string, LineageNode[]>();
    for (const [pathKey, phaseOnePath] of paths) {
        const finalPath: LineageNode[] = [];
        for (const phaseOneNode of phaseOnePath) {
            const finalNode = nodes.get(phaseOneNode.type === 'artifact' ? phaseOneNode.artifactId : phaseOneNode.transformId);
            if (finalNode) {
                finalPath.push(finalNode);
            }
        }
        finalPaths.set(pathKey, finalPath);
    }

    return {
        nodes,
        edges,
        paths: finalPaths,
        rootNodes
    };
}

// Helper function to check if an artifact has unprocessed incoming transforms
function hasUnprocessedIncomingTransforms(
    artifactId: string,
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[],
    processedTransforms: Set<string>
): boolean {
    // Find all transforms that produce this artifact
    const producingTransforms = transformOutputs
        .filter(output => output.artifact_id === artifactId)
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

    // Collect source artifact IDs for this transform
    const sourceArtifactIds = inputs.map(input => input.artifact_id);

    // Create transform node (Phase 1)
    phaseOneNodes.set(transformId, {
        type: 'transform',
        transformId: transformId,
        transformType: 'human',
        depth: 0, // Will be calculated based on sources
        isLeaf: false,
        path: humanTransform.derivation_path,
        sourceArtifactIds
    });

    for (const input of inputs) {
        for (const output of outputs) {
            const sourceId = input.artifact_id;
            const targetId = output.artifact_id;
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
            }
        }
    }

    // Update transform node depth based on max input depth
    const transformNode = phaseOneNodes.get(transformId);
    if (transformNode) {
        const maxInputDepth = inputs.reduce((max, input) => {
            const inputNode = phaseOneNodes.get(input.artifact_id);
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

    // Collect source artifact IDs for this transform
    const sourceArtifactIds = inputs.map(input => input.artifact_id);

    // Create transform node (Phase 1)
    phaseOneNodes.set(transformId, {
        type: 'transform',
        transformId: transformId,
        transformType: 'llm',
        depth: 0, // Will be calculated based on sources
        isLeaf: false,
        path: transformPath,
        sourceArtifactIds
    });

    for (const input of inputs) {
        for (const output of outputs) {
            const sourceId = input.artifact_id;
            const targetId = output.artifact_id;

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

                    // Also create a path key for the target artifact to maintain lineage
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
            const inputNode = phaseOneNodes.get(input.artifact_id);
            return Math.max(max, inputNode?.depth ?? 0);
        }, 0);
        transformNode.depth = maxInputDepth + 1;
    }
}

/**
 * Find the latest (most recent) artifact in a lineage chain
 */
export function findLatestArtifact(
    sourceArtifactId: string,
    path: string | undefined,
    graph: LineageGraph
): LineageResolutionResult {
    const sourceNode = graph.nodes.get(sourceArtifactId);
    if (!sourceNode) {
        return {
            artifactId: null,
            depth: 0,
            lineagePath: []
        };
    }

    // If no path specified, traverse the entire lineage from this artifact
    if (!path) {
        return traverseToLeaf(sourceArtifactId, graph);
    }

    // Path-based resolution: look for specific path lineages
    const pathKey = `${sourceArtifactId}:${path}`;
    const pathLineage = graph.paths.get(pathKey);

    if (pathLineage && pathLineage.length > 0) {
        // Find the deepest node in this path
        const deepestNode = pathLineage.reduce((deepest, current) =>
            current.depth > deepest.depth ? current : deepest
        );

        if (deepestNode.type !== "artifact") {
            throw new Error("Deepest node is not an artifact");
        }

        // Continue traversing from the deepest node to find the actual leaf
        const finalResult = traverseToLeaf(deepestNode.artifactId, graph);

        // Build complete lineage path without duplicates
        const completePath = [sourceNode];

        // Add path lineage nodes (excluding the deepest node to avoid duplication)
        for (const node of pathLineage) {
            if (node.type !== "artifact") {
                throw new Error("Node is not an artifact");
            }
            if (node.artifactId !== deepestNode.artifactId) {
                completePath.push(node);
            }
        }

        // Add final result lineage (this includes the deepest node)
        completePath.push(...finalResult.lineagePath);

        return {
            artifactId: finalResult.artifactId,
            path: path,
            depth: finalResult.depth,
            lineagePath: completePath
        };
    }

    // No path-specific lineage found, return original artifact with path
    return {
        artifactId: sourceArtifactId,
        path: path,
        depth: 0,
        lineagePath: [sourceNode]
    };
}

/**
 * Traverse from an artifact to its deepest leaf node
 */
function traverseToLeaf(
    artifactId: string,
    graph: LineageGraph,
    visited: Set<string> = new Set()
): LineageResolutionResult {
    // Prevent infinite loops
    if (visited.has(artifactId)) {
        return {
            artifactId: null,
            depth: 0,
            lineagePath: []
        };
    }
    visited.add(artifactId);

    const node = graph.nodes.get(artifactId);
    if (!node) {
        return {
            artifactId: null,
            depth: 0,
            lineagePath: []
        };
    }

    // If this is a leaf node, return it
    if (node.isLeaf) {
        return {
            artifactId: artifactId,
            depth: node.depth,
            lineagePath: [node]
        };
    }

    // Find all children and traverse to the deepest one
    const children = graph.edges.get(artifactId) || [];
    let deepestResult: LineageResolutionResult = {
        artifactId: artifactId,
        depth: node.depth,
        lineagePath: [node]
    };

    for (const childId of children) {
        const childResult = traverseToLeaf(childId, graph, new Set(visited));
        if (childResult.depth > deepestResult.depth) {
            deepestResult = {
                artifactId: childResult.artifactId,
                depth: childResult.depth,
                lineagePath: [node, ...childResult.lineagePath]
            };
        }
    }

    return deepestResult;
}

/**
 * Get the complete lineage path from a source artifact
 */
export function getLineagePath(
    artifactId: string,
    graph: LineageGraph
): LineageNode[] {
    const result = traverseToLeaf(artifactId, graph);
    return result.lineagePath;
}

/**
 * Validate the integrity of a lineage graph
 */
export function validateLineageIntegrity(graph: LineageGraph): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for orphaned nodes
    for (const [artifactId, node] of graph.nodes) {
        if (!graph.rootNodes.has(artifactId) && !hasIncomingEdges(artifactId, graph)) {
            warnings.push(`Artifact ${artifactId} appears to be orphaned`);
        }
    }

    // Check for circular references
    for (const rootId of graph.rootNodes) {
        if (hasCircularReference(rootId, graph)) {
            errors.push(`Circular reference detected starting from ${rootId}`);
        }
    }

    // Check for missing artifacts referenced in edges
    for (const [sourceId, targets] of graph.edges) {
        if (!graph.nodes.has(sourceId)) {
            errors.push(`Source artifact ${sourceId} referenced in edges but not in nodes`);
        }
        for (const targetId of targets) {
            if (!graph.nodes.has(targetId)) {
                errors.push(`Target artifact ${targetId} referenced in edges but not in nodes`);
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
 * Check if an artifact has incoming edges (transforms that produce it)
 */
function hasIncomingEdges(artifactId: string, graph: LineageGraph): boolean {
    for (const targets of graph.edges.values()) {
        if (targets.includes(artifactId)) {
            return true;
        }
    }
    return false;
}

/**
 * Check for circular references starting from a given artifact
 */
function hasCircularReference(
    artifactId: string,
    graph: LineageGraph,
    visited: Set<string> = new Set()
): boolean {
    if (visited.has(artifactId)) {
        return true;
    }

    visited.add(artifactId);
    const children = graph.edges.get(artifactId) || [];

    for (const childId of children) {
        if (hasCircularReference(childId, graph, new Set(visited))) {
            return true;
        }
    }

    return false;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Find all leaf nodes of a specific artifact type
 */
export function findLeafNodesByType(
    graph: LineageGraph,
    artifacts: ElectricArtifact[],
    artifactType: string
): ElectricArtifact[] {
    const leafArtifacts: ElectricArtifact[] = [];
    const artifactMap = new Map(artifacts.map(a => [a.id, a]));

    // Find all leaf nodes in the graph
    for (const [artifactId, node] of graph.nodes) {
        if (node.isLeaf) {
            const artifact = artifactMap.get(artifactId);
            if (artifact && artifact.type === artifactType) {
                leafArtifacts.push(artifact);
            }
        }
    }

    return leafArtifacts;
}

/**
 * Find all leaf brainstorm idea artifacts from the lineage graph
 */
export function findLatestBrainstormIdeas(
    graph: LineageGraph,
    artifacts: ElectricArtifact[]
): ElectricArtifact[] {
    return findLeafNodesByType(graph, artifacts, 'brainstorm_idea');
}

/**
 * Find all leaf brainstorm idea artifacts with lineage information
 */
export function findLatestBrainstormIdeasWithLineage(
    graph: LineageGraph,
    artifacts: import('../types').ElectricArtifact[]
): import('../types').ElectricArtifactWithLineage[] {
    const latestBrainstormIdeas = findLeafNodesByType(graph, artifacts, 'brainstorm_idea');
    return addLineageToArtifacts(latestBrainstormIdeas, graph);
}


/**
 * Get a human-readable description of a lineage chain
 */
export function describeLineage(lineagePath: LineageNode[]): string {
    if (lineagePath.length === 0) {
        return 'No lineage';
    }

    if (lineagePath.length === 1) {
        return 'Original';
    }

    const descriptions: string[] = ['Original'];

    for (let i = 1; i < lineagePath.length; i++) {
        const node = lineagePath[i];
        if (node.type !== "transform") {
            throw new Error("Node is not a transform");
        }
        if (node.transformType === 'human') {
            descriptions.push('User edited');
        } else if (node.transformType === 'llm') {
            descriptions.push('AI enhanced');
        } else {
            descriptions.push('Modified');
        }
    }

    return descriptions.join(' → ');
}

/**
 * Add lineage information to artifacts based on the lineage graph
 */
export function addLineageToArtifacts(
    artifacts: import('../types').ElectricArtifact[],
    graph: LineageGraph
): import('../types').ElectricArtifactWithLineage[] {
    return artifacts.map(artifact => {
        const node = graph.nodes.get(artifact.id);

        if (!node || node.type !== 'artifact') {
            return {
                ...artifact,
                sourceTransform: 'none',
                isEditable: false
            };
        }

        const sourceTransform = node.sourceTransform;

        if (sourceTransform === 'none') {
            return {
                ...artifact,
                sourceTransform: 'none',
                isEditable: false
            };
        }

        return {
            ...artifact,
            sourceTransform: {
                id: sourceTransform.transformId,
                type: sourceTransform.transformType,
                transformType: sourceTransform.transformType
            },
            isEditable: sourceTransform.transformType === 'human'
        };
    });
} 