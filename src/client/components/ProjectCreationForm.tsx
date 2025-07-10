import React from 'react';
import { Typography, Spin } from 'antd';
import { useProjectData } from '../contexts/ProjectDataContext';

const { Text } = Typography;

interface ProjectCreationFormProps {
    projectId: string;
    onCreated?: (artifactId: string) => void;
}

export const ProjectCreationForm: React.FC<ProjectCreationFormProps> = ({
    projectId,
    onCreated
}) => {
    const projectData = useProjectData();

    // Show loading state while project data is loading
    if (projectData.isLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '48px' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px' }}>
                    <Text type="secondary">加载项目信息...</Text>
                </div>
            </div>
        );
    }

    // Show error state
    if (projectData.error) {
        return (
            <div style={{ textAlign: 'center', padding: '48px' }}>
                <Text type="danger">加载项目失败: {typeof projectData.error === 'string' ? projectData.error : '未知错误'}</Text>
            </div>
        );
    }

    // Project is loaded - ActionItemsSection will handle all actions
    return (
        <div style={{ textAlign: 'center', padding: '24px' }}>
            <Text type="secondary">
                <p>项目已创建。</p>
                <p>使用下方的按钮继续。</p>
            </Text>
        </div>
    );
}; 