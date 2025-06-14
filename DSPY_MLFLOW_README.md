# DSPy 故事创意生成优化系统

这是一个基于 DSPy 的故事创意生成和优化系统，使用 LLM 评估器进行质量评估和模型优化。

## 系统架构

### 核心模块

1. **`common.py`** - 公共配置和数据结构
   - LLM 配置管理
   - 数据类定义（StoryIdea, BrainstormRequest, EvaluationResult）
   - 工具函数
   - 改进的 JSON 解析和错误处理

2. **`brainstorm_module.py`** - DSPy 创意生成模块
   - `BrainstormModule` - 基础创意生成模块
   

3. **`evaluators.py`** - LLM 评估器
   - 五维度评估：新颖性、可行性、结构性、题材一致性、吸引力
   - `StoryIdeaEvaluator` - 综合评估器
   - DSPy 优化指标函数

4. **`run_single_brainstorm.py`** - 单次运行脚本
   - 预定义测试案例
   - 交互模式

5. **`optimize_brainstorm.py`** - 优化训练脚本
   - Bootstrap Few-Shot 优化
   - COPRO 优化
   - 模型对比和保存
   - **纯DSPy架构，无需手动提示词工程**

6. **`inspect_optimized_prompts.py`** - **新增** 提示词检查工具
   - 检查优化后模块状态
   - 保存和导出优化提示词
   - 对比基础模型与优化模型

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

确保 `.env` 文件包含：
```env
LLM_API_KEY=your-deepseek-api-key
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL_NAME=deepseek-chat
```

### 3. 运行单次测试

```bash
python run_single_brainstorm.py
```

### 4. 运行优化训练

```bash
python optimize_brainstorm.py
```

### 5. 检查优化结果

优化完成后，查看：
- 控制台输出的详细检查信息
- `optimized_prompts/` 目录下的保存文件
- MLflow UI 中的实验记录

## 使用说明

### 单次创意生成

```python
from brainstorm_module import BrainstormModule
from common import BrainstormRequest

# 创建模块
module = BrainstormModule()

# 创建请求
request = BrainstormRequest(
    genre="甜宠",
    platform="抖音",
    requirements_section="浪漫甜蜜的爱情故事，适合年轻观众"
)

# 生成创意
ideas = module(request)
for idea in ideas:
    print(f"【{idea.title}】{idea.body}")
```

### 创意评估

```python
from evaluators import StoryIdeaEvaluator

# 创建评估器
evaluator = StoryIdeaEvaluator()

# 评估创意
result = evaluator.evaluate(ideas, request)
print(f"总体评分: {result.overall_score:.1f}/10")
print(f"详细反馈:\n{result.feedback}")
```

### 模块优化

```python
from dspy.teleprompt import BootstrapFewShotWithRandomSearch
from evaluators import create_evaluation_metric

# 创建评估指标
evaluator = StoryIdeaEvaluator()
metric = create_evaluation_metric(evaluator)

# 配置优化器
optimizer = BootstrapFewShotWithRandomSearch(
    metric=metric,
    num_candidate_programs=5,
    max_bootstrapped_demos=2
)

# 优化模块
base_module = BrainstormModule()
optimized_module = optimizer.compile(base_module, trainset=training_examples)
```

## 评估维度

系统使用七个维度评估创意质量：

1. **新颖性 (18%)** - 避免套路化，创意原创性
2. **可行性 (12%)** - 拍摄成本、场景复杂度等实际因素
3. **结构性 (8%)** - 起承转合完整性，逻辑清晰度
4. **详细程度 (18%)** - 故事梗概的丰富性、细节描述和情节展开程度
5. **逻辑连贯性 (16%)** - 故事内在逻辑、时间线一致性、因果关系合理性，特别关注穿越、重生、多时空等复杂设定的逻辑漏洞
6. **题材一致性 (10%)** - 与指定题材的匹配度
7. **吸引力 (18%)** - 观众兴趣和传播潜力

## 优化策略

### Bootstrap Few-Shot
- 使用少量高质量示例进行自举学习
- 适合改善创意生成的一致性和质量
- 训练速度相对较快

### COPRO (Collaborative Prompt Optimization)
- 协作式提示词优化
- 迭代改进提示模板
- 适合复杂创意生成任务

## MLflow 集成

系统集成 MLflow 进行实验跟踪：

```bash
# 启动 MLflow UI（可选）
mlflow ui

# 查看实验结果
# http://localhost:5000
```

自动记录：
- 模型参数和配置
- 评估指标和分数
- 优化过程追踪
- 模型保存和版本管理

## 扩展指南

### 添加新的评估维度

1. 在 `evaluators.py` 中添加新的 Signature：
```python
class NewEvaluationSignature(dspy.Signature):
    story_ideas = dspy.InputField(desc="待评估创意")
    new_score = dspy.OutputField(desc="新维度评分")
```

2. 在 `StoryIdeaEvaluator` 中集成新评估器

3. 更新权重计算逻辑

### 添加新的优化器

1. 导入新的 DSPy 优化器
2. 在 `optimize_brainstorm.py` 中添加优化函数
3. 在 `compare_models()` 中集成测试

### 自定义训练数据

修改 `create_training_examples()` 函数，添加更多样化的训练案例：

```python
def create_training_examples():
    return [
        # 女频题材
        BrainstormExample("甜宠", "抖音", "浪漫甜蜜的爱情故事"),
        BrainstormExample("虐恋", "小红书", "充满波折的爱情故事"),
        BrainstormExample("穿越", "快手", "身穿或魂穿设定"),
        BrainstormExample("重生", "抖音", "重生复仇或改变命运"),
        
        # 男频题材
        BrainstormExample("赘婿", "小红书", "赘婿逆袭，扮猪吃老虎"),
        BrainstormExample("神豪", "快手", "一夜暴富，点石成金"),
        BrainstormExample("战神", "抖音", "强者归来，兵王题材"),
        # 添加更多案例...
    ]
```

## 故障排除

### 常见问题

1. **API 连接失败**
   - 检查 `.env` 配置
   - 验证 API 密钥有效性

2. **评估器返回错误分数**
   - 检查 LLM 响应格式
   - 调整 `_parse_score` 函数

3. **优化过程中断**
   - 减少 `num_candidate_programs`
   - 设置 `num_threads=1`

4. **内存不足**
   - 减少训练样例数量
   - 降低模型参数

### 调试技巧

1. 启用详细日志：
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

2. 单步测试：
```python
# 先测试单个组件
ideas = module(request)
result = evaluator.evaluate(ideas, request)
```

3. 检查 MLflow 实验记录了解训练过程

## 许可证

[根据项目需要添加许可证信息] 

## 检查优化后的提示词

### 自动检查功能

运行优化脚本后，系统会自动检查和保存优化后的提示词：

```bash
python optimize_brainstorm.py
```

优化完成后，你会看到：
- 📚 Few-shot demonstrations 的数量和内容
- 🏷️  Signature 信息和字段描述  
- 📝 扩展的 Signature 或指令
- ✅ 提示词信息保存到 `optimized_prompts/` 目录

### 手动检查工具

使用独立的检查工具：

```python
from inspect_optimized_prompts import inspect_optimized_module, save_optimized_prompts
from brainstorm_module import BrainstormModule

# 检查模块状态
module = BrainstormModule()  # 或加载优化后的模块
inspect_optimized_module(module, "模块名称")

# 保存提示词信息到文件
save_optimized_prompts(module, "模块名称")
```

### 追踪执行过程

查看模块实际执行时使用的提示词：

```python
from inspect_optimized_prompts import trace_module_execution
from common import BrainstormRequest

request = BrainstormRequest(genre="甜宠", platform="抖音")
ideas = trace_module_execution(module, request, "测试模块")
```

### 对比基础与优化模型

```python
from inspect_optimized_prompts import compare_baseline_vs_optimized

baseline_module = BrainstormModule()
# optimized_module = 加载优化后的模块
compare_baseline_vs_optimized(baseline_module, optimized_module, test_request)
```

### 提示词文件格式

保存的提示词文件包含：

```json
{
  "name": "bootstrap",
  "type": "BrainstormModule", 
  "predictor": {
    "type": "Predict",
    "has_demos": true,
    "num_demos": 3,
    "demos": [
      {
        "genre": "甜宠",
        "platform": "抖音",
        "requirements_section": "浪漫甜蜜的爱情故事",
        "story_ideas": "[{\"title\":\"心动\",\"body\":\"...\"}]"
      }
    ],
    "signature": {
      "name": "BrainstormSignature",
      "fields": {
        "inputs": {
          "genre": "故事类型/题材",
          "platform": "目标平台"
        },
        "outputs": {
          "story_ideas": "JSON格式的故事创意数组"
        }
      }
    }
  }
}
```

## 错误处理改进

### 纯DSPy架构优势

系统采用纯DSPy架构，具有以下优势：

1. **结构化输出**: DSPy内部处理结构化输出，无需JSON解析
2. **自动优化**: 基于黄金样例自动优化提示词，无需手动工程
3. **模型无关**: 同一套代码可适配不同LLM模型
4. **DSPy示例配置**: 自动配置输入字段，避免"Use `example.with_inputs()`"错误  
3. **优化器参数**: 自动添加必需参数如`eval_kwargs`
4. **快速失败**: 遇到错误立即停止，不再继续执行

### 改进的JSON解析

- 支持去除markdown格式 (```json)
- 使用正则表达式提取JSON数组
- 详细的错误信息和调试输出
- 自动验证数据结构完整性

```python
# 示例：改进的解析逻辑
def parse_story_ideas(json_response: str) -> List[StoryIdea]:
    # 清理响应格式
    cleaned_response = json_response.strip()
    if cleaned_response.startswith("```json"):
        cleaned_response = cleaned_response.replace("```json", "").replace("```", "").strip()
    
    # 尝试直接解析，失败则使用正则表达式
    try:
        ideas_data = json.loads(cleaned_response)
    except json.JSONDecodeError:
        json_pattern = r'\[.*?\]'
        matches = re.findall(json_pattern, cleaned_response, re.DOTALL)
        if matches:
            ideas_data = json.loads(matches[0])
        else:
            raise json.JSONDecodeError("No valid JSON array found", cleaned_response, 0) 
```
