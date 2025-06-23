import React, { useCallback, useMemo } from 'react';
import {
    ReactFlow,
    Node,
    Edge,
    addEdge,
    Connection,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    BackgroundVariant,
    MiniMap,
    MarkerType,
    Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

const initialNodes: Node[] = [
    {
        id: '1',
        type: 'default',
        data: {
            label: (
                <div style={{
                    padding: '12px 18px',
                    background: 'linear-gradient(135deg, #1890ff 0%, #40a9ff 50%, #69c0ff 100%)',
                    borderRadius: '12px',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3), 0 2px 6px rgba(24, 144, 255, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)'
                }}>
                    💡 创意构思
                </div>
            )
        },
        position: { x: 100, y: 100 },
        sourcePosition: Position.Right,
        style: {
            background: 'transparent',
            border: 'none',
            width: 150,
        },
    },
    {
        id: '2',
        type: 'default',
        data: {
            label: (
                <div style={{
                    padding: '12px 18px',
                    background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 50%, #95de64 100%)',
                    borderRadius: '12px',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(82, 196, 26, 0.3), 0 2px 6px rgba(82, 196, 26, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)'
                }}>
                    📝 大纲生成
                </div>
            )
        },
        position: { x: 360, y: 100 },
        targetPosition: Position.Left,
        style: {
            background: 'transparent',
            border: 'none',
            width: 150,
        },
    },
];

const initialEdges: Edge[] = [
    {
        id: 'e1-2',
        source: '1',
        target: '2',
        type: 'smoothstep',
        style: {
            stroke: 'url(#edge-gradient)',
            strokeWidth: 3,
        },
        markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#40a9ff',
        },
    },
];

interface WorkflowVisualizationProps {
    height?: number;
}

const WorkflowVisualization: React.FC<WorkflowVisualizationProps> = ({
    height = 200
}) => {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const proOptions = useMemo(() => ({ hideAttribution: true }), []);

    return (
        <div style={{
            height: `${height}px`,
            border: '1px solid #333',
            borderRadius: '8px',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #2a2a2a 100%)'
        }}>
            <style>{`
        .react-flow__node-default .react-flow__handle-top,
        .react-flow__node-default .react-flow__handle-bottom {
          display: none;
        }
        .react-flow__node-default .react-flow__handle-left,
        .react-flow__node-default .react-flow__handle-right {
          opacity: 0;
        }
      `}</style>
            <svg width="0" height="0">
                <defs>
                    <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#1890ff" />
                        <stop offset="50%" stopColor="#40a9ff" />
                        <stop offset="100%" stopColor="#52c41a" />
                    </linearGradient>
                </defs>
            </svg>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                proOptions={proOptions}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag={true}
                zoomOnScroll={true}
                zoomOnPinch={true}
                zoomOnDoubleClick={true}
                minZoom={0.5}
                maxZoom={2}
                style={{ background: 'transparent' }}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1}
                    color="#333"
                />
                <Controls
                    style={{
                        background: '#0a0a0a',
                        border: '1px solid #333',
                    }}
                />
                <MiniMap
                    style={{
                        background: '#0a0a0a',
                        border: '1px solid #333',
                    }}
                    nodeColor="#666"
                    maskColor="rgba(0, 0, 0, 0.6)"
                />
            </ReactFlow>
        </div>
    );
};

export default WorkflowVisualization; 