/**
 * Core Lineage Resolution Algorithm
 * 
 * This module provides pure functions for resolving complex artifact lineages
 * in the script-writer application. It handles chains like:
 * 
 * brainstorm_collection[0] → human_transform → user_input → llm_transform → brainstorm_idea
 */

import type {
    ElectricArtifact,
    ElectricTransform,
    ElectricHumanTransform,
    ElectricTransformInput,
    ElectricTransformOutput
} from '../types';

// ============================================================================
// Data Structures
// ============================================================================

export type LineageNodeBase = {
    path?: string;
    depth: number;
    isLeaf: boolean;
    type: 'artifact' | 'transform';
    createdAt: string; // NEW: Add timestamp for chronological narrative
}

export type LineageNodeArtifact = LineageNodeBase & {
    type: 'artifact';
    artifactId: string;
    artifactType: string;
    sourceTransform: LineageNodeTransform | "none";
    schemaType: string; // NEW: Add schema type for better narrative description
    originType: 'ai_generated' | 'user_input'; // NEW: Add origin type for narrative
    artifact: ElectricArtifact; // NEW: Include the actual artifact object
}

export type LineageNodeTransform = LineageNodeBase & {
    type: 'transform';
    transformId: string;
    transformType: 'human' | 'llm';
    sourceArtifacts: LineageNodeArtifact[];
    transform: ElectricTransform; // NEW: Include the actual transform object
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
    createdAt?: string; // NEW: Add timestamp for chronological narrative
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
            sourceTransformId,
            createdAt: artifact.created_at,
            schemaType: artifact.schema_type,
            originType: artifact.origin_type,
            artifact: artifact
        } as PhaseOneArtifactNode);
    }

    // Step 1.5: Handle JSONPath-aware transform inputs
    for (const input of transformInputs) {
        const artifactPath = (input as any).artifact_path || '$'; // NEW: Get artifact_path field

        if (artifactPath !== '$') {
            // Create path-specific lineage tracking for any sub-artifact operations
            const pathKey = `${input.artifact_id}:${artifactPath}`;
            if (!paths.has(pathKey)) {
                paths.set(pathKey, []);
            }
        }
        // If artifactPath === '$', it's operating on the whole artifact (existing behavior)
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

    // First pass: Create all nodes with basic info
    for (const [nodeId, phaseOneNode] of phaseOneNodes) {
        if (phaseOneNode.type === 'artifact') {
            const artifactNode = phaseOneNode as PhaseOneArtifactNode;

            // Create artifact node (sourceTransform will be populated in second pass)
            const finalArtifactNode: LineageNodeArtifact = {
                type: 'artifact' as const,
                artifactId: artifactNode.artifactId,
                artifactType: artifactNode.artifactType,
                path: artifactNode.path,
                depth: artifactNode.depth,
                isLeaf: artifactNode.isLeaf,
                sourceTransform: "none", // Will be populated in second pass
                schemaType: artifactNode.schemaType,
                originType: artifactNode.originType,
                artifact: artifactNode.artifact,
                createdAt: artifactNode.createdAt
            };

            nodes.set(nodeId, finalArtifactNode);
        } else {
            const transformNode = phaseOneNode as PhaseOneTransformNode;

            // Create transform node (sourceArtifacts will be populated in second pass)
            const finalTransformNode: LineageNodeTransform = {
                type: 'transform' as const,
                transformId: transformNode.transformId,
                transformType: transformNode.transformType,
                path: transformNode.path,
                depth: transformNode.depth,
                isLeaf: transformNode.isLeaf,
                sourceArtifacts: [], // Will be populated in second pass
                transform: transformNode.transform,
                createdAt: transformNode.createdAt
            };

            nodes.set(nodeId, finalTransformNode);
        }
    }

    // Second pass: Populate references now that all nodes exist
    for (const [nodeId, phaseOneNode] of phaseOneNodes) {
        if (phaseOneNode.type === 'artifact') {
            const artifactNode = phaseOneNode as PhaseOneArtifactNode;
            const finalArtifactNode = nodes.get(nodeId) as LineageNodeArtifact;

            // Resolve sourceTransform reference
            if (artifactNode.sourceTransformId !== "none") {
                const sourceTransformNode = nodes.get(artifactNode.sourceTransformId) as LineageNodeTransform | undefined;
                if (sourceTransformNode && sourceTransformNode.type === 'transform') {
                    finalArtifactNode.sourceTransform = sourceTransformNode;
                } else {
                    console.warn(`Warning: Could not resolve sourceTransform ${artifactNode.sourceTransformId} for artifact ${nodeId}`);
                    finalArtifactNode.sourceTransform = "none";
                }
            }
        } else {
            const transformNode = phaseOneNode as PhaseOneTransformNode;
            const finalTransformNode = nodes.get(nodeId) as LineageNodeTransform;

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
            finalTransformNode.sourceArtifacts = sourceArtifacts;
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
        sourceArtifactIds,
        createdAt: transform.created_at,
        transform: transform
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

                // Also add the output artifact to the path lineage
                // This ensures that findLatestArtifact can find the edited artifact
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
        sourceArtifactIds,
        createdAt: transform.created_at,
        transform: transform
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
    graph: LineageGraph,
    artifacts?: ElectricArtifact[]
): LineageResolutionResult {
    const sourceNode = graph.nodes.get(sourceArtifactId);
    if (!sourceNode) {
        return {
            artifactId: null,
            path: path,
            depth: 0,
            lineagePath: []
        };
    }

    // If we have a specific path, look for path-specific lineage
    if (path && path !== '$') {
        const pathKey = `${sourceArtifactId}:${path}`;
        const pathLineage = graph.paths.get(pathKey);

        if (pathLineage && pathLineage.length > 0) {
            // Find the deepest artifact node in the path lineage
            const artifactNodes = pathLineage.filter(node => node.type === 'artifact');

            if (artifactNodes.length > 0) {
                const deepestArtifact = artifactNodes.reduce((deepest, current) =>
                    current.depth > deepest.depth ? current : deepest
                );
                return {
                    artifactId: deepestArtifact.artifactId,
                    path: path,
                    depth: deepestArtifact.depth,
                    lineagePath: pathLineage
                };
            } else {
                return {
                    artifactId: sourceArtifactId,
                    path: path,
                    depth: 0,
                    lineagePath: pathLineage
                };
            }
        } else {
            // No path-specific lineage found - return original artifact for this path
            // This is the key fix: don't traverse to deepest leaf, just return the original
            return {
                artifactId: sourceArtifactId,
                path: path,
                depth: sourceNode.depth,
                lineagePath: [sourceNode]
            };
        }
    } else {
        // No path specified, traverse from root to find deepest leaf
        return traverseToLeaf(sourceArtifactId, graph, new Set(), artifacts);
    }
}

/**
 * Traverse from an artifact to its deepest leaf node
 */
function traverseToLeaf(
    artifactId: string,
    graph: LineageGraph,
    visited: Set<string> = new Set(),
    artifacts?: ElectricArtifact[]
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
        const artifact = artifacts?.find(a => a.id === artifactId);
        return {
            artifactId: artifactId,
            depth: node.depth,
            lineagePath: [node],
            createdAt: node.createdAt
        };
    }

    // Find all children and traverse to the deepest one
    const children = graph.edges.get(artifactId) || [];

    let deepestResult: LineageResolutionResult = {
        artifactId: artifactId,
        depth: node.depth,
        lineagePath: [node],
        createdAt: node.createdAt
    };

    for (const childId of children) {
        const childResult = traverseToLeaf(childId, graph, new Set(visited), artifacts);

        // Use tie-breaking logic when depths are equal
        if (childResult.depth > deepestResult.depth) {
            deepestResult = {
                artifactId: childResult.artifactId,
                depth: childResult.depth,
                lineagePath: [node, ...childResult.lineagePath],
                createdAt: childResult.createdAt
            };
        } else if (childResult.depth === deepestResult.depth && childResult.artifactId && deepestResult.artifactId) {
            // Tie-breaking: prioritize user_input artifacts over ai_generated ones
            const childArtifact = artifacts?.find(a => a.id === childResult.artifactId);
            const currentArtifact = artifacts?.find(a => a.id === deepestResult.artifactId);

            if (childArtifact && currentArtifact) {
                const childIsUserInput = childArtifact.origin_type === 'user_input';
                const currentIsUserInput = currentArtifact.origin_type === 'user_input';

                // Prefer user_input over ai_generated
                if (childIsUserInput && !currentIsUserInput) {
                    deepestResult = {
                        artifactId: childResult.artifactId,
                        depth: childResult.depth,
                        lineagePath: [node, ...childResult.lineagePath],
                        createdAt: childResult.createdAt
                    };
                }
                // If both are user_input or both are ai_generated, keep the current one (first-wins)
            }
        }
    }

    const finalArtifact = artifacts?.find(a => a.id === deepestResult.artifactId);
    return {
        ...deepestResult,
        createdAt: finalArtifact?.created_at || ''
    };
}

/**
 * Get the complete lineage path from a source artifact
 */
export function getLineagePath(
    artifactId: string,
    graph: LineageGraph,
    artifacts?: ElectricArtifact[]
): LineageNode[] {
    const result = traverseToLeaf(artifactId, graph, new Set(), artifacts);
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

// ============================================================================
// NEW: JSONPath-Based Artifact Resolution
// ============================================================================

/**
 * Find the latest artifact for a specific JSONPath within a source artifact
 */
export function findLatestArtifactForPath(
    sourceArtifactId: string,
    artifactPath: string,
    graph: LineageGraph
): LineageResolutionResult {
    // 1. Find all transforms that used this artifact + path as input
    const pathKey = `${sourceArtifactId}:${artifactPath}`;
    const pathLineage = graph.paths.get(pathKey);

    if (pathLineage && pathLineage.length > 0) {
        // 2. Follow lineage to find latest derived artifact
        const latestTransform = pathLineage[pathLineage.length - 1];
        if (latestTransform.type === 'transform') {
            // Find the output artifact of this transform
            const transformNode = latestTransform as LineageNodeTransform;
            // For now, assume single output - could be enhanced for multiple outputs
            const outputArtifactId = graph.edges.get(transformNode.transformId)?.[0];
            if (outputArtifactId) {
                return {
                    artifactId: outputArtifactId,
                    path: '$', // Output is typically a complete artifact
                    depth: latestTransform.depth + 1,
                    lineagePath: pathLineage
                };
            }
        }
    }

    // 3. If no edits found, return original artifact + path
    return {
        artifactId: sourceArtifactId,
        path: artifactPath,
        depth: 0,
        lineagePath: []
    };
}

/**
 * Generic function to get artifact data at a specific JSONPath
 */
export function getArtifactAtPath(
    artifact: ElectricArtifact,
    artifactPath: string
): any | null {
    if (artifactPath === '$') {
        return JSON.parse(artifact.data);
    }

    try {
        const data = JSON.parse(artifact.data);

        // Handle $.ideas[n] pattern for brainstorm collections
        const ideaMatch = artifactPath.match(/^\$\.ideas\[(\d+)\]$/);
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
        const nestedFieldMatch = artifactPath.match(/^\$\.ideas\[(\d+)\]\.([a-zA-Z_][a-zA-Z0-9_]*)$/);
        if (nestedFieldMatch) {
            const index = parseInt(nestedFieldMatch[1]);
            const field = nestedFieldMatch[2];
            if (data.ideas && Array.isArray(data.ideas) && data.ideas[index]) {
                return data.ideas[index][field] || null;
            }
            return null;
        }

        // Handle simple field paths like $.title, $.body
        const fieldMatch = artifactPath.match(/^\$\.([a-zA-Z_][a-zA-Z0-9_]*)$/);
        if (fieldMatch) {
            const field = fieldMatch[1];
            return data[field] || null;
        }

        return null;
    } catch (error) {
        console.error('Error parsing artifact data:', error);
        return null;
    }
}

/**
 * Get the latest version for a specific path within an artifact
 */
export function getLatestVersionForPath(
    artifactId: string,
    artifactPath: string,
    graph: LineageGraph
): string | null {
    const result = findLatestArtifactForPath(artifactId, artifactPath, graph);
    return result.artifactId === artifactId ? null : result.artifactId;
}

// ============================================================================
// NEW: Principled Brainstorm Idea Resolution
// ============================================================================

export interface EffectiveBrainstormIdea {
    artifactId: string;
    artifactPath: string; // Path within the artifact ($ for standalone, $.ideas[n] for collection items)
    originalArtifactId: string; // The root collection or standalone idea this derives from
    index: number; // Index within the original collection (or 0 for standalone)
    isFromCollection: boolean;
}

/**
 * Find all effective brainstorm ideas using principled lineage graph traversal
 * This replaces the patchy table lookup approach with a proper graph-based solution
 */
export function findEffectiveBrainstormIdeas(
    graph: LineageGraph,
    artifacts: ElectricArtifact[]
): EffectiveBrainstormIdea[] {
    const results: EffectiveBrainstormIdea[] = [];
    const artifactMap = new Map(artifacts.map(a => [a.id, a]));





    // Step 1: Find all relevant brainstorm nodes (both leaf and non-leaf)
    // Collections can be non-leaf but still need processing for unconsumed ideas
    const relevantNodes = Array.from(graph.nodes.entries())
        .filter(([_, node]) => {
            if (node.type !== 'artifact') return false;

            const artifact = artifactMap.get((node as LineageNodeArtifact).artifactId);
            const isBrainstormType = artifact && (
                artifact.schema_type === 'brainstorm_idea_schema' || artifact.schema_type === 'brainstorm_collection_schema' ||
                artifact.type === 'brainstorm_idea' || artifact.type === 'brainstorm_idea_collection'
            );

            // Include all brainstorm types regardless of leaf status
            // - brainstorm_idea: only if leaf (final versions)
            // - brainstorm_idea_collection: always (may have unconsumed ideas)
            const shouldInclude = isBrainstormType && (
                ((artifact.schema_type === 'brainstorm_idea_schema' || artifact.type === 'brainstorm_idea') && node.isLeaf) ||
                (artifact.schema_type === 'brainstorm_collection_schema' || artifact.type === 'brainstorm_idea_collection')
            );


            return shouldInclude;
        })
        .map(([artifactId, node]) => ({ artifactId, node: node as LineageNodeArtifact }));



    for (const { artifactId, node } of relevantNodes) {
        const artifact = artifactMap.get(artifactId);
        if (!artifact) continue;

        if (artifact.schema_type === 'brainstorm_collection_schema' || artifact.type === 'brainstorm_idea_collection') {
            // Step 2a: Collection leaf - check which ideas are still "available"
            const consumedPaths = findConsumedCollectionPaths(artifactId, graph);
            const collectionIdeas = extractCollectionIdeas(artifact, consumedPaths);
            results.push(...collectionIdeas);

        } else if (artifact.schema_type === 'brainstorm_idea_schema' || artifact.type === 'brainstorm_idea') {
            // Step 2b: Standalone idea leaf - check if it originated from a collection
            const originInfo = traceToCollectionOrigin(artifactId, graph, artifactMap);

            if (originInfo.isFromCollection) {
                results.push({
                    artifactId,
                    artifactPath: '$', // Standalone artifact uses whole artifact
                    originalArtifactId: originInfo.originalCollectionId!,
                    index: originInfo.collectionIndex!,
                    isFromCollection: true
                });
            } else {
                results.push({
                    artifactId,
                    artifactPath: '$',
                    originalArtifactId: artifactId,
                    index: 0,
                    isFromCollection: false
                });
            }
        }
    }

    // CRITICAL: Sort results to preserve original collection ordering
    // This ensures that derived artifacts (human edits) appear in the same position
    // as their original collection items, maintaining consistent UI ordering
    results.sort((a, b) => {
        // First sort by original collection ID (to group ideas from same collection)
        if (a.originalArtifactId !== b.originalArtifactId) {
            return a.originalArtifactId.localeCompare(b.originalArtifactId);
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
    collectionArtifact: ElectricArtifact,
    consumedPaths: Set<string>
): EffectiveBrainstormIdea[] {
    const results: EffectiveBrainstormIdea[] = [];

    try {
        const collectionData = JSON.parse(collectionArtifact.data);
        if (!collectionData.ideas || !Array.isArray(collectionData.ideas)) {
            return results;
        }

        for (let i = 0; i < collectionData.ideas.length; i++) {
            const ideaPath = `$.ideas[${i}]`;

            if (!consumedPaths.has(ideaPath)) {
                // This idea hasn't been consumed, so it's still "available"
                results.push({
                    artifactId: collectionArtifact.id,
                    artifactPath: ideaPath,
                    originalArtifactId: collectionArtifact.id,
                    index: i,
                    isFromCollection: true
                });
            }
        }
    } catch (error) {
        console.error(`Error parsing collection data for ${collectionArtifact.id}:`, error);
    }

    return results;
}

/**
 * Trace a standalone idea back to see if it originated from a collection
 */
function traceToCollectionOrigin(
    ideaId: string,
    graph: LineageGraph,
    artifactMap: Map<string, ElectricArtifact>
): {
    isFromCollection: boolean;
    originalCollectionId?: string;
    originalPath?: string;
    collectionIndex?: number;
} {
    const node = graph.nodes.get(ideaId);
    if (!node || node.type !== 'artifact') {
        return { isFromCollection: false };
    }

    // Trace back through the lineage
    let currentNode: LineageNodeArtifact = node;
    let traceDepth = 0;

    while (currentNode.sourceTransform !== 'none' && traceDepth < 10) { // Prevent infinite loops
        traceDepth++;
        const sourceTransform = currentNode.sourceTransform;



        // Check all source artifacts of this transform
        for (const sourceArtifact of sourceTransform.sourceArtifacts) {
            const sourceArtifactData = artifactMap.get(sourceArtifact.artifactId);

            if (sourceArtifactData?.schema_type === 'brainstorm_collection_schema' || sourceArtifactData?.type === 'brainstorm_idea_collection') {
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
                    originalCollectionId: sourceArtifact.artifactId,
                    originalPath: sourceTransform.path,
                    collectionIndex
                };
            }

            // Continue tracing if this source artifact also has a source transform
            if (sourceArtifact.sourceTransform !== 'none') {
                currentNode = sourceArtifact;
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
    artifactId?: string;
    originalArtifactId?: string;
    artifactPath: string;
    index?: number;
    debugInfo?: string;
}

// ============================================================================
// NEW: Workflow Map/ToC Data Structures
// ============================================================================

export interface WorkflowNode {
    id: string;
    type: 'brainstorm_collection' | 'brainstorm_idea' | 'outline' | 'episode' | 'script';
    title: string;
    artifactId: string;
    position: { x: number; y: number };
    isMain: boolean;
    isActive: boolean;
    navigationTarget: string; // anchor or route
    createdAt: string;
    status?: 'completed' | 'processing' | 'failed';
    schemaType?: string; // NEW: Include artifact schema_type for display
}

/**
 * Convert effective brainstorm ideas to IdeaWithTitle format
 * This is a pure function that handles the data conversion logic
 */
export function convertEffectiveIdeasToIdeaWithTitle(
    effectiveIdeas: EffectiveBrainstormIdea[],
    artifacts: ElectricArtifact[]
): IdeaWithTitle[] {
    const artifactMap = new Map(artifacts.map(a => [a.id, a]));

    return effectiveIdeas.map((effectiveIdea): IdeaWithTitle => {
        // Get the actual data for this idea
        let title = '';
        let body = '';

        const artifact = artifactMap.get(effectiveIdea.artifactId);
        if (artifact) {
            try {
                if (effectiveIdea.artifactPath === '$') {
                    // Standalone artifact - use full data
                    const data = JSON.parse(artifact.data);
                    title = data.title || '';
                    body = data.body || '';
                } else {
                    // Collection artifact - extract specific idea
                    const data = JSON.parse(artifact.data);
                    if (data.ideas && Array.isArray(data.ideas) && data.ideas[effectiveIdea.index]) {
                        title = data.ideas[effectiveIdea.index].title || '';
                        body = data.ideas[effectiveIdea.index].body || '';
                    }
                }
            } catch (parseError) {
                console.error(`Error parsing artifact data for ${effectiveIdea.artifactId}:`, parseError);
            }
        }

        return {
            title,
            body,
            artifactId: effectiveIdea.artifactId,
            originalArtifactId: effectiveIdea.originalArtifactId,
            artifactPath: effectiveIdea.artifactPath,
            index: effectiveIdea.index
        };
    });
}

/**
 * Extract effective brainstorm ideas from raw project data
 * This is a pure function that handles the core lineage resolution logic
 */
export function extractEffectiveBrainstormIdeas(
    artifacts: ElectricArtifact[],
    transforms: ElectricTransform[],
    humanTransforms: ElectricHumanTransform[],
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[]
): EffectiveBrainstormIdea[] {
    try {
        // Build the lineage graph
        const graph = buildLineageGraph(
            artifacts,
            transforms,
            humanTransforms,
            transformInputs,
            transformOutputs
        );

        // Use principled resolution to find all effective brainstorm ideas
        return findEffectiveBrainstormIdeas(graph, artifacts);

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
    artifacts: ElectricArtifact[],
    graph: LineageGraph
): WorkflowNode[] {
    const workflowNodes: WorkflowNode[] = [];

    try {
        // Step 1: Find the main outline (only one allowed per project)
        const outlineArtifacts = artifacts.filter(a =>
            a.schema_type === 'outline_schema' ||
            a.type === 'outline_response' ||
            a.type === 'outline'
        );

        // Sort by creation date to get the latest/main outline
        const mainOutline = outlineArtifacts
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        if (!mainOutline) {
            // No outline yet - show brainstorm collection(s) only
            return createBrainstormOnlyWorkflow(artifacts);
        }

        // Step 2: Trace back from outline to find the main path
        const mainPath = traceMainPathFromOutline(mainOutline, graph, artifacts);

        // Step 3: Convert artifacts to workflow nodes
        return createWorkflowNodes(mainPath);

    } catch (error) {
        console.error('[findMainWorkflowPath] Error:', error);
        // Fallback: show brainstorm collections only
        return createBrainstormOnlyWorkflow(artifacts);
    }
}

/**
 * Create workflow when only brainstorm data exists (no outline yet)
 */
function createBrainstormOnlyWorkflow(artifacts: ElectricArtifact[]): WorkflowNode[] {
    const brainstormCollections = artifacts.filter(a =>
        a.schema_type === 'brainstorm_collection_schema' ||
        a.type === 'brainstorm_idea_collection'
    );

    if (brainstormCollections.length === 0) {
        return [];
    }

    // Get the latest collection
    const latestCollection = brainstormCollections
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    return [{
        id: `workflow-node-${latestCollection.id}`,
        type: 'brainstorm_collection',
        title: '创意构思',
        artifactId: latestCollection.id,
        position: { x: 90, y: 50 },
        isMain: true,
        isActive: true,
        navigationTarget: '#brainstorm-ideas',
        createdAt: latestCollection.created_at,
        status: latestCollection.streaming_status === 'streaming' ? 'processing' : 'completed',
        schemaType: latestCollection.schema_type // NEW: Include schema_type for display
    }];
}

/**
 * Trace back from outline to find the main artifact path
 */
function traceMainPathFromOutline(
    outlineArtifact: ElectricArtifact,
    graph: LineageGraph,
    artifacts: ElectricArtifact[]
): ElectricArtifact[] {
    const path: ElectricArtifact[] = [outlineArtifact];

    // Get the lineage node for this outline
    const outlineNode = graph.nodes.get(outlineArtifact.id);
    if (!outlineNode || outlineNode.type !== 'artifact') {
        return path;
    }

    // Trace back through source transforms
    let currentNode = outlineNode as LineageNodeArtifact;
    const visited = new Set<string>([outlineArtifact.id]);

    while (currentNode.sourceTransform !== 'none' && currentNode.sourceTransform) {
        const sourceTransform = currentNode.sourceTransform;

        // Find the most relevant source artifact (usually the first one)
        for (const sourceArtifact of sourceTransform.sourceArtifacts) {
            if (visited.has(sourceArtifact.artifactId)) {
                continue; // Avoid cycles
            }

            const artifact = artifacts.find(a => a.id === sourceArtifact.artifactId);
            if (artifact) {
                path.unshift(artifact); // Add to beginning to maintain order
                visited.add(artifact.id);
                currentNode = sourceArtifact;
                break;
            }
        }

        // Safety check to prevent infinite loops
        if (path.length > 10) {
            break;
        }
    }

    return path;
}

/**
 * Convert artifact path to workflow nodes
 */
function createWorkflowNodes(artifactPath: ElectricArtifact[]): WorkflowNode[] {
    const workflowNodes: WorkflowNode[] = [];
    let yPosition = 50;

    for (let i = 0; i < artifactPath.length; i++) {
        const artifact = artifactPath[i];
        const node = createWorkflowNodeFromArtifact(artifact, yPosition, i === artifactPath.length - 1);
        if (node) {
            workflowNodes.push(node);
            yPosition += 120; // Space between nodes
        }
    }

    return workflowNodes;
}

/**
 * Create a single workflow node from an artifact
 */
function createWorkflowNodeFromArtifact(
    artifact: ElectricArtifact,
    yPosition: number,
    isLatest: boolean
): WorkflowNode | null {
    let nodeType: WorkflowNode['type'];
    let title: string;
    let navigationTarget: string;

    // Determine node type and properties based on artifact
    if (artifact.schema_type === 'brainstorm_collection_schema' || artifact.type === 'brainstorm_idea_collection') {
        nodeType = 'brainstorm_collection';
        title = '创意构思';
        navigationTarget = '#brainstorm-ideas';
    } else if (artifact.schema_type === 'brainstorm_idea_schema' || artifact.type === 'brainstorm_idea') {
        nodeType = 'brainstorm_idea';

        // Try to extract title from data
        try {
            const data = JSON.parse(artifact.data);
            title = data.title || '选中创意';
        } catch {
            title = '选中创意';
        }

        navigationTarget = '#selected-idea';
    } else if (artifact.schema_type === 'outline_schema' || artifact.type === 'outline_response' || artifact.type === 'outline') {
        nodeType = 'outline';

        // Try to extract title from outline data
        try {
            const data = JSON.parse(artifact.data);
            title = data.title || '时间顺序大纲';
        } catch {
            title = '时间顺序大纲';
        }

        navigationTarget = '#story-outline';
    } else {
        // Unknown artifact type
        return null;
    }

    return {
        id: `workflow-node-${artifact.id}`,
        type: nodeType,
        title,
        artifactId: artifact.id,
        position: { x: 90, y: yPosition },
        isMain: true,
        isActive: isLatest, // Only the latest node is "active"
        navigationTarget,
        createdAt: artifact.created_at,
        status: artifact.streaming_status === 'streaming' ? 'processing' : 'completed',
        schemaType: artifact.schema_type // NEW: Include schema_type for display
    };
} 