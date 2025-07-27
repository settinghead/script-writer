import React from 'react';
import { Typography } from 'antd';
import {
    BulbOutlined,
    UserOutlined,
    FileTextOutlined,
    HistoryOutlined,
    VideoCameraOutlined,
    PlayCircleOutlined,
    EditOutlined,
    DatabaseOutlined
} from '@ant-design/icons';
import { ColorUtils } from '../../../common/theme/colors';

const { Text } = Typography;

interface SchemaTypeIconProps {
    schemaType: string;
    originType?: string;
    showText?: boolean;
    size?: 'small' | 'default' | 'large';
    style?: React.CSSProperties;
}

const iconMap = {
    BulbOutlined,
    UserOutlined,
    FileTextOutlined,
    HistoryOutlined,
    VideoCameraOutlined,
    PlayCircleOutlined,
    EditOutlined,
    DatabaseOutlined
};

const sizeMap = {
    small: 12,
    default: 14,
    large: 16
};

export const SchemaTypeIcon: React.FC<SchemaTypeIconProps> = ({
    schemaType,
    originType,
    showText = false,
    size = 'default',
    style = {}
}) => {
    const iconName = ColorUtils.getSchemaTypeIcon(schemaType);
    const IconComponent = iconMap[iconName as keyof typeof iconMap] || DatabaseOutlined;
    const color = ColorUtils.getJsondocColor(schemaType, originType);
    const displayName = ColorUtils.getSchemaTypeDisplayName(schemaType);
    const iconSize = sizeMap[size];

    if (showText) {
        return (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', ...style }}>
                <IconComponent 
                    style={{ 
                        color, 
                        fontSize: iconSize
                    }} 
                />
                <Text 
                    style={{ 
                        color, 
                        fontSize: iconSize,
                        fontWeight: 500
                    }}
                >
                    {displayName}
                </Text>
            </span>
        );
    }

    return (
        <IconComponent 
            style={{ 
                color, 
                fontSize: iconSize,
                ...style
            }} 
            title={displayName}
        />
    );
};

export default SchemaTypeIcon; 