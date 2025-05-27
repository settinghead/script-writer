import React from 'react';
import { Breadcrumb as AntBreadcrumb } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { HomeOutlined, BulbOutlined, MessageOutlined, EditOutlined, HistoryOutlined, FileTextOutlined } from '@ant-design/icons';

interface BreadcrumbItem {
    title: string;
    icon?: React.ReactNode;
    href?: string;
    onClick?: () => void;
}

const Breadcrumb: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const generateBreadcrumbItems = (): BreadcrumbItem[] => {
        const items: BreadcrumbItem[] = [
            {
                title: '首页',
                icon: <HomeOutlined />,
                onClick: () => navigate('/')
            }
        ];

        if (location.pathname === '/ideations') {
            items.push({
                title: '创作工作台',
                icon: <HistoryOutlined />
            });
        } else if (location.pathname.startsWith('/ideation')) {
            items.push({
                title: '创作工作台',
                icon: <HistoryOutlined />,
                onClick: () => navigate('/ideations')
            });

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
                title: '创作工作台',
                icon: <HistoryOutlined />,
                onClick: () => navigate('/ideations')
            });
            items.push({
                title: '设计故事大纲',
                icon: <FileTextOutlined />
            });
        } else if (location.pathname.startsWith('/outlines')) {
            items.push({
                title: '创作工作台',
                icon: <HistoryOutlined />,
                onClick: () => navigate('/ideations')
            });
            const outlineId = location.pathname.split('/')[2];
            if (outlineId) {
                items.push({
                    title: `大纲详情 (${outlineId.slice(0, 8)}...)`,
                    icon: <FileTextOutlined />
                });
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
        <div style={{
            padding: '12px 0',
            borderBottom: '1px solid #434343',
            marginBottom: '16px'
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