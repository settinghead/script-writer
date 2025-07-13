import React from 'react';
import { Typography, Spin } from 'antd';
import { useProjectData } from '../contexts/ProjectDataContext';
import { ArrowDown } from 'lucide-react';

const { Text } = Typography;

interface ProjectCreationFormProps {
    projectId: string;
    onCreated?: (jsondocId: string) => void;
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
        <div style={{ textAlign: 'center', padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Text type="secondary" >
                <ArrowDown
                    size={128}
                    style={{
                        marginTop: '32px',
                        animation: 'float 2s ease-in-out infinite'
                    }}
                />
            </Text>
            <style >{`
                @keyframes float {
                    0%, 100% {
                        transform: translateY(0px);
                    }
                    50% {
                        transform: translateY(-10px);
                    }
                }
            `}</style>
        </div>
    );
}; 