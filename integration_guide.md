# 优化模块集成指南

## 概述

恭喜完成 DSPy 优化过程！您现在拥有两种方式来使用优化后的模块：

1. **MLflow 模型** - 完整的优化模型，包含所有学习到的参数和示例
2. **提示词文件** - 保存了优化后的示例演示，可以重建类似的模型

## 文件结构

优化过程生成了以下文件：

```
project/
├── optimized_prompts/
│   └── flat_optimization_optimized_prompts.json  # 提示词信息
├── mlruns/                                       # MLflow 模型存储
│   └── 423243756719946323/                       # 实验ID
│       └── models/                               # 保存的模型
└── use_optimized_modules.py                      # 使用示例脚本
```

## 使用方法

### 1. 运行演示脚本

```bash
python use_optimized_modules.py
```

这将演示三种使用优化模块的方法：
- 从 MLflow 加载（推荐）
- 从提示词文件重建
- 生产环境集成示例

### 2. 在现有代码中集成

#### 方法 A: 直接替换现有模块

```python
from use_optimized_modules import load_optimized_from_mlflow, load_optimized_from_prompts
from brainstorm_module import BrainstormModule

# 尝试加载优化模型，失败则使用基础模型
optimized_module = (
    load_optimized_from_mlflow() or 
    load_optimized_from_prompts() or 
    BrainstormModule()
)

# 使用方式完全相同
result = optimized_module(
    genre="甜宠",
    platform="抖音", 
    requirements_section="职场精英, 双强CP"
)
```

#### 方法 B: 创建服务类

```python
class BrainstormService:
    def __init__(self):
        self.model = self._load_best_model()
    
    def _load_best_model(self):
        # 优先级：MLflow > 提示词文件 > 基础模型
        return (
            load_optimized_from_mlflow() or
            load_optimized_from_prompts() or
            BrainstormModule()
        )
    
    def generate_story_idea(self, genre, platform, requirements=""):
        result = self.model(
            genre=genre,
            platform=platform,
            requirements_section=requirements
        )
        return result.story_idea if hasattr(result, 'story_idea') else StoryIdea(title=result.title, body=result.body)
```

### 3. 集成到现有工作流

#### 在 run_single_brainstorm.py 中使用

```python
# 修改 run_single_brainstorm.py
from use_optimized_modules import load_optimized_from_mlflow, load_optimized_from_prompts

def create_module():
    """创建最佳可用模块"""
    return (
        load_optimized_from_mlflow() or
        load_optimized_from_prompts() or
        BrainstormModule()
    )

# 在主函数中使用
module = create_module()
```

#### 在后端 API 中使用

如果您有 API 服务，可以在启动时加载优化模型：

```python
# 在应用启动时
app.state.brainstorm_model = (
    load_optimized_from_mlflow() or
    load_optimized_from_prompts() or
    BrainstormModule()
)

# 在 API 端点中使用
@app.post("/api/brainstorm")
async def brainstorm_endpoint(request: BrainstormRequest):
    model = app.state.brainstorm_model
    result = model(
        genre=request.genre,
        platform=request.platform,
        requirements_section=request.requirements_section
    )
    return result.story_idea if hasattr(result, 'story_idea') else StoryIdea(title=result.title, body=result.body)
```

## 优化效果

优化后的模块相比基础模型具有以下优势：

1. **更好的示例演示** - 包含了学习到的高质量示例
2. **改进的提示词** - 经过 MIPROv2 优化的提示模板
3. **更一致的输出质量** - 基于评估指标优化的生成效果
4. **领域特定优化** - 针对您的具体用例（故事创意生成）进行了优化

## 性能对比

您可以运行以下命令来对比基础模型和优化模型的性能：

```bash
python use_optimized_modules.py
```

脚本会自动进行对比测试并显示结果。

## 故障排查

### 如果 MLflow 加载失败

1. 检查 `mlruns` 目录是否存在
2. 确认 MLflow 实验名称是否正确（默认：`Brainstorm_Flat_Optimization`）
3. 使用提示词文件作为备用方案

### 如果提示词文件重建失败

1. 检查 `optimized_prompts/flat_optimization_optimized_prompts.json` 是否存在
2. 确认文件格式是否正确
3. 回退到基础模型

### 环境配置问题

确保您的 `.env` 文件包含正确的 LLM 配置：

```env
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL_NAME=deepseek-chat
```

## 进一步优化

如果需要进一步优化，您可以：

1. **收集更多训练数据** - 添加更多高质量示例到 `examples/` 目录
2. **调整优化参数** - 修改 `optimize_brainstorm.py` 中的配置
3. **尝试不同的优化器** - 使用其他 DSPy 优化器如 `BootstrapFewShotWithRandomSearch`
4. **分组优化** - 将 `OPTIMIZATION_MODE` 改为 `"grouped"` 进行分维度优化

## 生产环境建议

1. **使用 MLflow 模型** - 更完整和稳定
2. **实现降级机制** - 确保优化模型失败时能回退到基础模型
3. **监控性能** - 记录生成质量和响应时间
4. **定期重新优化** - 随着更多数据的积累，定期重新运行优化

## 总结

您现在已经成功完成了 DSPy 模型优化，并有多种方式来使用优化后的模块。建议先运行演示脚本熟悉使用方法，然后根据您的具体需求选择合适的集成方式。

优化模块应该能够提供更好的故事创意生成质量，特别是在新颖性、逻辑连贯性和题材一致性方面。 