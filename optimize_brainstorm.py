#!/usr/bin/env python3
"""
Brainstorm optimization script using MIPROv2
Uses DSPy's most advanced optimizer for story idea generation quality improvement
Supports both flat (single-group) and grouped optimization approaches
"""

import mlflow
import sys
from copy import copy
from typing import List, Dict, Tuple
import dspy
from dspy.teleprompt import MIPROv2

from brainstorm_module import BrainstormModule, OptimizedBrainstormModule
from evaluators import StoryIdeaEvaluator, create_evaluation_metric, create_grouped_evaluation_metrics
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

def create_group_specific_training_examples(group_name: str) -> List[dspy.Example]:
    """Create training examples tailored for specific evaluation groups"""
    base_examples = create_training_examples()
    
    if group_name == "creativity":
        # Focus on genres that require high creativity and engagement
        creative_genres = ["穿越", "重生", "马甲", "替身", "玄幻", "末世", "金手指"]
        return [ex for ex in base_examples if ex.genre in creative_genres]
    elif group_name == "feasibility":
        # Focus on practical, cost-effective genres
        practical_genres = ["甜宠", "霸总", "萌宝", "团宠", "娱乐圈", "神医"]
        return [ex for ex in base_examples if ex.genre in practical_genres]
    elif group_name == "content_quality":
        # Focus on genres requiring detailed storytelling and logical coherence
        quality_genres = ["虐恋", "穿越", "重生", "战神", "逆袭", "高手下山"]
        return [ex for ex in base_examples if ex.genre in quality_genres]
    else:
        # Return all examples for overall/flat optimization
        return base_examples

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

def run_flat_optimization(auto_mode: str = "medium") -> Tuple[dspy.Module, List[dspy.Example]]:
    """Run flat (single-group) optimization - current approach"""
    print(f"🚀 开始平面优化 (模式: {auto_mode}) - 所有指标统一优化")
    print("=" * 60)
    
    try:
        # Create training examples
        train_examples = create_training_examples()
        print(f"创建了 {len(train_examples)} 个训练样例")
        
        # Create evaluator and metric (single overall metric)
        evaluator = StoryIdeaEvaluator()
        metric = create_evaluation_metric(evaluator)  # This uses the overall score
        
        # Configure MIPROv2 optimizer
        optimizer = MIPROv2(
            metric=metric,
            auto=auto_mode,
            max_bootstrapped_demos=4,
            num_threads=8,
            max_labeled_demos=4,
            verbose=True,
            track_stats=True,
            seed=42
        )
        
        print(f"配置平面优化器完成，开始训练...")
        
        # Compile the module
        base_module = BrainstormModule()
        compiled_module = optimizer.compile(
            base_module, 
            trainset=train_examples,
            requires_permission_to_run=False
        )
        
        print(f"✅ 平面优化完成!")
        return compiled_module, train_examples
        
    except Exception as e:
        print(f"❌ 平面优化过程中发生错误: {e}")
        print("停止执行")
        sys.exit(1)

def run_grouped_optimization(auto_mode: str = "medium") -> Tuple[Dict[str, dspy.Module], List[dspy.Example]]:
    """Run grouped optimization - separate optimization for different evaluation aspects"""
    print(f"🚀 开始分组优化 (模式: {auto_mode}) - 分别优化不同评估维度")
    print("=" * 60)
    
    try:
        # Create evaluator and grouped metrics
        evaluator = StoryIdeaEvaluator()
        grouped_metrics = create_grouped_evaluation_metrics(evaluator, use_single_group=False)
        
        optimized_modules = {}
        all_training_examples = []
        
        for group_name, metric in grouped_metrics.items():
            print(f"\n📊 优化组别: {group_name}")
            print("-" * 40)
            
            # Create group-specific or shared training examples
            if group_name in ["creativity", "feasibility", "content_quality"]:
                train_examples = create_group_specific_training_examples(group_name)
                print(f"  使用 {len(train_examples)} 个针对性训练样例")
            else:
                train_examples = create_training_examples()
                print(f"  使用 {len(train_examples)} 个通用训练样例")
            
            all_training_examples.extend(train_examples)
            
            # Configure optimizer for this group
            optimizer = MIPROv2(
                metric=metric,
                auto=auto_mode,
                max_bootstrapped_demos=3,  # Slightly fewer demos per group
                num_threads=6,
                max_labeled_demos=3,
                verbose=True,
                track_stats=True,
                seed=42 + hash(group_name) % 100  # Different seed per group
            )
            
            print(f"  开始优化 {group_name} 组...")
            
            # Compile module for this group
            base_module = BrainstormModule()
            compiled_module = optimizer.compile(
                base_module,
                trainset=train_examples,
                requires_permission_to_run=False
            )
            
            optimized_modules[group_name] = compiled_module
            print(f"  ✅ {group_name} 组优化完成!")
        
        print(f"\n✅ 所有分组优化完成! 共优化了 {len(optimized_modules)} 个组别")
        return optimized_modules, list(set(all_training_examples))  # Remove duplicates
        
    except Exception as e:
        print(f"❌ 分组优化过程中发生错误: {e}")
        print("停止执行")
        sys.exit(1)

def evaluate_model_performance(module, test_examples: List[dspy.Example], name: str) -> Tuple[float, Dict[str, float]]:
    """Evaluate model performance on test examples, return overall score and detailed scores"""
    print(f"\n📊 评估 {name} 模型性能")
    print("-" * 40)
    
    evaluator = StoryIdeaEvaluator()
    total_scores = []
    detailed_scores = {
        'novelty': [], 'feasibility': [], 'structure': [], 
        'detail': [], 'logical_coherence': [], 'genre': [], 'engagement': []
    }
    
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
            
            # Collect detailed scores
            detailed_scores['novelty'].append(result.novelty_score)
            detailed_scores['feasibility'].append(result.feasibility_score)
            detailed_scores['structure'].append(result.structure_score)
            detailed_scores['detail'].append(result.detail_score)
            detailed_scores['logical_coherence'].append(result.logical_coherence_score)
            detailed_scores['genre'].append(result.genre_score)
            detailed_scores['engagement'].append(result.engagement_score)
            
            print(f"  案例 {i+1} ({example.genre}): {result.overall_score:.1f}/10")
            
        except Exception as e:
            print(f"  ❌ 案例 {i+1} 评估失败: {e}")
            print("停止执行")
            sys.exit(1)
    
    if total_scores:
        avg_score = sum(total_scores) / len(total_scores)
        
        # Calculate average detailed scores
        avg_detailed_scores = {}
        for metric_name, scores in detailed_scores.items():
            if scores:
                avg_detailed_scores[metric_name] = sum(scores) / len(scores)
            else:
                avg_detailed_scores[metric_name] = 0.0
        
        print(f"\n  平均分数: {avg_score:.1f}/10")
        print(f"  详细分数:")
        for metric_name, score in avg_detailed_scores.items():
            print(f"    {metric_name}: {score:.1f}/10")
        
        return avg_score, avg_detailed_scores
    else:
        print("  ❌ 无有效评估结果")
        sys.exit(1)

def evaluate_grouped_models(grouped_modules: Dict[str, dspy.Module], test_examples: List[dspy.Example]) -> Tuple[float, Dict[str, float]]:
    """Evaluate grouped models and average their scores"""
    print(f"\n📊 评估分组优化模型性能")
    print("-" * 40)
    
    group_scores = {}
    group_detailed_scores = {}
    
    # Evaluate each group
    for group_name, module in grouped_modules.items():
        overall_score, detailed_scores = evaluate_model_performance(module, test_examples, f"分组-{group_name}")
        group_scores[group_name] = overall_score
        group_detailed_scores[group_name] = detailed_scores
    
    # Calculate averaged final score
    if group_scores:
        final_avg_score = sum(group_scores.values()) / len(group_scores)
        
        # Average detailed scores across groups
        final_detailed_scores = {}
        metric_names = ['novelty', 'feasibility', 'structure', 'detail', 'logical_coherence', 'genre', 'engagement']
        
        for metric_name in metric_names:
            metric_scores = [scores.get(metric_name, 0) for scores in group_detailed_scores.values()]
            final_detailed_scores[metric_name] = sum(metric_scores) / len(metric_scores) if metric_scores else 0.0
        
        print(f"\n🎯 分组模型最终平均分数: {final_avg_score:.1f}/10")
        print(f"  最终详细分数:")
        for metric_name, score in final_detailed_scores.items():
            print(f"    {metric_name}: {score:.1f}/10")
        
        return final_avg_score, final_detailed_scores
    else:
        print("  ❌ 无有效分组评估结果")
        sys.exit(1)

def save_optimized_model(module, name: str, score: float, detailed_scores: Dict[str, float] = None):
    """Save optimized model with MLflow"""
    try:
        with mlflow.start_run(run_name=f"optimized_brainstorm_{name}"):
            # Log parameters
            mlflow.log_param("optimizer_type", name)
            mlflow.log_param("model_type", "BrainstormModule")
            
            # Log metrics
            mlflow.log_metric("average_score", score)
            
            # Log detailed scores if available
            if detailed_scores:
                for metric_name, metric_score in detailed_scores.items():
                    mlflow.log_metric(f"avg_{metric_name}_score", metric_score)
            
            # Log model with proper input example format
            input_example = {
                "genre": "都市爱情",
                "platform": "抖音",
                "requirements_section": "浪漫甜蜜的爱情故事"
            }
            
            model_info = mlflow.dspy.log_model(
                module,
                artifact_path="model",
                input_example=input_example
            )
            
            print(f"✅ 模型已保存: {model_info.model_uri}")
            return model_info
    except Exception as e:
        print(f"❌ 模型保存失败: {e}")
        print("停止执行")
        sys.exit(1)

def compare_optimization_approaches():
    """Compare flat vs grouped optimization approaches with baseline"""
    print("🆚 优化方法对比测试: 基线 vs 平面优化 vs 分组优化")
    print("=" * 70)
    
    # Create test examples (separate from training)
    test_examples = [
        dspy.Example(genre="先婚后爱", platform="抖音", requirements_section="契约婚姻，情感真实"),
        dspy.Example(genre="恶女", platform="小红书", requirements_section="恶毒女配逆袭，双重人格"),
        dspy.Example(genre="残疾大佬", platform="快手", requirements_section="残疾大佬隐藏身份"),
        dspy.Example(genre="后宫", platform="抖音", requirements_section="后宫争斗，权谋设计"),
        dspy.Example(genre="复仇", platform="小红书", requirements_section="复仇主题，情节紧凑")
    ]
    
    results = {}
    detailed_results = {}
    
    # 1. Test baseline model
    print("\n1️⃣ 测试基线模型...")
    baseline_module = BrainstormModule()
    baseline_score, baseline_detailed = evaluate_model_performance(baseline_module, test_examples, "基线模型")
    results["基线模型"] = baseline_score
    detailed_results["基线模型"] = baseline_detailed
    
    # 2. Test flat optimization
    print(f"\n2️⃣ 运行平面优化...")
    flat_module, _ = run_flat_optimization("medium")
    flat_score, flat_detailed = evaluate_model_performance(flat_module, test_examples, "平面优化")
    results["平面优化"] = flat_score
    detailed_results["平面优化"] = flat_detailed
    
    # Inspect and save flat model
    print(f"\n🔍 检查平面优化结果:")
    inspect_optimized_module(flat_module, "平面优化")
    save_optimized_prompts(flat_module, "flat_optimization")
    save_optimized_model(flat_module, "flat_optimization", flat_score, flat_detailed)
    
    # 3. Test grouped optimization
    print(f"\n3️⃣ 运行分组优化...")
    grouped_modules, _ = run_grouped_optimization("medium")
    grouped_score, grouped_detailed = evaluate_grouped_models(grouped_modules, test_examples)
    results["分组优化"] = grouped_score
    detailed_results["分组优化"] = grouped_detailed
    
    # Inspect and save grouped models
    print(f"\n🔍 检查分组优化结果:")
    for group_name, module in grouped_modules.items():
        inspect_optimized_module(module, f"分组优化-{group_name}")
        save_optimized_prompts(module, f"grouped_optimization_{group_name}")
        # Save individual group models
        group_score, group_detailed = evaluate_model_performance(module, test_examples[:2], f"分组-{group_name}")  # Shorter eval for individual groups
        save_optimized_model(module, f"grouped_{group_name}", group_score, group_detailed)
    
    # Display final comparison results
    print("\n🏆 最终对比结果")
    print("=" * 70)
    print(f"{'方法':<15} {'总分':<10} {'提升':<10}")
    print("-" * 35)
    
    baseline_score_val = results["基线模型"]
    for method_name, score in results.items():
        if method_name == "基线模型":
            improvement = "基准"
        else:
            improvement = f"+{score - baseline_score_val:.1f}"
        print(f"{method_name:<15} {score:<10.1f} {improvement:<10}")
    
    # Display detailed comparison
    print(f"\n📊 详细指标对比")
    print("=" * 70)
    metric_names = ['novelty', 'feasibility', 'structure', 'detail', 'logical_coherence', 'genre', 'engagement']
    
    print(f"{'指标':<15} {'基线':<8} {'平面':<8} {'分组':<8} {'最佳':<8}")
    print("-" * 55)
    
    for metric_name in metric_names:
        baseline_val = detailed_results["基线模型"].get(metric_name, 0)
        flat_val = detailed_results["平面优化"].get(metric_name, 0)
        grouped_val = detailed_results["分组优化"].get(metric_name, 0)
        
        best_val = max(baseline_val, flat_val, grouped_val)
        best_method = "基线" if best_val == baseline_val else ("平面" if best_val == flat_val else "分组")
        
        print(f"{metric_name:<15} {baseline_val:<8.1f} {flat_val:<8.1f} {grouped_val:<8.1f} {best_method:<8}")
    
    # Find overall best method
    best_method = max(results.items(), key=lambda x: x[1])
    print(f"\n🥇 最佳优化方法: {best_method[0]} (得分: {best_method[1]:.1f})")
    
    return results, detailed_results

def main():
    """Main optimization workflow with approach comparison"""
    print("🧪 故事创意生成优化系统 - 平面 vs 分组优化对比")
    print("=" * 70)
    
    try:
        # Setup MLflow
        mlflow.set_experiment("Brainstorm_Optimization_Comparison")
        mlflow.dspy.autolog()
        
        # Run comprehensive comparison
        results, detailed_results = compare_optimization_approaches()
        
        print("\n✅ 优化对比流程完成!")
        print("\n📝 结果总结:")
        print("1. 基线模型: 未经优化的原始模型")
        print("2. 平面优化: 使用单一综合指标优化 (当前方法)")
        print("3. 分组优化: 分别优化创意性、可行性、内容质量三个组别")
        print("4. 查看 MLflow UI 了解详细训练过程和模型对比")
        print("5. 缓存机制避免重复评估相同内容")
        
    except Exception as e:
        print(f"❌ 主流程发生错误: {e}")
        print("程序终止")
        sys.exit(1)

if __name__ == "__main__":
    main()
