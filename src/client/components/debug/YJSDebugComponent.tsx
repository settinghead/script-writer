import React, { useEffect, useState } from 'react';
import { Card, Typography, Space, Divider } from 'antd';
import { useYJSArtifact } from '../../transform-artifact-framework/hooks/useYJSArtifact';
import { YJSArtifactProvider, useYJSField } from '../../transform-artifact-framework/contexts/YJSArtifactContext';

const { Title, Text, Paragraph } = Typography;

// Component to test YJS field access
const YJSFieldTester: React.FC = () => {
    const titleField = useYJSField('title');
    const bodyField = useYJSField('body');

    return (
        <Space direction="vertical" style={{ width: '100%' }}>
            <div>
                <Text strong>Title Field:</Text>
                <Paragraph>
                    Value: {JSON.stringify(titleField.value)}
                </Paragraph>
                <Paragraph>
                    Initialized: {titleField.isInitialized.toString()}
                </Paragraph>
            </div>

            <div>
                <Text strong>Body Field:</Text>
                <Paragraph>
                    Value: {JSON.stringify(bodyField.value)}
                </Paragraph>
                <Paragraph>
                    Initialized: {bodyField.isInitialized.toString()}
                </Paragraph>
            </div>
        </Space>
    );
};

// Main debug component
export const YJSDebugComponent: React.FC<{ artifactId: string }> = ({ artifactId }) => {
    const [hookData, setHookData] = useState<any>(null);
    const { data, artifact, isLoading, error, isConnected, updateField } = useYJSArtifact(artifactId);

    useEffect(() => {
        setHookData({
            data,
            artifact: artifact ? {
                id: artifact.id,
                schema_type: artifact.schema_type,
                origin_type: artifact.origin_type,
                data: artifact.data
            } : null,
            isLoading,
            error,
            isConnected
        });
    }, [data, artifact, isLoading, error, isConnected]);

    return (
        <Card title="YJS Debug Information" style={{ margin: '20px' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                    <Title level={4}>Hook Data</Title>
                    <Paragraph>
                        <Text strong>Is Loading:</Text> {isLoading.toString()}
                    </Paragraph>
                    <Paragraph>
                        <Text strong>Is Connected:</Text> {isConnected.toString()}
                    </Paragraph>
                    <Paragraph>
                        <Text strong>Error:</Text> {error || 'None'}
                    </Paragraph>
                    <Paragraph>
                        <Text strong>YJS Data:</Text>
                        <pre>{JSON.stringify(data, null, 2)}</pre>
                    </Paragraph>
                    <Paragraph>
                        <Text strong>Artifact Data:</Text>
                        <pre>{JSON.stringify(artifact?.data, null, 2)}</pre>
                    </Paragraph>
                </div>

                <Divider />

                <div>
                    <Title level={4}>YJS Field Access Test</Title>
                    <YJSArtifactProvider artifactId={artifactId}>
                        <YJSFieldTester />
                    </YJSArtifactProvider>
                </div>
            </Space>
        </Card>
    );
}; 