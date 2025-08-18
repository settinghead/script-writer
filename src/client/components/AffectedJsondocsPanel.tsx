import React, { useMemo, useState, useCallback } from 'react';
import { Card, Typography, List, Tag, Button, Progress, message } from 'antd';
import type { AffectedJsondoc } from '../../common/staleDetection';

const { Text, Title } = Typography;

interface AffectedJsondocsPanelProps {
    projectId: string;
    affected: AffectedJsondoc[];
}

export const AffectedJsondocsPanel: React.FC<AffectedJsondocsPanelProps> = ({ projectId, affected }) => {
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
    const severityColor = useCallback((sev: AffectedJsondoc['severity']) => {
        switch (sev) {
            case 'high': return 'red';
            case 'medium': return 'orange';
            default: return 'blue';
        }
    }, []);

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

    return (
        <Card
            style={{ backgroundColor: '#111', border: '1px solid #333' }}
            title={<Title level={5} style={{ color: '#fff', margin: 0 }}>受影响内容（可自动修正）</Title>}
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
                            <div>
                                <Tag color={severityColor(item.severity)}>{item.severity}</Tag>
                                <Text style={{ color: '#ddd' }}>{item.schemaType}</Text>
                            </div>
                            <Text type="secondary">{item.reason}</Text>
                        </div>
                    </List.Item>
                )}
            />
        </Card>
    );
};

export default AffectedJsondocsPanel;


