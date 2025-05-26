import React from 'react';
import { Select, Typography } from 'antd';

const { Text } = Typography;
const { Option } = Select;

// Platform options for short drama platforms
export const platformOptions = [
    { value: '抖音', label: '抖音 (Douyin)' },
    { value: '快手', label: '快手 (Kuaishou)', disabled: true },
    { value: '小红书', label: '小红书 (Xiaohongshu)', disabled: true },
    { value: 'B站', label: 'B站 (Bilibili)', disabled: true },
    { value: '微博', label: '微博 (Weibo)', disabled: true },
    { value: '腾讯视频', label: '腾讯视频 (Tencent Video)', disabled: true },
    { value: '爱奇艺', label: '爱奇艺 (iQiyi)', disabled: true },
    { value: '优酷', label: '优酷 (Youku)', disabled: true },
    { value: '芒果TV', label: '芒果TV (Mango TV)', disabled: true },
    { value: '西瓜视频', label: '西瓜视频 (Xigua Video)', disabled: true }
];

interface PlatformSelectionProps {
    selectedPlatform: string;
    onPlatformChange: (value: string) => void;
    disabledOptions?: string[]; // Optional array of platform values to disable
}

const PlatformSelection: React.FC<PlatformSelectionProps> = ({
    selectedPlatform,
    onPlatformChange,
    disabledOptions = [] // Default to empty array if not provided
}) => {
    // If no platform is selected and 抖音 is available, select it by default
    React.useEffect(() => {
        if (!selectedPlatform && !disabledOptions.includes('抖音')) {
            onPlatformChange('抖音');
        }
    }, []);

    // Filter and transform options based on disabledOptions
    const options = platformOptions.map(option => ({
        ...option,
        disabled: disabledOptions.includes(option.value) || option.disabled
    }));

    return (
        <div style={{ marginBottom: '16px' }}>
            <Text strong>目标平台:</Text>
            <Select
                style={{ width: '100%' }}
                placeholder="选择目标平台"
                options={options}
                value={selectedPlatform}
                onChange={onPlatformChange}
            />
        </div>
    );
};

export default PlatformSelection; 