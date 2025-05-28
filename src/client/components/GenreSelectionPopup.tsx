import React, { useState, useEffect } from 'react';
import { Modal, Drawer, Button, Checkbox, Typography, Slider, Row, Col } from 'antd';
import { RightOutlined, LeftOutlined, CloseOutlined } from '@ant-design/icons';

const { Text } = Typography;

// Genre hierarchy with disabled states
export const genreOptions = {
    '女频': {
        '爱情类': {
            '甜宠': ['浪漫甜蜜的爱情故事'],
            '虐恋': ['充满波折、痛苦和情感挣扎的爱情故事'],
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
    onSelect: (selection: { paths: string[][]; proportions: number[] }) => void;
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
    const [tempProportions, setTempProportions] = useState<number[]>([]);
    const [activeNavigationPath, setActiveNavigationPath] = useState<string[]>([]);

    const initializeProportions = (paths: string[][]) => {
        if (paths.length === 0) {
            setTempProportions([]);
        } else if (paths.length === 1) {
            setTempProportions([100]);
        } else {
            const equalShare = Math.floor(100 / paths.length);
            setTempProportions(paths.map(() => equalShare));
        }
    };

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
            initializeProportions(currentSelectionPaths);
            setNavigationPath([]);
            if (!isMobile) {
                if (currentSelectionPaths.length > 0 && currentSelectionPaths[0].length > 0) {
                    console.log('[GenreSelectionPopup] useEffect (visible): Initializing activeNavigationPath based on currentSelectionPaths[0]. Path:', currentSelectionPaths[0].slice(0, -1));
                    setActiveNavigationPath(currentSelectionPaths[0].slice(0, -1));
                } else {
                    console.log('[GenreSelectionPopup] useEffect (visible): Initializing activeNavigationPath to empty array (no current selection).');
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
        console.log('[GenreSelectionPopup] handleNavigationClick: pathForNextColumn:', JSON.stringify(pathForNextColumn), 'isMobile:', isMobile);
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

        let newSelectedPaths: string[][] = [];

        setTempSelectedPaths(prevSelectedPaths => {
            const isAlreadySelected = prevSelectedPaths.some(p => JSON.stringify(p) === JSON.stringify(fullItemPath));
            if (isAlreadySelected) {
                newSelectedPaths = prevSelectedPaths.filter(p => JSON.stringify(p) !== JSON.stringify(fullItemPath));
            } else {
                if (prevSelectedPaths.length < 3) {
                    newSelectedPaths = [...prevSelectedPaths, fullItemPath];
                } else {
                    newSelectedPaths = prevSelectedPaths;
                }
            }
            initializeProportions(newSelectedPaths);
            return newSelectedPaths;
        });
    };

    const handleRemoveSelectedItem = (indexToRemove: number) => {
        const newSelectedPaths = tempSelectedPaths.filter((_, index) => index !== indexToRemove);
        setTempSelectedPaths(newSelectedPaths);
        initializeProportions(newSelectedPaths);
    };

    const handleProportionSliderChange = (index: number, value: number | null) => {
        if (value === null) return;
        const newProportions = [...tempProportions];
        newProportions[index] = value;
        setTempProportions(newProportions);
    };

    const handleConfirm = () => {
        if (tempSelectedPaths.length > 0 && tempSelectedPaths.length <= 3) {
            let finalProportions: number[];
            if (tempSelectedPaths.length === 0) {
                finalProportions = [];
            } else if (tempSelectedPaths.length === 1) {
                finalProportions = [100];
            } else {
                const sum = tempProportions.reduce((acc, p) => acc + p, 0);
                if (sum === 0) {
                    const equalShare = 100 / tempProportions.length;
                    finalProportions = tempProportions.map(() => equalShare);
                } else {
                    finalProportions = tempProportions.map(p => Math.round((p / sum) * 100));
                    const currentSum = finalProportions.reduce((a, b) => a + b, 0);
                    if (currentSum !== 100 && finalProportions.length > 0) {
                        finalProportions[0] += (100 - currentSum);
                    }
                }
            }
            onSelect({ paths: tempSelectedPaths, proportions: finalProportions });
            onClose();
        }
    };

    const handleCancel = () => {
        setTempSelectedPaths(currentSelectionPaths);
        initializeProportions(currentSelectionPaths);
        onClose();
    };

    const renderProportionSliders = () => {
        if (tempSelectedPaths.length === 0) return null;

        const totalRawSum = tempProportions.reduce((a, b) => a + b, 0);
        const isSingleItem = tempSelectedPaths.length === 1;

        return (
            <div style={{ marginTop: '20px', padding: '0 16px' }}>
                <Text strong style={{ display: 'block', marginBottom: '10px' }}>调整类型比例:</Text>
                {tempSelectedPaths.map((path, index) => {
                    const pathString = path.join(' > ');
                    const currentRawValue = tempProportions[index] || 0;
                    const baseValue = tempProportions.length > 0 ? (100 / tempProportions.length) : 0;
                    const displayValue = tempProportions[index] !== undefined ? tempProportions[index] : baseValue;

                    const currentPercentage = totalRawSum > 0 ? (displayValue / totalRawSum) * 100 : (tempSelectedPaths.length > 0 ? (100 / tempSelectedPaths.length) : 0);

                    return (
                        <div key={`slider-${index}`} style={{ marginBottom: '15px' }}>
                            <Row align="middle" gutter={8}>
                                <Col flex="1">
                                    <Text ellipsis={{ tooltip: pathString }}>{pathString}</Text>
                                </Col>
                                <Col style={{ width: '70px', textAlign: 'right' }}>
                                    <Text type="secondary">
                                        {isSingleItem ? '100%' : `${currentPercentage.toFixed(0)}%`}
                                    </Text>
                                </Col>
                                <Col>
                                    <Button
                                        type="text"
                                        icon={<CloseOutlined />}
                                        onClick={() => handleRemoveSelectedItem(index)}
                                        size="small"
                                        danger
                                    />
                                </Col>
                            </Row>
                            <Slider
                                min={0}
                                max={100}
                                step={1}
                                value={isSingleItem ? 100 : displayValue}
                                onChange={(value) => handleProportionSliderChange(index, value)}
                                tooltip={{ formatter: (value) => `${value}` }}
                                disabled={isSingleItem}
                            />
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderMillerColumns = () => {
        const columns = [];
        let currentLevelData: any = genreOptions;
        let currentPathSegmentsForRender: string[] = [];

        console.log('[GenreSelectionPopup] renderMillerColumns START. activeNavigationPath:', JSON.stringify(activeNavigationPath), 'tempSelectedPaths:', JSON.stringify(tempSelectedPaths));

        columns.push(
            <div key="col-root" style={{
                width: '200px',
                borderRight: '1px solid #303030',
                height: 'auto',
                maxHeight: '300px',
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
                            onClick={() => {
                                console.log('[GenreSelectionPopup] renderMillerColumns (root): onClick for key:', key, 'itemPath:', JSON.stringify(itemPath), 'hasChildren:', hasChildren([], key), 'isDeepestLevel:', isDeepestLevel([], key));
                                if (hasChildren([], key) && !isDeepestLevel([], key)) handleNavigationClick(itemPath);
                            }}
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

        for (let i = 0; i < activeNavigationPath.length; i++) {
            currentPathSegmentsForRender = activeNavigationPath.slice(0, i + 1);
            currentLevelData = getDataAtPath(currentPathSegmentsForRender);

            console.log(`[GenreSelectionPopup] renderMillerColumns (loop ${i}): currentPathSegmentsForRender FOR THIS ITERATION:`, JSON.stringify(currentPathSegmentsForRender), 'Raw currentLevelData exists:', !!currentLevelData);

            if (i === 1) { // This iteration generates the THIRD visual column
                console.log(`[GenreSelectionPopup] Generating THIRD visual column (i=${i}). activeNavigationPath at this point:`, JSON.stringify(activeNavigationPath));
                console.log(`[GenreSelectionPopup] Path used for getDataAtPath for Col 3:`, JSON.stringify(currentPathSegmentsForRender));
                if (currentLevelData && typeof currentLevelData === 'object') {
                    console.log(`[GenreSelectionPopup] Children for Col 3:`, JSON.stringify(Object.keys(currentLevelData)));
                } else {
                    console.log(`[GenreSelectionPopup] No children object for Col 3, currentLevelData:`, currentLevelData);
                }
            }

            if (currentLevelData && typeof currentLevelData === 'object' && !Array.isArray(currentLevelData)) {
                columns.push(
                    <div key={`col-${i}`} style={{
                        width: '200px',
                        borderRight: '1px solid #303030',
                        height: 'auto',
                        maxHeight: '300px',
                        overflowY: 'auto'
                    }}>
                        {Object.keys(currentLevelData).map(key => {
                            const itemPath = [...currentPathSegmentsForRender, key];
                            const isEffectivelySelected = tempSelectedPaths.some(p => JSON.stringify(p) === JSON.stringify(itemPath) && (!hasChildren(currentPathSegmentsForRender, key) || isDeepestLevel(currentPathSegmentsForRender, key)));
                            const canSelectItem = !hasChildren(currentPathSegmentsForRender, key) || isDeepestLevel(currentPathSegmentsForRender, key);
                            const isActiveNavBranch = activeNavigationPath[i + 1] === key;

                            const itemHasChildren = hasChildren(currentPathSegmentsForRender, key);
                            const itemIsDeepest = isDeepestLevel(currentPathSegmentsForRender, key);
                            console.log(`[GenreSelectionPopup] renderMillerColumns (column ${i}): onClick for key:`, key, 'itemPath:', JSON.stringify(itemPath));
                            console.log(`    Args for nav decision: itemHasChildren: ${itemHasChildren}, itemIsDeepest: ${itemIsDeepest}`);

                            return (
                                <div
                                    key={key}
                                    onClick={() => {
                                        if (itemHasChildren && !itemIsDeepest) {
                                            console.log(`    Navigating due to itemHasChildren && !itemIsDeepest.`);
                                            handleNavigationClick(itemPath);
                                        } else if (canSelectItem) {
                                            console.log(`    Checkbox change due to canSelectItem: ${canSelectItem}.`);
                                            handleCheckboxChange(currentPathSegmentsForRender, key);
                                        }
                                    }}
                                    style={{
                                        padding: '8px 12px',
                                        cursor: 'pointer',
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
            <>

                <div style={{ display: 'flex', flexGrow: 1, overflowX: 'auto', overflowY: 'hidden', borderBottom: tempSelectedPaths.length >= 2 ? '1px solid #303030' : 'none', paddingBottom: tempSelectedPaths.length >= 2 ? '10px' : '0' }}>
                    {columns}
                </div>
                {renderProportionSliders()}
            </>
        );
    };

    const renderSingleView = () => {
        const currentDataToDisplay = getDataAtPath(navigationPath);
        const breadcrumbs = navigationPath.length > 0 ? navigationPath : ['选择类型'];

        return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>


                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0', borderBottom: tempSelectedPaths.length >= 2 ? '1px solid #303030' : 'none', paddingBottom: tempSelectedPaths.length >= 2 ? '10px' : '0' }}>
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
                                                handleCheckboxChange(navigationPath, key);
                                            } else if (canSelectItem && isItemSelected) {
                                                handleCheckboxChange(navigationPath, key);
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
                {renderProportionSliders()}
            </div>
        );
    };

    const drawerHeight = tempSelectedPaths.length >= 2 ? '85vh' : '70vh';

    const modalBodyStyle: React.CSSProperties = {
        height: 'auto',
        maxHeight: 'calc(100vh - 180px)', // Account for modal header, footer, and body padding
        overflowY: 'auto',
    };

    if (isMobile) {
        return (
            <Drawer
                title="选择故事类型与比例"
                placement="bottom"
                height={drawerHeight}
                onClose={handleCancel}
                open={visible}
                style={{ padding: 0 }}
                styles={{ footer: { padding: '16px', borderTop: '1px solid #303030' } }}
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
            title="选择故事类型与比例"
            open={visible}
            onCancel={handleCancel}
            width={Math.min(220 * (activeNavigationPath.length + 2) + (tempSelectedPaths.length >= 2 ? 50 : 0), 1000)}
            style={modalBodyStyle}
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