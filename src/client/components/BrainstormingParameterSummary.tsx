import React from 'react';
import { Typography, Divider, Tag, Space } from 'antd';

const { Text } = Typography;

interface BrainstormingParameterSummaryProps {
    selectedPlatform: string;
    selectedGenrePaths: string[][];
    requirements: string;
}

const BrainstormingParameterSummary: React.FC<BrainstormingParameterSummaryProps> = ({
    selectedPlatform,
    selectedGenrePaths,
    requirements
}) => {
    const buildGenreDisplayElements = (): React.ReactElement[] => {
        return selectedGenrePaths.map((path, index) => {
            const genreText = path.join(' > ');
            return (
                <Tag key={index} color="blue" style={{ fontSize: '11px' }}>
                    {genreText}
                </Tag>
            );
        });
    };

    return (
        <div style={{
            padding: '12px 16px',
            background: '#262626',
            border: '1px solid #404040',
            borderRadius: '8px',
            marginBottom: '16px'
        }}>
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                alignItems: 'center',
                fontSize: '13px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>平台:</Text>
                    <Text style={{ color: '#d9d9d9', fontSize: '12px' }}>
                        {selectedPlatform || '通用'}
                    </Text>
                </div>

                <Divider type="vertical" style={{ background: '#404040', margin: '0' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>类型:</Text>
                    {selectedGenrePaths.length > 0 ? (
                        <Space wrap size="small">
                            {buildGenreDisplayElements()}
                        </Space>
                    ) : (
                        <Text style={{ color: '#d9d9d9', fontSize: '12px' }}>
                            未指定
                        </Text>
                    )}
                </div>

                {requirements && (
                    <>
                        <Divider type="vertical" style={{ background: '#404040', margin: '0' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Text type="secondary" style={{ fontSize: '12px' }}>要求:</Text>
                            <Text style={{
                                color: '#d9d9d9',
                                fontSize: '12px',
                                maxWidth: '200px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}>
                                {requirements}
                            </Text>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default BrainstormingParameterSummary; 