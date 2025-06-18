import React, { useState, useEffect } from 'react';
import {
    Modal,
    Drawer,
    Button,
    Checkbox,
    Typography,
    Row,
    Col,
    Menu,
    List,
    Form,
    Space,
    Card,
    Breadcrumb,
    Flex,
    Tag,
    Alert
} from 'antd';
import { RightOutlined, LeftOutlined, CloseOutlined, HomeOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Text, Title } = Typography;

// Genre hierarchy with disabled states
export const genreOptions = {
    '女频': {
        '爱情类': {
            '甜宠': ['浪漫甜蜜的爱情故事'],
            '虐恋': ['充满波折、痛苦和情感挣扎的爱情故事'],
            '世情': ['刻画种种世态炎凉', 'disabled'],
            '先婚后爱': ['闪婚', '替嫁', '错嫁', '契约婚姻', 'disabled'],
            '霸总': ['高冷型', '奶狗型', '疯批型', '沙雕型', 'disabled']
        },
        '设定类': {
            '穿越': ['身穿', '魂穿', '近穿', '远穿', '反穿', '来回穿', '双穿', '穿书', '穿系统', 'disabled'],
            '重生': ['重生', '双重生', '多重生', 'disabled'],
            '马甲': ['单马甲', '多马甲', '双马甲', 'disabled'],
            '替身': ['双胞胎', '真假千金', '错认白月光', 'disabled']
        },
        '其他类型': {
            '复仇': ['复仇', 'disabled'],
            '萌宝': ['单宝', '多宝', '龙凤胎', '双胞胎', '真假萌宝', 'disabled'],
            '家庭': ['家庭伦理', '寻亲', 'disabled'],
            '团宠': ['团宠', 'disabled'],
            '恶女': ['恶毒女配', '双重人格', 'disabled'],
            '娱乐圈': ['娱乐圈', 'disabled']
        }
    },
    '男频': {
        '设定类': {
            '穿越': ['穿越', 'disabled'],
            '重生': ['重生', 'disabled'],
            '玄幻': ['修炼成仙', '升级打怪', 'disabled'],
            '末世': ['天灾', '丧尸', '安全屋', 'disabled']
        },
        '逆袭类': {
            '战神': ['强者', '龙王', '兵王', '城主', 'disabled'],
            '神豪': ['一夜暴富', '点石成金', '物价贬值', '神仙神豪', 'disabled'],
            '赘婿': ['赘婿', 'disabled'],
            '离婚': ['离婚', 'disabled'],
            '逆袭': ['小人物', '扮猪吃老虎', '马甲大佬', 'disabled'],
            '残疾大佬': ['残疾大佬', 'disabled'],
            '金手指': ['超能力', '系统选中', '世界巨变', 'disabled'],
            '高手下山': ['高手下山', 'disabled']
        },
        '其他类型': {
            '神医': ['神医', 'disabled'],
            '后宫': ['后宫', 'disabled']
        }
    }
};

export interface GenreSelectionPopupProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (selection: { paths: string[][] }) => void;
    currentSelectionPaths: string[][];
    disabledOptions?: string[]; // Optional array of genre paths to disable
}

const GenreSelectionPopup: React.FC<GenreSelectionPopupProps> = ({
    visible,
    onClose,
    onSelect,
    currentSelectionPaths,
    disabledOptions = [] // Default to empty array if not provided
}) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [navigationPath, setNavigationPath] = useState<string[]>([]);
    const [tempSelectedPaths, setTempSelectedPaths] = useState<string[][]>(currentSelectionPaths);
    const [activeNavigationPath, setActiveNavigationPath] = useState<string[]>([]);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (visible) {
            setTempSelectedPaths(currentSelectionPaths);
            setNavigationPath([]);
            if (!isMobile) {
                if (currentSelectionPaths.length > 0 && currentSelectionPaths[0].length > 0) {
                    setActiveNavigationPath(currentSelectionPaths[0].slice(0, -1));
                } else {
                    setActiveNavigationPath([]);
                }
            }
        }
    }, [visible, currentSelectionPaths, isMobile]);

    const isOptionDisabled = (path: string[]) => {
        // Check if the path is in disabledOptions
        if (disabledOptions.some(disabledPath =>
            JSON.stringify(disabledPath) === JSON.stringify(path))) {
            return true;
        }

        // Check if the path contains any disabled segments
        const pathString = path.join(' > ');
        return pathString.includes('disabled');
    };

    const getDataAtPath = (path: string[]) => {
        let current: any = genreOptions;
        for (const segment of path) {
            if (segment === 'disabled') continue;
            current = current[segment];
            if (!current) return null;
        }
        return current;
    };

    const hasChildren = (path: string[], key: string) => {
        const data = getDataAtPath([...path, key]);
        return data && typeof data === 'object' && !Array.isArray(data);
    };

    const isDeepestLevel = (path: string[], key: string) => {
        const data = getDataAtPath([...path, key]);
        if (Array.isArray(data)) {
            return data.length <= 1 || (data.length === 2 && data.includes('disabled'));
        }
        if (data && typeof data === 'object') {
            const children = Object.keys(data);
            if (children.length === 1) {
                const childData = data[children[0]];
                if (Array.isArray(childData) && (childData.length <= 1 || (childData.length === 2 && childData.includes('disabled')))) {
                    return true;
                }
            }
        }
        return false;
    };

    const handleNavigationClick = (pathForNextColumn: string[]) => {
        if (isMobile) {
            setNavigationPath(pathForNextColumn);
        } else {
            setActiveNavigationPath(pathForNextColumn);
        }
    };

    const handleCheckboxChange = (itemPath: string[], itemName: string) => {
        const fullItemPath = [...itemPath, itemName];

        // Don't allow selection if the option is disabled
        if (isOptionDisabled(fullItemPath)) {
            return;
        }

        setTempSelectedPaths(prevSelectedPaths => {
            const isAlreadySelected = prevSelectedPaths.some(p => JSON.stringify(p) === JSON.stringify(fullItemPath));
            if (isAlreadySelected) {
                return prevSelectedPaths.filter(p => JSON.stringify(p) !== JSON.stringify(fullItemPath));
            } else {
                if (prevSelectedPaths.length < 3) {
                    return [...prevSelectedPaths, fullItemPath];
                } else {
                    return prevSelectedPaths;
                }
            }
        });
    };

    const handleRemoveSelectedItem = (indexToRemove: number) => {
        const newSelectedPaths = tempSelectedPaths.filter((_, index) => index !== indexToRemove);
        setTempSelectedPaths(newSelectedPaths);
    };

    const handleConfirm = () => {
        if (tempSelectedPaths.length > 0 && tempSelectedPaths.length <= 3) {
            onSelect({ paths: tempSelectedPaths });
            onClose();
        }
    };

    const handleCancel = () => {
        setTempSelectedPaths(currentSelectionPaths);
        onClose();
    };

    const renderSelectedItemsTags = () => {
        if (tempSelectedPaths.length === 0) return null;

        return (
            <Card size="small" style={{ marginTop: 16 }}>
                <Title level={5} style={{ marginBottom: 16 }}>已选择的故事类型</Title>
                <Space wrap>
                    {tempSelectedPaths.map((path, index) => {
                        const pathString = path.join(' > ');
                        return (
                            <Tag
                                key={index}
                                closable
                                onClose={() => handleRemoveSelectedItem(index)}
                                color="blue"
                                style={{ marginBottom: 8 }}
                            >
                                {pathString}
                            </Tag>
                        );
                    })}
                </Space>
            </Card>
        );
    };

    const createMenuItems = (data: any, basePath: string[] = []): MenuProps['items'] => {
        if (!data || typeof data !== 'object' || Array.isArray(data)) return [];

        return Object.keys(data).map(key => {
            const itemPath = [...basePath, key];
            const itemHasChildren = hasChildren(basePath, key);
            const itemIsDeepest = isDeepestLevel(basePath, key);
            const canSelectItem = !itemHasChildren || itemIsDeepest;
            const isSelected = tempSelectedPaths.some(p => JSON.stringify(p) === JSON.stringify(itemPath));

            return {
                key: itemPath.join('|'),
                label: (
                    <Flex justify="space-between" align="center">
                        <Flex align="center">
                            {canSelectItem && (
                                <Checkbox
                                    checked={isSelected}
                                    onChange={() => handleCheckboxChange(basePath, key)}
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={!isSelected && tempSelectedPaths.length >= 3}
                                    style={{ marginRight: 8 }}
                                />
                            )}
                            <span>{key}</span>
                        </Flex>
                        {itemHasChildren && !itemIsDeepest && <RightOutlined style={{ fontSize: 10 }} />}
                    </Flex>
                ),
                onClick: () => {
                    if (itemHasChildren && !itemIsDeepest) {
                        handleNavigationClick(itemPath);
                    } else if (canSelectItem) {
                        handleCheckboxChange(basePath, key);
                    }
                }
            };
        });
    };

    const renderMillerColumns = () => {
        const columns: React.ReactElement[] = [];
        let currentLevelData: any = genreOptions;
        let currentPathSegmentsForRender: string[] = [];

        // Root column
        columns.push(
            <Card key="col-root" size="small" style={{ width: 200, height: 300, overflow: 'auto' }}>
                <Menu
                    mode="vertical"
                    selectedKeys={activeNavigationPath.length > 0 ? [activeNavigationPath[0]] : []}
                    items={createMenuItems(currentLevelData)}
                    style={{ border: 'none' }}
                />
            </Card>
        );

        // Additional columns based on navigation path
        for (let i = 0; i < activeNavigationPath.length; i++) {
            currentPathSegmentsForRender = activeNavigationPath.slice(0, i + 1);
            currentLevelData = getDataAtPath(currentPathSegmentsForRender);

            if (currentLevelData && typeof currentLevelData === 'object' && !Array.isArray(currentLevelData)) {
                columns.push(
                    <Card key={`col-${i}`} size="small" style={{ width: 200, height: 300, overflow: 'auto' }}>
                        <Menu
                            mode="vertical"
                            selectedKeys={activeNavigationPath.length > i + 1 ? [activeNavigationPath[i + 1]] : []}
                            items={createMenuItems(currentLevelData, currentPathSegmentsForRender)}
                            style={{ border: 'none' }}
                        />
                    </Card>
                );
            } else {
                break;
            }
        }

        return (
            <Flex vertical>
                <Flex gap={8} style={{ overflowX: 'auto', paddingBottom: tempSelectedPaths.length > 0 ? 16 : 0 }}>
                    {columns}
                </Flex>
                {tempSelectedPaths.length >= 3 && (
                    <Alert
                        message="已选择最大数量 (3个) 的故事类型"
                        description="如需选择其他类型，请先移除已选择的类型。"
                        type="info"
                        showIcon
                        style={{ margin: '16px 0' }}
                    />
                )}
                {tempSelectedPaths.length > 0 && renderSelectedItemsTags()}
            </Flex>
        );
    };

    const renderBreadcrumb = () => {
        const breadcrumbItems = [
            {
                title: <HomeOutlined />,
            },
            ...navigationPath.map((segment, index) => ({
                title: segment,
                onClick: () => setNavigationPath(navigationPath.slice(0, index + 1))
            }))
        ];

        return (
            <Breadcrumb
                items={breadcrumbItems}
                style={{ marginBottom: 16 }}
            />
        );
    };

    const renderSingleView = () => {
        const currentDataToDisplay = getDataAtPath(navigationPath);

        return (
            <Flex vertical style={{ height: '100%' }}>
                {navigationPath.length > 0 && renderBreadcrumb()}

                <div style={{ flex: 1, paddingBottom: tempSelectedPaths.length > 0 ? 16 : 0 }}>
                    {currentDataToDisplay && typeof currentDataToDisplay === 'object' && !Array.isArray(currentDataToDisplay) ? (
                        <List
                            dataSource={Object.keys(currentDataToDisplay)}
                            renderItem={(key) => {
                                const itemFullPath = [...navigationPath, key];
                                const isItemSelected = tempSelectedPaths.some(p => JSON.stringify(p) === JSON.stringify(itemFullPath));
                                const itemHasChildren = hasChildren(navigationPath, key);
                                const itemIsDeepest = isDeepestLevel(navigationPath, key);
                                const canSelectItem = !itemHasChildren || itemIsDeepest;

                                return (
                                    <List.Item
                                        onClick={() => {
                                            if (itemHasChildren && !itemIsDeepest) {
                                                handleNavigationClick(itemFullPath);
                                            } else if (canSelectItem) {
                                                handleCheckboxChange(navigationPath, key);
                                            }
                                        }}
                                        style={{
                                            cursor: 'pointer',
                                            backgroundColor: isItemSelected ? '#1890ff10' : 'transparent',
                                            padding: '12px 16px',
                                            borderRadius: 6
                                        }}
                                        actions={[
                                            itemHasChildren && !itemIsDeepest ? <RightOutlined key="arrow" /> : null
                                        ].filter(Boolean)}
                                    >
                                        <List.Item.Meta
                                            avatar={canSelectItem ? (
                                                <Checkbox
                                                    checked={isItemSelected}
                                                    onChange={() => handleCheckboxChange(navigationPath, key)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    disabled={!isItemSelected && tempSelectedPaths.length >= 3}
                                                />
                                            ) : null}
                                            title={key}
                                        />
                                    </List.Item>
                                );
                            }}
                        />
                    ) : (
                        <Text type="secondary" style={{ padding: 16, display: 'block', textAlign: 'center' }}>
                            当前分类下没有更多子选项
                        </Text>
                    )}
                </div>

                {tempSelectedPaths.length > 0 && renderSelectedItemsTags()}
            </Flex>
        );
    };

    const drawerHeight = tempSelectedPaths.length > 0 ? '85vh' : '70vh';

    if (isMobile) {
        return (
            <Drawer
                title="选择故事类型"
                placement="bottom"
                height={drawerHeight}
                onClose={handleCancel}
                open={visible}
                footer={
                    <Space>
                        <Button onClick={handleCancel}>
                            取消
                        </Button>
                        <Button
                            type="primary"
                            onClick={handleConfirm}
                            disabled={tempSelectedPaths.length === 0 || tempSelectedPaths.length > 3}
                        >
                            确定 ({tempSelectedPaths.length})
                        </Button>
                    </Space>
                }
            >
                {renderSingleView()}
            </Drawer>
        );
    }

    return (
        <Modal
            title="选择故事类型"
            open={visible}
            onCancel={handleCancel}
            width={Math.min(220 * (activeNavigationPath.length + 2) + (tempSelectedPaths.length > 0 ? 50 : 0), 1000)}
            centered
            footer={[
                <Button key="cancel" onClick={handleCancel}>
                    取消
                </Button>,
                <Button
                    key="confirm"
                    type="primary"
                    onClick={handleConfirm}
                    disabled={tempSelectedPaths.length === 0 || tempSelectedPaths.length > 3}
                >
                    确定 ({tempSelectedPaths.length})
                </Button>
            ]}
        >
            {renderMillerColumns()}
        </Modal>
    );
};

export default GenreSelectionPopup; 