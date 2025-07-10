# Testing React Components in Script Writer

This document explains how to test React components in the script-writer project, particularly the YJS-enabled components that handle real-time collaborative editing.

## Overview

The project uses **Vitest** with **React Testing Library** for component testing. The testing approach focuses on:

1. **Behavioral Testing**: Testing what users see and interact with
2. **Mock-based Testing**: Isolating components from external dependencies
3. **Integration Testing**: Testing component interactions
4. **YJS Component Testing**: Special patterns for collaborative editing components

## Testing Setup

### Dependencies

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### Configuration

- **Vitest Config**: `vitest.config.ts` - configured for `jsdom` environment
- **Test Setup**: `src/__tests__/setup.ts` - includes jest-dom matchers
- **Test Pattern**: `src/**/*.{test,spec}.{js,ts,tsx}` files

### Running Tests

```bash
# Run all tests
npm test -- --run

# Run specific test file
npm test -- --run src/client/components/shared/__tests__/YJSField.simple.test.tsx

# Run tests in watch mode (development)
npm test
```

## YJS Component Testing Pattern

### 1. Mock the YJS Context

YJS components depend on the `YJSArtifactContext`. Mock it to control the data flow:

```typescript
// Mock the YJS context and hooks
const mockUpdateField = vi.fn();
const mockValue = vi.fn();
const mockIsInitialized = vi.fn();

// Mock the YJS context
vi.mock('../../../contexts/YJSArtifactContext', () => ({
    YJSArtifactProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    useYJSField: vi.fn((path: string) => ({
        value: mockValue(path),
        updateValue: mockUpdateField,
        isInitialized: mockIsInitialized(path)
    }))
}));
```

### 2. Mock Ant Design Components

For simpler testing, mock Ant Design components with basic HTML elements:

```typescript
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
    
    return {
        ...actual,
        Input: MockInput,
        // ... other mocked components
    };
});
```

### 3. Test Component Rendering

Test that components render correctly with mocked data:

```typescript
it('renders with initial value from YJS', () => {
    mockValue.mockReturnValue('Test Title');
    
    render(<YJSTextField path="title" placeholder="Enter title" />);

    const input = screen.getByTestId('input');
    expect(input).toHaveValue('Test Title');
    expect(input).toHaveAttribute('placeholder', 'Enter title');
});
```

### 4. Test User Interactions

Test that user interactions trigger the correct YJS updates:

```typescript
it('handles user input and updates YJS', async () => {
    mockValue.mockReturnValue('Initial Value');
    
    render(<YJSTextField path="title" placeholder="Enter title" />);

    const input = screen.getByTestId('input');
    
    await act(async () => {
        fireEvent.change(input, { target: { value: 'New Title' } });
    });

    // Should call updateValue after debounce
    await waitFor(() => {
        expect(mockUpdateField).toHaveBeenCalledWith('title', 'New Title');
    }, { timeout: 1500 });
});
```

### 5. Test Different Data Types

Test how components handle different data types (strings, arrays, objects):

```typescript
it('renders array of strings as textarea', () => {
    mockValue.mockReturnValue(['Theme 1', 'Theme 2', 'Theme 3']);
    
    render(<YJSArrayField path="themes" placeholder="Enter themes" />);

    const textarea = screen.getByTestId('textarea');
    expect(textarea).toHaveValue('Theme 1\nTheme 2\nTheme 3');
});
```

## Testing Strategies

### 1. Mock Data Management

Control what data the components receive:

```typescript
// Different values for different paths
mockValue.mockImplementation((path: string) => {
    switch (path) {
        case 'title': return 'Test Title';
        case 'description': return 'Test Description';
        case 'themes': return ['Theme 1', 'Theme 2'];
        default: return '';
    }
});
```

### 2. Test Loading States

Test components in different states:

```typescript
it('shows loading state when YJS is not initialized', () => {
    mockIsInitialized.mockReturnValue(false);
    mockValue.mockReturnValue('');

    render(<YJSTextField path="title" placeholder="Enter title" />);

    expect(screen.getByTestId('spin')).toBeInTheDocument();
});
```

### 3. Test Error Handling

Test how components handle errors:

```typescript
it('handles updateValue errors gracefully', async () => {
    mockUpdateField.mockRejectedValue(new Error('Network error'));
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // ... trigger error and verify console.error was called
    
    consoleSpy.mockRestore();
});
```

### 4. Test Performance Features

Test debouncing and other performance optimizations:

```typescript
it('demonstrates debouncing behavior', async () => {
    // Simulate rapid typing
    await act(async () => {
        fireEvent.change(input, { target: { value: 'T' } });
    });
    
    await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        fireEvent.change(input, { target: { value: 'Test' } });
    });

    // Should eventually call updateValue with the final value
    await waitFor(() => {
        expect(mockUpdateField).toHaveBeenCalledWith('title', 'Test');
    }, { timeout: 1500 });
});
```

## Integration Testing

### Testing Multiple Components Together

```typescript
it('can test multiple fields working together', async () => {
    render(
        <div>
            <YJSTextField path="title" placeholder="Title" />
            <YJSTextAreaField path="description" placeholder="Description" />
            <YJSArrayField path="themes" placeholder="Themes" />
        </div>
    );

    // Check all fields render correctly
    expect(screen.getByDisplayValue('Test Title')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Description')).toBeInTheDocument();
    
    // Test interactions between components
    // ...
});
```

### Testing with YJSArtifactProvider

For more complex integration tests, you can test with the actual provider:

```typescript
it('works with YJSArtifactProvider', () => {
    render(
        <YJSArtifactProvider artifactId="test-artifact">
            <YJSTextField path="title" placeholder="Title" />
        </YJSArtifactProvider>
    );
    
    // Test with real provider behavior
});
```

## Best Practices

### 1. Focus on User Behavior

Test what users see and do, not implementation details:

```typescript
// Good: Test user-visible behavior
expect(screen.getByDisplayValue('Test Title')).toBeInTheDocument();

// Avoid: Testing internal state
expect(component.state.title).toBe('Test Title');
```

### 2. Use Descriptive Test Names

```typescript
// Good: Describes the behavior being tested
it('updates YJS field when user types in input')

// Avoid: Vague or implementation-focused
it('calls updateField function')
```

### 3. Test Edge Cases

```typescript
it('handles empty values correctly', () => {
    mockValue.mockReturnValue('');
    // ... test empty state
});

it('handles non-array values gracefully', () => {
    mockValue.mockReturnValue(null);
    // ... test error handling
});
```

### 4. Clean Up Between Tests

```typescript
beforeEach(() => {
    vi.clearAllMocks();
    mockIsInitialized.mockReturnValue(true);
});

afterEach(() => {
    vi.clearAllMocks();
});
```

### 5. Use Realistic Test Data

Use data that resembles real application data:

```typescript
const mockCharacters = [
    { name: '林慕琛', type: 'male_lead', age: '28', gender: 'male' },
    { name: '夏栀', type: 'female_lead', age: '24', gender: 'female' }
];
```

## Common Testing Patterns

### 1. Test Component Props

```typescript
it('passes props correctly', () => {
    render(<YJSTextField path="title" placeholder="Custom placeholder" disabled />);
    
    const input = screen.getByTestId('input');
    expect(input).toHaveAttribute('placeholder', 'Custom placeholder');
    expect(input).toBeDisabled();
});
```

### 2. Test Conditional Rendering

```typescript
it('shows different UI based on data', () => {
    mockValue.mockReturnValue([]);
    
    render(<YJSArrayField path="themes" />);
    
    expect(screen.getByText('Add Theme')).toBeInTheDocument();
    expect(screen.queryByTestId('textarea')).not.toBeInTheDocument();
});
```

### 3. Test Event Handling

```typescript
it('handles button clicks', async () => {
    render(<YJSArrayField path="themes" />);
    
    const addButton = screen.getByText('Add Theme');
    
    await act(async () => {
        fireEvent.click(addButton);
    });
    
    expect(mockUpdateField).toHaveBeenCalledWith('themes', expect.any(Array));
});
```

## Debugging Tests

### 1. Use screen.debug()

```typescript
it('debug test', () => {
    render(<YJSTextField path="title" />);
    
    screen.debug(); // Prints the rendered DOM
});
```

### 2. Check Mock Calls

```typescript
it('debug mock calls', () => {
    // ... test code
    
    console.log('Mock calls:', mockUpdateField.mock.calls);
});
```

### 3. Use waitFor for Async Operations

```typescript
await waitFor(() => {
    expect(mockUpdateField).toHaveBeenCalled();
}, { timeout: 2000 });
```

## Example Test Files

- `YJSField.simple.test.tsx` - Basic YJS component testing
- `YJSField.test.tsx` - Comprehensive YJS component testing including complex components

## Conclusion

This testing approach allows you to:

1. **Verify Component Behavior**: Test what users see and interact with
2. **Mock External Dependencies**: Isolate components from YJS, APIs, etc.
3. **Test Edge Cases**: Handle errors, empty states, and unusual data
4. **Ensure Performance**: Test debouncing and other optimizations
5. **Maintain Confidence**: Catch regressions and ensure reliability

The key is to focus on testing the component's public interface (props, user interactions, rendered output) rather than internal implementation details. 