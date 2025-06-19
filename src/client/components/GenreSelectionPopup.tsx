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
    '故事背景': {
        '时代背景': {
            '现代都市': ['都市生活', '职场', '校园', '娱乐圈'],
            '古代背景': ['宫廷', '江湖', '宅门', '官场'],
            '架空世界': ['异世大陆', '修真领域', '末世危机'],
            '其他时代': ['民国', '近现代', '未来世界']
        },
        '地理背景': {
            '城市环境': ['都市', '豪门', '市井'],
            '乡村环境': ['乡村', '家庭', '衣锦还乡'],
            '特殊环境': ['荒野', '海外', '荒野求生'],
            '文化场所': ['文化旅游', '文化传承']
        }
    },
    '故事类型': {
        '爱情情感': {
            '甜宠爱情': ['浪漫甜蜜的爱情故事', '日久生情', '青梅竹马', '萌宝助攻'],
            '虐恋情深': ['充满波折、痛苦和情感挣扎的爱情故事', '追妻虐恋', '恩情错付'],
            '婚姻题材': ['闪婚夫妻', '替嫁情缘', '先婚后爱', '契约婚姻'],
            '成熟爱情': ['熟龄浪漫', '父母爱情', '世情']
        },
        '玄幻奇幻': {
            '修真仙侠': ['仙侠', '修真领域', '升级打怪'],
            '玄幻冒险': ['玄幻', '异世大陆', '修炼成仙'],
            '奇幻魔法': ['奇幻', '魔法世界'],
            '武侠江湖': ['武侠', '江湖', '江湖恩怨']
        },
        '现实题材': {
            '家庭伦理': ['家庭', '家庭伦理', '家族恩怨', '千里寻亲'],
            '职场生活': ['职场', '创业商战', '都市生活'],
            '青春成长': ['青春', '校园', '成长励志'],
            '社会现实': ['民间传说', '民俗文化', '文化传承']
        },
        '悬疑推理': {
            '推理探案': ['悬疑推理', '推理探案', '刑侦罪案'],
            '惊悚恐怖': ['奇闻惊悚', '末世危机'],
            '犯罪题材': ['犯罪', '扫黑除恶', '抗日谍战']
        }
    },
    '人物设定': {
        '女性角色': {
            '女性成长': ['女性觉醒', '真假千金', '恶毒女配'],
            '女性复仇': ['复仇', '反转打脸'],
            '女性逆袭': ['逆袭', '扮猪吃虎', '穿越重生'],
            '女性特殊': ['双重人格', '多马甲', '团宠']
        },
        '男性角色': {
            '霸总类型': ['高冷型', '奶狗型', '疯批型', '沙雕型'],
            '男性逆袭': ['赘婿', '战神', '神豪', '高手下山'],
            '男性特殊': ['残疾大佬', '马甲大佬', '神医']
        },
        '特殊设定': {
            '萌宝设定': ['单宝', '多宝', '龙凤胎', '双胞胎', '真假萌宝'],
            '替身设定': ['双胞胎', '真假千金', '错认白月光'],
            '身份设定': ['团宠', '恶女', '娱乐圈']
        }
    },
    '剧情机制': {
        '穿越重生': {
            '穿越类型': ['身穿', '魂穿', '近穿', '远穿', '反穿', '来回穿', '双穿', '穿书', '穿系统'],
            '重生类型': ['重生', '双重生', '多重生', '穿越重生'],
            '特殊穿越': ['交换人生', '无限流']
        },
        '系统金手指': {
            '系统类型': ['系统选中', '升级系统', '签到系统'],
            '特殊能力': ['超能力', '金手指', '点石成金'],
            '特殊设定': ['一夜暴富', '物价贬值', '神仙神豪']
        },
        '复仇逆袭': {
            '复仇题材': ['复仇', '反转打脸', '恩怨斗争'],
            '逆袭成长': ['逆袭', '小人物', '扮猪吃虎'],
            '身份揭秘': ['马甲', '单马甲', '多马甲', '双马甲']
        }
    },
    '题材风格': {
        '动作冒险': {
            '动作片': ['动作', '战争', '竞技'],
            '冒险探索': ['荒野求生', '绝境求生', '古玩鉴宝'],
            '历史军事': ['抗日谍战', '家国情怀', '主旋律']
        },
        '轻松娱乐': {
            '喜剧搞笑': ['喜剧', '沙雕', '轻松'],
            '二次元': ['二次元', '动漫改编'],
            '娱乐圈': ['娱乐圈', '明星', '经纪人']
        },
        '深度题材': {
            '宫斗权谋': ['宫斗宅斗', '宫廷', '权谋'],
            '商战职场': ['创业商战', '职场', '商业'],
            '传承文化': ['种田经商', '文化传承', '传承觉醒']
        }
    },
    '特殊分类': {
        '科幻未来': {
            '科幻题材': ['科幻', '未来世界', '时空穿越'],
            '末世题材': ['末世危机', '天灾', '丧尸', '安全屋'],
            '星际题材': ['星际', '机甲', '虫族']
        },
        '后宫多元': {
            '后宫题材': ['后宫', '多女主'],
            '多元关系': ['多角恋', '三角恋'],
            '特殊关系': ['师徒', '主仆', '年龄差']
        },
        '其他特色': {
            '美食生活': ['美食', '种田', '日常'],
            '医疗题材': ['神医', '医生', '中医'],
            '其他': ['其他', '未分类', '特殊题材']
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