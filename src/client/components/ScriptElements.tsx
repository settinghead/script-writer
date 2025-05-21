import React from 'react';
import { RenderElementProps, RenderLeafProps } from 'slate-react';

export const Element = ({ attributes, children, element }: RenderElementProps) => {
    switch (element.type) {
        case 'scene-heading':
            return <div {...attributes} style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{children}</div>;
        case 'character':
            return <div {...attributes} style={{ textAlign: 'center', textTransform: 'uppercase' }}>{children}</div>;
        case 'dialogue':
            return <div {...attributes} style={{ marginLeft: '20%', marginRight: '20%' }}>{children}</div>;
        default:
            return <p {...attributes}>{children}</p>;
    }
};

export const Leaf = ({ attributes, children, leaf }: RenderLeafProps) => {
    let style: React.CSSProperties = {};

    if (leaf.bold) style.fontWeight = 'bold';
    if (leaf.italic) style.fontStyle = 'italic';
    if (leaf.underline) style.textDecoration = 'underline';

    return <span {...attributes} style={style}>{children}</span>;
}; 