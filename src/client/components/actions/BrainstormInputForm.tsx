import React from 'react';
import { Button, Typography, message } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import { BaseActionProps } from './index';
import { ArtifactEditor } from '../../transform-artifact-framework/ArtifactEditor';

const { Title } = Typography;

interface BrainstormInputFormProps extends BaseActionProps {
    brainstormArtifact: any;
}

const BrainstormInputForm: React.FC<BrainstormInputFormProps> = ({
    projectId,
    brainstormArtifact,
    onSuccess,
    onError
}) => {
    // Field configuration for the brainstorm input form
    const brainstormFields = [
        { field: 'platform', component: 'input' as const, placeholder: '目标平台 (如: 抖音, 快手, 小红书)' },
        { field: 'genre', component: 'input' as const, placeholder: '故事类型 (如: 现代甜宠, 古装复仇)' },
        { field: 'other_requirements', component: 'textarea' as const, rows: 3, placeholder: '其他要求 (角色设定、情节要求、风格偏好等...)' },
        { field: 'numberOfIdeas', component: 'input' as const, placeholder: '创意数量 (1-4)' }
    ];

    const handleStartBrainstorm = () => {
        // TODO: Trigger brainstorm agent with the artifact data
        message.info('即将启动头脑风暴...');
        // For now, just call onSuccess to indicate the action is available
        onSuccess?.();
    };

    return (
        <div style={{ padding: '24px' }}>
            <Title level={4} style={{ marginBottom: '24px', color: '#fff', textAlign: 'center' }}>
                <BulbOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                头脑风暴要求
            </Title>

            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <ArtifactEditor
                    artifactId={brainstormArtifact.id}
                    fields={brainstormFields}
                    className="brainstorm-input-editor"
                    onSaveSuccess={() => {
                        message.success('参数已保存');
                    }}
                />

                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                    <Button
                        type="primary"
                        size="large"
                        style={{
                            width: '200px',
                            height: '48px',
                            fontSize: '16px',
                            borderRadius: '8px'
                        }}
                        onClick={handleStartBrainstorm}
                    >
                        开始头脑风暴
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default BrainstormInputForm; 