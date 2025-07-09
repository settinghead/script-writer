import React from 'react';
import { Card, Typography, Alert } from 'antd';

const { Title, Text } = Typography;

export const YJSDemo: React.FC = () => {
    return (
        <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
            <Title level={2}>YJS 协作编辑演示</Title>

            <Alert
                message="YJS 功能暂时禁用"
                description="由于 Electric SQL 数据格式问题，YJS 协作编辑功能暂时禁用。我们正在解决 JSON 解析错误。"
                type="warning"
                showIcon
                style={{ marginBottom: '24px' }}
            />

            <Card title="功能说明">
                <Text>
                    YJS 协作编辑功能允许多个用户同时编辑同一个文档，并实时同步更改。
                    一旦解决了数据格式问题，此功能将重新启用。
                </Text>
            </Card>
        </div>
    );
};

export default YJSDemo; 