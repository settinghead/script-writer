import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, Typography, List, Button, Progress, message, Space, Checkbox } from 'antd';
import type { AffectedJsondoc } from '../../common/staleDetection';
import { useProjectData } from '../contexts/ProjectDataContext';

const { Text, Title } = Typography;

interface AffectedJsondocsPanelProps {
    projectId: string;
    affected: AffectedJsondoc[];
    compact?: boolean; // render as an inline compact tile for juxtaposition with actions
}

export const AffectedJsondocsPanel: React.FC<AffectedJsondocsPanelProps> = ({ projectId, affected, compact = false }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const projectData = useProjectData();

    // selection state: default select all on affected change
    const [selected, setSelected] = useState<Set<string>>(new Set());
    useEffect(() => {
        setSelected(new Set(affected.map(a => a.jsondocId)));
    }, [affected]);

    const subscribeProgress = useCallback(() => {
        try {
            const es = new EventSource(`/api/auto-fix/stream/${projectId}`);
            es.onmessage = (evt) => {
                try {
                    const data = JSON.parse(evt.data);
                    if (data.type === 'start') {
                        setProgress(0);
                    } else if (data.type === 'progress' && data.total > 0) {
                        setProgress(Math.round((data.processed / data.total) * 100));
                    } else if (data.type === 'done') {
                        setProgress(100);
                        es.close();
                    }
                } catch { }
            };
            es.onerror = () => es.close();
            return es;
        } catch {
            return null;
        }
    }, [projectId]);

    const total = affected.length;
    const selectedCount = selected.size;

    const toggleOne = useCallback((id: string, checked: boolean) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (checked) next.add(id); else next.delete(id);
            return next;
        });
    }, []);

    const allChecked = selectedCount === total && total > 0;
    const noneChecked = selectedCount === 0;
    const toggleAll = useCallback((checked: boolean) => {
        if (checked) setSelected(new Set(affected.map(a => a.jsondocId)));
        else setSelected(new Set());
    }, [affected]);

    // Build upstream names from affected.sources
    const upstreamNames = useMemo(() => {
        const idSet = new Set<string>();
        const names: string[] = [];
        const jsondocs = Array.isArray(projectData.jsondocs) ? projectData.jsondocs as any[] : [];
        const getName = (id: string, schemaType: string) => {
            const jd = jsondocs.find(j => j.id === id);
            if (jd && jd.schema_type === '灵感创意') {
                try {
                    const data = typeof jd.data === 'string' ? JSON.parse(jd.data) : jd.data;
                    if (data?.title) return data.title as string;
                } catch { }
            }
            return schemaType ? `${schemaType}` : id.substring(0, 6);
        };
        for (const a of affected) {
            if (Array.isArray(a.sources)) {
                for (const s of a.sources) {
                    if (!idSet.has(s.id)) {
                        idSet.add(s.id);
                        names.push(getName(s.id, s.schemaType));
                    }
                }
            }
        }
        return names;
    }, [affected, projectData.jsondocs]);

    const handleAutoFix = useCallback(async () => {
        if (affected.length === 0 || isRunning) return;
        setIsRunning(true);
        setProgress(0);
        try {
            const response = await fetch('/api/auto-fix/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer debug-auth-token-script-writer-dev`
                },
                credentials: 'include',
                body: JSON.stringify({
                    projectId,
                    items: affected.filter(a => selected.has(a.jsondocId)).map(a => ({
                        jsondocId: a.jsondocId,
                        schemaType: a.schemaType,
                        editRequirements: '自动修正：使内容与上游变更保持一致'
                    }))
                })
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${response.status}`);
            }
            const es = subscribeProgress();
            const result = await response.json();
            message.success(`自动修正完成：${result.processed} / ${selectedCount}`);
            setProgress(100);
            es && es.close();
        } catch (e: any) {
            console.error('Auto-fix failed:', e);
            message.error(`自动修正失败：${e.message || e}`);
        } finally {
            setIsRunning(false);
        }
    }, [affected, isRunning, projectId, total]);

    if (affected.length === 0) return null;

    // Compact inline rendering with a simple inline list
    if (compact) {
        return (
            <Space size={12} style={{ alignItems: 'flex-start' }}>
                <div style={{ color: '#bbb', fontSize: 12, lineHeight: 1.5 }}>
                    <div style={{ marginBottom: 4 }}>
                        {upstreamNames.length > 0 ? (
                            <>因为“{upstreamNames.join(', ')}”被修改，以下内容可能过时：</>
                        ) : (
                            <>因为上游内容已经修改，以下内容可能过时：</>
                        )}
                    </div>
                    <div style={{ maxHeight: 120, overflowY: 'auto', paddingRight: 4 }}>
                        {affected.map((a, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Checkbox
                                    checked={selected.has(a.jsondocId)}
                                    onChange={e => toggleOne(a.jsondocId, e.target.checked)}
                                    disabled={isRunning}
                                />
                                <span style={{ color: '#ddd' }}>{a.schemaType}</span>
                                <span style={{ color: '#888' }}> — {a.reason}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Checkbox
                        checked={allChecked}
                        indeterminate={!allChecked && !noneChecked}
                        onChange={e => toggleAll(e.target.checked)}
                        disabled={isRunning}
                    >全选</Checkbox>
                    <Button size="small" type="primary" onClick={handleAutoFix} disabled={isRunning || noneChecked}>
                        {isRunning ? '处理中...' : `自动修正所选(${selectedCount})`}
                    </Button>
                    {isRunning && <Progress percent={progress} size="small" style={{ width: 120, margin: 0 }} />}
                </div>
            </Space>
        );
    }

    return (
        <Card
            style={{ backgroundColor: '#111', border: '1px solid #333' }}
            title={<Title level={5} style={{ color: '#fff', margin: 0 }}>{upstreamNames.length > 0 ? `因为“${upstreamNames.join(', ')}”被修改，以下内容可能过时` : '因为上游内容已经修改，以下内容可能过时'}</Title>}
            extra={(
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Checkbox
                        checked={allChecked}
                        indeterminate={!allChecked && !noneChecked}
                        onChange={e => toggleAll(e.target.checked)}
                        disabled={isRunning}
                    >全选</Checkbox>
                    <Button type="primary" onClick={handleAutoFix} disabled={isRunning || noneChecked}>
                        {isRunning ? '处理中...' : `自动修正所选(${selectedCount})`}
                    </Button>
                </div>
            )}
        >
            {isRunning && (
                <div style={{ marginBottom: 12 }}>
                    <Progress percent={progress} size="small" />
                </div>
            )}
            <List
                dataSource={Array.isArray(affected) ? affected : []}
                renderItem={(item) => (
                    <List.Item style={{ color: '#ddd', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Checkbox
                            checked={selected.has(item.jsondocId)}
                            onChange={e => toggleOne(item.jsondocId, e.target.checked)}
                            disabled={isRunning}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <Text style={{ color: '#ddd' }}>{item.schemaType}</Text>
                            <Text type="secondary">{item.reason}</Text>
                        </div>
                    </List.Item>
                )}
            />
        </Card>
    );
};

export default AffectedJsondocsPanel;


