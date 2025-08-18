import React from 'react';
import * as Diff from 'diff';

interface DiffViewProps {
    oldValue: string;
    newValue: string;
}

// Lightweight word diff view reused across modals and debug panels
const DiffView: React.FC<DiffViewProps> = ({ oldValue, newValue }) => {
    const parts = Diff.diffWords(oldValue || '', newValue || '');
    return (
        <pre
            style={{
                whiteSpace: 'pre-wrap',
                background: '#0f0f0f',
                color: '#eee',
                padding: 16,
                border: '1px solid #333',
                borderRadius: 6,
                maxHeight: 500,
                overflow: 'auto'
            }}
        >
            {parts.map((part, index) => {
                const color = part.added ? '#52c41a' : part.removed ? '#ff4d4f' : '#d9d9d9';
                const textDecoration = part.removed ? 'line-through' : 'none';
                return (
                    <span key={index} style={{ color, textDecoration }}>{part.value}</span>
                );
            })}
        </pre>
    );
};

export default DiffView;


