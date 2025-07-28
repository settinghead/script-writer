import React, { useState } from 'react';
import { Typography, Input, Tag, Space, InputNumber } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import GenreSelectionPopup from './GenreSelectionPopup';
import PlatformSelection from './PlatformSelection';
import { MAX_GENRE_SELECTIONS } from './GenreSelectionPopup';
import AIButton from './shared/AIButton';

const { Text } = Typography;

interface BrainstormingInputFormProps {
    selectedPlatform: string;
    selectedGenrePaths: string[][];
    requirements: string;
    numberOfIdeas: number;
    onPlatformChange: (value: string) => void;
    onGenreSelectionChange: (paths: string[][]) => void;
    onRequirementsChange: (value: string) => void;
    onNumberOfIdeasChange: (value: number) => void;
    onGenerate: () => void;
    isGenerating?: boolean;
}

const BrainstormingInputForm: React.FC<BrainstormingInputFormProps> = ({
    selectedPlatform,
    selectedGenrePaths,
    requirements,
    numberOfIdeas,
    onPlatformChange,
    onGenreSelectionChange,
    onRequirementsChange,
    onNumberOfIdeasChange,
    onGenerate,
    isGenerating = false
}) => {
    const [genrePopupVisible, setGenrePopupVisible] = useState(false);

    const handleGenreSelectionConfirm = (selection: { paths: string[][] }) => {
        onGenreSelectionChange(selection.paths);
        setGenrePopupVisible(false);
    };

    const isGenreSelectionComplete = () => {
        return selectedGenrePaths.length > 0 && selectedGenrePaths.every(path => path.length > 0);
    };

    const buildGenreDisplayElements = (): React.ReactElement[] => {
        return selectedGenrePaths.map((path, index) => {
            const genreText = path.join(' > ');
            return (
                <Tag key={index} color="blue" style={{ marginBottom: 4 }}>
                    {genreText}
                </Tag>
            );
        });
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            maxWidth: '800px',
            margin: '0 auto',
            padding: '20px 0'
        }}>
            {/* Platform Selection */}
            <div>

                <PlatformSelection
                    selectedPlatform={selectedPlatform}
                    onPlatformChange={onPlatformChange}
                />
            </div>

            {/* Genre Selection */}
            <div>
                <Text style={{ color: '#d9d9d9', marginBottom: '8px', display: 'block', fontWeight: 500 }}>
                    故事类型
                </Text>
                <GenreSelectionPopup
                    visible={genrePopupVisible}
                    onClose={() => setGenrePopupVisible(false)}
                    onSelect={handleGenreSelectionConfirm}
                    currentSelectionPaths={selectedGenrePaths}
                />
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
                        <div style={{ color: '#d9d9d9', cursor: 'pointer', flex: 1 }}>
                            <Space wrap>
                                {buildGenreDisplayElements()}
                            </Space>
                        </div>
                    ) : (
                        <span style={{ color: '#666', cursor: 'pointer' }}>
                            点击选择故事类型 (可多选, 最多{MAX_GENRE_SELECTIONS}个)
                        </span>
                    )}
                    <RightOutlined style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }} />
                </div>
            </div>

            <GenreSelectionPopup
                visible={genrePopupVisible}
                onClose={() => setGenrePopupVisible(false)}
                onSelect={handleGenreSelectionConfirm}
                currentSelectionPaths={selectedGenrePaths}
            />

            {/* Number of Ideas Selection */}
            <div>
                <Text style={{ color: '#d9d9d9', marginBottom: '8px', display: 'block', fontWeight: 500 }}>
                    生成创意数量
                </Text>
                <InputNumber
                    min={1}
                    max={4}
                    value={numberOfIdeas}
                    onChange={(value) => onNumberOfIdeasChange(value || 3)}
                    style={{
                        width: '100%',
                        background: '#141414',
                        borderColor: '#434343',
                        color: '#d9d9d9'
                    }}
                    size="large"
                    placeholder="选择要生成的创意数量 (1-4)"
                />
                <Text style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    建议生成2-3个创意进行对比选择
                </Text>
            </div>

            {/* Requirements Input */}
            <div>
                <Text style={{ color: '#d9d9d9', marginBottom: '8px', display: 'block', fontWeight: 500 }}>
                    其他要求 (可选)
                </Text>
                <Input.TextArea
                    value={requirements}
                    onChange={(e) => onRequirementsChange(e.target.value)}
                    placeholder="请输入故事的具体要求，如角色设定、情节偏好等..."
                    rows={3}
                    style={{
                        background: '#141414',
                        border: '1px solid #434343',
                        color: '#d9d9d9'
                    }}
                />
            </div>

            {/* Generate Button */}
            <AIButton
                onClick={onGenerate}
                loading={isGenerating}
                disabled={!isGenreSelectionComplete()}
                size="large"
                style={{
                    height: '44px',
                    fontSize: '16px',
                    fontWeight: 500
                }}
            >
                {isGenerating ? '生成中...' : `开始头脑风暴 (${numberOfIdeas}个创意)`}
            </AIButton>
        </div>
    );
};

export default BrainstormingInputForm; 