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
import { useWorkflowNodes } from '../transform-jsonDoc-framework/useLineageResolution';
import { useCurrentSection, type CurrentSection } from '../hooks/useCurrentSection';
import type { WorkflowNode } from '../../common/transform-jsonDoc-framework/lineageResolution';



interface WorkflowVisualizationProps {
    width?: number;
}

// Convert WorkflowNode to ReactFlow Node
const createReactFlowNode = (workflowNode: WorkflowNode, currentSection: CurrentSection): Node => {
    const getNodeColor = (type: WorkflowNode['schemaType'], isHighlighted: boolean) => {
        // Define colorful scheme for when node is highlighted
        const colorfulColors = {
            brainstorm_input: {
                gradient: 'linear-gradient(135deg, #1890ff 0%, #40a9ff 50%, #69c0ff 100%)',
                shadow: 'rgba(24, 144, 255, 0.3)'
            },
            brainstorm_collection: {
                gradient: 'linear-gradient(135deg, #1890ff 0%, #40a9ff 50%, #69c0ff 100%)',
                shadow: 'rgba(24, 144, 255, 0.3)'
            },
            brainstorm_idea: {
                gradient: 'linear-gradient(135deg, #52c41a 0%, #73d13d 50%, #95de64 100%)',
                shadow: 'rgba(82, 196, 26, 0.3)'
            },
            outline: {
                gradient: 'linear-gradient(135deg, #722ed1 0%, #9254de 50%, #b37feb 100%)',
                shadow: 'rgba(114, 46, 209, 0.3)'
            },
            chronicles: {
                gradient: 'linear-gradient(135deg, #faad14 0%, #ffc53d 50%, #ffd666 100%)',
                shadow: 'rgba(250, 173, 20, 0.3)'
            },
            episode: {
                gradient: 'linear-gradient(135deg, #fa541c 0%, #ff7a45 50%, #ffa39e 100%)',
                shadow: 'rgba(250, 84, 28, 0.3)'
            },
            script: {
                gradient: 'linear-gradient(135deg, #13c2c2 0%, #36cfc9 50%, #87e8de 100%)',
                shadow: 'rgba(19, 194, 194, 0.3)'
            }
        };

        // Define monochrome scheme for default state
        const monochromeColors = {
            brainstorm_input: {
                gradient: 'linear-gradient(135deg, #404040 0%, #505050 50%, #606060 100%)',
                shadow: 'rgba(64, 64, 64, 0.2)'
            },
            brainstorm_collection: {
                gradient: 'linear-gradient(135deg, #404040 0%, #505050 50%, #606060 100%)',
                shadow: 'rgba(64, 64, 64, 0.2)'
            },
            brainstorm_idea: {
                gradient: 'linear-gradient(135deg, #454545 0%, #555555 50%, #656565 100%)',
                shadow: 'rgba(69, 69, 69, 0.2)'
            },
            outline: {
                gradient: 'linear-gradient(135deg, #484848 0%, #585858 50%, #686868 100%)',
                shadow: 'rgba(72, 72, 72, 0.2)'
            },
            chronicles: {
                gradient: 'linear-gradient(135deg, #4a4a4a 0%, #5a5a5a 50%, #6a6a6a 100%)',
                shadow: 'rgba(74, 74, 74, 0.2)'
            },
            episode: {
                gradient: 'linear-gradient(135deg, #424242 0%, #525252 50%, #626262 100%)',
                shadow: 'rgba(66, 66, 66, 0.2)'
            },
            script: {
                gradient: 'linear-gradient(135deg, #464646 0%, #565656 50%, #666666 100%)',
                shadow: 'rgba(70, 70, 70, 0.2)'
            }
        };

        return isHighlighted ? colorfulColors[type] : monochromeColors[type];
    };

    // Determine if this node should be highlighted based on current section
    const shouldHighlight = (): boolean => {
        if (!currentSection) {
            console.log(`[shouldHighlight] No current section for ${workflowNode.title}`);
            return false;
        }

        // Map navigation targets to sections
        const sectionMap: Record<string, CurrentSection> = {
            '#brainstorm-ideas': 'brainstorm-ideas',
            '#outline-settings': 'outline-settings',
            '#chronicles': 'chronicles'
        };

        const nodeSection = sectionMap[workflowNode.navigationTarget];
        const shouldHighlightResult = nodeSection === currentSection;

        console.log(`[shouldHighlight] ${workflowNode.title}:`, {
            navigationTarget: workflowNode.navigationTarget,
            nodeSection,
            currentSection,
            shouldHighlight: shouldHighlightResult
        });

        return shouldHighlightResult;
    };

    const getNodeIcon = (type: WorkflowNode['schemaType']) => {
        const icons = {
            brainstorm_input: '📝',
            brainstorm_collection: '💡',
            brainstorm_idea: '📝',
            outline: '📋',
            chronicles: '📚',
            episode: '🎬',
            script: '📄'
        };
        return icons[type];
    };

    const isHighlighted = shouldHighlight();
    const colorScheme = getNodeColor(workflowNode.schemaType, isHighlighted);
    const icon = getNodeIcon(workflowNode.schemaType);

    return {
        id: workflowNode.id,
        type: 'default',
        data: {
            label: (
                <div style={{
                    padding: '12px 18px',
                    background: colorScheme.gradient,
                    borderRadius: '12px',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: `0 4px 12px ${colorScheme.shadow}, 0 2px 6px ${colorScheme.shadow}`,
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease-in-out', // Smooth transition for color changes
                    opacity: workflowNode.isMain ? 1 : 0.6,
                    transform: isHighlighted ? 'scale(1.02)' : 'scale(1)' // Subtle scale effect for active nodes
                }}>
                    {icon} {workflowNode.title}
                    {workflowNode.status === 'processing' && (
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#fff',
                            marginLeft: '4px',
                            animation: 'pulse 1.5s ease-in-out infinite'
                        }} />
                    )}
                </div>
            )
        },
        position: workflowNode.position,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        style: {
            background: 'transparent',
            border: 'none',
            width: 200,
        },
    };
};

// Create edges between workflow nodes
const createWorkflowEdges = (workflowNodes: WorkflowNode[]): Edge[] => {
    const edges: Edge[] = [];

    for (let i = 0; i < workflowNodes.length - 1; i++) {
        const sourceNode = workflowNodes[i];
        const targetNode = workflowNodes[i + 1];

        edges.push({
            id: `edge-${sourceNode.id}-${targetNode.id}`,
            source: sourceNode.id,
            target: targetNode.id,
            type: 'default',
            style: {
                stroke: '#666',
                strokeWidth: 2,
            },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#666',
            },
            sourceHandle: 'bottom',
            targetHandle: 'top',
        });
    }

    return edges;
};

const WorkflowVisualization: React.FC<WorkflowVisualizationProps> = ({
    width = 300
}) => {

    // Get real workflow data
    const { workflowNodes, isLoading, error } = useWorkflowNodes();

    // Get current section for highlighting
    const currentSection = useCurrentSection();

    // Debug current section
    React.useEffect(() => {
        console.log('[WorkflowVisualization] Current section changed:', currentSection);
    }, [currentSection]);

    // Convert workflow nodes to ReactFlow format
    const reactFlowNodes = useMemo(() => {
        if (workflowNodes === "pending" || workflowNodes === "error") {
            return [];
        }
        return workflowNodes.map(workflowNode => {
            const node = createReactFlowNode(workflowNode, currentSection);

            return node;
        });
    }, [workflowNodes, currentSection]);

    const reactFlowEdges = useMemo(() => {
        if (workflowNodes === "pending" || workflowNodes === "error") {
            return [];
        }
        return createWorkflowEdges(workflowNodes);
    }, [workflowNodes]);

    // Use ReactFlow state management
    const [nodes, setNodes, onNodesChange] = useNodesState(reactFlowNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(reactFlowEdges);

    // Update nodes when workflow data changes
    React.useEffect(() => {
        setNodes(reactFlowNodes);
    }, [reactFlowNodes, setNodes]);

    // Update edges when workflow data changes
    React.useEffect(() => {
        setEdges(reactFlowEdges);
    }, [reactFlowEdges, setEdges]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const proOptions = useMemo(() => ({ hideAttribution: true }), []);

    // Handle node clicks for navigation
    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        if (workflowNodes === "pending" || workflowNodes === "error") {
            return;
        }
        const workflowNode = workflowNodes.find(wn => wn.id === node.id);
        if (workflowNode?.navigationTarget) {
            // First try to scroll to existing element on current page
            const targetElement = document.querySelector(workflowNode.navigationTarget);
            if (targetElement) {
                // Element exists on current page - scroll to it
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                    inline: 'nearest'
                });

                // Update URL hash for bookmarkable navigation
                const hash = workflowNode.navigationTarget;
                if (hash.startsWith('#')) {
                    window.history.replaceState(null, '', hash);
                }
            } else {
                // Element doesn't exist - might need to navigate to different route
                // For now, just log - we can enhance this later when we have more routes
                console.log(`Navigation target not found: ${workflowNode.navigationTarget}`);
                console.log('Available elements:', document.querySelectorAll('[id]'));
            }
        }
    }, [workflowNodes]);



    // Show loading state
    if (isLoading) {
        return (
            <div style={{
                height: '100%',
                width: `${width}px`,
                border: '1px solid #333',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #2a2a2a 100%)'
            }}>
                <div style={{ textAlign: 'center', color: '#666' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚡</div>
                    <div style={{ fontSize: '12px' }}>加载工作流...</div>
                </div>
            </div>
        );
    }

    // Show error state
    if (error) {
        return (
            <div style={{
                height: '100%',
                width: `${width}px`,
                border: '1px solid #333',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #2a2a2a 100%)'
            }}>
                <div style={{ textAlign: 'center', color: '#ff4d4f' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
                    <div style={{ fontSize: '12px' }}>工作流加载失败</div>
                </div>
            </div>
        );
    }

    // Show empty state
    if (workflowNodes.length === 0) {
        return (
            <div style={{
                height: '100%',
                width: `${width}px`,
                border: '1px solid #333',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #2a2a2a 100%)'
            }}>
                <div style={{ textAlign: 'center', color: '#666' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>🚀</div>
                    <div style={{ fontSize: '12px' }}>开始创作流程</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            height: '100%',
            width: `${width}px`,
            border: '1px solid #333',
            borderRadius: '8px',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #2a2a2a 100%)'
        }}>
            <style>{`
        .react-flow__node-default .react-flow__handle-left,
        .react-flow__node-default .react-flow__handle-right {
          display: none;
        }
        .react-flow__node-default .react-flow__handle-top,
        .react-flow__node-default .react-flow__handle-bottom {
          opacity: 0;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                proOptions={proOptions}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={true}
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