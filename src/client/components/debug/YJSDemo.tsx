import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Typography, Alert, Divider } from 'antd';
import { YJSEditableText } from '../shared/YJSEditableText';
import { useProjectData } from '../../contexts/ProjectDataContext';

const { Title, Text } = Typography;

export const YJSDemo: React.FC = () => {
    const [testArtifactId, setTestArtifactId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const projectData = useProjectData();

    // Get current project ID from URL or context
    const currentProjectId = React.useMemo(() => {
        // Try to get project ID from current artifacts
        if (Array.isArray(projectData.artifacts) && projectData.artifacts.length > 0) {
            return projectData.artifacts[0].project_id;
        }
        // Fallback to URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const projectFromUrl = window.location.pathname.match(/\/projects\/([^\/]+)/)?.[1];
        return projectFromUrl || urlParams.get('projectId') || 'default-project';
    }, [projectData.artifacts]);

    // Find or create a test artifact for YJS demo
    useEffect(() => {
        console.log('YJSDemo: Looking for existing artifacts...');
        console.log('Current project ID:', currentProjectId);
        console.log('Available artifacts:', projectData.artifacts);

        if (Array.isArray(projectData.artifacts)) {
            const existingArtifact = projectData.artifacts.find((a: any) => {
                console.log('Checking artifact:', a.id, a.data);

                // Handle both string and object data formats
                let artifactData = a.data;
                if (typeof artifactData === 'string') {
                    try {
                        artifactData = JSON.parse(artifactData);
                    } catch (e) {
                        console.log('Failed to parse artifact data:', artifactData);
                        return false;
                    }
                }

                const isMatch = artifactData &&
                    typeof artifactData === 'object' &&
                    artifactData.title === 'YJS Demo Artifact';

                console.log('Is match?', isMatch, 'Title:', artifactData?.title);
                return isMatch;
            });

            if (existingArtifact) {
                console.log('Found existing YJS demo artifact:', existingArtifact.id);
                console.log('Artifact data:', existingArtifact.data);
                setTestArtifactId(existingArtifact.id);
            } else {
                console.log('No existing YJS demo artifact found');
            }
        }
    }, [projectData.artifacts, currentProjectId]);

    const createTestArtifact = async () => {
        setIsCreating(true);
        try {
            // Create a test artifact for YJS demo
            const response = await fetch('/api/artifacts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                },
                body: JSON.stringify({
                    projectId: currentProjectId,
                    type: 'user_input',
                    data: {
                        title: 'YJS Demo Artifact',
                        body: 'This is a demo artifact for testing YJS collaborative editing. Click to edit this content collaboratively!'
                    },
                    typeVersion: 'v1',
                    metadata: { demo: true }
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Create artifact response:', result);

                if (result.artifact && result.artifact.id) {
                    console.log('Created YJS demo artifact:', result.artifact);
                    setTestArtifactId(result.artifact.id);

                    // Force a small delay to allow Electric SQL to sync
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } else {
                    console.error('Artifact creation succeeded but no artifact ID returned:', result);
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('Failed to create test artifact:', errorData);
            }
        } catch (error) {
            console.error('Error creating test artifact:', error);
        } finally {
            setIsCreating(false);
        }
    };

    if (!testArtifactId) {
        return (
            <Card title="YJS Collaborative Editing Demo" style={{ maxWidth: 800, margin: '20px auto' }}>
                <Alert
                    message="No Demo Artifact Found"
                    description="Create a test artifact to demonstrate YJS collaborative editing features."
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                />

                <Button
                    type="primary"
                    onClick={createTestArtifact}
                    loading={isCreating}
                >
                    Create Demo Artifact
                </Button>
            </Card>
        );
    }

    return (
        <div style={{ maxWidth: 800, margin: '20px auto' }}>
            <Card title="YJS Collaborative Editing Demo" style={{ marginBottom: 16 }}>
                <Alert
                    message="Real-time Collaborative Editing"
                    description="The fields below use YJS for real-time collaborative editing. Open this page in multiple tabs to see changes sync instantly!"
                    type="success"
                    showIcon
                    style={{ marginBottom: 16 }}
                />

                <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <div>
                        <Title level={5}>Title Field</Title>
                        <YJSEditableText
                            artifactId={testArtifactId}
                            field="title"
                            placeholder="Enter a title..."
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div>
                        <Title level={5}>Body Field (Multiline)</Title>
                        <YJSEditableText
                            artifactId={testArtifactId}
                            field="body"
                            placeholder="Enter body content..."
                            multiline={true}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <Divider />

                    <div>
                        <Title level={5}>Non-Collaborative Field (Fallback)</Title>
                        <Text type="secondary">
                            This field has collaboration disabled and will fall back to regular editing:
                        </Text>
                        <YJSEditableText
                            artifactId={testArtifactId}
                            field="title"
                            placeholder="This field doesn't use YJS..."
                            enableCollaboration={false}
                            style={{ width: '100%', marginTop: 8 }}
                        />
                    </div>
                </Space>
            </Card>

            <Card title="How to Test" size="small">
                <Space direction="vertical" size="small">
                    <Text>• Open this page in multiple browser tabs</Text>
                    <Text>• Edit any field in one tab</Text>
                    <Text>• Watch the changes appear instantly in other tabs</Text>
                    <Text>• Notice the blue "⚡ Live" indicator on collaborative fields</Text>
                    <Text>• Try editing the same field simultaneously in different tabs</Text>
                </Space>
            </Card>
        </div>
    );
}; 