import React from 'react';
import { Card, Typography } from 'antd';

const { Text } = Typography;

interface StageDetailViewProps {
    scriptId: string;
    stageId: string;
    onGenerateStart: (stageId: string, sessionId: string, transformId: string) => void;
}

export const StageDetailView: React.FC<StageDetailViewProps> = ({
    scriptId,
    stageId,
    onGenerateStart
}) => {
    return (
        <Card title="阶段详情" style={{ backgroundColor: '#161b22', border: '1px solid #303030' }}>
            <Text style={{ color: '#e6edf3' }}>
                阶段详情组件开发中... Script ID: {scriptId}, Stage ID: {stageId}
            </Text>
        </Card>
    );
}; 