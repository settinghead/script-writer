import React, { useState, useCallback } from 'react';
import { Card, Typography, List, Button, Progress, message, Space } from 'antd';
import type { AffectedJsondoc } from '../../common/staleDetection';

const { Text, Title } = Typography;

interface AffectedJsondocsPanelProps {
    projectId: string;
    affected: AffectedJsondoc[];
    compact?: boolean; // render as an inline compact tile for juxtaposition with actions
}

export const AffectedJsondocsPanel: React.FC<AffectedJsondocsPanelProps> = ({ projectId, affected, compact = false }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);

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
                    items: affected.map(a => ({
                        jsondocId: a.jsondocId,
                        schemaType: a.schemaType,
                        editRequirements: '自动修正：使内容与上游变更保持一致',
                        affectedContext: a.sourceChanges?.map(sc => ({
                            jsondocId: sc.jsondocId,
                            schemaType: a.schemaType,
                            reason: a.reason
                        })) || []
                    }))
                })
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${response.status}`);
            }
            const es = subscribeProgress();
            const result = await response.json();
            message.success(`自动修正完成：${result.processed} / ${total}`);
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
                    <div style={{ marginBottom: 4 }}>因为上游内容已经修改，以下内容可能过时：</div>
                    <div style={{ maxHeight: 120, overflowY: 'auto', paddingRight: 4 }}>
                        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                            {affected.map((a, idx) => (
                                <li key={idx} style={{ whiteSpace: 'pre-wrap' }}>
                                    <span style={{ color: '#ddd' }}>{a.schemaType}</span>
                                    <span style={{ color: '#888' }}> — {a.reason}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Button size="small" type="primary" onClick={handleAutoFix} disabled={isRunning}>
                        {isRunning ? '处理中...' : '自动修正'}
                    </Button>
                    {isRunning && <Progress percent={progress} size="small" style={{ width: 120, margin: 0 }} />}
                </div>
            </Space>
        );
    }

    return (
        <Card
            style={{ backgroundColor: '#111', border: '1px solid #333' }}
            title={<Title level={5} style={{ color: '#fff', margin: 0 }}>因为上游内容已经修改，以下内容可能过时</Title>}
            extra={(
                <Button type="primary" onClick={handleAutoFix} disabled={isRunning}>
                    {isRunning ? '处理中...' : '自动修正'}
                </Button>
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
                    <List.Item style={{ color: '#ddd' }}>
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


