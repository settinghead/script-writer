import React, { useCallback, useMemo, useState } from 'react';
import { ReactFlow, Node, Edge, Background, Controls, MiniMap, useNodesState, useEdgesState, BackgroundVariant, MarkerType, Handle, Position, NodeTypes } from 'reactflow';
import { Typography, Checkbox, Space, Tooltip, Spin, Button, message } from 'antd';
import { DatabaseOutlined, UserOutlined, RobotOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import dagre from 'dagre';
import { useProjectData } from '../contexts/ProjectDataContext';
import { AppColors, ColorUtils } from '../../common/theme/colors';
import 'reactflow/dist/style.css';
import { ElectricJsondoc } from '@/common/types';

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


    } catch (error: any) {
        console.error('Error deleting transform:', error);
        message.error(`Failed to delete transform: ${error.message}`);
    }
};

// Delete jsondoc function
const deleteJsondoc = async (jsondocId: string) => {
    try {
        const response = await fetch(`/api/jsondocs/${jsondocId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer debug-auth-token-script-writer-dev`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete jsondoc');
        }

        const result = await response.json();
        message.success(result.message || 'Jsondoc deleted successfully');

    } catch (error: any) {
        console.error('Error deleting jsondoc:', error);
        message.error(`Failed to delete jsondoc: ${error.message}`);
    }
};

// Custom node components
const JsondocNode: React.FC<{
    data: {
        jsondoc: ElectricJsondoc,
        isLatest: boolean,
        originType: string
    }
}> = ({ data }) => {
    const { jsondoc, isLatest, originType } = data;

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        deleteJsondoc(jsondoc.id);
    };

    const getTypeColor = (type: string, originType?: string) => {
        return ColorUtils.getJsondocColor(type, originType);
    };

    const typeColor = getTypeColor(jsondoc.schema_type, originType);
    const borderColor = isLatest ? AppColors.status.latest : typeColor;
    const borderWidth = isLatest ? 3 : 2;

    let parsedData;
    try {
        parsedData = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
    } catch {
        parsedData = { error: 'Invalid JSON' };
    }

    return (
        <div style={{
            background: AppColors.background.primary,
            border: `${borderWidth}px solid ${borderColor}`,
            borderRadius: '8px',
            padding: '16px',
            minWidth: '220px',
            maxWidth: '320px',
            minHeight: '100px',
            color: AppColors.text.white,
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
                            Jsondoc Details
                        </div>
                        <div><strong>ID:</strong> {jsondoc.id}</div>
                        <div><strong>Project ID:</strong> {jsondoc.project_id}</div>
                        <div><strong>Type:</strong> {jsondoc.schema_type}</div>
                        <div><strong>Type Version:</strong> {jsondoc.schema_version}</div>
                        {jsondoc.metadata && (
                            <div><strong>Metadata:</strong> {typeof jsondoc.metadata === 'string' ? jsondoc.metadata : JSON.stringify(jsondoc.metadata)}</div>
                        )}
                        {jsondoc.streaming_status && (
                            <div><strong>Streaming Status:</strong> {jsondoc.streaming_status}</div>
                        )}
                        <div><strong>Created:</strong> {new Date(jsondoc.created_at).toLocaleString()}</div>
                        <div><strong>Updated:</strong> {new Date(jsondoc.updated_at || '').toLocaleString()}</div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 'bold', color: '#52c41a', marginBottom: '4px' }}>
                            Data Content
                        </div>
                        {jsondoc.schema_type === 'json_patch' ? (
                            <div style={{ fontSize: '10px', background: '#262626', padding: '8px', borderRadius: '4px' }}>
                                <div style={{ marginBottom: '8px' }}>
                                    <strong>补丁数量:</strong> {parsedData.patches?.length || 0}
                                </div>
                                <div style={{ marginBottom: '8px' }}>
                                    <strong>状态:</strong> {parsedData.applied ? '已应用' : '未应用'}
                                </div>
                                {parsedData.targetJsondocId && (
                                    <div style={{ marginBottom: '8px' }}>
                                        <strong>目标Jsondoc:</strong> {parsedData.targetJsondocId}
                                    </div>
                                )}
                                {parsedData.errorMessage && (
                                    <div style={{ marginBottom: '8px', color: '#ff4d4f' }}>
                                        <strong>错误:</strong> {parsedData.errorMessage}
                                    </div>
                                )}
                                <div style={{ marginTop: '8px' }}>
                                    <strong>补丁内容:</strong>
                                </div>
                                <pre style={{ maxHeight: '150px', overflow: 'auto', fontSize: '9px', background: '#1a1a1a', padding: '4px', borderRadius: '2px' }}>
                                    {JSON.stringify(parsedData.patches, null, 2)}
                                </pre>
                            </div>
                        ) : (
                            <pre style={{ maxHeight: '250px', overflow: 'auto', fontSize: '10px', background: '#262626', padding: '8px', borderRadius: '4px' }}>
                                {JSON.stringify(parsedData, null, 2)}
                            </pre>
                        )}
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
                            删除Jsondoc
                        </Button>
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
                        <Text style={{ color: AppColors.text.white, fontWeight: 'bold', fontSize: '12px' }}>
                            {jsondoc.schema_type}
                        </Text>
                        {isLatest && (
                            <span style={{
                                background: AppColors.status.latest,
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
                    <Text style={{ color: AppColors.text.secondary, fontSize: '10px' }}>
                        {jsondoc.schema_type}
                    </Text>
                    <br />
                    <Text style={{ color: AppColors.text.tertiary, fontSize: '9px', fontStyle: 'italic' }}>
                        {(() => {
                            try {
                                const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
                                let preview = '';

                                if (jsondoc.schema_type === 'brainstorm_collection') {
                                    if (data.ideas && Array.isArray(data.ideas) && data.ideas.length > 0) {
                                        const firstIdea = data.ideas[0];
                                        const title = firstIdea.title || '';
                                        preview = title.length > 25 ? `${title.substring(0, 25)}...` : title;
                                    } else {
                                        preview = '创意集合';
                                    }
                                } else if (jsondoc.schema_type === 'brainstorm_idea') {
                                    const title = data.title || '';
                                    preview = title.length > 25 ? `${title.substring(0, 25)}...` : title;
                                } else if (jsondoc.schema_type === 'outline_settings') {
                                    const outlineTitle = data.title || data.synopsis || '';
                                    preview = outlineTitle.length > 25 ? `${outlineTitle.substring(0, 25)}...` : outlineTitle;
                                } else if (jsondoc.schema_type === 'json_patch') {
                                    if (data.patches && Array.isArray(data.patches)) {
                                        const patchCount = data.patches.length;
                                        const applied = data.applied ? '已应用' : '未应用';
                                        preview = `${patchCount}个补丁 ${applied}`;
                                    } else {
                                        preview = 'JSON补丁';
                                    }
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
        return ColorUtils.getTransformColor(type as 'human' | 'llm');
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
                background: AppColors.background.secondary,
                border: `2px solid ${typeColor}`,
                borderRadius: '8px',
                padding: '12px',
                minWidth: '180px',
                maxWidth: '250px',
                color: AppColors.text.white,
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
                            <Text style={{ color: AppColors.text.white, fontWeight: 'bold', fontSize: '11px' }}>
                                {transform.type.toUpperCase()}
                            </Text>
                        </div>

                        {/* Status indicator overlay */}
                        {isInProgress && (
                            <div style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                background: AppColors.background.primary,
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
                                background: AppColors.status.error,
                                borderRadius: '50%',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '16px',
                                height: '16px'
                            }}>
                                <CloseOutlined style={{ color: AppColors.text.white, fontSize: '10px' }} />
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
    jsondoc: JsondocNode,
    transform: TransformNode,
};

// Graph layout function using dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 150, edgesep: 50 }); // Add edgesep for better spacing

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: node.type === 'jsondoc' ? 240 : 140, height: node.type === 'jsondoc' ? 140 : 100 });
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
            x: nodeWithPosition.x - (node.type === 'jsondoc' ? 120 : 70),
            y: nodeWithPosition.y - (node.type === 'jsondoc' ? 70 : 50),
        };
    });

    return { nodes, edges };
};

const RawGraphVisualization: React.FC = () => {
    const projectData = useProjectData();
    const [showJsondocs, setShowJsondocs] = useState(true);
    const [showTransforms, setShowTransforms] = useState(true);
    const [showHumanTransforms, setShowHumanTransforms] = useState(true);
    const [showLLMTransforms, setShowLLMTransforms] = useState(true);

    // Process lineage data and convert to React Flow format
    const { nodes: flowNodes, edges: flowEdges } = useMemo(() => {
        // Handle loading/error states
        if (projectData.jsondocs === "pending" ||
            projectData.transforms === "pending" ||
            projectData.humanTransforms === "pending" ||
            projectData.transformInputs === "pending" ||
            projectData.transformOutputs === "pending" ||
            projectData.lineageGraph === "pending") {
            return { nodes: [], edges: [] };
        }

        if (projectData.jsondocs === "error" ||
            projectData.transforms === "error" ||
            projectData.humanTransforms === "error" ||
            projectData.transformInputs === "error" ||
            projectData.transformOutputs === "error" ||
            projectData.lineageGraph === "error") {
            return { nodes: [], edges: [] };
        }

        if (!projectData.jsondocs.length) {
            return { nodes: [], edges: [] };
        }

        // Use the globally shared lineage graph from context
        const lineageGraph = projectData.lineageGraph;

        const nodes: Node[] = [];
        const edges: Edge[] = [];

        // Create jsondoc nodes
        if (showJsondocs && Array.isArray(projectData.jsondocs)) {
            projectData.jsondocs.forEach((jsondoc) => {
                // Check if this is the latest version in a lineage chain
                const lineageNode = lineageGraph.nodes?.get(jsondoc.id);
                const isLatest = lineageNode?.isLeaf || false;

                // Determine origin type by checking which transforms created this jsondoc
                let originType: string | undefined;
                if (Array.isArray(projectData.transformOutputs)) {
                    const creatingTransform = projectData.transformOutputs
                        .find((output: any) => output.jsondoc_id === jsondoc.id);

                    if (creatingTransform && Array.isArray(projectData.transforms)) {
                        const transform = projectData.transforms
                            .find((t: any) => t.id === creatingTransform.transform_id);
                        if (transform) {
                            originType = transform.type; // 'human' or 'llm'
                        }
                    }
                }

                // Special handling for user input jsondocs
                if (jsondoc.origin_type === 'user_input') {
                    originType = 'human';
                }

                nodes.push({
                    id: jsondoc.id,
                    type: 'jsondoc',
                    data: { jsondoc, isLatest, originType },
                    position: { x: 0, y: 0 }, // Will be set by layout
                });
            });
        }

        // Create transform nodes and edges
        if (showTransforms && Array.isArray(projectData.transforms)) {
            projectData.transforms.forEach((transform: any) => {
                const shouldShow =
                    (transform.type === 'human' && showHumanTransforms) ||
                    (transform.type === 'llm' && showLLMTransforms);

                if (!shouldShow) return;

                // Find associated human transform if it exists
                let humanTransform;
                if (Array.isArray(projectData.humanTransforms) && Array.isArray(projectData.transformInputs)) {
                    humanTransform = projectData.humanTransforms.find((ht: any) =>
                        Array.isArray(projectData.transformInputs) && projectData.transformInputs.some((ti: any) =>
                            ti.transform_id === transform.id && ti.jsondoc_id === ht.source_jsondoc_id
                        )
                    );
                }

                nodes.push({
                    id: transform.id,
                    type: 'transform',
                    data: { transform, humanTransform },
                    position: { x: 0, y: 0 }, // Will be set by layout
                });

                // Create edges from input jsondocs to transform
                if (Array.isArray(projectData.transformInputs)) {
                    const inputs = projectData.transformInputs.filter((ti: any) => ti.transform_id === transform.id);
                    const edgeColor = ColorUtils.getTransformColor(transform.type as 'human' | 'llm');

                    inputs.forEach((input: any) => {
                        if (showJsondocs && Array.isArray(projectData.jsondocs) && projectData.jsondocs.some((a) => a.id === input.jsondoc_id)) {
                            edges.push({
                                id: `${input.jsondoc_id}-${transform.id}`,
                                source: input.jsondoc_id,
                                target: transform.id,
                                type: 'default',
                                style: { stroke: edgeColor, strokeWidth: 2 },
                                markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
                            });
                        }
                    });
                }

                // Create edges from transform to output jsondocs
                if (Array.isArray(projectData.transformOutputs)) {
                    const outputs = projectData.transformOutputs.filter((to: any) => to.transform_id === transform.id);
                    const edgeColor = ColorUtils.getTransformColor(transform.type as 'human' | 'llm');

                    outputs.forEach((output: any) => {
                        if (showJsondocs && Array.isArray(projectData.jsondocs) && projectData.jsondocs.some((a) => a.id === output.jsondoc_id)) {
                            edges.push({
                                id: `${transform.id}-${output.jsondoc_id}`,
                                source: transform.id,
                                target: output.jsondoc_id,
                                type: 'default',
                                style: { stroke: edgeColor, strokeWidth: 2 },
                                markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
                            });
                        }
                    });
                }
            });
        }

        // Fallback: If we have no edges but have human transforms, create edges from human transform data
        if (edges.length === 0 && Array.isArray(projectData.humanTransforms) && projectData.humanTransforms.length > 0) {
            projectData.humanTransforms.forEach((humanTransform: any) => {
                // Find the corresponding transform
                if (Array.isArray(projectData.transforms)) {
                    const transform = projectData.transforms.find((t: any) => t.id === humanTransform.transform_id);
                    if (!transform) return;

                    const shouldShow =
                        (transform.type === 'human' && showHumanTransforms) ||
                        (transform.type === 'llm' && showLLMTransforms);
                    if (!shouldShow) return;

                    const edgeColor = ColorUtils.getTransformColor(transform.type as 'human' | 'llm');

                    // Create edge from source jsondoc to transform (if both exist in nodes)
                    if (humanTransform.source_jsondoc_id &&
                        nodes.some(n => n.id === humanTransform.source_jsondoc_id) &&
                        nodes.some(n => n.id === transform.id)) {

                        edges.push({
                            id: `fallback-${humanTransform.source_jsondoc_id}-${transform.id}`,
                            source: humanTransform.source_jsondoc_id,
                            target: transform.id,
                            type: 'default',
                            style: { stroke: edgeColor, strokeWidth: 2 },
                            markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
                        });
                    }

                    // Create edge from transform to derived jsondoc (if both exist in nodes)
                    if (humanTransform.derived_jsondoc_id &&
                        nodes.some(n => n.id === transform.id) &&
                        nodes.some(n => n.id === humanTransform.derived_jsondoc_id)) {

                        edges.push({
                            id: `fallback-${transform.id}-${humanTransform.derived_jsondoc_id}`,
                            source: transform.id,
                            target: humanTransform.derived_jsondoc_id,
                            type: 'default',
                            style: { stroke: edgeColor, strokeWidth: 2 },
                            markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
                        });
                    }
                }
            });
        }

        // Additional fallback: Use lineage graph relationships to create edges
        if (edges.length === 0 && lineageGraph.edges) {
            lineageGraph.edges.forEach((targetIds: any, sourceId: any) => {
                targetIds.forEach((targetId: any) => {
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
        projectData.jsondocs,
        projectData.transforms,
        projectData.humanTransforms,
        projectData.transformInputs,
        projectData.transformOutputs,
        projectData.lineageGraph,
        showJsondocs,
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
                    <Text style={{ color: AppColors.text.white, fontWeight: 'bold' }}>显示选项</Text>
                    <Checkbox
                        checked={showJsondocs}
                        onChange={(e) => setShowJsondocs(e.target.checked)}
                        style={{ color: AppColors.text.white }}
                    >
                        <DatabaseOutlined /> Jsondoc ({projectData.jsondocs.length})
                    </Checkbox>
                    <Checkbox
                        checked={showTransforms}
                        onChange={(e) => setShowTransforms(e.target.checked)}
                        style={{ color: AppColors.text.white }}
                        disabled={!showHumanTransforms && !showLLMTransforms}
                    >
                        Transform ({projectData.transforms.length})
                    </Checkbox>
                    <div style={{ marginLeft: '20px' }}>
                        <Checkbox
                            checked={showHumanTransforms}
                            onChange={(e) => setShowHumanTransforms(e.target.checked)}
                            style={{ color: AppColors.text.white }}
                        >
                            <UserOutlined /> Human Transform
                        </Checkbox>
                        <br />
                        <Checkbox
                            checked={showLLMTransforms}
                            onChange={(e) => setShowLLMTransforms(e.target.checked)}
                            style={{ color: AppColors.text.white }}
                        >
                            <RobotOutlined /> LLM Transform
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