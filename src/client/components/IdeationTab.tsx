import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, Typography, Spin, Alert, Select, Row, Col, Divider, Modal, Drawer } from 'antd';
import { SendOutlined, RightOutlined, LeftOutlined } from '@ant-design/icons';
import { jsonrepair } from 'jsonrepair';

// Use a hardcoded template instead of importing from a file
// The content is directly copied from src/client/ideation.txt
const ideationTemplate = `
你是一个短视频编剧。你的任务是根据用户输入的灵感，创作一个短视频的情节提要（ Plot Outline ）。

Guidelines：

\`\`\`
1. 情节具体且明确：精确具体地明确故事的核心情节、主要事件和角色的关键行动。
2.每个主要角色的动机清晰，知道"为什么角色为什么要做某些事情"
3. 有明确的冲突或目标
4.故事完整，叙事闭环
5. 去除笼统的概括语句。不使用任何修辞手法。只描述事件，不描述其他

\`\`\`
接下来，你需要将用户输入的灵感改编为故事情节。故事需要充满着激烈的冲突和张力。
步骤1：分析用户输入的灵感，并确定最适合的叙事范式。这类叙事中最为知名的作品通常在哪种特定媒体或平台上找到（例如起点中文网的悬疑频道、电视上的法制悬疑系列等）。
步骤2：利用你刚才提到的，会出现的平台风格，根据用户输入灵感，创作出小说剧情。请想象小说已经写出，是短篇小说，而你现在将它缩写为200字左右的情节提要（Plot Outline）。情节提要（Plot Outline）剧情需要由具体的事件组成，所有内容都被写出，起承转合结构，第一人称。剧情要具体，参考情节提要（Plot Outline）guidelines

目标平台：{platform}
故事类型：{genre}
---
请按照步骤执行，用户输入的灵感是：
请以JSON格式回复，包含以下字段:
{
  "mediaType": "适合的媒体类型，例如'小说'、'电视剧'等",
  "platform": "推荐的发布平台，例如'起点中文网悬疑频道'等",
  "plotOutline": "500字左右的情节提要，以第一人称编写",
  "analysis": "简短分析为什么这个故事适合上述平台"
}

用户需求：
{user_input}


`;

// Idea generation template
const ideaGenerationTemplate = `
你是一个创意生成器。请根据给定的故事类型，生成一个简短、具体、有趣的创意灵感句子。

故事类型：{genre}
目标平台：{platform}

要求：
- 只需要一句话（15-30字）
- 要具体，不要抽象
- 要有冲突或戏剧性
- 适合短视频/短剧格式

请直接返回这一句创意，不要其他解释。
`;

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// Platform options for short drama platforms
const platformOptions = [
    { value: '抖音', label: '抖音 (Douyin)' },
    { value: '快手', label: '快手 (Kuaishou)' },
    { value: '小红书', label: '小红书 (Xiaohongshu)' },
    { value: 'B站', label: 'B站 (Bilibili)' },
    { value: '微博', label: '微博 (Weibo)' },
    { value: '腾讯视频', label: '腾讯视频 (Tencent Video)' },
    { value: '爱奇艺', label: '爱奇艺 (iQiyi)' },
    { value: '优酷', label: '优酷 (Youku)' },
    { value: '芒果TV', label: '芒果TV (Mango TV)' },
    { value: '西瓜视频', label: '西瓜视频 (Xigua Video)' }
];

// Genre hierarchy based on the provided text
const genreOptions = {
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

// Genre Selection Popup Component
interface GenreSelectionPopupProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (path: string[]) => void;
    currentSelection: string[];
}

const GenreSelectionPopup: React.FC<GenreSelectionPopupProps> = ({
    visible,
    onClose,
    onSelect,
    currentSelection
}) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [navigationPath, setNavigationPath] = useState<string[]>([]);
    const [tempSelectedPath, setTempSelectedPath] = useState<string[]>(currentSelection);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (visible) {
            setTempSelectedPath(currentSelection);
            setNavigationPath([]);
        }
    }, [visible, currentSelection]);

    // Get data at specific path
    const getDataAtPath = (path: string[]) => {
        let current: any = genreOptions;
        for (const segment of path) {
            current = current[segment];
            if (!current) return null;
        }
        return current;
    };

    // Check if item has children (is expandable)
    const hasChildren = (path: string[], key: string) => {
        const data = getDataAtPath([...path, key]);
        return data && typeof data === 'object' && !Array.isArray(data);
    };

    // Check if this is the deepest meaningful level
    const isDeepestLevel = (path: string[], key: string) => {
        const data = getDataAtPath([...path, key]);
        if (Array.isArray(data)) {
            return data.length <= 1; // If only one option or empty, it's effectively deepest
        }
        if (typeof data === 'object') {
            const children = Object.keys(data);
            if (children.length === 1) {
                // Check if the single child is also single-option
                const childData = data[children[0]];
                if (Array.isArray(childData) && childData.length <= 1) {
                    return true;
                }
            }
        }
        return false;
    };

    // Handle item click - now just updates temp selection, doesn't close
    const handleItemClick = (path: string[], key: string, columnIndex: number = 0) => {
        // Use the actual column index to determine the selection level
        const newPath = [...tempSelectedPath.slice(0, columnIndex), key];

        if (hasChildren(path, key) && !isDeepestLevel(path, key)) {
            // Navigate deeper
            if (isMobile) {
                setNavigationPath(newPath);
            } else {
                setTempSelectedPath(newPath);
            }
        } else {
            // This is a final selection but don't close yet
            setTempSelectedPath(newPath);
        }
    };

    // Handle confirm button
    const handleConfirm = () => {
        if (tempSelectedPath.length >= 3) {
            onSelect(tempSelectedPath);
            onClose();
        }
    };

    // Handle cancel
    const handleCancel = () => {
        setTempSelectedPath(currentSelection);
        onClose();
    };

    // Render Miller Columns (Desktop)
    const renderMillerColumns = () => {
        const columns = [];
        let currentData = genreOptions;
        let currentPath: string[] = [];

        // Add root column
        columns.push(
            <div key="root" style={{
                width: '200px',
                borderRight: '1px solid #303030',
                height: '400px',
                overflowY: 'auto'
            }}>
                {Object.keys(currentData).map(key => (
                    <div
                        key={key}
                        onClick={() => handleItemClick(currentPath, key, 0)}
                        style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            backgroundColor: tempSelectedPath[0] === key ? '#1890ff20' : 'transparent',
                            borderLeft: tempSelectedPath[0] === key ? '3px solid #1890ff' : '3px solid transparent',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffffff10'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tempSelectedPath[0] === key ? '#1890ff20' : 'transparent'}
                    >
                        <span>{key}</span>
                        {hasChildren(currentPath, key) && <RightOutlined style={{ fontSize: '10px' }} />}
                    </div>
                ))}
            </div>
        );

        // Add subsequent columns based on selection
        for (let i = 0; i < tempSelectedPath.length && i < 4; i++) {
            currentPath = tempSelectedPath.slice(0, i + 1);
            currentData = getDataAtPath(currentPath);

            if (currentData && typeof currentData === 'object' && !Array.isArray(currentData)) {
                columns.push(
                    <div key={`column-${i}`} style={{
                        width: '200px',
                        borderRight: '1px solid #303030',
                        height: '400px',
                        overflowY: 'auto'
                    }}>
                        {Object.keys(currentData).map(key => (
                            <div
                                key={key}
                                onClick={() => handleItemClick(currentPath, key, i + 1)}
                                style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    backgroundColor: tempSelectedPath[i + 1] === key ? '#1890ff20' : 'transparent',
                                    borderLeft: tempSelectedPath[i + 1] === key ? '3px solid #1890ff' : '3px solid transparent',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffffff10'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tempSelectedPath[i + 1] === key ? '#1890ff20' : 'transparent'}
                            >
                                <span>{key}</span>
                                {hasChildren(currentPath, key) && !isDeepestLevel(currentPath, key) && (
                                    <RightOutlined style={{ fontSize: '10px' }} />
                                )}
                            </div>
                        ))}
                    </div>
                );
            }
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '400px', overflow: 'hidden' }}>
                {/* Current selection display */}
                {tempSelectedPath.length > 0 && (
                    <div style={{
                        padding: '12px 16px',
                        backgroundColor: '#1a1a1a',
                        borderBottom: '1px solid #303030',
                        fontSize: '12px',
                        color: '#52c41a',
                        marginBottom: '8px'
                    }}>
                        当前选择: {tempSelectedPath.join(' > ')}
                    </div>
                )}

                <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
                    {columns}
                </div>
            </div>
        );
    };

    // Render Single View Navigation (Mobile)
    const renderSingleView = () => {
        const currentData = getDataAtPath(navigationPath);
        const breadcrumbs = navigationPath.length > 0 ? navigationPath : ['选择类型'];

        return (
            <div style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
                {/* Breadcrumbs */}
                <div style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #303030',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
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

                {/* Current selection display */}
                {tempSelectedPath.length > 0 && (
                    <div style={{
                        padding: '8px 16px',
                        backgroundColor: '#1a1a1a',
                        borderBottom: '1px solid #303030',
                        fontSize: '12px',
                        color: '#52c41a'
                    }}>
                        当前选择: {tempSelectedPath.join(' > ')}
                    </div>
                )}

                {/* Items */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                    {currentData && typeof currentData === 'object' && !Array.isArray(currentData) &&
                        Object.keys(currentData).map(key => (
                            <div
                                key={key}
                                onClick={() => handleItemClick(navigationPath, key, navigationPath.length)}
                                style={{
                                    padding: '12px 16px',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #2a2a2a',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    backgroundColor: tempSelectedPath.includes(key) ? '#1890ff10' : 'transparent'
                                }}
                            >
                                <span>{key}</span>
                                {hasChildren(navigationPath, key) && !isDeepestLevel(navigationPath, key) && (
                                    <RightOutlined style={{ fontSize: '12px', color: '#666' }} />
                                )}
                            </div>
                        ))
                    }
                </div>
            </div>
        );
    };

    if (isMobile) {
        return (
            <Drawer
                title="选择故事类型"
                placement="bottom"
                height="60vh"
                onClose={handleCancel}
                open={visible}
                footer={
                    <div style={{ textAlign: 'right', padding: '16px 0' }}>
                        <Button onClick={handleCancel} style={{ marginRight: '8px' }}>
                            取消
                        </Button>
                        <Button
                            type="primary"
                            onClick={handleConfirm}
                            disabled={tempSelectedPath.length < 3}
                        >
                            确定
                        </Button>
                    </div>
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
            width={800}
            footer={[
                <Button key="cancel" onClick={handleCancel}>
                    取消
                </Button>,
                <Button
                    key="confirm"
                    type="primary"
                    onClick={handleConfirm}
                    disabled={tempSelectedPath.length < 3}
                >
                    确定
                </Button>
            ]}
        >
            {renderMillerColumns()}
        </Modal>
    );
};

interface IdeationResponse {
    mediaType?: string;
    platform?: string;
    plotOutline?: string;
    analysis?: string;
    // Add any other fields that might be in the response
}

const IdeationTab: React.FC = () => {
    const [userInput, setUserInput] = useState('古早言情剧');
    const [selectedPlatform, setSelectedPlatform] = useState<string>('');
    const [selectedGenrePath, setSelectedGenrePath] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);
    const [genrePopupVisible, setGenrePopupVisible] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [result, setResult] = useState<IdeationResponse | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setUserInput(e.target.value);
    };

    const handlePlatformChange = (value: string) => {
        setSelectedPlatform(value);
    };

    const handleGenreSelection = (path: string[]) => {
        setSelectedGenrePath(path);
    };

    // Check if genre selection is complete (for dice button)
    const isGenreSelectionComplete = () => {
        return selectedGenrePath.length >= 3; // At least main > sub > detail
    };

    // Build genre string for the prompt
    const buildGenreString = () => {
        return selectedGenrePath.join(' > ');
    };

    // Generate a one-sentence idea using LLM
    const generateIdea = async () => {
        if (!isGenreSelectionComplete()) {
            return;
        }

        // Check if there's substantial content and confirm replacement
        if (userInput.length > 5) {
            const confirmed = window.confirm('当前输入框有内容，是否要替换为新的创意？');
            if (!confirmed) {
                return;
            }
        }

        setIsGeneratingIdea(true);
        setError(null);

        try {
            const genreString = buildGenreString();
            const prompt = ideaGenerationTemplate
                .replace('{genre}', genreString)
                .replace('{platform}', selectedPlatform || '通用短视频平台');

            const response = await fetch('/llm-api/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'user', content: prompt }
                    ],
                    stream: false // Explicitly disable streaming
                })
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            // Parse as regular JSON response
            const data = await response.json();

            // Extract the content from the response
            let ideaText = '';
            if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                ideaText = data.choices[0].message.content.trim();
            } else {
                throw new Error('无法从响应中提取内容');
            }

            if (ideaText && ideaText.length > 5) {
                setUserInput(ideaText);
            } else {
                throw new Error('生成的创意内容为空');
            }

        } catch (err) {
            console.error('Error generating idea:', err);
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setIsGeneratingIdea(false);
        }
    };

    const generateIdeation = async () => {
        if (!userInput.trim()) {
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);

        // Create a new AbortController for this request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            // Create the prompt by replacing placeholders in the template
            const fullPrompt = ideationTemplate
                .replace('{user_input}', userInput)
                .replace('{platform}', selectedPlatform || '未指定')
                .replace('{genre}', buildGenreString() || '未指定');

            const response = await fetch('/llm-api/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'user', content: fullPrompt }
                    ],
                    response_format: { type: 'json_object' },
                    stream: false // Explicitly disable streaming
                }),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            // Parse as regular JSON response
            const data = await response.json();

            // Extract the content from the response
            let contentText = '';
            if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                contentText = data.choices[0].message.content.trim();
            } else {
                throw new Error('无法从响应中提取内容');
            }

            // Parse the content as JSON (since we requested JSON format)
            try {
                const jsonResult = JSON.parse(contentText) as IdeationResponse;
                setResult(jsonResult);
            } catch (parseError) {
                // If JSON parsing fails, try with jsonrepair
                try {
                    const repairedJson = jsonrepair(contentText);
                    const jsonResult = JSON.parse(repairedJson) as IdeationResponse;
                    setResult(jsonResult);
                } catch (repairError) {
                    console.error('Failed to parse JSON even after repair:', repairError);
                    console.log('Raw content:', contentText);
                    setError(new Error('响应格式不正确，无法解析为JSON'));
                }
            }

        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('Request was aborted');
            } else {
                console.error('Error generating ideation:', err);
                setError(err instanceof Error ? err : new Error(String(err)));
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    // Cleanup function to abort any ongoing fetch when component unmounts
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return (
        <div style={{ padding: '20px', maxWidth: '600px', width: "100%", margin: '0 auto', overflow: "auto" }}>
            <Title level={4}>灵感生成器</Title>
            <Paragraph>
                输入你的灵感，AI将帮你构建故事情节提要。
            </Paragraph>

            <div style={{ marginBottom: '16px' }}>
                <Text strong>目标平台:</Text>
                <Select
                    style={{ width: '100%' }}
                    placeholder="选择目标平台"
                    options={platformOptions}
                    value={selectedPlatform}
                    onChange={handlePlatformChange}
                />
            </div>

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
                    {selectedGenrePath.length > 0 ? (
                        <span style={{ color: '#d9d9d9' }}>
                            {buildGenreString()}
                        </span>
                    ) : (
                        <span style={{ color: '#666' }}>
                            点击选择故事类型
                        </span>
                    )}
                    <RightOutlined style={{ fontSize: '12px', color: '#666' }} />
                </div>
            </div>

            <GenreSelectionPopup
                visible={genrePopupVisible}
                onClose={() => setGenrePopupVisible(false)}
                onSelect={handleGenreSelection}
                currentSelection={selectedGenrePath}
            />

            {/* Only show subsequent elements when genre selection is complete */}
            {isGenreSelectionComplete() ? (
                <>
                    <Divider style={{ margin: '24px 0' }} />

                    {/* Idea Generator Section */}
                    <div style={{
                        marginBottom: '24px',
                        textAlign: 'center',
                        padding: '16px',
                        background: '#1a1a1a',
                        borderRadius: '8px',
                        border: '1px solid #303030'
                    }}>
                        <Text strong style={{ display: 'block', marginBottom: '12px', color: '#d9d9d9' }}>
                            创意生成器
                        </Text>
                        <Text type="secondary" style={{ display: 'block', marginBottom: '16px', fontSize: '12px' }}>
                            基于选择的类型生成创意灵感
                        </Text>
                        <Button
                            type="primary"
                            size="large"
                            onClick={generateIdea}
                            loading={isGeneratingIdea}
                            style={{
                                background: '#52c41a',
                                borderColor: '#52c41a',
                                fontSize: '16px',
                                height: '40px',
                                minWidth: '120px'
                            }}
                        >
                            <span style={{ marginRight: '8px' }}>🎲</span>
                            {isGeneratingIdea ? '生成中...' : '随机创意'}
                        </Button>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <Text strong style={{ display: 'block', marginBottom: '8px' }}>创作灵感:</Text>
                        <TextArea
                            rows={4}
                            value={userInput}
                            onChange={handleInputChange}
                            placeholder="输入你的创作灵感..."
                            disabled={isLoading || isGeneratingIdea}
                            style={{
                                background: isGeneratingIdea ? '#2a2a2a' : undefined,
                                borderColor: isGeneratingIdea ? '#52c41a' : undefined
                            }}
                        />
                    </div>

                    {/* Only show generate button when there's text input */}
                    {userInput.trim() && (
                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={generateIdeation}
                            loading={isLoading}
                            style={{ marginBottom: '24px', marginRight: '8px' }}
                        >
                            生成
                        </Button>
                    )}

                    {error && (
                        <Alert
                            message="Error"
                            description={error.message}
                            type="error"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    )}

                    {(isLoading || result) && (
                        <div
                            style={{
                                marginTop: '16px',
                                padding: '16px',
                                border: '1px solid #303030',
                                borderRadius: '8px',
                                backgroundColor: '#141414'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <Text strong style={{ fontSize: '16px' }}>生成结果</Text>
                                {isLoading && <Spin />}
                            </div>

                            {result ? (
                                <div>
                                    {result.mediaType && (
                                        <div style={{ marginBottom: '16px' }}>
                                            <Text strong>适合媒体类型:</Text> {result.mediaType}
                                        </div>
                                    )}

                                    {result.platform && (
                                        <div style={{ marginBottom: '16px' }}>
                                            <Text strong>推荐平台:</Text> {result.platform}
                                        </div>
                                    )}

                                    {result.plotOutline && (
                                        <div style={{ marginBottom: '16px' }}>
                                            <Text strong>情节提要:</Text>
                                            <Paragraph style={{
                                                padding: '12px',
                                                backgroundColor: '#1f1f1f',
                                                borderRadius: '8px',
                                                marginTop: '8px'
                                            }}>
                                                {result.plotOutline}
                                            </Paragraph>
                                        </div>
                                    )}

                                    {result.analysis && (
                                        <div>
                                            <Text strong>分析:</Text>
                                            <Paragraph style={{
                                                padding: '12px',
                                                backgroundColor: '#1f1f1f',
                                                borderRadius: '8px',
                                                marginTop: '8px'
                                            }}>
                                                {result.analysis}
                                            </Paragraph>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <pre style={{
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        color: '#d9d9d9'
                                    }}>
                                        {''}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                /* Progress hint when genre selection is incomplete */
                <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#666',
                    background: '#1a1a1a',
                    borderRadius: '8px',
                    border: '1px solid #303030',
                    marginTop: '24px'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                    <Text type="secondary" style={{ fontSize: '16px', display: 'block', marginBottom: '8px' }}>
                        请先完成故事类型选择以继续
                    </Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                        需要选择完整的类型层级（至少3层）
                    </Text>
                </div>
            )}
        </div>
    );
};

export default IdeationTab; 