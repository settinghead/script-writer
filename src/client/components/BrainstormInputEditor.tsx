import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, Button, Typography, message, Tag, Space, InputNumber, Input } from 'antd';
import { BulbOutlined, RightOutlined } from '@ant-design/icons';
import { useProjectData } from '../contexts/ProjectDataContext';
import { YJSArtifactProvider, useYJSField, useYJSArtifactContext } from '../transform-artifact-framework/contexts/YJSArtifactContext';
import { YJSTextField, YJSTextAreaField, YJSNumberField } from '../transform-artifact-framework/components/YJSField';
import GenreSelectionPopup, { MAX_GENRE_SELECTIONS } from './GenreSelectionPopup';
import PlatformSelection from './PlatformSelection';

const { Text, Title } = Typography;

interface BrainstormInputEditorProps {
    artifact: any;
    isEditable?: boolean;
    currentStage?: string;
    onViewOriginalIdeas?: () => void;
}

// Custom YJS Genre Selection Field Component
const YJSGenreSelectionField: React.FC<{ path: string; placeholder?: string }> = ({ path, placeholder }) => {
    const { value, updateValue, isInitialized } = useYJSField(path);
    const { updateValue: updateGenreText } = useYJSField('genre'); // Also update genre text
    const [genrePopupVisible, setGenrePopupVisible] = useState(false);

    // Parse the current value to get genre paths
    const genrePaths = useMemo(() => {
        const result = !value || !Array.isArray(value) ? [] : value;
        return result;
    }, [value]);

    // Handle genre selection
    const handleGenreSelectionConfirm = useCallback((selection: { paths: string[][] }) => {
        const genreText = selection.paths.map(path => path.join(' > ')).join(', ');
        updateValue(selection.paths);
        updateGenreText(genreText);
        setGenrePopupVisible(false);
    }, [updateValue, updateGenreText, value, genrePaths]);

    // Build genre display elements
    const buildGenreDisplayElements = useCallback((): React.ReactElement[] => {
        if (!genrePaths || !Array.isArray(genrePaths)) return [];

        return genrePaths.map((path: string[], index: number) => (
            <Tag key={index} style={{ marginBottom: '4px' }}>
                {path.join(' > ')}
            </Tag>
        ));
    }, [genrePaths]);

    if (!isInitialized) {
        return <div>加载中...</div>;
    }

    return (
        <div>
            <div style={{ marginBottom: '8px' }}>
                <Space wrap>
                    {buildGenreDisplayElements()}
                </Space>
            </div>
            <Button
                type="dashed"
                icon={<RightOutlined />}
                onClick={() => setGenrePopupVisible(true)}
                style={{ width: '100%' }}
            >
                {genrePaths.length > 0 ? '修改故事类型' : '选择故事类型'}
            </Button>

            <GenreSelectionPopup
                visible={genrePopupVisible}
                onClose={() => setGenrePopupVisible(false)}
                onSelect={handleGenreSelectionConfirm}
                currentSelectionPaths={genrePaths}
            />
        </div>
    );
};

// Custom YJS Platform Selection Field Component
const YJSPlatformSelectionField: React.FC<{ path: string; placeholder?: string }> = ({ path, placeholder }) => {
    const { value, updateValue, isInitialized } = useYJSField(path);

    const handlePlatformChange = useCallback((selectedPlatform: string) => {
        updateValue(selectedPlatform);
    }, [updateValue]);

    if (!isInitialized) {
        return <div>加载中...</div>;
    }

    return (
        <PlatformSelection
            selectedPlatform={value || ''}
            onPlatformChange={handlePlatformChange}
        />
    );
};

// Separate component that uses YJS context
const BrainstormInputForm: React.FC = () => {
    const { value: platform } = useYJSField('platform');
    const { value: genrePaths } = useYJSField('genrePaths');
    const { value: genre } = useYJSField('genre');
    const { value: numberOfIdeas } = useYJSField('numberOfIdeas');
    const { value: otherRequirements } = useYJSField('other_requirements');

    return (
        <Card
            title={
                <Space>
                    <BulbOutlined style={{ color: '#1890ff' }} />
                    <Text strong>头脑风暴需求</Text>
                </Space>
            }
            style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #434343'
            }}
        >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div>
                    <Text strong>目标平台：</Text>
                    <div style={{ marginTop: '8px' }}>
                        <YJSPlatformSelectionField path="platform" placeholder="请选择发布平台" />
                    </div>
                </div>

                <div>
                    <Text strong>故事类型</Text>
                    <div style={{ marginTop: '8px' }}>
                        <YJSGenreSelectionField path="genrePaths" />
                    </div>
                </div>

                <div>
                    <Text strong>生成创意数量</Text>
                    <div style={{ marginTop: '8px' }}>
                        <YJSNumberField path="numberOfIdeas" placeholder="3" />
                        <div style={{ marginTop: '4px' }}>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                建议生成2-3个创意进行比较选择
                            </Text>
                        </div>
                    </div>
                </div>

                <div>
                    <Text strong>其他要求 (可选)</Text>
                    <div style={{ marginTop: '8px' }}>
                        <YJSTextAreaField
                            path="other_requirements"
                            placeholder="例如：特定的情节要求、角色设定、风格偏好等"
                            rows={4}
                        />
                    </div>
                </div>
            </Space>
        </Card>
    );
};

// Main component
const BrainstormInputEditor: React.FC<BrainstormInputEditorProps> = ({
    artifact,
    isEditable = true
}) => {
    if (!artifact) {
        return (
            <Card style={{ backgroundColor: '#1a1a1a', border: '1px solid #434343' }}>
                <Text type="secondary">未找到头脑风暴输入数据</Text>
            </Card>
        );
    }

    return (
        <YJSArtifactProvider artifactId={artifact.id}>
            <BrainstormInputForm />
        </YJSArtifactProvider>
    );
};

export default BrainstormInputEditor; 