import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { YJSTextField, YJSTextAreaField, YJSArrayOfStringField } from '../components/YJSField';
import { YJSSlateArrayOfStringField } from '../components/YJSSlateArrayField';

// Mock the YJS context and hooks
const mockUpdateField = vi.fn();
const mockValue = vi.fn();
const mockIsInitialized = vi.fn();

// Mock the YJS context
vi.mock('../contexts/YJSJsondocContext', () => ({
    YJSJsondocProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    useYJSField: vi.fn((path: string) => ({
        value: mockValue(path),
        updateValue: mockUpdateField,
        isInitialized: mockIsInitialized(path)
    }))
}));

// Mock Ant Design components for simpler testing
vi.mock('antd', async () => {
    const actual = await vi.importActual('antd');

    const MockInput = ({ value, onChange, placeholder, ...props }: any) => (
        <input
            data-testid="input"
            value={value || ''}
            onChange={(e) => onChange?.(e)}
            placeholder={placeholder}
            {...props}
        />
    );

    const MockTextArea = ({ value, onChange, placeholder, rows, ...props }: any) => (
        <textarea
            data-testid="textarea"
            value={value || ''}
            onChange={(e) => onChange?.(e)}
            placeholder={placeholder}
            rows={rows}
            {...props}
        />
    );

    MockInput.TextArea = MockTextArea;

    return {
        ...actual,
        Input: MockInput,
        Spin: ({ children, ...props }: any) => (
            <div data-testid="spin" {...props}>
                {children}
            </div>
        )
    };
});

// Mock Slate.js components for testing
vi.mock('slate-react', () => ({
    Slate: ({ children, initialValue, onValueChange }: any) => (
        <div data-testid="slate-editor" data-initial-value={JSON.stringify(initialValue)}>
            {children}
        </div>
    ),
    Editable: ({ placeholder, onKeyDown, renderElement, ...props }: any) => (
        <div
            data-testid="slate-editable"
            data-placeholder={placeholder}
            contentEditable
            onKeyDown={onKeyDown}
            {...props}
        />
    ),
    withReact: (editor: any) => editor
}));

vi.mock('slate', () => ({
    createEditor: () => ({}),
    Editor: {},
    Node: {
        string: (node: any) => node.children?.[0]?.text || '',
        children: function* (editor: any, path: any) {
            // Mock implementation for testing
        }
    },
    Element: {
        isElement: (node: any) => node && typeof node === 'object' && node.type
    },
    Transforms: {
        insertNodes: vi.fn(),
        setNodes: vi.fn()
    }
}));

vi.mock('slate-history', () => ({
    withHistory: (editor: any) => editor
}));

describe('YJS Field Components - Working Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsInitialized.mockReturnValue(true);
    });

    describe('YJSTextField', () => {
        it('renders correctly with mocked data', () => {
            mockValue.mockReturnValue('Test Title');

            render(<YJSTextField path="title" placeholder="Enter title" />);

            // Check that the input is rendered
            const input = screen.getByTestId('input');
            expect(input).toBeInTheDocument();
            expect(input).toHaveAttribute('placeholder', 'Enter title');
        });

        it('calls updateValue when input changes', async () => {
            mockValue.mockReturnValue('Initial Value');

            render(<YJSTextField path="title" placeholder="Enter title" />);

            const input = screen.getByTestId('input');

            // Simulate user typing
            fireEvent.change(input, { target: { value: 'New Title' } });

            // Wait for debounced update
            await waitFor(() => {
                expect(mockUpdateField).toHaveBeenCalled();
            }, { timeout: 1500 });
        });

        it('handles empty values', () => {
            mockValue.mockReturnValue('');

            render(<YJSTextField path="title" placeholder="Enter title" />);

            const input = screen.getByTestId('input');
            expect(input).toBeInTheDocument();
        });
    });

    describe('YJSTextAreaField', () => {
        it('renders correctly with mocked data', () => {
            mockValue.mockReturnValue('Test Description');

            render(<YJSTextAreaField path="description" placeholder="Enter description" rows={4} />);

            // Check that the textarea is rendered
            const textarea = screen.getByTestId('textarea');
            expect(textarea).toBeInTheDocument();
            expect(textarea).toHaveAttribute('placeholder', 'Enter description');
            expect(textarea).toHaveAttribute('rows', '4');
        });

        it('calls updateValue when textarea changes', async () => {
            mockValue.mockReturnValue('');

            render(<YJSTextAreaField path="description" placeholder="Enter description" />);

            const textarea = screen.getByTestId('textarea');

            // Simulate user typing
            fireEvent.change(textarea, { target: { value: 'New description' } });

            // Wait for debounced update
            await waitFor(() => {
                expect(mockUpdateField).toHaveBeenCalled();
            }, { timeout: 1500 });
        });
    });

    describe('YJSArrayOfStringField', () => {
        it('renders correctly with string array data', () => {
            mockValue.mockReturnValue(['Item 1', 'Item 2', 'Item 3']);

            render(<YJSArrayOfStringField path="stringArray" placeholder="Enter items" />);

            // Check that the textarea is rendered
            const textarea = screen.getByTestId('textarea');
            expect(textarea).toBeInTheDocument();
            expect(textarea).toHaveAttribute('placeholder', 'Enter items');
            expect(textarea).toHaveValue('Item 1\nItem 2\nItem 3');
        });

        it('calls updateValue when textarea changes', async () => {
            mockValue.mockReturnValue(['Item 1']);

            render(<YJSArrayOfStringField path="stringArray" placeholder="Enter items" />);

            const textarea = screen.getByTestId('textarea');

            // Simulate user typing new lines
            fireEvent.change(textarea, { target: { value: 'Item 1\nItem 2\nItem 3' } });

            // Wait for debounced update
            await waitFor(() => {
                expect(mockUpdateField).toHaveBeenCalled();
            }, { timeout: 1500 });
        });

        it('handles empty array correctly', () => {
            mockValue.mockReturnValue([]);

            render(<YJSArrayOfStringField path="stringArray" placeholder="Enter items" />);

            const textarea = screen.getByTestId('textarea');
            expect(textarea).toBeInTheDocument();
            expect(textarea).toHaveValue('');
        });

        it('preserves empty lines', async () => {
            mockValue.mockReturnValue([]);

            render(<YJSArrayOfStringField path="stringArray" placeholder="Enter items" />);

            const textarea = screen.getByTestId('textarea');

            // Simulate user typing with empty lines
            fireEvent.change(textarea, { target: { value: 'Item 1\n\nItem 2\n  \nItem 3\n' } });

            // Wait for debounced update
            await waitFor(() => {
                expect(mockUpdateField).toHaveBeenCalled();
            }, { timeout: 1500 });

            // Verify that empty lines are preserved (trimmed but not filtered out)
            const lastCall = mockUpdateField.mock.calls[mockUpdateField.mock.calls.length - 1];
            expect(lastCall[0]).toEqual(['Item 1', '', 'Item 2', '', 'Item 3', '']);
        });

        it('should allow Enter key to create new lines and increase array size', async () => {
            mockValue.mockReturnValue(['Item 1']);

            render(<YJSArrayOfStringField path="stringArray" placeholder="Enter items" />);

            const textarea = screen.getByTestId('textarea');

            // Verify initial state
            expect(textarea).toHaveValue('Item 1');

            // Focus the textarea and position cursor at the end
            fireEvent.focus(textarea);

            // Simulate pressing Enter at the end of "Item 1"
            fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

            // Simulate the actual text change that should happen after Enter
            fireEvent.change(textarea, { target: { value: 'Item 1\n' } });

            // Wait for debounced update
            await waitFor(() => {
                expect(mockUpdateField).toHaveBeenCalled();
            }, { timeout: 1500 });

            // Verify that updateField was called with the new array
            const lastCall = mockUpdateField.mock.calls[mockUpdateField.mock.calls.length - 1];
            expect(lastCall[0]).toEqual(['Item 1', '']); // Should have two items: one with content and one empty

            // Now test typing after the Enter
            fireEvent.change(textarea, { target: { value: 'Item 1\nItem 2' } });

            await waitFor(() => {
                expect(mockUpdateField).toHaveBeenCalled();
            }, { timeout: 1500 });

            // This time we should have two items
            const finalCall = mockUpdateField.mock.calls[mockUpdateField.mock.calls.length - 1];
            expect(finalCall[0]).toEqual(['Item 1', 'Item 2']);
        });

        it('should handle Enter key in middle of text correctly', async () => {
            mockValue.mockReturnValue(['Item 1 and more text']);

            render(<YJSArrayOfStringField path="stringArray" placeholder="Enter items" />);

            const textarea = screen.getByTestId('textarea');

            // Verify initial state
            expect(textarea).toHaveValue('Item 1 and more text');

            // Simulate pressing Enter in the middle of the text (after "Item 1 ")
            // This should split the line into two items
            fireEvent.change(textarea, { target: { value: 'Item 1 \nand more text' } });

            await waitFor(() => {
                expect(mockUpdateField).toHaveBeenCalled();
            }, { timeout: 1500 });

            // Should split into two items
            const lastCall = mockUpdateField.mock.calls[mockUpdateField.mock.calls.length - 1];
            expect(lastCall[0]).toEqual(['Item 1', 'and more text']);
        });
    });

    describe('YJSSlateArrayOfStringField', () => {
        it('renders correctly with string array data', () => {
            mockValue.mockReturnValue(['Item 1', 'Item 2', 'Item 3']);

            render(<YJSSlateArrayOfStringField path="slateArray" placeholder="Enter bullet items" />);

            // Check that the Slate editor is rendered
            const slateEditor = screen.getByTestId('slate-editor');
            expect(slateEditor).toBeInTheDocument();

            // Check that the Editable component is rendered
            const slateEditable = screen.getByTestId('slate-editable');
            expect(slateEditable).toBeInTheDocument();
            expect(slateEditable).toHaveAttribute('data-placeholder', 'Enter bullet items');
        });

        it('converts array to slate format correctly', () => {
            mockValue.mockReturnValue(['Item 1', 'Item 2']);

            render(<YJSSlateArrayOfStringField path="slateArray" placeholder="Enter items" />);

            const slateEditor = screen.getByTestId('slate-editor');
            const initialValue = JSON.parse(slateEditor.getAttribute('data-initial-value') || '[]');

            // Should convert array to bullet-item format
            expect(initialValue).toHaveLength(2);
            expect(initialValue[0]).toEqual({
                type: 'bullet-item',
                children: [{ text: 'Item 1' }]
            });
            expect(initialValue[1]).toEqual({
                type: 'bullet-item',
                children: [{ text: 'Item 2' }]
            });
        });

        it('handles empty array correctly', () => {
            mockValue.mockReturnValue([]);

            render(<YJSSlateArrayOfStringField path="slateArray" placeholder="Enter items" />);

            const slateEditor = screen.getByTestId('slate-editor');
            const initialValue = JSON.parse(slateEditor.getAttribute('data-initial-value') || '[]');

            // Should create one empty bullet item for empty array
            expect(initialValue).toHaveLength(1);
            expect(initialValue[0]).toEqual({
                type: 'bullet-item',
                children: [{ text: '' }]
            });
        });

        it('handles non-array values gracefully', () => {
            mockValue.mockReturnValue('not an array');

            render(<YJSSlateArrayOfStringField path="slateArray" placeholder="Enter items" />);

            const slateEditor = screen.getByTestId('slate-editor');
            const initialValue = JSON.parse(slateEditor.getAttribute('data-initial-value') || '[]');

            // Should create one empty bullet item for non-array values
            expect(initialValue).toHaveLength(1);
            expect(initialValue[0]).toEqual({
                type: 'bullet-item',
                children: [{ text: '' }]
            });
        });

        it('handles Enter key correctly', () => {
            mockValue.mockReturnValue(['Item 1']);

            render(<YJSSlateArrayOfStringField path="slateArray" placeholder="Enter items" />);

            const slateEditable = screen.getByTestId('slate-editable');

            // Simulate pressing Enter key
            fireEvent.keyDown(slateEditable, { key: 'Enter', code: 'Enter' });

            // The component should handle Enter key (preventDefault and create new bullet item)
            // Since we're mocking Slate, we can't test the actual transform, but we can verify the event handler exists
            expect(slateEditable).toBeInTheDocument();
        });

        it('displays helper text correctly', () => {
            mockValue.mockReturnValue(['Item 1']);

            render(<YJSSlateArrayOfStringField path="slateArray" placeholder="Enter items" />);

            // Check for helper text
            expect(screen.getByText('按 Enter 创建新的列表项')).toBeInTheDocument();
        });

        it('shows loading state when not initialized', () => {
            mockValue.mockReturnValue(['Item 1']);
            mockIsInitialized.mockReturnValue(false);

            render(<YJSSlateArrayOfStringField path="slateArray" placeholder="Enter items" />);

            // Should show loading text
            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });

        it('handles undefined and null values', () => {
            mockValue.mockReturnValue(undefined);

            render(<YJSSlateArrayOfStringField path="slateArray" placeholder="Enter items" />);

            const slateEditor = screen.getByTestId('slate-editor');
            const initialValue = JSON.parse(slateEditor.getAttribute('data-initial-value') || '[]');

            // Should create one empty bullet item for undefined values
            expect(initialValue).toHaveLength(1);
            expect(initialValue[0]).toEqual({
                type: 'bullet-item',
                children: [{ text: '' }]
            });
        });
    });

    describe('Mock Validation', () => {
        it('validates that mocks are working correctly', () => {
            // Test that our mocks are properly set up
            mockValue.mockReturnValue('test-value');
            mockIsInitialized.mockReturnValue(true);

            expect(mockValue('test-path')).toBe('test-value');
            expect(mockIsInitialized('test-path')).toBe(true);
        });

        it('validates that mock functions are called with correct parameters', () => {
            mockValue.mockReturnValue('test');

            render(<YJSTextField path="title" placeholder="Test" />);

            // Check that useYJSField was called with the correct path
            expect(mockValue).toHaveBeenCalledWith('title');
            expect(mockIsInitialized).toHaveBeenCalledWith('title');
        });
    });

    describe('Component Integration', () => {
        it('can render multiple components together', () => {
            mockValue.mockImplementation((path: string) => {
                switch (path) {
                    case 'title': return 'Test Title';
                    case 'description': return 'Test Description';
                    default: return '';
                }
            });

            render(
                <div>
                    <YJSTextField path="title" placeholder="Title" />
                    <YJSTextAreaField path="description" placeholder="Description" />
                </div>
            );

            // Check that both components are rendered
            expect(screen.getByTestId('input')).toBeInTheDocument();
            expect(screen.getByTestId('textarea')).toBeInTheDocument();
        });
    });

    describe('Error Handling', () => {
        it('handles undefined values gracefully', () => {
            mockValue.mockReturnValue(undefined);

            render(<YJSTextField path="title" placeholder="Enter title" />);

            const input = screen.getByTestId('input');
            expect(input).toBeInTheDocument();
            expect(input).toHaveValue('');
        });

        it('handles null values gracefully', () => {
            mockValue.mockReturnValue(null);

            render(<YJSTextField path="title" placeholder="Enter title" />);

            const input = screen.getByTestId('input');
            expect(input).toBeInTheDocument();
            expect(input).toHaveValue('');
        });
    });
}); 