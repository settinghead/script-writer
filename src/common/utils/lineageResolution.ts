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

export interface LineageNode {
    artifactId: string;
    transformId?: string;
    path?: string;
    depth: number;
    isLeaf: boolean;
    artifactType?: string;
    transformType?: 'human' | 'llm';
}

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
    const nodes = new Map<string, LineageNode>();
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

    // Initialize nodes and determine root nodes
    for (const artifact of artifacts) {
        const isRoot = !artifactsWithIncomingTransforms.has(artifact.id);
        if (isRoot) {
            rootNodes.add(artifact.id);
        }

        nodes.set(artifact.id, {
            artifactId: artifact.id,
            depth: 0,
            isLeaf: true, // Will be updated if we find outgoing transforms
            artifactType: artifact.type
        });
    }

    // Step 2: Process all transforms in dependency order
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
                const inputNode = nodes.get(input.artifact_id);
                // Can process if the input node exists and either:
                // 1. It's a root node (no incoming transforms), or
                // 2. All transforms that produce this input have been processed
                return inputNode && (
                    rootNodes.has(input.artifact_id) ||
                    !hasUnprocessedIncomingTransforms(input.artifact_id, transformInputs, transformOutputs, processedTransforms)
                );
            });

            if (canProcess) {
                // Process this transform
                if (transform.type === 'human') {
                    processHumanTransform(transform, humanTransforms, transformInputs, transformOutputs, nodes, edges, paths, rootNodes);
                } else if (transform.type === 'llm') {
                    processLLMTransform(transform, transformInputs, transformOutputs, nodes, edges, paths, rootNodes);
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

    return {
        nodes,
        edges,
        paths,
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

// Helper function to process human transforms
function processHumanTransform(
    transform: ElectricTransform,
    humanTransforms: ElectricHumanTransform[],
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[],
    nodes: Map<string, LineageNode>,
    edges: Map<string, string[]>,
    paths: Map<string, LineageNode[]>,
    rootNodes: Set<string>
): void {
    const transformId = transform.id;
    const humanTransform = humanTransforms.find(ht => ht.transform_id === transformId);

    if (!humanTransform) return;

    const inputs = transformInputs.filter(ti => ti.transform_id === transformId);
    const outputs = transformOutputs.filter(to => to.transform_id === transformId);

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
            const sourceNode = nodes.get(sourceId);
            if (sourceNode) {
                sourceNode.isLeaf = false;
            }

            // Update target node
            const targetNode = nodes.get(targetId);
            if (targetNode) {
                targetNode.transformId = transformId;
                targetNode.path = path;
                targetNode.transformType = 'human';
                targetNode.depth = (sourceNode?.depth ?? 0) + 1;
            }

            // Remove target from root nodes (it has an incoming transform)
            rootNodes.delete(targetId);

            // Track path-based lineage
            const pathKey = `${sourceId}:${path}`;
            if (!paths.has(pathKey)) {
                paths.set(pathKey, []);
            }
            paths.get(pathKey)!.push(targetNode!);
        }
    }
}

// Helper function to process LLM transforms
function processLLMTransform(
    transform: ElectricTransform,
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[],
    nodes: Map<string, LineageNode>,
    edges: Map<string, string[]>,
    paths: Map<string, LineageNode[]>,
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
            const sourceNode = nodes.get(sourceId);
            if (sourceNode) {
                sourceNode.isLeaf = false;
            }

            // Update target node
            const targetNode = nodes.get(targetId);
            if (targetNode) {
                targetNode.transformId = transformId;
                targetNode.transformType = 'llm';
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

            // Create path lineage using the determined path
            const activePath = transformPath || sourceNode?.path;
            if (activePath) {
                const pathKey = `${sourceId}:${activePath}`;
                const existingPath = paths.get(pathKey) || [];
                paths.set(pathKey, [...existingPath, targetNode!]);

                // Also create a path key for the target artifact to maintain lineage
                const targetPathKey = `${targetId}:${activePath}`;
                paths.set(targetPathKey, [targetNode!]);
            }
        }
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

        // Continue traversing from the deepest node to find the actual leaf
        const finalResult = traverseToLeaf(deepestNode.artifactId, graph);

        // Build complete lineage path without duplicates
        const completePath = [sourceNode];

        // Add path lineage nodes (excluding the deepest node to avoid duplication)
        for (const node of pathLineage) {
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
 * Extract all brainstorm-related artifacts from a lineage graph
 */
export function extractBrainstormLineages(
    graph: LineageGraph,
    artifacts: ElectricArtifact[]
): Map<string, LineageResolutionResult[]> {
    const brainstormLineages = new Map<string, LineageResolutionResult[]>();

    // Find all brainstorm_idea_collection artifacts
    for (const artifact of artifacts) {
        if (artifact.type === 'brainstorm_idea_collection') {
            const lineages: LineageResolutionResult[] = [];

            try {
                // Handle both string and object data formats
                let data: any;
                if (typeof artifact.data === 'string') {
                    data = JSON.parse(artifact.data);
                } else {
                    data = artifact.data;
                }

                if (Array.isArray(data)) {
                    // For each idea in the collection, resolve its lineage
                    for (let i = 0; i < data.length; i++) {
                        const path = `[${i}]`;
                        const result = findLatestArtifact(artifact.id, path, graph);
                        lineages.push(result);
                    }
                }
            } catch (error) {
                console.warn(`Failed to parse brainstorm collection ${artifact.id}:`, error);
            }

            brainstormLineages.set(artifact.id, lineages);
        }
    }

    return brainstormLineages;
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