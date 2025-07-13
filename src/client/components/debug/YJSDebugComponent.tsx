import React, { useEffect, useState } from 'react';
import { Card, Typography, Space, Divider } from 'antd';
import { useYJSJsonDoc } from '../../transform-jsonDoc-framework/hooks/useYJSJsonDoc';
import { YJSJsonDocProvider, useYJSField } from '../../transform-jsonDoc-framework/contexts/YJSJsonDocContext';

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
export const YJSDebugComponent: React.FC<{ jsonDocId: string }> = ({ jsonDocId }) => {
    const [hookData, setHookData] = useState<any>(null);
    const { data, jsonDoc, isLoading, error, isConnected, updateField } = useYJSJsonDoc(jsonDocId);

    useEffect(() => {
        setHookData({
            data,
            jsonDoc: jsonDoc ? {
                id: jsonDoc.id,
                schema_type: jsonDoc.schema_type,
                origin_type: jsonDoc.origin_type,
                data: jsonDoc.data
            } : null,
            isLoading,
            error,
            isConnected
        });
    }, [data, jsonDoc, isLoading, error, isConnected]);

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
                        <Text strong>JsonDoc Data:</Text>
                        <pre>{JSON.stringify(jsonDoc?.data, null, 2)}</pre>
                    </Paragraph>
                </div>

                <Divider />

                <div>
                    <Title level={4}>YJS Field Access Test</Title>
                    <YJSJsonDocProvider jsonDocId={jsonDocId}>
                        <YJSFieldTester />
                    </YJSJsonDocProvider>
                </div>
            </Space>
        </Card>
    );
}; 