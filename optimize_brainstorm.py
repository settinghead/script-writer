#!/usr/bin/env python3
"""
Brainstorm optimization script using MIPROv2
Uses DSPy's most advanced optimizer for story idea generation quality improvement
"""

import mlflow
import sys
from copy import copy
from typing import List
import dspy
from dspy.teleprompt import MIPROv2

from brainstorm_module import BrainstormModule, OptimizedBrainstormModule
from evaluators import StoryIdeaEvaluator, create_evaluation_metric
from common import BrainstormRequest
from inspect_optimized_prompts import inspect_optimized_module, save_optimized_prompts

def create_training_examples() -> List[dspy.Example]:
    """Create diverse training examples for optimization using real genre system"""
    examples_data = [
        # 女频 - 爱情类
        {"genre": "甜宠", "platform": "抖音", "requirements_section": "浪漫甜蜜的爱情故事，适合年轻观众"},
        {"genre": "虐恋", "platform": "小红书", "requirements_section": "充满波折、痛苦和情感挣扎的爱情故事"},
        {"genre": "霸总", "platform": "快手", "requirements_section": "高冷型霸道总裁，节奏紧凑"},
        
        # 女频 - 设定类
        {"genre": "穿越", "platform": "抖音", "requirements_section": "身穿或魂穿，古代现代背景都可"},
        {"genre": "重生", "platform": "小红书", "requirements_section": "重生题材，复仇或改变命运"},
        {"genre": "马甲", "platform": "快手", "requirements_section": "多重身份设定，反转惊喜"},
        {"genre": "替身", "platform": "抖音", "requirements_section": "真假千金，双胞胎替换"},
        
        # 女频 - 其他类型
        {"genre": "萌宝", "platform": "小红书", "requirements_section": "可爱萌娃，温馨家庭"},
        {"genre": "团宠", "platform": "快手", "requirements_section": "被全家宠爱的设定"},
        {"genre": "娱乐圈", "platform": "抖音", "requirements_section": "娱乐圈背景，明星生活"},
        
        # 男频 - 设定类
        {"genre": "玄幻", "platform": "快手", "requirements_section": "修炼成仙，升级打怪"},
        {"genre": "末世", "platform": "抖音", "requirements_section": "末日求生，丧尸题材，制作成本可控"},
        
        # 男频 - 逆袭类
        {"genre": "战神", "platform": "小红书", "requirements_section": "强者归来，兵王题材"},
        {"genre": "神豪", "platform": "抖音", "requirements_section": "一夜暴富，点石成金"},
        {"genre": "赘婿", "platform": "快手", "requirements_section": "赘婿逆袭，扮猪吃老虎"},
        {"genre": "逆袭", "platform": "小红书", "requirements_section": "小人物成长，马甲大佬"},
        {"genre": "金手指", "platform": "抖音", "requirements_section": "超能力，系统选中"},
        {"genre": "高手下山", "platform": "快手", "requirements_section": "隐世高手重出江湖"},
        
        # 男频 - 其他类型
        {"genre": "神医", "platform": "小红书", "requirements_section": "医术高超，悬壶济世"},
    ]
    
    # Create DSPy examples and configure with proper input fields
    configured_examples = []
    for data in examples_data:
        example = dspy.Example(**data)
        configured_example = example.with_inputs("genre", "platform", "requirements_section")
        configured_examples.append(configured_example)
    
    return configured_examples

def generate_ideas_with_retry(module, request: BrainstormRequest, max_retries: int = 2):
    """Generate ideas with retry logic for JSON parsing failures"""
    for attempt in range(max_retries + 1):
        try:
            ideas = module(
                genre=request.genre,
                platform=request.platform,
                requirements_section=request.requirements_section
            )
            if len(ideas) == 0:
                if attempt < max_retries:
                    print(f"  JSON解析失败，重试 {attempt + 1}/{max_retries}")
                    continue
                else:
                    print(f"  ❌ JSON解析失败，达到最大重试次数，停止执行")
                    sys.exit(1)
            return ideas
        except Exception as e:
            if attempt < max_retries:
                print(f"  生成失败，重试 {attempt + 1}/{max_retries}: {e}")
                continue
            else:
                print(f"  ❌ 生成失败，达到最大重试次数: {e}")
                sys.exit(1)

def run_mipro_optimization(auto_mode: str = "medium"):
    """Run MIPROv2 optimization with specified auto mode"""
    print(f"🚀 开始 MIPROv2 优化 (模式: {auto_mode})")
    print("=" * 50)
    
    try:
        # Create training examples
        train_examples = create_training_examples()
        print(f"创建了 {len(train_examples)} 个训练样例")
        
        # Create evaluator and metric
        evaluator = StoryIdeaEvaluator()
        metric = create_evaluation_metric(evaluator)
        
        # Configure MIPROv2 optimizer
        optimizer = MIPROv2(
            metric=metric,
            auto=auto_mode,  # "light", "medium", or "heavy"
            max_bootstrapped_demos=4,
            num_threads=5,
            max_labeled_demos=4,
            verbose=True,
            track_stats=True,
            seed=42  # For reproducibility
        )
        
        print(f"配置 MIPROv2 优化器完成 ({auto_mode} 模式)，开始训练...")
        
        # Compile the module
        base_module = BrainstormModule()
        compiled_module = optimizer.compile(
            base_module, 
            trainset=train_examples,
            requires_permission_to_run=False  # Required for MIPROv2
        )
        
        print(f"✅ MIPROv2 优化完成 ({auto_mode} 模式)!")
        return compiled_module, train_examples
        
    except Exception as e:
        print(f"❌ MIPROv2 优化过程中发生错误: {e}")
        print("停止执行")
        sys.exit(1)

def evaluate_model_performance(module, test_examples: List[dspy.Example], name: str):
    """Evaluate model performance on test examples"""
    print(f"\n📊 评估 {name} 模型性能")
    print("-" * 40)
    
    evaluator = StoryIdeaEvaluator()
    total_scores = []
    
    for i, example in enumerate(test_examples[:5]):
        try:
            request = BrainstormRequest(
                genre=example.genre,
                platform=example.platform,
                requirements_section=example.requirements_section
            )
            
            # Generate ideas with retry logic
            ideas = generate_ideas_with_retry(module, request)
            
            # Evaluate
            result = evaluator.evaluate(ideas, request)
            total_scores.append(result.overall_score)
            
            print(f"  案例 {i+1} ({example.genre}): {result.overall_score:.1f}/10")
            
        except Exception as e:
            print(f"  ❌ 案例 {i+1} 评估失败: {e}")
            print("停止执行")
            sys.exit(1)
    
    if total_scores:
        avg_score = sum(total_scores) / len(total_scores)
        print(f"\n  平均分数: {avg_score:.1f}/10")
        return avg_score
    else:
        print("  ❌ 无有效评估结果")
        sys.exit(1)

def save_optimized_model(module, name: str, score: float):
    """Save optimized model with MLflow"""
    try:
        with mlflow.start_run(run_name=f"optimized_brainstorm_{name}"):
            # Log parameters
            mlflow.log_param("optimizer_type", name)
            mlflow.log_param("model_type", "BrainstormModule")
            
            # Log metrics
            mlflow.log_metric("average_score", score)
            
            # Log model
            model_info = mlflow.dspy.log_model(
                module,
                artifact_path="model",
                input_example=BrainstormRequest(
                    genre="都市爱情",
                    platform="抖音"
                )
            )
            
            print(f"✅ 模型已保存: {model_info.model_uri}")
            return model_info
    except Exception as e:
        print(f"❌ 模型保存失败: {e}")
        print("停止执行")
        sys.exit(1)

def compare_mipro_modes():
    """Compare different MIPROv2 auto modes and baseline"""
    print("🆚 MIPROv2 模式对比测试")
    print("=" * 50)
    
    # Create test examples (separate from training)
    test_examples = [
        dspy.Example(genre="先婚后爱", platform="抖音", requirements_section="契约婚姻，情感真实"),
        dspy.Example(genre="恶女", platform="小红书", requirements_section="恶毒女配逆袭，双重人格"),
        dspy.Example(genre="残疾大佬", platform="快手", requirements_section="残疾大佬隐藏身份"),
        dspy.Example(genre="后宫", platform="抖音", requirements_section="后宫争斗，权谋设计"),
        dspy.Example(genre="复仇", platform="小红书", requirements_section="复仇主题，情节紧凑")
    ]
    
    results = {}
    
    # Test baseline model
    print("测试基础模型...")
    baseline_module = BrainstormModule()
    baseline_score = evaluate_model_performance(baseline_module, test_examples, "基础模型")
    results["基础模型"] = baseline_score
    
    # Test different MIPROv2 modes
    mipro_modes = ["light", "medium", "heavy"]
    
    for mode in mipro_modes:
        print(f"\n运行 MIPROv2 优化 ({mode} 模式)...")
        optimized_module, _ = run_mipro_optimization(mode)
        mode_score = evaluate_model_performance(optimized_module, test_examples, f"MIPROv2-{mode}")
        results[f"MIPROv2-{mode}"] = mode_score
        
        # Inspect and save optimized model
        print(f"\n🔍 检查 MIPROv2-{mode} 优化结果:")
        inspect_optimized_module(optimized_module, f"MIPROv2-{mode}")
        save_optimized_prompts(optimized_module, f"miprov2_{mode}")
        
        # Save model
        save_optimized_model(optimized_module, f"miprov2_{mode}", mode_score)
    
    # Display final results
    print("\n🏆 最终对比结果")
    print("=" * 50)
    for model_name, score in results.items():
        print(f"{model_name:15}: {score:.1f}/10")
    
    # Find best model
    best_model = max(results.items(), key=lambda x: x[1])
    print(f"\n🥇 最佳模型: {best_model[0]} (得分: {best_model[1]:.1f})")
    
    return results

def main():
    """Main optimization workflow using MIPROv2"""
    print("🧪 故事创意生成优化系统 - MIPROv2版本")
    print("=" * 50)
    
    try:
        # Setup MLflow
        mlflow.set_experiment("Brainstorm_MIPROv2_Optimization")
        mlflow.dspy.autolog()
        
        # Run comprehensive comparison
        results = compare_mipro_modes()
        
        print("\n✅ MIPROv2 优化流程完成!")
        print("\n📝 使用建议:")
        print("1. 查看 MLflow UI 了解详细训练过程")
        print("2. Heavy 模式通常效果最好但耗时最长")
        print("3. Medium 模式是性能和时间的良好平衡")
        print("4. Light 模式适合快速原型测试")
        print("5. 选择表现最佳的模型进行部署")
        
    except Exception as e:
        print(f"❌ 主流程发生错误: {e}")
        print("程序终止")
        sys.exit(1)

if __name__ == "__main__":
    main()
