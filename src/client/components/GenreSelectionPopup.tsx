import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { RightOutlined, HomeOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useLocalStorage } from '../hooks/useLocalStorage';

const { Text, Title } = Typography;

// Configuration constants
export const MAX_GENRE_SELECTIONS = 4;
const COLUMN_WIDTH = 200;
const COLUMN_GAP = 8;
const MAX_COLUMNS = 4; // Changed from 3 to 4 to show all hierarchy levels
const MODAL_PADDING = 48; // Modal internal padding
const MODAL_WIDTH = MAX_COLUMNS * COLUMN_WIDTH + (MAX_COLUMNS - 1) * COLUMN_GAP + MODAL_PADDING;
const COLUMN_HEIGHT = 300;
const SELECTED_ITEMS_HEIGHT = 200; // Increased from 120 to 180 for better display
const MODAL_HEIGHT = COLUMN_HEIGHT + SELECTED_ITEMS_HEIGHT + 100; // Extra space for padding

import { genreSelections, GenreSelection } from '../data/genreOptions';

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
    const [activeNavigationPath, setActiveNavigationPath] = useState<string[]>([]);

    // Use localStorage to persist temporary selections
    const [tempSelectedPathsStorage, setTempSelectedPathsStorage] = useLocalStorage<string[][]>('genreSelections', []);
    const [tempSelectedPaths, setTempSelectedPaths] = useState<string[][]>(currentSelectionPaths);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (visible) {
            // Always prioritize server data (currentSelectionPaths) over localStorage
            // Only use localStorage if server data is empty
            const initialSelections = currentSelectionPaths.length > 0 ? currentSelectionPaths : tempSelectedPathsStorage;

            setTempSelectedPaths(initialSelections);
            setNavigationPath([]);
            if (!isMobile) {
                if (initialSelections.length > 0 && initialSelections[0].length > 0) {
                    setActiveNavigationPath(initialSelections[0].slice(0, -1));
                } else {
                    setActiveNavigationPath([]);
                }
            }
        }
    }, [visible, currentSelectionPaths, isMobile]); // Removed tempSelectedPathsStorage from dependencies

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

    const getDataAtPath = (path: string[]): GenreSelection[] => {
        let current: GenreSelection[] = genreSelections;
        for (const segment of path) {
            const found = current.find(item => item.label === segment);
            if (!found || !found.selections) return [];
            current = found.selections;
        }
        return current;
    };

    const hasChildren = (path: string[], key: string): boolean => {
        const data = getDataAtPath(path);
        const item = data.find(item => item.label === key);
        return Boolean(item?.selections && item.selections.length > 0);
    };

    const isDeepestLevel = (path: string[], key: string): boolean => {
        const data = getDataAtPath(path);
        const item = data.find(item => item.label === key);
        return !item?.selections || item.selections.length === 0;
    };

    // Only allow selection from 3rd column onwards (path length >= 2)
    const canSelectAtLevel = (path: string[]): boolean => {
        return path.length >= 2;
    };

    // Check if any children of this path are selected
    const hasSelectedChildren = (path: string[]): boolean => {
        return tempSelectedPaths.some(selectedPath => {
            if (selectedPath.length <= path.length) return false;
            return path.every((segment, index) => selectedPath[index] === segment);
        });
    };

    // Check if any parent of this path is selected (this should disable the item)
    const hasSelectedParent = (path: string[]): boolean => {
        return tempSelectedPaths.some(selectedPath => {
            if (selectedPath.length >= path.length) return false;
            return selectedPath.every((segment, index) => path[index] === segment);
        });
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

        // Don't allow selection if not at 3rd column or beyond
        if (!canSelectAtLevel(fullItemPath)) {
            return;
        }

        setTempSelectedPaths(prevSelectedPaths => {
            const isAlreadySelected = prevSelectedPaths.some(p => JSON.stringify(p) === JSON.stringify(fullItemPath));

            let newSelectedPaths;

            if (isAlreadySelected) {
                // Remove this selection
                newSelectedPaths = prevSelectedPaths.filter(p => JSON.stringify(p) !== JSON.stringify(fullItemPath));
            } else {
                // Add this selection if under limit
                if (prevSelectedPaths.length < MAX_GENRE_SELECTIONS) {
                    // When selecting a parent, remove any child selections
                    // When selecting a child, remove any parent selections
                    const filteredPaths = prevSelectedPaths.filter(p => {
                        // Remove children of the new selection (parent overrides children)
                        if (p.length > fullItemPath.length) {
                            const isChild = fullItemPath.every((segment, index) => p[index] === segment);
                            if (isChild) return false;
                        }

                        // Remove parents of the new selection (child overrides parents)
                        if (p.length < fullItemPath.length) {
                            const isParent = p.every((segment, index) => fullItemPath[index] === segment);
                            if (isParent) return false;
                        }

                        return true;
                    });

                    newSelectedPaths = [...filteredPaths, fullItemPath];
                } else {
                    newSelectedPaths = prevSelectedPaths;
                }
            }

            // Persist to localStorage
            setTempSelectedPathsStorage(newSelectedPaths);
            return newSelectedPaths;
        });
    };

    const handleRemoveSelectedItem = (indexToRemove: number) => {
        const newSelectedPaths = tempSelectedPaths.filter((_, index) => index !== indexToRemove);
        setTempSelectedPaths(newSelectedPaths);
        // Persist to localStorage
        setTempSelectedPathsStorage(newSelectedPaths);
    };

    const handleConfirm = () => {
        if (tempSelectedPaths.length > 0 && tempSelectedPaths.length <= MAX_GENRE_SELECTIONS) {
            onSelect({ paths: tempSelectedPaths });
            onClose();
            // Clear localStorage after confirming selection
            setTempSelectedPathsStorage([]);
        } else {
            // No action needed, handleConfirm is called when tempSelectedPaths.length is 0 or > MAX_GENRE_SELECTIONS
        }
    };

    const handleCancel = () => {
        setTempSelectedPaths(currentSelectionPaths);
        // Clear localStorage when canceling
        setTempSelectedPathsStorage([]);
        onClose();
    };

    // Memoize the createMenuItems function to prevent recreation on every render
    const createMenuItems = useCallback((data: GenreSelection[], basePath: string[] = []): MenuProps['items'] => {
        if (!data || data.length === 0) return [];

        return data.map(item => {
            const itemPath = [...basePath, item.label];
            const itemHasChildren = item.selections && item.selections.length > 0;
            const itemIsDeepest = !itemHasChildren;
            const canSelectAtThisLevel = canSelectAtLevel(itemPath);
            const canSelectItem = canSelectAtThisLevel && (itemIsDeepest || itemHasChildren);
            const isSelected = tempSelectedPaths.some(p => JSON.stringify(p) === JSON.stringify(itemPath));
            const hasChildrenSelected = hasSelectedChildren(itemPath);
            const hasParentSelected = hasSelectedParent(itemPath);

            // Check if this item is part of the current navigation path (for navigation highlighting)
            const isInNavigationPath = activeNavigationPath.length > basePath.length &&
                activeNavigationPath[basePath.length] === item.label &&
                basePath.every((segment, index) => activeNavigationPath[index] === segment);

            return {
                key: itemPath.join('|'),
                label: (
                    <Flex justify="space-between" align="center" style={{
                        // Only show navigation highlighting, NOT selection highlighting
                        backgroundColor: isInNavigationPath ? '#1890ff10' : 'transparent',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        margin: '-4px -8px'
                    }}>
                        <Flex align="center">
                            {canSelectItem && (
                                <Checkbox
                                    checked={isSelected}
                                    onChange={() => handleCheckboxChange(basePath, item.label)}
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={(!isSelected && tempSelectedPaths.length >= MAX_GENRE_SELECTIONS) || hasParentSelected}
                                    style={{ marginRight: 8 }}
                                />
                            )}
                            <span style={{ opacity: hasParentSelected ? 0.5 : 1 }}>{item.label}</span>
                        </Flex>
                        {itemHasChildren && <RightOutlined style={{ fontSize: 10 }} />}
                    </Flex>
                ),
                onClick: () => {
                    if (itemHasChildren) {
                        handleNavigationClick(itemPath);
                    } else if (canSelectItem) {
                        handleCheckboxChange(basePath, item.label);
                    }
                }
            };
        });
    }, [tempSelectedPaths, activeNavigationPath]);

    // Memoize the renderSelectedItemsTags function
    const renderSelectedItemsTags = useCallback(() => {
        if (tempSelectedPaths.length === 0) return null;

        return (
            <Card size="small" style={{ marginTop: 16 }}>
                <Title level={5} style={{ marginBottom: 12, marginTop: 0 }}>已选择的故事类型</Title>
                <Space wrap size="small">
                    {tempSelectedPaths.map((path, index) => {
                        const pathString = path.join(' > ');
                        return (
                            <Tag
                                key={index}
                                closable
                                onClose={() => handleRemoveSelectedItem(index)}
                                color="blue"
                                style={{ marginBottom: 6, fontSize: '12px' }}
                            >
                                {pathString}
                            </Tag>
                        );
                    })}
                </Space>
            </Card>
        );
    }, [tempSelectedPaths]);

    // Memoize the renderMillerColumns function
    const renderMillerColumns = useMemo(() => {
        const columns: React.ReactElement[] = [];
        let currentLevelData: GenreSelection[] = genreSelections;
        let currentPathSegmentsForRender: string[] = [];

        // Root column
        const rootSelectedKeys = [];
        // Only add navigation key if we have an active navigation path
        // Don't add selected items to selectedKeys as that's for navigation, not selection
        if (activeNavigationPath.length > 0) {
            rootSelectedKeys.push(activeNavigationPath[0]);
        }

        columns.push(
            <Card key="col-root" size="small" style={{ width: COLUMN_WIDTH, height: COLUMN_HEIGHT, overflow: 'auto' }}>
                <Menu
                    mode="vertical"
                    selectedKeys={[...new Set(rootSelectedKeys)]} // Remove duplicates
                    items={createMenuItems(currentLevelData)}
                    style={{ border: 'none' }}
                />
            </Card>
        );

        // Additional columns based on navigation path
        for (let i = 0; i < activeNavigationPath.length; i++) {
            currentPathSegmentsForRender = activeNavigationPath.slice(0, i + 1);
            currentLevelData = getDataAtPath(currentPathSegmentsForRender);

            if (currentLevelData && currentLevelData.length > 0) {
                const columnSelectedKeys = [];

                // Only add navigation key if we have more navigation levels
                // Don't add selected items to selectedKeys as that's for navigation, not selection
                if (activeNavigationPath.length > i + 1) {
                    columnSelectedKeys.push(activeNavigationPath[i + 1]);
                }

                columns.push(
                    <Card key={`col-${i}`} size="small" style={{ width: COLUMN_WIDTH, height: COLUMN_HEIGHT, overflow: 'auto' }}>
                        <Menu
                            mode="vertical"
                            selectedKeys={[...new Set(columnSelectedKeys)]} // Remove duplicates
                            items={createMenuItems(currentLevelData, currentPathSegmentsForRender)}
                            style={{ border: 'none' }}
                        />
                    </Card>
                );
            } else {
                break; // No more columns to render
            }
        }

        // Add placeholder columns to maintain consistent width
        while (columns.length < MAX_COLUMNS) {
            columns.push(
                <Card key={`placeholder-${columns.length}`} size="small" style={{ width: COLUMN_WIDTH, height: COLUMN_HEIGHT, opacity: 0.3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
                        <Text type="secondary">选择左侧分类</Text>
                    </div>
                </Card>
            );
        }

        return (
            <Flex vertical style={{ height: MODAL_HEIGHT - 150 }}> {/* Reserve space for header and footer */}
                <Flex gap={COLUMN_GAP} style={{ marginBottom: 16 }}>
                    {columns}
                </Flex>
                <div style={{
                    minHeight: tempSelectedPaths.length > 0 ? 'auto' : 0,
                    maxHeight: SELECTED_ITEMS_HEIGHT,
                    overflow: tempSelectedPaths.length > 2 ? 'auto' : 'visible'
                }}>
                    {tempSelectedPaths.length > 0 && renderSelectedItemsTags()}
                </div>
            </Flex>
        );
    }, [activeNavigationPath, tempSelectedPaths, createMenuItems, renderSelectedItemsTags]);

    // Memoize the renderBreadcrumb function
    const renderBreadcrumb = useCallback(() => {
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
    }, [navigationPath]);

    // Memoize the renderSingleView function
    const renderSingleView = useMemo(() => {
        const currentDataToDisplay = getDataAtPath(navigationPath);

        return (
            <Flex vertical style={{ height: '100%' }}>
                {navigationPath.length > 0 && renderBreadcrumb()}

                <div style={{ flex: 1, paddingBottom: tempSelectedPaths.length > 0 ? 16 : 0 }}>
                    {currentDataToDisplay && currentDataToDisplay.length > 0 ? (
                        <List
                            dataSource={currentDataToDisplay}
                            renderItem={(item: GenreSelection) => {
                                const itemFullPath = [...navigationPath, item.label];
                                const isItemSelected = tempSelectedPaths.some(p => JSON.stringify(p) === JSON.stringify(itemFullPath));
                                const itemHasChildren = Boolean(item.selections && item.selections.length > 0);
                                const canSelectAtThisLevel = canSelectAtLevel(itemFullPath);
                                const canSelectItem = canSelectAtThisLevel && (!itemHasChildren || itemHasChildren);

                                return (
                                    <List.Item
                                        onClick={() => {
                                            if (itemHasChildren) {
                                                handleNavigationClick(itemFullPath);
                                            } else if (canSelectItem) {
                                                handleCheckboxChange(navigationPath, item.label);
                                            }
                                        }}
                                        style={{
                                            cursor: 'pointer',
                                            backgroundColor: isItemSelected ? '#1890ff10' : 'transparent',
                                            padding: '12px 16px',
                                            borderRadius: 6
                                        }}
                                        actions={[
                                            itemHasChildren ? <RightOutlined key="arrow" /> : null
                                        ].filter(Boolean)}
                                    >
                                        <List.Item.Meta
                                            avatar={canSelectItem ? (
                                                <Checkbox
                                                    checked={isItemSelected}
                                                    onChange={() => handleCheckboxChange(navigationPath, item.label)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    disabled={!isItemSelected && tempSelectedPaths.length >= MAX_GENRE_SELECTIONS}
                                                />
                                            ) : null}
                                            title={item.label}
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
    }, [navigationPath, tempSelectedPaths, renderBreadcrumb, renderSelectedItemsTags]);

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
                            disabled={tempSelectedPaths.length === 0 || tempSelectedPaths.length > MAX_GENRE_SELECTIONS}
                        >
                            确定 ({tempSelectedPaths.length})
                        </Button>
                    </Space>
                }
            >
                {renderSingleView}
            </Drawer>
        );
    }

    return (
        <Modal
            title="选择故事类型"
            open={visible}
            onCancel={handleCancel}
            width={MODAL_WIDTH}
            height={MODAL_HEIGHT}
            centered
            footer={
                <Flex justify="space-between" align="center">
                    <div>
                        {tempSelectedPaths.length >= MAX_GENRE_SELECTIONS && (
                            <Text type="warning" style={{ fontSize: '12px' }}>
                                已选择最大数量 ({MAX_GENRE_SELECTIONS}个)，如需选择其他类型，请先移除已选择的类型
                            </Text>
                        )}
                    </div>
                    <Space>
                        <Button onClick={handleCancel}>
                            取消
                        </Button>
                        <Button
                            type="primary"
                            onClick={handleConfirm}
                            disabled={tempSelectedPaths.length === 0 || tempSelectedPaths.length > MAX_GENRE_SELECTIONS}
                        >
                            确定 ({tempSelectedPaths.length})
                        </Button>
                    </Space>
                </Flex>
            }
        >
            {renderMillerColumns}
        </Modal>
    );
};

export default GenreSelectionPopup; 