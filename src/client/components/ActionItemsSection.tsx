import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

const ActionItemsSection: React.FC = () => {
    return (
        <div style={{
            background: '#1a1a1a',
            borderTop: '1px solid #333',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 12px',
            flexShrink: 0
        }}>
            <Text type="secondary" style={{ fontSize: '16px', fontWeight: 500 }}>
                Action Items Placeholder
            </Text>
        </div>
    );
};

export default ActionItemsSection; 