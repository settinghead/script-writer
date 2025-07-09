import React, { useState, useEffect, HTMLAttributes } from 'react';
import { Breadcrumb as AntBreadcrumb } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { HomeOutlined, BulbOutlined, MessageOutlined, EditOutlined, HistoryOutlined, FileTextOutlined, PlayCircleOutlined, ProjectOutlined } from '@ant-design/icons';
import { useProjectStore } from '../stores/projectStore';

interface BreadcrumbItem {
    title: string;
    icon?: React.ReactNode;
    href?: string;
    onClick?: () => void;
}

const Breadcrumb: React.FC<HTMLAttributes<HTMLDivElement>> = (props) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Extract project ID from URL
    const pathParts = location.pathname.split('/');
    const projectId = pathParts[1] === 'projects' && pathParts[2] ? pathParts[2] : null;

    // Get project title from store
    const projectTitle = useProjectStore(state =>
        projectId ? state.projects[projectId]?.outline?.components?.title || '' : ''
    );

    const generateBreadcrumbItems = (): BreadcrumbItem[] => {
        const items: BreadcrumbItem[] = [
            {
                title: '工作台',
                icon: <HistoryOutlined />,
                onClick: () => navigate('/projects')
            }
        ];

        if (location.pathname === '/projects') {
            // Just show the main workspace item for the home page
            return items;
        } else if (location.pathname.startsWith('/ideation')) {
            const ideationId = location.pathname.split('/')[2];
            if (ideationId) {
                items.push({
                    title: `灵感详情 (${ideationId.slice(0, 8)}...)`,
                    icon: <BulbOutlined />
                });
            } else {
                items.push({
                    title: '新建灵感',
                    icon: <BulbOutlined />
                });
            }
        } else if (location.pathname.startsWith('/new-outline')) {
            items.push({
                title: '设计时间顺序大纲',
                icon: <FileTextOutlined />
            });
        } else if (location.pathname.startsWith('/outlines')) {
            const outlineId = location.pathname.split('/')[2];
            if (outlineId) {
                items.push({
                    title: `时间顺序大纲详情 (${outlineId.slice(0, 8)}...)`,
                    icon: <FileTextOutlined />
                });
            }
        } else if (location.pathname.startsWith('/projects/')) {
            const pathParts = location.pathname.split('/');
            const projectId = pathParts[2];
            const section = pathParts[3];

            // Add project title as second level
            items.push({
                title: projectTitle ? `项目 "${projectTitle}"` : `项目 (${projectId.slice(0, 8)}...)`,
                icon: <ProjectOutlined />,
                onClick: () => navigate(`/projects/${projectId}`)
            });

            if (section === 'outline') {
                items.push({
                    title: '大纲',
                    icon: <FileTextOutlined />,
                    onClick: () => navigate(`/projects/${projectId}/outline`)
                });

                const subsection = pathParts[4];
                if (subsection) {
                    const sectionNames: { [key: string]: string } = {
                        'title': '剧本标题',
                        'genre': '剧本类型',
                        'target-audience': '目标受众',
                        'selling-points': '产品卖点',
                        'satisfaction-points': '情感爽点',
                        'setting': '故事设定',
                        'synopsis-stages': '分段故事梗概',
                        'characters': '角色设定'
                    };
                    items.push({
                        title: sectionNames[subsection] || subsection,
                        icon: <FileTextOutlined />
                    });
                }
            } else if (section === 'episodes') {
                items.push({
                    title: '剧集结构',
                    icon: <PlayCircleOutlined />,
                    onClick: () => navigate(`/projects/${projectId}/episodes`)
                });
            } else if (section === 'stages') {
                const stageId = pathParts[4];
                items.push({
                    title: '剧集结构',
                    icon: <PlayCircleOutlined />,
                    onClick: () => navigate(`/projects/${projectId}/episodes`)
                });

                if (stageId) {
                    items.push({
                        title: `阶段详情`,
                        icon: <PlayCircleOutlined />,
                        onClick: () => navigate(`/projects/${projectId}/stages/${stageId}`)
                    });

                    const episodeSection = pathParts[5];
                    const episodeId = pathParts[6];
                    if (episodeSection === 'episodes' && episodeId) {
                        items.push({
                            title: `第${episodeId}集`,
                            icon: <PlayCircleOutlined />,
                            onClick: () => navigate(`/projects/${projectId}/stages/${stageId}/episodes/${episodeId}`)
                        });

                        if (pathParts[7] === 'script') {
                            items.push({
                                title: '剧本内容',
                                icon: <EditOutlined />
                            });
                        }
                    }
                }
            }
        } else if (location.pathname === '/chat') {
            items.push({
                title: '对话',
                icon: <MessageOutlined />
            });
        } else if (location.pathname.startsWith('/script')) {
            items.push({
                title: '剧本编辑',
                icon: <EditOutlined />
            });
        }

        return items;
    };

    const items = generateBreadcrumbItems().map((item, index) => ({
        title: (
            <span
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: item.onClick ? 'pointer' : 'default',
                    color: item.onClick ? '#1890ff' : 'inherit'
                }}
                onClick={item.onClick}
            >
                {item.icon}
                {item.title}
            </span>
        )
    }));

    return (
        <div {...props} style={{
            padding: '12px 0',
            ...props.style
        }}>
            <AntBreadcrumb
                items={items}
                style={{
                    fontSize: '14px',
                    color: '#d9d9d9'
                }}
            />
        </div>
    );
};

export default Breadcrumb; 