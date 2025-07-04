import React, { useCallback, useMemo, useState } from 'react';
import { ReactFlow, Node, Edge, Background, Controls, MiniMap, useNodesState, useEdgesState, BackgroundVariant, MarkerType, Handle, Position, NodeTypes } from 'reactflow';
import { Typography, Checkbox, Space, Tooltip, Spin, Button, message } from 'antd';
import { DatabaseOutlined, UserOutlined, RobotOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import dagre from 'dagre';
import { useProjectData } from '../contexts/ProjectDataContext';
import { buildLineageGraph } from '../../common/transform-artifact-framework/lineageResolution';
import type { ElectricArtifact, ElectricTransform, ElectricHumanTransform } from '../../common/types';
import 'reactflow/dist/style.css';

const { Text } = Typography;



// Delete transform function
const deleteTransform = async (transformId: string) => {
    try {
        const response = await fetch(`/api/transforms/${transformId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer debug-auth-token-script-writer-dev`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete transform');
        }

        const result = await response.json();
        message.success(result.message || 'Transform deleted successfully');

        // Refresh the page to update the graph
        window.location.reload();
    } catch (error: any) {
        console.error('Error deleting transform:', error);
        message.error(`Failed to delete transform: ${error.message}`);
    }
};

// Custom node components
const ArtifactNode: React.FC<{ data: any }> = ({ data }) => {
    const { artifact, isLatest, originType } = data;

    const getTypeColor = (type: string, originType?: string) => {
        // Input params get purple color
        if (type === 'brainstorm_params' || type === 'brainstorm_tool_input' || type === 'outline_input' || type.includes('input')) {
            return '#722ed1'; // Purple for input params
        }

        // Color based on origin type
        if (originType === 'human') {
            return '#52c41a'; // Green for human-derived artifacts
        } else if (originType === 'llm') {
            return '#fa8c16'; // Orange for AI-generated artifacts
        }

        // Fallback colors for specific types
        switch (type) {
            case 'user_input': return '#52c41a'; // Green for user input
            case 'brainstorm_idea': return '#fa8c16'; // Orange for AI-generated ideas
            case 'outline_response': return '#fa8c16'; // Orange for AI-generated outlines
            case 'chronicles': return '#fa8c16'; // Orange for AI-generated chronicles
            default: return '#666'; // Gray for unknown types
        }
    };

    const typeColor = getTypeColor(artifact.type, originType);
    const borderColor = isLatest ? '#fadb14' : typeColor;
    const borderWidth = isLatest ? 3 : 2;

    let parsedData;
    try {
        parsedData = typeof artifact.data === 'string' ? JSON.parse(artifact.data) : artifact.data;
    } catch {
        parsedData = { error: 'Invalid JSON' };
    }

    return (
        <div style={{
            background: '#1a1a1a',
            border: `${borderWidth}px solid ${borderColor}`,
            borderRadius: '8px',
            padding: '16px',
            minWidth: '220px',
            maxWidth: '320px',
            minHeight: '100px',
            color: 'white',
            position: 'relative'
        }}>
            {/* Connection handles */}
            <Handle
                type="target"
                position={Position.Left}
                style={{ background: typeColor, width: 8, height: 8 }}
            />
            <Handle
                type="source"
                position={Position.Right}
                style={{ background: typeColor, width: 8, height: 8 }}
            />

            <Tooltip
                title={<div style={{ fontSize: '11px' }}>
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontWeight: 'bold', color: '#1890ff', marginBottom: '4px' }}>
                            Artifact Details
                        </div>
                        <div><strong>ID:</strong> {artifact.id}</div>
                        <div><strong>Project ID:</strong> {artifact.project_id}</div>
                        <div><strong>Type:</strong> {artifact.type}</div>
                        <div><strong>Type Version:</strong> {artifact.type_version}</div>
                        {artifact.metadata && (
                            <div><strong>Metadata:</strong> {typeof artifact.metadata === 'string' ? artifact.metadata : JSON.stringify(artifact.metadata)}</div>
                        )}
                        {artifact.streaming_status && (
                            <div><strong>Streaming Status:</strong> {artifact.streaming_status}</div>
                        )}
                        <div><strong>Created:</strong> {new Date(artifact.created_at).toLocaleString()}</div>
                        <div><strong>Updated:</strong> {new Date(artifact.updated_at).toLocaleString()}</div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 'bold', color: '#52c41a', marginBottom: '4px' }}>
                            Data Content
                        </div>
                        <pre style={{ maxHeight: '250px', overflow: 'auto', fontSize: '10px', background: '#262626', padding: '8px', borderRadius: '4px' }}>
                            {JSON.stringify(parsedData, null, 2)}
                        </pre>
                    </div>
                </div>}
                overlayStyle={{ maxWidth: '600px' }}
            >
                <div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '8px',
                        gap: '8px'
                    }}>
                        <DatabaseOutlined style={{ color: typeColor }} />
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: '12px' }}>
                            {artifact.type}
                        </Text>
                        {isLatest && (
                            <span style={{
                                background: '#fadb14',
                                color: '#000',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 'bold'
                            }}>
                                LATEST
                            </span>
                        )}
                    </div>
                    <Text style={{ color: '#ccc', fontSize: '10px' }}>
                        {artifact.schema_type || artifact.type}
                    </Text>
                    <br />
                    <Text style={{ color: '#aaa', fontSize: '9px', fontStyle: 'italic' }}>
                        {(() => {
                            try {
                                const data = typeof artifact.data === 'string' ? JSON.parse(artifact.data) : artifact.data;
                                let preview = '';

                                if (artifact.schema_type === 'brainstorm_collection_schema' || artifact.type === 'brainstorm_idea_collection') {
                                    if (data.ideas && Array.isArray(data.ideas) && data.ideas.length > 0) {
                                        const firstIdea = data.ideas[0];
                                        const title = firstIdea.title || '';
                                        preview = title.length > 25 ? `${title.substring(0, 25)}...` : title;
                                    } else {
                                        preview = '创意集合';
                                    }
                                } else if (artifact.schema_type === 'brainstorm_idea_schema' || artifact.type === 'brainstorm_idea') {
                                    const title = data.title || '';
                                    preview = title.length > 25 ? `${title.substring(0, 25)}...` : title;
                                } else if (artifact.schema_type === 'outline_schema' || artifact.type === 'outline_response' || artifact.type === 'outline') {
                                    const outlineTitle = data.title || data.synopsis || '';
                                    preview = outlineTitle.length > 25 ? `${outlineTitle.substring(0, 25)}...` : outlineTitle;
                                } else if (artifact.schema_type === 'user_input_schema' || artifact.type === 'user_input') {
                                    const content = data.content || data.text || '';
                                    preview = content.length > 25 ? `${content.substring(0, 25)}...` : content;
                                } else {
                                    // Generic preview for other types
                                    const keys = Object.keys(data);
                                    if (keys.length > 0) {
                                        const firstKey = keys[0];
                                        const firstValue = data[firstKey];
                                        if (typeof firstValue === 'string') {
                                            preview = firstValue.length > 25 ? `${firstValue.substring(0, 25)}...` : firstValue;
                                        } else {
                                            preview = `${firstKey}: ${typeof firstValue}`;
                                        }
                                    } else {
                                        preview = '空数据';
                                    }
                                }

                                return preview || '无预览';
                            } catch (error) {
                                return '数据解析错误';
                            }
                        })()}
                    </Text>
                </div>
            </Tooltip>
        </div>
    );
};

const TransformNode: React.FC<{ data: any }> = ({ data }) => {
    const { transform, humanTransform } = data;

    const getTypeColor = (type: string) => {
        return type === 'human' ? '#52c41a' : '#fa8c16'; // Green for human, orange for AI
    };

    const typeColor = getTypeColor(transform.type);

    // Status indicators
    const isInProgress = transform.status === 'in_progress' || transform.status === 'running';
    const isFailed = transform.status === 'failed' || transform.status === 'error';

    let contextData;
    try {
        contextData = transform.execution_context ?
            (typeof transform.execution_context === 'string' ?
                JSON.parse(transform.execution_context) :
                transform.execution_context) :
            {};
    } catch {
        contextData = { error: 'Invalid JSON' };
    }

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        deleteTransform(transform.id);
    };

    return (
        <div
            style={{
                background: '#2a2a2a',
                border: `2px solid ${typeColor}`,
                borderRadius: '8px',
                padding: '12px',
                minWidth: '180px',
                maxWidth: '250px',
                color: 'white',
                position: 'relative',
                transform: 'rotate(45deg)',
                transformOrigin: 'center'
            }}
        >
            {/* Connection handles */}
            <Handle
                type="target"
                position={Position.Left}
                style={{ background: typeColor, width: 8, height: 8 }}
            />
            <Handle
                type="source"
                position={Position.Right}
                style={{ background: typeColor, width: 8, height: 8 }}
            />

            <div style={{ transform: 'rotate(-45deg)' }}>
                <Tooltip
                    title={<div>
                        <div style={{ marginBottom: '12px' }}>
                            <div><strong>Transform ID:</strong> {transform.id}</div>
                            <div><strong>Type:</strong> {transform.type}</div>
                            <div><strong>Status:</strong> {transform.status}</div>
                            <div><strong>Created:</strong> {new Date(transform.created_at).toLocaleString()}</div>
                            {humanTransform && (
                                <>
                                    <div><strong>Action:</strong> {humanTransform.action_type}</div>
                                    <div><strong>Path:</strong> {humanTransform.derivation_path}</div>
                                    {humanTransform.transform_name && (
                                        <div><strong>Transform Name:</strong> {humanTransform.transform_name}</div>
                                    )}
                                </>
                            )}
                            <div><strong>Context:</strong></div>
                            <pre style={{ fontSize: '10px', maxHeight: '200px', overflow: 'auto' }}>
                                {JSON.stringify(contextData, null, 2)}
                            </pre>
                        </div>
                        <div style={{ textAlign: 'center', borderTop: '1px solid #444', paddingTop: '8px' }}>
                            <Button
                                type="primary"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={handleDelete}
                                style={{ fontSize: '12px' }}
                            >
                                删除转换
                            </Button>
                        </div>
                    </div>}
                    overlayStyle={{ maxWidth: '400px' }}
                >
                    <div style={{ textAlign: 'center', position: 'relative' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '6px',
                            gap: '6px'
                        }}>
                            {transform.type === 'human' ?
                                <UserOutlined style={{ color: typeColor }} /> :
                                <RobotOutlined style={{ color: typeColor }} />
                            }
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: '11px' }}>
                                {transform.type.toUpperCase()}
                            </Text>
                        </div>

                        {/* Status indicator overlay */}
                        {isInProgress && (
                            <div style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                background: '#1a1a1a',
                                borderRadius: '50%',
                                padding: '2px'
                            }}>
                                <Spin size="small" />
                            </div>
                        )}

                        {isFailed && (
                            <div style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                background: '#f5222d',
                                borderRadius: '50%',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '16px',
                                height: '16px'
                            }}>
                                <CloseOutlined style={{ color: 'white', fontSize: '10px' }} />
                            </div>
                        )}

                        <Text style={{ color: '#ccc', fontSize: '9px' }}>
                            {transform.status}
                        </Text>
                        <br />
                        <Text style={{ color: '#999', fontSize: '8px' }}>
                            {new Date(transform.created_at).toLocaleString()}
                        </Text>
                    </div>
                </Tooltip>
            </div>
        </div>
    );
};

const nodeTypes: NodeTypes = {
    artifact: ArtifactNode,
    transform: TransformNode,
};

// Graph layout function using dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 150 });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: node.type === 'artifact' ? 240 : 140, height: node.type === 'artifact' ? 140 : 100 });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = Position.Left;
        node.sourcePosition = Position.Right;
        node.position = {
            x: nodeWithPosition.x - (node.type === 'artifact' ? 120 : 70),
            y: nodeWithPosition.y - (node.type === 'artifact' ? 70 : 50),
        };
    });

    return { nodes, edges };
};

const RawGraphVisualization: React.FC = () => {
    const projectData = useProjectData();
    const [showArtifacts, setShowArtifacts] = useState(true);
    const [showTransforms, setShowTransforms] = useState(true);
    const [showHumanTransforms, setShowHumanTransforms] = useState(true);
    const [showLLMTransforms, setShowLLMTransforms] = useState(true);

    // Process lineage data and convert to React Flow format
    const { nodes: flowNodes, edges: flowEdges } = useMemo(() => {
        if (!projectData.artifacts.length) {
            return { nodes: [], edges: [] };
        }

        // Build lineage graph using existing function
        const lineageGraph = buildLineageGraph(
            projectData.artifacts,
            projectData.transforms,
            projectData.humanTransforms,
            projectData.transformInputs,
            projectData.transformOutputs
        );

        const nodes: Node[] = [];
        const edges: Edge[] = [];

        // Create artifact nodes
        if (showArtifacts) {
            projectData.artifacts.forEach((artifact) => {
                // Check if this is the latest version in a lineage chain
                const lineageNode = lineageGraph.nodes.get(artifact.id);
                const isLatest = lineageNode?.isLeaf || false;

                // Determine origin type by checking which transforms created this artifact
                let originType: string | undefined;
                const creatingTransform = projectData.transformOutputs
                    .find(output => output.artifact_id === artifact.id);

                if (creatingTransform) {
                    const transform = projectData.transforms
                        .find(t => t.id === creatingTransform.transform_id);
                    if (transform) {
                        originType = transform.type; // 'human' or 'llm'
                    }
                }

                // Special handling for user input artifacts
                if (artifact.origin_type === 'user_input' || artifact.type === 'user_input') {
                    originType = 'human';
                }

                nodes.push({
                    id: artifact.id,
                    type: 'artifact',
                    data: { artifact, isLatest, originType },
                    position: { x: 0, y: 0 }, // Will be set by layout
                });
            });
        }

        // Create transform nodes and edges
        if (showTransforms) {
            projectData.transforms.forEach((transform) => {
                const shouldShow =
                    (transform.type === 'human' && showHumanTransforms) ||
                    (transform.type === 'llm' && showLLMTransforms);

                if (!shouldShow) return;

                // Find associated human transform if it exists
                const humanTransform = projectData.humanTransforms.find(ht =>
                    projectData.transformInputs.some(ti =>
                        ti.transform_id === transform.id && ti.artifact_id === ht.source_artifact_id
                    )
                );

                nodes.push({
                    id: transform.id,
                    type: 'transform',
                    data: { transform, humanTransform },
                    position: { x: 0, y: 0 }, // Will be set by layout
                });

                // Create edges from input artifacts to transform
                const inputs = projectData.transformInputs.filter(ti => ti.transform_id === transform.id);
                const edgeColor = transform.type === 'human' ? '#52c41a' : '#fa8c16'; // Green for human, orange for AI

                inputs.forEach((input) => {
                    if (showArtifacts && projectData.artifacts.some(a => a.id === input.artifact_id)) {
                        edges.push({
                            id: `${input.artifact_id}-${transform.id}`,
                            source: input.artifact_id,
                            target: transform.id,
                            type: 'default',
                            style: { stroke: edgeColor, strokeWidth: 2 },
                            markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
                        });
                    }
                });

                // Create edges from transform to output artifacts
                const outputs = projectData.transformOutputs.filter(to => to.transform_id === transform.id);

                outputs.forEach((output) => {
                    if (showArtifacts && projectData.artifacts.some(a => a.id === output.artifact_id)) {
                        edges.push({
                            id: `${transform.id}-${output.artifact_id}`,
                            source: transform.id,
                            target: output.artifact_id,
                            type: 'default',
                            style: { stroke: edgeColor, strokeWidth: 2 },
                            markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
                        });
                    }
                });
            });
        }

        // Fallback: If we have no edges but have human transforms, create edges from human transform data
        if (edges.length === 0 && projectData.humanTransforms.length > 0) {
            projectData.humanTransforms.forEach((humanTransform) => {
                // Find the corresponding transform
                const transform = projectData.transforms.find(t => t.id === humanTransform.transform_id);
                if (!transform) return;

                const shouldShow =
                    (transform.type === 'human' && showHumanTransforms) ||
                    (transform.type === 'llm' && showLLMTransforms);
                if (!shouldShow) return;

                const edgeColor = transform.type === 'human' ? '#52c41a' : '#fa8c16'; // Green for human, orange for AI

                // Create edge from source artifact to transform (if both exist in nodes)
                if (humanTransform.source_artifact_id &&
                    nodes.some(n => n.id === humanTransform.source_artifact_id) &&
                    nodes.some(n => n.id === transform.id)) {

                    edges.push({
                        id: `fallback-${humanTransform.source_artifact_id}-${transform.id}`,
                        source: humanTransform.source_artifact_id,
                        target: transform.id,
                        type: 'default',
                        style: { stroke: edgeColor, strokeWidth: 2 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
                    });
                }

                // Create edge from transform to derived artifact (if both exist in nodes)
                if (humanTransform.derived_artifact_id &&
                    nodes.some(n => n.id === transform.id) &&
                    nodes.some(n => n.id === humanTransform.derived_artifact_id)) {

                    edges.push({
                        id: `fallback-${transform.id}-${humanTransform.derived_artifact_id}`,
                        source: transform.id,
                        target: humanTransform.derived_artifact_id,
                        type: 'default',
                        style: { stroke: edgeColor, strokeWidth: 2 },
                        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
                    });
                }
            });
        }

        // Additional fallback: Use lineage graph relationships to create edges
        if (edges.length === 0) {
            lineageGraph.edges.forEach((targetIds, sourceId) => {
                targetIds.forEach((targetId) => {
                    const sourceExists = nodes.some(n => n.id === sourceId);
                    const targetExists = nodes.some(n => n.id === targetId);

                    if (sourceExists && targetExists) {
                        edges.push({
                            id: `lineage-${sourceId}-${targetId}`,
                            source: sourceId,
                            target: targetId,
                            type: 'default',
                            style: { stroke: '#faad14', strokeWidth: 2 },
                            markerEnd: { type: MarkerType.ArrowClosed, color: '#faad14' },
                        });
                    }
                });
            });
        }

        return getLayoutedElements(nodes, edges);
    }, [
        projectData.artifacts,
        projectData.transforms,
        projectData.humanTransforms,
        projectData.transformInputs,
        projectData.transformOutputs,
        showArtifacts,
        showTransforms,
        showHumanTransforms,
        showLLMTransforms
    ]);

    const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

    // Update nodes and edges when data changes
    React.useEffect(() => {
        setNodes(flowNodes);
        setEdges(flowEdges);
    }, [flowNodes, flowEdges, setNodes, setEdges]);

    const onFitView = useCallback(() => {
        // This will be handled by the fitView prop on ReactFlow
    }, []);

    if (projectData.isLoading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                background: '#0a0a0a'
            }}>
                <Text style={{ color: 'white' }}>加载图谱数据...</Text>
            </div>
        );
    }

    return (
        <div style={{ height: '100%', background: '#0a0a0a' }}>
            {/* Controls */}
            <div style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                zIndex: 1000,
                background: '#1a1a1a',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #333'
            }}>
                <Space direction="vertical" size="small">
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>显示选项</Text>
                    <Checkbox
                        checked={showArtifacts}
                        onChange={(e) => setShowArtifacts(e.target.checked)}
                        style={{ color: 'white' }}
                    >
                        <DatabaseOutlined /> 工件 ({projectData.artifacts.length})
                    </Checkbox>
                    <Checkbox
                        checked={showTransforms}
                        onChange={(e) => setShowTransforms(e.target.checked)}
                        style={{ color: 'white' }}
                        disabled={!showHumanTransforms && !showLLMTransforms}
                    >
                        转换 ({projectData.transforms.length})
                    </Checkbox>
                    <div style={{ marginLeft: '20px' }}>
                        <Checkbox
                            checked={showHumanTransforms}
                            onChange={(e) => setShowHumanTransforms(e.target.checked)}
                            style={{ color: 'white' }}
                        >
                            <UserOutlined /> 人工转换
                        </Checkbox>
                        <br />
                        <Checkbox
                            checked={showLLMTransforms}
                            onChange={(e) => setShowLLMTransforms(e.target.checked)}
                            style={{ color: 'white' }}
                        >
                            <RobotOutlined /> AI转换
                        </Checkbox>
                    </div>
                </Space>
            </div>

            {/* Graph */}
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.1 }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={true}
                panOnDrag={true}
                zoomOnScroll={true}
                zoomOnPinch={true}
                zoomOnDoubleClick={true}
                minZoom={0.1}
                maxZoom={2}
                style={{ background: '#0a0a0a' }}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1}
                    color="#333"
                />
                <Controls
                    style={{
                        background: '#1a1a1a',
                        border: '1px solid #333',
                    }}
                />
                <MiniMap
                    style={{
                        background: '#1a1a1a',
                        border: '1px solid #333',
                    }}
                    nodeColor="#666"
                    maskColor="rgba(0, 0, 0, 0.8)"
                />
            </ReactFlow>
        </div>
    );
};

export default RawGraphVisualization; 