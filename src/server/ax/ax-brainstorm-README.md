# AX Brainstorm System

TypeScript implementation of the Python DSPy brainstorm module using the [ax-llm/ax](https://github.com/ax-llm/ax) library.

## Overview

This system replicates the story brainstorming functionality from the Python DSPy implementation, featuring:

- **Core Brainstorm Module**: Generate story ideas using ax's AxChainOfThought
- **Evaluation System**: Multi-aspect evaluation with parallel scoring
- **MiPRO Optimization**: Automated prompt optimization (experimental)
- **Streaming Support**: Real-time story generation
- **TypeScript Type Safety**: Full type safety with Zod schemas

## Files Structure

```
src/server/ax/
├── ax-brainstorm-types.ts           # TypeScript types and Zod schemas
├── ax-llm-config.ts                # LLM configuration helpers  
├── ax-brainstorm-core.ts           # Core brainstorm module implementation
├── ax-evaluation-system-simple.ts # Simplified evaluation system
├── ax-optimize-brainstorm.ts       # MiPRO optimization script (experimental)
├── ax-run-brainstorm.ts            # Main usage script
└── ax-brainstorm-README.md         # This documentation
```

## Prerequisites

1. **Install dependencies**:
```bash
npm install @ax-llm/ax zod dotenv
```

2. **Set up environment variables**:
Create a `.env` file with:
```env
LLM_API_KEY=your_openai_api_key_here
LLM_BASE_URL=https://api.openai.com/v1  # Optional, for custom endpoints
LLM_MODEL_NAME=gpt-4o                   # Your preferred model
```

## Quick Start

### Basic Usage

```bash
# Run basic brainstorm with default settings
./run-ts src/server/ax/ax-run-brainstorm.ts

# Generate multiple ideas
./run-ts src/server/ax/ax-run-brainstorm.ts --count=3

# Enable evaluation
./run-ts src/server/ax/ax-run-brainstorm.ts --evaluate

# Use streaming mode (simplified)
./run-ts src/server/ax/ax-run-brainstorm.ts --streaming

# Use different example
./run-ts src/server/ax/ax-run-brainstorm.ts --example=1

# Combine options
./run-ts src/server/ax/ax-run-brainstorm.ts --count=2 --evaluate --name="my-test"
```

### Available Command Line Options

- `--name=<name>`: Set run name for logging
- `--count=<number>`: Number of ideas to generate (default: 2)
- `--evaluate`: Enable multi-aspect evaluation  
- `--streaming`: Use streaming generation mode
- `--example=<index>`: Use specific example (0=甜宠, 1=虐恋, 2=复仇)

## Programmatic Usage

### Basic Story Generation

```typescript
import { AxAI } from '@ax-llm/ax';
import { BrainstormProgram } from './ax-brainstorm-core';
import { BrainstormRequest } from './ax-brainstorm-types';

// Create AI instance
const ai = new AxAI({
  name: 'openai',
  apiKey: process.env.LLM_API_KEY!,
});

// Create brainstorm program
const brainstorm = new BrainstormProgram();

// Generate story idea
const request: BrainstormRequest = {
  genre: '甜宠',
  platform: '抖音',
  requirements_section: '现代都市背景，温馨浪漫',
};

const idea = await brainstorm.generateIdea(ai, request);
console.log(`Title: ${idea.title}`);
console.log(`Body: ${idea.body}`);
```

### Story Evaluation

```typescript
import { StoryEvaluationSystem } from './ax-evaluation-system-simple';

// Create evaluation system
const evaluator = new StoryEvaluationSystem();

// Evaluate story idea
const evaluation = await evaluator.evaluateStoryIdea(
  ai,
  idea,
  request.genre,
  request.platform
);

console.log(`Overall Score: ${evaluation.overall_score}/10`);
console.log(`Feedback: ${evaluation.feedback}`);
```

### Streaming Generation

```typescript
// Streaming generation (when properly implemented)
const generator = brainstorm.streamingGenerateIdea(ai, request);

for await (const partial of generator) {
  if (partial.title) console.log(`Title: ${partial.title}`);
  if (partial.body) console.log(`Body: ${partial.body}`);
}
```

## Evaluation Metrics

The system evaluates stories across 7 dimensions:

1. **Novelty (新颖性)**: Originality and creativity (Weight: 18%)
2. **Feasibility (可行性)**: Production feasibility (Weight: 12%)
3. **Structure (结构)**: Story structure clarity (Weight: 8%)
4. **Detail (详细程度)**: Level of detail (Weight: 18%)
5. **Logic (逻辑连贯性)**: Logical coherence (Weight: 16%)
6. **Genre (题材一致性)**: Genre consistency (Weight: 10%)
7. **Engagement (吸引力)**: Audience appeal (Weight: 18%)

## Example Genres and Platforms

Predefined examples include:

- **甜宠** (Sweet Romance) → 抖音 (TikTok)
- **虐恋** (Angsty Romance) → 小红书 (Xiaohongshu)
- **复仇** (Revenge) → 快手 (Kuaishou)
- **穿越** (Time Travel) → 抖音 (TikTok)
- **重生** (Rebirth) → 小红书 (Xiaohongshu)
- **霸总** (CEO Romance) → 抖音 (TikTok)

## Optimization (Experimental)

**Note**: The MiPRO optimization script has complex type issues and is currently experimental.

```bash
# Run optimization (when types are fixed)
./run-ts src/server/ax/ax-optimize-brainstorm.ts
```

This will:
1. Train the brainstorm program using MiPRO
2. Generate optimized demos and instructions
3. Save configuration to a timestamped JSON file
4. Evaluate performance on validation set

## Troubleshooting

### Common Issues

1. **LLM Configuration Errors**
   - Ensure environment variables are set correctly
   - Check API key validity and model availability

2. **Type Errors**
   - Some ax library types may need adjustment
   - The current implementation prioritizes functionality over perfect typing

3. **Generation Failures**
   - Check network connectivity
   - Verify model name and API endpoint
   - Monitor rate limits

### Known Limitations

1. **Streaming Implementation**: Currently simplified, full streaming with progressive updates needs refinement
2. **MiPRO Optimization**: Type compatibility issues need resolution
3. **Configuration**: baseURL configuration for custom endpoints needs proper typing

## Architecture Notes

This implementation follows the ax library patterns:

- **Signatures**: Use template literals with field builders (`s` and `f`)
- **Programs**: Extend `AxChainOfThought` for reasoning-based generation
- **Assertions**: Add quality control with `addAssert`
- **Evaluation**: Parallel execution for efficiency
- **Type Safety**: Zod schemas for validation

## Comparison with Python Version

| Feature | Python DSPy | TypeScript ax | Status |
|---------|-------------|---------------|---------|
| Core Generation | ✅ | ✅ | Complete |
| Multi-aspect Evaluation | ✅ | ✅ | Complete |
| MiPRO Optimization | ✅ | ⚠️ | Experimental |
| Streaming | ✅ | ⚠️ | Simplified |
| Type Safety | ❌ | ✅ | Improved |
| Parallel Evaluation | ❌ | ✅ | Improved |

## Next Steps

1. Fix ax library type compatibility issues
2. Implement full streaming with progressive UI updates
3. Resolve MiPRO optimization types
4. Add baseURL configuration support
5. Create integration tests
6. Add example with different LLM providers

## License

Follows the same license as the main script-writer project. 