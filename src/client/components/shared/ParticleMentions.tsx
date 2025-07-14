import React, { useState, useCallback, useMemo } from 'react';
import { Mentions, Spin, Typography, Tag } from 'antd';
import { SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import { useParticleSearch, ParticleSearchResult } from '../../hooks/useParticleSearch';
import { useDebounce } from '../../hooks/useDebounce';

const { Text } = Typography;

export interface ParticleMentionsProps {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    projectId: string;
    disabled?: boolean;
    rows?: number;
    className?: string;
    style?: React.CSSProperties;
}

export const ParticleMentions: React.FC<ParticleMentionsProps> = ({
    value,
    onChange,
    placeholder = '输入 @ 来搜索粒子...',
    projectId,
    disabled = false,
    rows = 4,
    className,
    style
}) => {
    const [searchText, setSearchText] = useState('');
    const debouncedSearchText = useDebounce(searchText, 300);

    const { particles, loading, error, searchParticles, clearResults } = useParticleSearch({
        projectId,
        limit: 20
    });

    // Trigger search when debounced text changes
    React.useEffect(() => {
        if (debouncedSearchText.trim()) {
            searchParticles(debouncedSearchText);
        } else {
            clearResults();
        }
    }, [debouncedSearchText, searchParticles, clearResults]);

    const handleSearch = useCallback((text: string) => {
        setSearchText(text);
    }, []);

    const handleSelect = useCallback((option: any) => {
        // Clear search when an option is selected
        setSearchText('');
        clearResults();
    }, [clearResults]);

    // Convert particles to Mentions options format
    const mentionOptions = useMemo(() => {
        return particles.map(particle => ({
            value: particle.id,
            label: (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileTextOutlined style={{ color: '#1890ff' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '14px' }}>
                            {particle.title}
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: '#666',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>
                            {particle.content_preview}
                        </div>
                    </div>
                    <Tag color="blue">
                        {particle.type}
                    </Tag>
                </div>
            ),
            // Store particle data for reference
            particle
        }));
    }, [particles]);

    return (
        <div className={className} style={style}>
            <Mentions
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                disabled={disabled}
                rows={rows}
                prefix="@"
                options={mentionOptions}
                onSearch={handleSearch}
                onSelect={handleSelect}
                loading={loading}
                notFoundContent={
                    loading ? (
                        <div style={{ textAlign: 'center', padding: '12px' }}>
                            <Spin size="small" />
                            <Text style={{ marginLeft: 8, color: '#666' }}>搜索中...</Text>
                        </div>
                    ) : searchText && !particles.length ? (
                        <div style={{ textAlign: 'center', padding: '12px' }}>
                            <SearchOutlined style={{ color: '#ccc' }} />
                            <Text style={{ marginLeft: 8, color: '#999' }}>
                                未找到匹配的粒子
                            </Text>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '12px' }}>
                            <Text style={{ color: '#999' }}>
                                输入关键词搜索粒子
                            </Text>
                        </div>
                    )
                }
                filterOption={false} // Disable client-side filtering since we use server-side search
                style={{ width: '100%' }}
            />
            {error && (
                <div style={{ marginTop: 4, color: '#ff4d4f', fontSize: '12px' }}>
                    {error}
                </div>
            )}
        </div>
    );
};

export default ParticleMentions; 