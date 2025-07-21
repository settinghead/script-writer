import React, { useEffect, useState } from 'react';
import { Card, Typography, Button, Space } from 'antd';
import { useProjectData } from '../contexts/ProjectDataContext';

const { Title, Text } = Typography;

interface ElectricSQLDebuggerProps {
    projectId: string;
}

export const ElectricSQLDebugger: React.FC<ElectricSQLDebuggerProps> = ({ projectId }) => {
    const projectData = useProjectData();
    const [updateCount, setUpdateCount] = useState(0);
    const [lastUpdate, setLastUpdate] = useState<string>('');

    // Track when Electric SQL data changes
    useEffect(() => {
        if (Array.isArray(projectData.jsondocs)) {
            const patchJsondocs = projectData.jsondocs.filter((j: any) => j.schema_type === 'json_patch');
            if (patchJsondocs.length > 0) {
                setUpdateCount(prev => prev + 1);
                setLastUpdate(new Date().toLocaleTimeString());
                console.log(`[ElectricSQLDebugger] Electric SQL data updated! Found ${patchJsondocs.length} patch jsondocs`);
            }
        }
    }, [projectData.jsondocs?.length, Array.isArray(projectData.jsondocs) ? JSON.stringify(projectData.jsondocs.filter((j: any) => j.schema_type === 'json_patch')) : '']);

    const patchJsondocs = Array.isArray(projectData.jsondocs)
        ? projectData.jsondocs.filter((j: any) => j.schema_type === 'json_patch')
        : [];

    const aiPatchTransforms = Array.isArray(projectData.transforms)
        ? projectData.transforms.filter((t: any) => t.type === 'ai_patch')
        : [];

    return (
        <Card
            title="Electric SQL Debugger"
            size="small"
            style={{
                position: 'fixed',
                top: 10,
                right: 10,
                width: 300,
                zIndex: 1000,
                backgroundColor: '#001529'
            }}
        >
            <Space direction="vertical" size="small">
                <div>
                    <Text strong>Project ID:</Text>
                    <br />
                    <Text code>{projectId}</Text>
                </div>

                <div>
                    <Text strong>Electric SQL Status:</Text>
                    <br />
                    <Text type={projectData.isLoading ? 'warning' : 'success'}>
                        {projectData.isLoading ? 'Loading...' : 'Connected'}
                    </Text>
                </div>

                <div>
                    <Text strong>Total Jsondocs:</Text>
                    <br />
                    <Text>{Array.isArray(projectData.jsondocs) ? projectData.jsondocs.length : 'N/A'}</Text>
                </div>

                <div>
                    <Text strong>Patch Jsondocs:</Text>
                    <br />
                    <Text type={patchJsondocs.length > 0 ? 'success' : 'secondary'}>
                        {patchJsondocs.length}
                    </Text>
                </div>

                <div>
                    <Text strong>AI Patch Transforms:</Text>
                    <br />
                    <Text type={aiPatchTransforms.length > 0 ? 'success' : 'secondary'}>
                        {aiPatchTransforms.length}
                    </Text>
                </div>

                <div>
                    <Text strong>Updates Detected:</Text>
                    <br />
                    <Text>{updateCount}</Text>
                </div>

                {lastUpdate && (
                    <div>
                        <Text strong>Last Update:</Text>
                        <br />
                        <Text type="success">{lastUpdate}</Text>
                    </div>
                )}

                <Button
                    size="small"
                    onClick={() => {
                        setUpdateCount(0);
                        setLastUpdate('');
                    }}
                >
                    Reset Counter
                </Button>
            </Space>
        </Card>
    );
}; 