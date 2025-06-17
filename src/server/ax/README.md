# Ax-Based Brainstorm Optimization

This directory contains the TypeScript implementation of the brainstorm system using the ax library, replicating the Python DSPy functionality.

## Overview

The system consists of:
- **Generation**: `BrainstormProgram` using ax library with few-shot prompting
- **Evaluation**: Vercel AI SDK with Zod schema validation
- **Optimization**: MiPRO v2 optimizer for improving generation quality
- **Examples**: Real training data from `/src/examples/` directory

## Files

### Core Components

- `ax-brainstorm-core.ts` - Main brainstorm program using ax signature
- `ax-brainstorm-types.ts` - TypeScript types and Zod schemas
- `exampleLoader.ts` - Loads and formats training examples

### Optimization

- `ax-optimize-brainstorm.ts` - MiPRO v2 optimization script
- `test-optimization.ts` - Simple test for optimization
- `use-optimized-brainstorm.ts` - Example of using optimized program

## Usage

### 1. Basic Generation

```typescript
import { AxAI } from '@ax-llm/ax';
import { BrainstormProgram } from './ax-brainstorm-core';
import { getLLMCredentials } from '../services/LLMConfig';

const llmConfig = getLLMCredentials();
const ai = new AxAI({ name: 'openai', apiKey: llmConfig.apiKey });

const program = new BrainstormProgram();
const result = await program.forward(ai, {
  genre: '甜宠',
  platform: '抖音',
  requirements_section: '现代都市背景，温馨浪漫'
});
```

### 2. Run Optimization

```bash
# Run optimization with default settings
npx tsx src/server/ax/ax-optimize-brainstorm.ts

# Run with custom parameters
npx tsx src/server/ax/ax-optimize-brainstorm.ts --trials=20 --auto=medium --verbose

# Test with small dataset
npx tsx src/server/ax/test-optimization.ts
```

### 3. Use Optimized Program

```bash
# Use default optimized config
npx tsx src/server/ax/use-optimized-brainstorm.ts

# Use specific config file
npx tsx src/server/ax/use-optimized-brainstorm.ts ./my-optimized-config.json
```

## Optimization Process

The optimization uses **MiPRO v2** (Multi-Prompt Optimization) from the ax library:

1. **Load Training Data**: Examples from `/src/examples/` directory
2. **Define Metrics**: Quality-based or similarity-based evaluation
3. **Run Optimization**: MiPRO v2 finds optimal demonstrations
4. **Save Configuration**: Optimized demos saved to JSON file
5. **Apply Optimization**: Load demos into program for improved performance

### Optimization Options

- `numTrials`: Number of optimization trials (default: 15)
- `auto`: Optimization intensity - 'light' | 'medium' | 'heavy'
- `metricType`: Evaluation metric - 'quality' | 'similarity'
- `verbose`: Enable detailed logging
- `outputPath`: Where to save optimized configuration

### Evaluation Metrics

#### Quality Metric
- Title quality (30%): Length 3-10 characters
- Body appropriateness (40%): Length 50-200 characters  
- Genre relevance (30%): Contains genre-specific content

#### Similarity Metric
- Structural validation (50%): Title/body length checks
- Keyword matching (50%): Genre-specific keyword presence

## Integration with Existing System

The optimized program can be integrated into the existing streaming service:

```typescript
// In your streaming service
import { BrainstormProgram } from '../ax/ax-brainstorm-core';

class BrainstormingStreamingService {
  private program: BrainstormProgram;
  
  constructor() {
    this.program = new BrainstormProgram();
    this.loadOptimizedDemos();
  }
  
  private async loadOptimizedDemos() {
    // Load and apply optimized demonstrations
    const config = JSON.parse(fs.readFileSync('./optimized-brainstorm-demos.json', 'utf8'));
    if (config.demos) {
      this.program.setDemos(config.demos);
    }
  }
}
```

## Performance Benefits

With optimization, you can expect:
- **Higher Quality**: Better story titles and descriptions
- **Consistency**: More reliable output format
- **Genre Alignment**: Better matching to requested genres
- **Efficiency**: Optimized prompts reduce token usage

## Next Steps

1. **Continuous Optimization**: Re-run optimization with new training data
2. **A/B Testing**: Compare optimized vs non-optimized versions
3. **Custom Metrics**: Add domain-specific evaluation criteria
4. **Multi-Modal**: Extend to other content types (episodes, scripts)

## Troubleshooting

### Common Issues

1. **No Training Examples**: Ensure `/src/examples/` contains valid JSON files
2. **API Rate Limits**: Reduce `numTrials` or use `auto: 'light'`
3. **Memory Issues**: For large datasets, optimize in batches
4. **Type Errors**: Ensure all examples match `BrainstormRequest` schema

### Debug Tips

- Use `verbose: true` for detailed optimization logs
- Start with `numTrials: 5` for quick testing
- Check example format with `loadExamples()` function
- Validate schemas with Zod before optimization 