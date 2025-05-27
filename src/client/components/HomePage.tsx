import React, { useState } from 'react';
import { Tabs, Typography, Button } from 'antd';
import { BulbOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import IdeationsList from './IdeationsList';
import OutlinesList from './OutlinesList';

const { Title } = Typography;

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('ideations');
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    React.useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleCreateNew = () => {
        navigate('/ideation');
    };

    const tabItems = [
        {
            key: 'ideations',
            label: (
                <span>
                    <BulbOutlined />
                    灵感历史
                </span>
            ),
            children: <IdeationsList />
        },
        {
            key: 'outlines',
            label: (
                <span>
                    <FileTextOutlined />
                    大纲历史
                </span>
            ),
            children: <OutlinesList />
        }
    ];

    return (
        <div style={{ padding: isMobile ? '0 8px' : '0 4px' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'center',
                marginBottom: isMobile ? '16px' : '20px',
                flexDirection: isMobile ? 'column' : 'row',
                gap: isMobile ? '12px' : '0'
            }}>
                <Title level={isMobile ? 3 : 2} style={{ margin: 0, color: '#fff' }}>
                    创作工作台
                </Title>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleCreateNew}
                    size={isMobile ? 'middle' : 'large'}
                    style={isMobile ? { alignSelf: 'flex-start' } : {}}
                >
                    新建灵感
                </Button>
            </div>

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={tabItems}
                size={isMobile ? 'small' : 'middle'}
                style={{
                    '& .ant-tabs-content-holder': {
                        paddingTop: '16px'
                    }
                }}
            />
        </div>
    );
};

export default HomePage; 