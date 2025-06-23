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
                    fontSize: '18px',
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
        position: { x: 50, y: 150 },
        sourcePosition: Position.Right,
        style: {
            background: 'transparent',
            border: 'none',
            width: 180,
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
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(82, 196, 26, 0.3), 0 2px 6px rgba(82, 196, 26, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)'
                }}>
                    📝 叙事大纲
                </div>
            )
        },
        position: { x: 280, y: 150 },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
            background: 'transparent',
            border: 'none',
            width: 180,
        },
    },
    {
        id: '3',
        type: 'default',
        data: {
            label: (
                <div style={{
                    padding: '10px 14px',
                    background: 'linear-gradient(135deg, #722ed1 0%, #9254de 50%, #b37feb 100%)',
                    borderRadius: '10px',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 3px 8px rgba(114, 46, 209, 0.3), 0 1px 4px rgba(114, 46, 209, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)'
                }}>
                    🎬 第一幕
                </div>
            )
        },
        position: { x: 510, y: 80 },
        targetPosition: Position.Left,
        style: {
            background: 'transparent',
            border: 'none',
            width: 150,
        },
    },
    {
        id: '4',
        type: 'default',
        data: {
            label: (
                <div style={{
                    padding: '10px 14px',
                    background: 'linear-gradient(135deg, #fa541c 0%, #ff7a45 50%, #ffa39e 100%)',
                    borderRadius: '10px',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 3px 8px rgba(250, 84, 28, 0.3), 0 1px 4px rgba(250, 84, 28, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)'
                }}>
                    🎭 第二幕
                </div>
            )
        },
        position: { x: 510, y: 130 },
        targetPosition: Position.Left,
        style: {
            background: 'transparent',
            border: 'none',
            width: 150,
        },
    },
    {
        id: '5',
        type: 'default',
        data: {
            label: (
                <div style={{
                    padding: '10px 14px',
                    background: 'linear-gradient(135deg, #13c2c2 0%, #36cfc9 50%, #87e8de 100%)',
                    borderRadius: '10px',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 3px 8px rgba(19, 194, 194, 0.3), 0 1px 4px rgba(19, 194, 194, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)'
                }}>
                    🎪 第三幕
                </div>
            )
        },
        position: { x: 510, y: 180 },
        targetPosition: Position.Left,
        style: {
            background: 'transparent',
            border: 'none',
            width: 150,
        },
    },
    {
        id: '6',
        type: 'default',
        data: {
            label: (
                <div style={{
                    padding: '10px 14px',
                    background: 'linear-gradient(135deg, #eb2f96 0%, #f759ab 50%, #ffadd6 100%)',
                    borderRadius: '10px',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 3px 8px rgba(235, 47, 150, 0.3), 0 1px 4px rgba(235, 47, 150, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)'
                }}>
                    🎯 尾声
                </div>
            )
        },
        position: { x: 510, y: 230 },
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
        type: 'default',
        style: {
            stroke: '#666',
            strokeWidth: 3,
        },
        markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#666',
        },
    },
    {
        id: 'e2-3',
        source: '2',
        target: '3',
        type: 'default',
        style: {
            stroke: '#666',
            strokeWidth: 2,
        },
        markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#666',
        },
    },
    {
        id: 'e2-4',
        source: '2',
        target: '4',
        type: 'default',
        style: {
            stroke: '#666',
            strokeWidth: 2,
        },
        markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#666',
        },
    },
    {
        id: 'e2-5',
        source: '2',
        target: '5',
        type: 'default',
        style: {
            stroke: '#666',
            strokeWidth: 2,
        },
        markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#666',
        },
    },
    {
        id: 'e2-6',
        source: '2',
        target: '6',
        type: 'default',
        style: {
            stroke: '#666',
            strokeWidth: 2,
        },
        markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#666',
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

            </ReactFlow>
        </div>
    );
};

export default WorkflowVisualization; 