import React from 'react';
import { Card, Typography, Row, Col, Space, Divider } from 'antd';
import SchemaTypeIcon from '../shared/SchemaTypeIcon';

const { Title, Text } = Typography;

export const SchemaTypeIconDemo: React.FC = () => {
    const schemaTypes = [
        { type: '灵感创意', originType: 'llm' },
        { type: 'brainstorm_collection', originType: 'llm' },
        { type: 'brainstorm_input_params', originType: 'human' },
        { type: '剧本设定', originType: 'llm' },
        { type: 'chronicles', originType: 'llm' },
        { type: '分集结构', originType: 'llm' },
        { type: '单集大纲', originType: 'llm' },
        { type: '单集剧本', originType: 'llm' },
        { type: 'json_patch', originType: undefined },
        { type: 'outline_input', originType: 'human' },
        { type: 'user_input', originType: 'human' }
    ];

    return (
        <Card style={{ margin: '20px', backgroundColor: '#1f1f1f' }}>
            <Title level={3} style={{ color: '#fff', textAlign: 'center' }}>
                Schema Type Icons Demo
            </Title>

            <Divider style={{ borderColor: '#434343' }} />

            <Row gutter={[16, 16]}>
                {schemaTypes.map((schema, index) => (
                    <Col xs={24} sm={12} md={8} lg={6} key={index}>
                        <Card
                            size="small"
                            style={{
                                backgroundColor: '#262626',
                                border: '1px solid #434343',
                                minHeight: '120px'
                            }}
                        >
                            <Space direction="vertical" align="center" style={{ width: '100%' }}>
                                {/* Large icon */}
                                <SchemaTypeIcon
                                    schemaType={schema.type}
                                    originType={schema.originType}
                                    size="large"
                                />

                                {/* With text */}
                                <SchemaTypeIcon
                                    schemaType={schema.type}
                                    originType={schema.originType}
                                    showText={true}
                                    size="default"
                                />

                                {/* Raw schema type for reference */}
                                <Text style={{
                                    fontSize: '10px',
                                    color: '#666',
                                    fontFamily: 'monospace',
                                    textAlign: 'center'
                                }}>
                                    {schema.type}
                                </Text>
                            </Space>
                        </Card>
                    </Col>
                ))}
            </Row>

            <Divider style={{ borderColor: '#434343' }} />

            <div style={{ textAlign: 'center' }}>
                <Text style={{ color: '#aaa' }}>
                    Icons are automatically colored based on schema type and origin (human vs AI)
                </Text>
            </div>
        </Card>
    );
};

export default SchemaTypeIconDemo; 