# Streaming Services Architecture

## Overview

The streaming services have been refactored to eliminate code duplication and provide a clean, extensible architecture for handling real-time LLM streaming data.

## Base Class: `LLMStreamingService<T>`

The base class now provides common functionality for all streaming services:

### Common Methods (Available to all subclasses)

- **`parseWithCommonFlow(content: string, serviceName: string): T[]`** - Standard parsing flow with logging and fallbacks
- **`parseJSONWithFallback(content: string): any`** - JSON parsing with jsonrepair fallback
- **`findJSONStart(content: string)`** - Detect array vs object JSON structures
- **`cleanContent(content: string): string`** - Text cleaning utilities
- **`extractJSON(content: string): string`** - Extract JSON from mixed content
- **`normalizeAndValidateArray(items: any[]): T[]`** - Bulk normalization and validation
- **`normalizeAndValidateSingle(item: any): T | null`** - Single item normalization and validation

### Abstract Methods (Must be implemented by subclasses)

- **`validate(item: any): item is T`** - Type validation for the specific data type
- **`parsePartial(content: string): T[]`** - Main parsing entry point
- **`normalizeItem(data: any): T | null`** - Normalize raw data to typed structure
- **`extractPartialItems(content: string): T[]`** - Fallback partial extraction when JSON parsing fails
- **`convertArtifactToItem(artifactData: any): T | null`** - Convert artifact data to typed structure

## Implementation Pattern

Each streaming service follows this pattern:

```typescript
export class MyStreamingService extends LLMStreamingService<MyType> {
    // Type validation
    validate(item: any): item is MyType {
        return typeof item === 'object' && /* validation logic */;
    }

    // Main parsing - delegates to common flow
    parsePartial(content: string): MyType[] {
        return this.parseWithCommonFlow(content, 'MyStreamingService');
    }

    // Data normalization
    protected normalizeItem(data: any): MyType | null {
        try {
            return { /* normalize data to MyType */ };
        } catch (error) {
            console.warn('Failed to normalize:', data, error);
            return null;
        }
    }

    // Fallback partial extraction
    protected extractPartialItems(content: string): MyType[] {
        // Custom regex-based extraction for when JSON parsing fails
        return [];
    }

    // Artifact conversion
    protected convertArtifactToItem(artifactData: any): MyType | null {
        return this.normalizeItem(artifactData);
    }
}
```

## Benefits of Refactoring

### Before (Duplicated Code)
- Each service had ~200-250 lines of similar JSON parsing logic
- Duplicate error handling and logging
- Inconsistent parsing strategies across services
- Hard to maintain and debug

### After (Clean Architecture)
- Base class handles all common parsing logic (~150 lines)
- Each service focuses on type-specific logic (~50-100 lines)
- Consistent parsing behavior across all services
- Easy to add new streaming types
- Centralized error handling and logging


## Adding New Streaming Services

To add a new streaming service:

1. Define your data type interface
2. Extend `LLMStreamingService<YourType>`
3. Implement the 4 required abstract methods
4. Use `parseWithCommonFlow()` in `parsePartial()`
5. Focus implementation on type-specific normalization and validation

The base class will handle all the complex JSON parsing, error recovery, and logging automatically. 