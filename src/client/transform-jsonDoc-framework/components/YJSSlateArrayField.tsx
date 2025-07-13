import React, { useCallback, useMemo } from 'react';
import { Descendant, Editor, Node, NodeEntry, Element as SlateElement, Transforms, createEditor } from 'slate';
import { withHistory } from 'slate-history';
import { Editable, RenderElementProps, Slate, withReact } from 'slate-react';
import { useYJSField } from '../contexts/YJSJsonDocContext';

// Slate plugin to enforce bullet list layout
const withBulletLayout = (editor: any) => {
    const { normalizeNode } = editor;

    editor.normalizeNode = ([node, path]: NodeEntry) => {
        if (path.length === 0) {
            // Ensure we have at least one bullet item
            if (editor.children.length === 0) {
                const bulletItem = {
                    type: 'bullet-item',
                    children: [{ text: '' }],
                };
                Transforms.insertNodes(editor, bulletItem as any, { at: path.concat(0) });
            }

            // Ensure all children are bullet items
            for (const [child, childPath] of Node.children(editor, path)) {
                if (SlateElement.isElement(child) && (child as any).type !== 'bullet-item') {
                    const newProperties = { type: 'bullet-item' };
                    Transforms.setNodes(editor, newProperties as any, { at: childPath });
                }
            }
        }

        return normalizeNode([node, path]);
    };

    return editor;
};

// Component to render bullet items
const BulletElement = ({ attributes, children }: RenderElementProps) => (
    <div {...attributes} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '4px' }}>
        <span style={{
            marginRight: '8px',
            marginTop: '2px',
            fontSize: '16px',
            color: '#fff',
            fontWeight: 'bold',
            minWidth: '16px'
        }}>•</span>
        <div style={{ flex: 1 }}>{children}</div>
    </div>
);

// Main component
export const YJSSlateArrayOfStringField = React.memo(({ path, placeholder }: {
    path: string;
    placeholder?: string;
}) => {
    const { value, updateValue, isInitialized } = useYJSField(path);

    // Convert array to Slate value
    const arrayToSlateValue = useCallback((array: string[]): any[] => {
        if (!Array.isArray(array) || array.length === 0) {
            return [{ type: 'bullet-item', children: [{ text: '' }] }];
        }
        return array.map(item => ({
            type: 'bullet-item',
            children: [{ text: item || '' }]
        }));
    }, []);

    // Convert Slate value to array
    const slateValueToArray = useCallback((slateValue: any[]): string[] => {
        return slateValue.map(node => {
            if (SlateElement.isElement(node) && (node as any).type === 'bullet-item') {
                return Node.string(node);
            }
            return '';
        });
    }, []);

    const slateValue = useMemo(() => {
        const array = Array.isArray(value) ? value : [];
        return arrayToSlateValue(array);
    }, [value, arrayToSlateValue]);

    const handleChange = useCallback((newValue: any[]) => {
        const newArray = slateValueToArray(newValue);
        updateValue(newArray);
    }, [slateValueToArray, updateValue]);

    // Create a key based on the array content to force re-mount when YJS value changes
    const editorKey = useMemo(() => {
        return JSON.stringify(Array.isArray(value) ? value : []);
    }, [value]);

    const renderElement = useCallback((props: RenderElementProps) => {
        switch ((props.element as any).type) {
            case 'bullet-item':
                return <BulletElement {...props} />;
            default:
                return <div {...props.attributes}>{props.children}</div>;
        }
    }, []);

    const editor = useMemo(
        () => withBulletLayout(withHistory(withReact(createEditor()))),
        []
    );

    // Handle Enter key to create new bullet items
    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            event.preventDefault();

            // Insert a new bullet item
            const newBulletItem = {
                type: 'bullet-item',
                children: [{ text: '' }],
            };

            Transforms.insertNodes(editor, newBulletItem as any);
        }
    }, [editor]);

    if (!isInitialized) {
        return <div>Loading...</div>;
    }


    return (
        <div style={{
            backgroundColor: '#1f1f1f',
            border: '1px solid #434343',
            borderRadius: '6px',
            padding: '8px',
            minHeight: '100px'
        }}>
            <Slate
                key={editorKey}
                editor={editor}
                initialValue={slateValue}
                onValueChange={handleChange}
            >
                <Editable
                    renderElement={renderElement}
                    placeholder={placeholder || '输入列表项...'}
                    onKeyDown={handleKeyDown}
                    style={{
                        outline: 'none',
                        minHeight: '80px',
                        fontSize: '14px',
                        lineHeight: '1.5',
                        color: '#fff',
                        backgroundColor: 'transparent',
                    }}
                />
            </Slate>
            <div style={{ marginTop: 8, color: '#666', fontSize: '12px' }}>
                按 Enter 创建新的列表项
            </div>
        </div>
    );
}); 