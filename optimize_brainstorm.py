#!/usr/bin/env python3
"""
Brainstorm optimization script
Uses DSPy optimizers to improve story idea generation quality
"""

import mlflow
from copy import copy
from typing import List
import dspy
from dspy.teleprompt import BootstrapFewShotWithRandomSearch, COPRO, BayesianSignatureOptimizer

from brainstorm_module import BrainstormModule, OptimizedBrainstormModule
from evaluators import StoryIdeaEvaluator, create_evaluation_metric
from common import BrainstormRequest

class BrainstormExample(dspy.Example):
    """Example class for brainstorm training data"""
    def __init__(self, genre: str, platform: str, requirements_section: str = ""):
        super().__init__(
            genre=genre,
            platform=platform,
            requirements_section=requirements_section
        )
        # Mark input fields
        self.genre = genre
        self.platform = platform
        self.requirements_section = requirements_section

def create_training_examples() -> List[BrainstormExample]:
    """Create diverse training examples for optimization using real genre system"""
    examples = [
        # 女频 - 爱情类
        BrainstormExample("甜宠", "抖音", "浪漫甜蜜的爱情故事，适合年轻观众"),
        BrainstormExample("虐恋", "小红书", "充满波折、痛苦和情感挣扎的爱情故事"),
        BrainstormExample("霸总", "快手", "高冷型霸道总裁，节奏紧凑"),
        
        # 女频 - 设定类
        BrainstormExample("穿越", "抖音", "身穿或魂穿，古代现代背景都可"),
        BrainstormExample("重生", "小红书", "重生题材，复仇或改变命运"),
        BrainstormExample("马甲", "快手", "多重身份设定，反转惊喜"),
        BrainstormExample("替身", "抖音", "真假千金，双胞胎替换"),
        
        # 女频 - 其他类型
        BrainstormExample("萌宝", "小红书", "可爱萌娃，温馨家庭"),
        BrainstormExample("团宠", "快手", "被全家宠爱的设定"),
        BrainstormExample("娱乐圈", "抖音", "娱乐圈背景，明星生活"),
        
        # 男频 - 设定类
        BrainstormExample("玄幻", "快手", "修炼成仙，升级打怪"),
        BrainstormExample("末世", "抖音", "末日求生，丧尸题材，制作成本可控"),
        
        # 男频 - 逆袭类
        BrainstormExample("战神", "小红书", "强者归来，兵王题材"),
        BrainstormExample("神豪", "抖音", "一夜暴富，点石成金"),
        BrainstormExample("赘婿", "快手", "赘婿逆袭，扮猪吃老虎"),
        BrainstormExample("逆袭", "小红书", "小人物成长，马甲大佬"),
        BrainstormExample("金手指", "抖音", "超能力，系统选中"),
        BrainstormExample("高手下山", "快手", "隐世高手重出江湖"),
        
        # 男频 - 其他类型
        BrainstormExample("神医", "小红书", "医术高超，悬壶济世"),
    ]
    
    return examples

def run_bootstrap_optimization():
    """Run bootstrap few-shot optimization"""
    print("🚀 开始 Bootstrap Few-Shot 优化")
    print("=" * 50)
    
    # Create training examples
    train_examples = create_training_examples()
    print(f"创建了 {len(train_examples)} 个训练样例")
    
    # Create evaluator and metric
    evaluator = StoryIdeaEvaluator()
    metric = create_evaluation_metric(evaluator)
    
    # Configure optimizer
    optimizer = BootstrapFewShotWithRandomSearch(
        metric=metric,
        num_candidate_programs=8,  # More candidates for better exploration
        max_bootstrapped_demos=3,  # More demonstrations
        num_threads=1,  # Keep single-threaded for stability
        max_rounds=2   # Multiple optimization rounds
    )
    
    print("配置优化器完成，开始训练...")
    
    # Compile the module
    base_module = BrainstormModule()
    compiled_module = optimizer.compile(base_module, trainset=train_examples)
    
    print("✅ Bootstrap 优化完成!")
    return compiled_module, train_examples

def run_copro_optimization():
    """Run COPRO (Collaborative Prompt Optimization)"""
    print("🚀 开始 COPRO 优化")
    print("=" * 50)
    
    # Create training examples
    train_examples = create_training_examples()
    print(f"创建了 {len(train_examples)} 个训练样例")
    
    # Create evaluator and metric
    evaluator = StoryIdeaEvaluator()
    metric = create_evaluation_metric(evaluator)
    
    # Configure COPRO optimizer
    optimizer = COPRO(
        metric=metric,
        breadth=10,    # Number of candidates to generate
        depth=3,       # Number of optimization iterations
        init_temperature=1.4  # Temperature for generation
    )
    
    print("配置 COPRO 优化器完成，开始训练...")
    
    # Compile the module
    base_module = BrainstormModule()
    compiled_module = optimizer.compile(base_module, trainset=train_examples)
    
    print("✅ COPRO 优化完成!")
    return compiled_module, train_examples

def evaluate_model_performance(module, test_examples: List[BrainstormExample], name: str):
    """Evaluate model performance on test examples"""
    print(f"\n📊 评估 {name} 模型性能")
    print("-" * 40)
    
    evaluator = StoryIdeaEvaluator()
    total_scores = []
    
    for i, example in enumerate(test_examples[:5]):  # Test on first 5 examples
        try:
            request = BrainstormRequest(
                genre=example.genre,
                platform=example.platform,
                requirements_section=example.requirements_section
            )
            
            # Generate ideas
            ideas = module(request)
            
            # Evaluate
            result = evaluator.evaluate(ideas, request)
            total_scores.append(result.overall_score)
            
            print(f"  案例 {i+1} ({example.genre}): {result.overall_score:.1f}/10")
            
        except Exception as e:
            print(f"  案例 {i+1} 评估失败: {e}")
            continue
    
    if total_scores:
        avg_score = sum(total_scores) / len(total_scores)
        print(f"\n  平均分数: {avg_score:.1f}/10")
        return avg_score
    else:
        print("  无有效评估结果")
        return 0.0

def save_optimized_model(module, name: str, score: float):
    """Save optimized model with MLflow"""
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

def compare_models():
    """Compare different optimization approaches"""
    print("🆚 模型对比测试")
    print("=" * 50)
    
    # Create test examples (separate from training)
    test_examples = [
        BrainstormExample("先婚后爱", "抖音", "契约婚姻，情感真实"),
        BrainstormExample("恶女", "小红书", "恶毒女配逆袭，双重人格"),
        BrainstormExample("残疾大佬", "快手", "残疾大佬隐藏身份"),
        BrainstormExample("后宫", "抖音", "后宫争斗，权谋设计"),
        BrainstormExample("复仇", "小红书", "复仇主题，情节紧凑")
    ]
    
    results = {}
    
    # Test baseline model
    print("测试基础模型...")
    baseline_module = BrainstormModule()
    baseline_score = evaluate_model_performance(baseline_module, test_examples, "基础模型")
    results["基础模型"] = baseline_score
    
    # Test bootstrap optimized model
    try:
        print("\n运行 Bootstrap 优化...")
        bootstrap_module, _ = run_bootstrap_optimization()
        bootstrap_score = evaluate_model_performance(bootstrap_module, test_examples, "Bootstrap优化")
        results["Bootstrap优化"] = bootstrap_score
        
        # Save best bootstrap model
        save_optimized_model(bootstrap_module, "bootstrap", bootstrap_score)
        
    except Exception as e:
        print(f"Bootstrap 优化失败: {e}")
        results["Bootstrap优化"] = 0.0
    
    # Test COPRO optimized model
    try:
        print("\n运行 COPRO 优化...")
        copro_module, _ = run_copro_optimization()
        copro_score = evaluate_model_performance(copro_module, test_examples, "COPRO优化")
        results["COPRO优化"] = copro_score
        
        # Save COPRO model
        save_optimized_model(copro_module, "copro", copro_score)
        
    except Exception as e:
        print(f"COPRO 优化失败: {e}")
        results["COPRO优化"] = 0.0
    
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
    """Main optimization workflow"""
    print("🧪 故事创意生成优化系统")
    print("=" * 50)
    
    # Setup MLflow
    mlflow.set_experiment("Brainstorm_Optimization")
    mlflow.dspy.autolog()
    
    # Run comprehensive comparison
    results = compare_models()
    
    print("\n✅ 优化流程完成!")
    print("\n📝 使用建议:")
    print("1. 查看 MLflow UI 了解详细训练过程")
    print("2. 选择表现最佳的模型进行部署")
    print("3. 可以基于最佳模型继续调优参数")

if __name__ == "__main__":
    main() 