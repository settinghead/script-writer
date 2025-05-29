import React, { useState } from 'react';
import { Button, Typography, Input } from 'antd';
import { BulbOutlined, RightOutlined } from '@ant-design/icons';
import GenreSelectionPopup from './GenreSelectionPopup';
import PlatformSelection from './PlatformSelection';

const { Text } = Typography;

interface BrainstormingInputFormProps {
    selectedPlatform: string;
    selectedGenrePaths: string[][];
    genreProportions: number[];
    requirements: string;
    onPlatformChange: (value: string) => void;
    onGenreSelectionChange: (paths: string[][], proportions: number[]) => void;
    onRequirementsChange: (value: string) => void;
    onGenerate: () => void;
    isGenerating?: boolean;
}

const BrainstormingInputForm: React.FC<BrainstormingInputFormProps> = ({
    selectedPlatform,
    selectedGenrePaths,
    genreProportions,
    requirements,
    onPlatformChange,
    onGenreSelectionChange,
    onRequirementsChange,
    onGenerate,
    isGenerating = false
}) => {
    const [genrePopupVisible, setGenrePopupVisible] = useState(false);

    const handleGenreSelectionConfirm = (selection: { paths: string[][]; proportions: number[] }) => {
        onGenreSelectionChange(selection.paths, selection.proportions);
        setGenrePopupVisible(false);
    };

    const isGenreSelectionComplete = () => {
        return selectedGenrePaths.length > 0 && selectedGenrePaths.every(path => path.length > 0);
    };

    const buildGenreDisplayElements = (): (JSX.Element | string)[] => {
        return selectedGenrePaths.map((path, index) => {
            const genreText = path.join(' > ');
            const proportion = genreProportions[index];
            const proportionText = proportion ? ` (${proportion}%)` : '';

            return (
                <span key={index} style={{ marginRight: '8px', marginBottom: '4px', display: 'inline-block' }}>
                    {genreText}{proportionText}
                    {index < selectedGenrePaths.length - 1 && ', '}
                </span>
            );
        });
    };

    return (
        <div style={{
            padding: '16px',
            background: '#1a1a1a',
            borderRadius: '8px',
            border: '1px solid #303030',
            marginBottom: '24px'
        }}>
            <div style={{ marginBottom: '16px' }}>
                <Text strong style={{ fontSize: '16px', color: '#d9d9d9' }}>
                    💡 头脑风暴
                </Text>
                <Text type="secondary" style={{ display: 'block', fontSize: '12px', marginTop: '4px' }}>
                    选择平台和类型，生成故事灵感
                </Text>
            </div>

            <PlatformSelection
                selectedPlatform={selectedPlatform}
                onPlatformChange={onPlatformChange}
            />

            <div style={{ marginBottom: '16px' }}>
                <Text strong style={{ display: 'block', marginBottom: '8px' }}>故事类型:</Text>
                <div
                    onClick={() => setGenrePopupVisible(true)}
                    style={{
                        border: '1px solid #434343',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        minHeight: '32px',
                        cursor: 'pointer',
                        background: '#141414',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#1890ff'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#434343'}
                >
                    {selectedGenrePaths.length > 0 ? (
                        <span style={{ color: '#d9d9d9', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                {buildGenreDisplayElements()}
                            </div>
                        </span>
                    ) : (
                        <span style={{ color: '#666', cursor: 'pointer' }}>
                            点击选择故事类型 (可多选, 最多3个)
                        </span>
                    )}
                    <RightOutlined style={{ fontSize: '12px', color: '#666' }} />
                </div>
            </div>

            <GenreSelectionPopup
                visible={genrePopupVisible}
                onClose={() => setGenrePopupVisible(false)}
                onSelect={handleGenreSelectionConfirm}
                currentSelectionPaths={selectedGenrePaths}
            />

            <div style={{ marginBottom: '16px' }}>
                <Text strong style={{ display: 'block', marginBottom: '8px' }}>特殊要求:</Text>
                <Input
                    value={requirements}
                    onChange={(e) => onRequirementsChange(e.target.value)}
                    placeholder="可以留空，或添加具体要求，例如：要狗血、要反转、要搞笑等"
                    style={{
                        background: '#141414',
                        border: '1px solid #434343',
                        borderRadius: '6px'
                    }}
                />
                <Text type="secondary" style={{ fontSize: '11px', marginTop: '4px', display: 'block' }}>
                    AI将根据您的特殊要求来生成故事灵感
                </Text>
            </div>

            <Button
                type="primary"
                icon={<BulbOutlined />}
                onClick={onGenerate}
                disabled={!isGenreSelectionComplete() || isGenerating}
                loading={isGenerating}
                style={{
                    width: '100%',
                    height: '40px',
                    background: isGenreSelectionComplete() && !isGenerating ? '#1890ff' : '#434343',
                    borderColor: isGenreSelectionComplete() && !isGenerating ? '#1890ff' : '#434343'
                }}
            >
                {isGenerating ? '正在生成故事灵感...' : '生成故事灵感'}
            </Button>
        </div>
    );
};

export default BrainstormingInputForm; 