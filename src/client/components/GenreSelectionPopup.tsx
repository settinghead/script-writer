import React, { useState, useEffect } from 'react';
import { Modal, Drawer, Button, Checkbox, Typography } from 'antd';
import { RightOutlined, LeftOutlined } from '@ant-design/icons';

// const { Paragraph } = Typography; // Not used directly here, but Text is. Text is used by ProportionAdjustmentModal

// Genre hierarchy (remains exported for potential use elsewhere, though primarily internal now)
export const genreOptions = {
    '女频': {
        '爱情类': {
            '甜宠': ['浪漫甜蜜的爱情故事'],
            '虐恋': ['充满波折、痛苦和情感挣扎的爱情故事'],
            '先婚后爱': ['闪婚', '替嫁', '错嫁', '契约婚姻'],
            '霸总': ['高冷型', '奶狗型', '疯批型', '沙雕型']
        },
        '设定类': {
            '穿越': ['身穿', '魂穿', '近穿', '远穿', '反穿', '来回穿', '双穿', '穿书', '穿系统'],
            '重生': ['重生', '双重生', '多重生'],
            '马甲': ['单马甲', '多马甲', '双马甲'],
            '替身': ['双胞胎', '真假千金', '错认白月光']
        },
        '其他类型': {
            '复仇': ['复仇'],
            '萌宝': ['单宝', '多宝', '龙凤胎', '双胞胎', '真假萌宝'],
            '家庭': ['家庭伦理', '寻亲'],
            '团宠': ['团宠'],
            '恶女': ['恶毒女配', '双重人格'],
            '娱乐圈': ['娱乐圈']
        }
    },
    '男频': {
        '设定类': {
            '穿越': ['穿越'],
            '重生': ['重生'],
            '玄幻': ['修炼成仙', '升级打怪'],
            '末世': ['天灾', '丧尸', '安全屋']
        },
        '逆袭类': {
            '战神': ['强者', '龙王', '兵王', '城主'],
            '神豪': ['一夜暴富', '点石成金', '物价贬值', '神仙神豪'],
            '赘婿': ['赘婿'],
            '离婚': ['离婚'],
            '逆袭': ['小人物', '扮猪吃老虎', '马甲大佬'],
            '残疾大佬': ['残疾大佬'],
            '金手指': ['超能力', '系统选中', '世界巨变'],
            '高手下山': ['高手下山']
        },
        '其他类型': {
            '神医': ['神医'],
            '后宫': ['后宫']
        }
    }
};

export interface GenreSelectionPopupProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (paths: string[][]) => void;
    currentSelection: string[][];
}

const GenreSelectionPopup: React.FC<GenreSelectionPopupProps> = ({
    visible,
    onClose,
    onSelect,
    currentSelection
}) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [navigationPath, setNavigationPath] = useState<string[]>([]);
    const [tempSelectedPaths, setTempSelectedPaths] = useState<string[][]>(currentSelection);
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
            setTempSelectedPaths(currentSelection);
            setNavigationPath([]);
            // Initialize activeNavigationPath when the modal becomes visible or currentSelection changes (for Miller columns)
            if (!isMobile) {
                if (currentSelection.length > 0 && currentSelection[0].length > 0) {
                    setActiveNavigationPath(currentSelection[0].slice(0, -1));
                } else {
                    setActiveNavigationPath([]);
                }
            }
        }
    }, [visible, currentSelection, isMobile]);

    const getDataAtPath = (path: string[]) => {
        let current: any = genreOptions;
        for (const segment of path) {
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
            return data.length <= 1;
        }
        if (typeof data === 'object') {
            const children = Object.keys(data);
            if (children.length === 1) {
                const childData = data[children[0]];
                if (Array.isArray(childData) && childData.length <= 1) {
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
        setTempSelectedPaths(prevSelectedPaths => {
            const isAlreadySelected = prevSelectedPaths.some(p => JSON.stringify(p) === JSON.stringify(fullItemPath));
            if (isAlreadySelected) {
                return prevSelectedPaths.filter(p => JSON.stringify(p) !== JSON.stringify(fullItemPath));
            } else {
                if (prevSelectedPaths.length < 3) {
                    return [...prevSelectedPaths, fullItemPath];
                }
                return prevSelectedPaths;
            }
        });
    };

    const handleConfirm = () => {
        if (tempSelectedPaths.length > 0 && tempSelectedPaths.length <= 3) { // Ensure not over limit before confirming
            onSelect(tempSelectedPaths);
            onClose();
        }
    };

    const handleCancel = () => {
        setTempSelectedPaths(currentSelection); // Reset to original selection on cancel
        onClose();
    };

    const renderMillerColumns = () => {
        const columns = [];
        let currentLevelData: any = genreOptions;
        let currentPathSegmentsForRender: string[] = []; // Path for the current column items

        // Column 0 (Root)
        columns.push(
            <div key="col-root" style={{
                width: '200px',
                borderRight: '1px solid #303030',
                height: '400px',
                overflowY: 'auto'
            }}>
                {Object.keys(currentLevelData).map(key => {
                    const itemPath = [key];
                    const isEffectivelySelected = tempSelectedPaths.some(p => JSON.stringify(p) === JSON.stringify(itemPath) && (!hasChildren([], key) || isDeepestLevel([], key)));
                    const canSelectItem = !hasChildren([], key) || isDeepestLevel([], key);
                    const isActiveNavBranch = activeNavigationPath[0] === key;

                    return (
                        <div
                            key={key}
                            onClick={() => { if (hasChildren([], key) && !isDeepestLevel([], key)) handleNavigationClick(itemPath); }}
                            style={{
                                padding: '8px 12px',
                                cursor: (hasChildren([], key) && !isDeepestLevel([], key)) ? 'pointer' : 'default',
                                backgroundColor: isActiveNavBranch ? '#1890ff20' : (isEffectivelySelected ? '#1890ff10' : 'transparent'),
                                borderLeft: isActiveNavBranch ? '3px solid #1890ff' : (isEffectivelySelected ? '3px solid #1890ff80' : '3px solid transparent'),
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                            onMouseEnter={(e) => { if (!isActiveNavBranch && !isEffectivelySelected) e.currentTarget.style.backgroundColor = '#ffffff10'; }}
                            onMouseLeave={(e) => { if (!isActiveNavBranch && !isEffectivelySelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                {canSelectItem && (
                                    <Checkbox
                                        checked={isEffectivelySelected}
                                        onChange={() => handleCheckboxChange([], key)}
                                        onClick={(e) => e.stopPropagation()}
                                        disabled={!isEffectivelySelected && tempSelectedPaths.length >= 3}
                                        style={{ marginRight: '8px' }}
                                    />
                                )}
                                <span>{key}</span>
                            </div>
                            {hasChildren([], key) && !isDeepestLevel([], key) && <RightOutlined style={{ fontSize: '10px' }} />}
                        </div>
                    );
                })}
            </div>
        );

        // Subsequent columns based on activeNavigationPath
        for (let i = 0; i < activeNavigationPath.length; i++) {
            currentPathSegmentsForRender = activeNavigationPath.slice(0, i + 1);
            currentLevelData = getDataAtPath(currentPathSegmentsForRender);

            if (currentLevelData && typeof currentLevelData === 'object' && !Array.isArray(currentLevelData)) {
                columns.push(
                    <div key={`col-${i}`} style={{
                        width: '200px',
                        borderRight: '1px solid #303030',
                        height: '400px',
                        overflowY: 'auto'
                    }}>
                        {Object.keys(currentLevelData).map(key => {
                            const itemPath = [...currentPathSegmentsForRender, key];
                            const isEffectivelySelected = tempSelectedPaths.some(p => JSON.stringify(p) === JSON.stringify(itemPath) && (!hasChildren(currentPathSegmentsForRender, key) || isDeepestLevel(currentPathSegmentsForRender, key)));
                            const canSelectItem = !hasChildren(currentPathSegmentsForRender, key) || isDeepestLevel(currentPathSegmentsForRender, key);
                            const isActiveNavBranch = activeNavigationPath[i + 1] === key;

                            return (
                                <div
                                    key={key}
                                    onClick={() => { if (hasChildren(currentPathSegmentsForRender, key) && !isDeepestLevel(currentPathSegmentsForRender, key)) handleNavigationClick(itemPath); }}
                                    style={{
                                        padding: '8px 12px',
                                        cursor: (hasChildren(currentPathSegmentsForRender, key) && !isDeepestLevel(currentPathSegmentsForRender, key)) ? 'pointer' : 'default',
                                        backgroundColor: isActiveNavBranch ? '#1890ff20' : (isEffectivelySelected ? '#1890ff10' : 'transparent'),
                                        borderLeft: isActiveNavBranch ? '3px solid #1890ff' : (isEffectivelySelected ? '3px solid #1890ff80' : '3px solid transparent'),
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                    onMouseEnter={(e) => { if (!isActiveNavBranch && !isEffectivelySelected) e.currentTarget.style.backgroundColor = '#ffffff10'; }}
                                    onMouseLeave={(e) => { if (!isActiveNavBranch && !isEffectivelySelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        {canSelectItem && (
                                            <Checkbox
                                                checked={isEffectivelySelected}
                                                onChange={() => handleCheckboxChange(currentPathSegmentsForRender, key)}
                                                onClick={(e) => e.stopPropagation()}
                                                disabled={!isEffectivelySelected && tempSelectedPaths.length >= 3}
                                                style={{ marginRight: '8px' }}
                                            />
                                        )}
                                        <span>{key}</span>
                                    </div>
                                    {hasChildren(currentPathSegmentsForRender, key) && !isDeepestLevel(currentPathSegmentsForRender, key) && <RightOutlined style={{ fontSize: '10px' }} />}
                                </div>
                            );
                        })}
                    </div>
                );
            } else {
                break;
            }
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '400px', overflow: 'hidden' }}>
                <div style={{
                    padding: '12px 16px',
                    backgroundColor: '#1a1a1a',
                    borderBottom: '1px solid #303030',
                    fontSize: '12px',
                    color: tempSelectedPaths.length > 3 ? '#ff4d4f' : (tempSelectedPaths.length > 0 ? '#52c41a' : '#666'),
                    marginBottom: '8px',
                    flexShrink: 0
                }}>
                    当前选择 ({tempSelectedPaths.length}/3): {tempSelectedPaths.map(path => path.join(' > ')).join(', ') || '未选择'}
                    {tempSelectedPaths.length > 3 && <span style={{ marginLeft: '8px', fontWeight: 'bold' }}>超出数量限制！</span>}
                </div>
                <div style={{ display: 'flex', flexGrow: 1, overflowX: 'auto', overflowY: 'hidden' }}>
                    {columns}
                </div>
            </div>
        );
    };

    const renderSingleView = () => {
        const currentDataToDisplay = getDataAtPath(navigationPath);
        const breadcrumbs = navigationPath.length > 0 ? navigationPath : ['选择类型'];

        return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #303030',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexShrink: 0
                }}>
                    {navigationPath.length > 0 && (
                        <Button
                            type="text"
                            icon={<LeftOutlined />}
                            onClick={() => setNavigationPath(navigationPath.slice(0, -1))}
                            style={{ padding: '4px 8px', height: 'auto' }}
                        />
                    )}
                    <div style={{ fontSize: '14px', color: '#1890ff' }}>
                        {breadcrumbs.join(' > ')}
                    </div>
                </div>
                <div style={{
                    padding: '8px 16px',
                    backgroundColor: '#1a1a1a',
                    borderBottom: '1px solid #303030',
                    fontSize: '12px',
                    color: tempSelectedPaths.length > 3 ? '#ff4d4f' : (tempSelectedPaths.length > 0 ? '#52c41a' : '#666'),
                    flexShrink: 0
                }}>
                    已选择 ({tempSelectedPaths.length}/3): {tempSelectedPaths.map(path => path.join(' > ')).join(', ') || '未选择'}
                    {tempSelectedPaths.length > 3 && <span style={{ marginLeft: '8px', fontWeight: 'bold' }}>超出数量限制！</span>}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                    <>
                        {currentDataToDisplay && typeof currentDataToDisplay === 'object' && !Array.isArray(currentDataToDisplay) &&
                            Object.keys(currentDataToDisplay).map(key => {
                                const itemFullPath = [...navigationPath, key];
                                const isItemSelected = tempSelectedPaths.some(p => JSON.stringify(p) === JSON.stringify(itemFullPath));
                                const itemHasChildren = hasChildren(navigationPath, key);
                                const itemIsDeepest = isDeepestLevel(navigationPath, key);
                                const canSelectItem = !itemHasChildren || itemIsDeepest;

                                return (
                                    <div
                                        key={key}
                                        onClick={() => {
                                            if (itemHasChildren && !itemIsDeepest) {
                                                handleNavigationClick(itemFullPath);
                                            } else if (canSelectItem && !isItemSelected && tempSelectedPaths.length < 3) {
                                                handleCheckboxChange(navigationPath, key); // Allow row click to select if checkbox not directly clicked
                                            } else if (canSelectItem && isItemSelected) {
                                                handleCheckboxChange(navigationPath, key); // Allow row click to deselect
                                            }
                                        }}
                                        style={{
                                            padding: '12px 16px',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid #2a2a2a',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            backgroundColor: isItemSelected ? '#1890ff10' : 'transparent'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            {canSelectItem && (
                                                <Checkbox
                                                    checked={isItemSelected}
                                                    onChange={() => handleCheckboxChange(navigationPath, key)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    disabled={!isItemSelected && tempSelectedPaths.length >= 3}
                                                    style={{ marginRight: '12px' }}
                                                />
                                            )}
                                            <span>{key}</span>
                                        </div>
                                        {itemHasChildren && !itemIsDeepest && (
                                            <RightOutlined style={{ fontSize: '12px', color: '#666' }} />
                                        )}
                                    </div>
                                );
                            })
                        }
                        {(!currentDataToDisplay || (typeof currentDataToDisplay === 'object' && Array.isArray(currentDataToDisplay) && Object.keys(currentDataToDisplay).length === 0)) && (
                            <div style={{ padding: '12px 16px', color: '#666' }}>当前分类下没有更多子选项。</div>
                        )}
                    </>
                </div>
            </div>
        );
    };

    if (isMobile) {
        return (
            <Drawer
                title="选择故事类型"
                placement="bottom"
                height="70vh"
                onClose={handleCancel}
                open={visible}
                bodyStyle={{ padding: 0 }}
                footerStyle={{ padding: '16px', borderTop: '1px solid #303030' }}
                footer={[
                    <Button key="cancel" onClick={handleCancel} style={{ marginRight: '8px' }}>
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
                {renderSingleView()}
            </Drawer>
        );
    }

    return (
        <Modal
            title="选择故事类型"
            open={visible}
            onCancel={handleCancel}
            width={Math.min(220 * (activeNavigationPath.length + 2), 1000)}
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