# DSPy 故事创意生成优化系统

这是一个基于 DSPy 的故事创意生成和优化系统，使用 LLM 评估器进行质量评估和模型优化。

## 系统架构

### 核心模块

1. **`common.py`** - 公共配置和数据结构
   - LLM 配置管理
   - 数据类定义（StoryIdea, BrainstormRequest, EvaluationResult）
   - 工具函数

2. **`brainstorm_module.py`** - DSPy 创意生成模块
   - `BrainstormModule` - 基础创意生成模块
   - `OptimizedBrainstormModule` - 增强版创意生成模块（带推理链）

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

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements_brainstorm.txt
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

系统使用五个维度评估创意质量：

1. **新颖性 (25%)** - 避免套路化，创意原创性
2. **可行性 (20%)** - 拍摄成本、场景复杂度等实际因素
3. **结构性 (15%)** - 起承转合完整性，逻辑清晰度
4. **题材一致性 (20%)** - 与指定题材的匹配度
5. **吸引力 (20%)** - 观众兴趣和传播潜力

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