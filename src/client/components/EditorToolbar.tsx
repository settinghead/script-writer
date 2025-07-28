import React from 'react';
import { Button, Tooltip } from 'antd';
import { BoldOutlined, ItalicOutlined, UnderlineOutlined } from '@ant-design/icons';
import { Editor} from 'slate';

interface EditorToolbarProps {
    editor: any; // TODO: Add proper Slate editor type
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor }) => {
    const isMarkActive = (format: string) => {
        const marks = Editor.marks(editor);
        return marks ? (marks as any)[format] === true : false;
    };

    const toggleMark = (format: string) => {
        const isActive = isMarkActive(format);

        if (isActive) {
            Editor.removeMark(editor, format);
        } else {
            Editor.addMark(editor, format, true);
        }
    };

    return (
        <div className="editor-toolbar" style={{ padding: '8px', borderBottom: '1px solid #303030' }}>
            <Tooltip title="Bold">
                <Button
                    icon={<BoldOutlined />}
                    onClick={() => toggleMark('bold')}
                    type={isMarkActive('bold') ? 'primary' : 'default'}
                    style={{ marginRight: '8px' }}
                />
            </Tooltip>
            <Tooltip title="Italic">
                <Button
                    icon={<ItalicOutlined />}
                    onClick={() => toggleMark('italic')}
                    type={isMarkActive('italic') ? 'primary' : 'default'}
                    style={{ marginRight: '8px' }}
                />
            </Tooltip>
            <Tooltip title="Underline">
                <Button
                    icon={<UnderlineOutlined />}
                    onClick={() => toggleMark('underline')}
                    type={isMarkActive('underline') ? 'primary' : 'default'}
                />
            </Tooltip>
        </div>
    );
};

export default EditorToolbar; 