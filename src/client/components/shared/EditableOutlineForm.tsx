import React from 'react';
import { Typography, Space } from 'antd';
import { UserOutlined, HeartOutlined, StarOutlined, EnvironmentOutlined, TeamOutlined } from '@ant-design/icons';
import { YJSTextField, YJSTextAreaField, YJSArrayField, YJSCharacterArray } from '../../transform-artifact-framework/components/YJSField';

const { Text } = Typography;

/**
 * YJS-enabled editable form component for outline settings
 * This component is designed to be used within a YJSArtifactProvider
 * Uses the new subscription-based approach with useYJSField
 */
export const EditableOutlineForm: React.FC = () => {
    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Basic Information */}
            <div>
                <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                    📊 基本信息
                </Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                        <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>剧本标题：</Text>
                        <YJSTextField
                            path="title"
                            placeholder="剧本标题"
                        />
                    </div>
                    <div>
                        <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>剧本类型：</Text>
                        <YJSTextField
                            path="genre"
                            placeholder="剧本类型"
                        />
                    </div>
                </div>
            </div>

            {/* Target Audience */}
            <div>
                <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                    <UserOutlined style={{ marginRight: '8px' }} />
                    目标观众
                </Text>
                <div>
                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>目标群体：</Text>
                    <YJSTextField
                        path="target_audience.demographic"
                        placeholder="目标群体"
                    />
                </div>
                <div style={{ marginTop: '12px' }}>
                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>核心主题：</Text>
                    <YJSArrayField
                        path="target_audience.core_themes"
                        placeholder="每行一个主题..."
                    />
                </div>
            </div>

            {/* Selling Points */}
            <div>
                <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                    <HeartOutlined style={{ marginRight: '8px' }} />
                    卖点
                </Text>
                <YJSArrayField
                    path="selling_points"
                    placeholder="每行一个卖点..."
                />
            </div>

            {/* Satisfaction Points */}
            <div>
                <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                    <StarOutlined style={{ marginRight: '8px' }} />
                    爽点
                </Text>
                <YJSArrayField
                    path="satisfaction_points"
                    placeholder="每行一个爽点..."
                />
            </div>

            {/* Setting */}
            <div>
                <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                    <EnvironmentOutlined style={{ marginRight: '8px' }} />
                    故事设定
                </Text>
                <div style={{ marginBottom: '12px' }}>
                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>核心设定：</Text>
                    <YJSTextAreaField
                        path="setting.core_setting_summary"
                        placeholder="核心设定"
                        rows={3}
                    />
                </div>
                <div>
                    <Text strong style={{ fontSize: '14px', color: '#fff', display: 'block', marginBottom: '4px' }}>关键场景：</Text>
                    <YJSArrayField
                        path="setting.key_scenes"
                        placeholder="每行一个关键场景..."
                    />
                </div>
            </div>

            {/* Characters */}
            <div>
                <Text strong style={{ fontSize: '16px', color: '#fff', display: 'block', marginBottom: '12px' }}>
                    <TeamOutlined style={{ marginRight: '8px' }} />
                    角色设定
                </Text>
                <YJSCharacterArray path="characters" />
            </div>
        </Space>
    );
}; 