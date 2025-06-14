#!/usr/bin/env python3
"""
Brainstorm optimization script using MIPROv2
Uses DSPy's most advanced optimizer for story idea generation quality improvement
Supports both flat (single-group) and grouped optimization approaches
Uses golden examples from /examples directory for high-quality training data
"""

import mlflow
import sys
import json
import os
from copy import copy
from typing import List, Dict, Tuple
from datetime import datetime
import dspy
from dspy.teleprompt import MIPROv2

from brainstorm_module import BrainstormModule
from evaluators import StoryIdeaEvaluator, create_evaluation_metric, create_grouped_evaluation_metrics
from common import BrainstormRequest, StoryIdea
from inspect_optimized_prompts import inspect_optimized_module, save_optimized_prompts

# CONFIGURATION: Set optimization mode
# Options: "flat" (current approach - single overall metric) or "grouped" (separate group optimization)
OPTIMIZATION_MODE = "flat"  # Change this to "grouped" to use grouped optimization

# CONFIGURATION: Number of test examples to evaluate (reduce for faster optimization)
MAX_TEST_EXAMPLES = 2  # Reduced from 5 to speed up evaluation



# Global variables for logging
LOG_DIR = None
CURRENT_STEP = 0

class ComprehensiveLogger:
    """Comprehensive file-based logger for optimization process"""
    
    def __init__(self, base_dir: str = "optimization_logs"):
        self.base_dir = base_dir
        self.run_dir = None
        self.step_counter = 0
        self.setup_logging_directories()
    
    def setup_logging_directories(self):
        """Setup logging directory structure"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        mode = OPTIMIZATION_MODE
        self.run_dir = os.path.join(self.base_dir, f"{mode}_optimization_{timestamp}")
        
        # Create directory structure
        directories = [
            "00_configuration",
            "01_training_data", 
            "02_golden_examples",
            "03_optimization_process",
            "04_evaluation_results",
            "05_final_models",
            "06_prompts_comparison",
            "07_error_logs",
            "08_performance_metrics"
        ]
        
        for dir_name in directories:
            os.makedirs(os.path.join(self.run_dir, dir_name), exist_ok=True)
        
        print(f"📁 日志目录创建: {self.run_dir}")
    
    def log_configuration(self, config: Dict):
        """Log optimization configuration"""
        config_file = os.path.join(self.run_dir, "00_configuration", "optimization_config.json")
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        print(f"✅ 配置已保存: {config_file}")
    
    def log_training_data(self, examples: List[dspy.Example], data_type: str):
        """Log training examples"""
        data_dir = os.path.join(self.run_dir, "01_training_data")
        
        # Save examples as JSON
        examples_data = []
        for i, example in enumerate(examples):
            example_dict = {
                "index": i,
                "genre": getattr(example, 'genre', 'N/A'),
                "platform": getattr(example, 'platform', 'N/A'),
                "requirements_section": getattr(example, 'requirements_section', 'N/A'),
                "has_expected_output": hasattr(example, 'ideas'),
            }
            if hasattr(example, 'ideas'):
                example_dict["expected_ideas"] = example.ideas
            examples_data.append(example_dict)
        
        json_file = os.path.join(data_dir, f"{data_type}_examples.json")
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(examples_data, f, ensure_ascii=False, indent=2)
        
        # Save summary
        summary_file = os.path.join(data_dir, f"{data_type}_summary.txt")
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write(f"Training Data Summary - {data_type}\n")
            f.write("=" * 50 + "\n\n")
            f.write(f"Total examples: {len(examples)}\n")
            f.write(f"Data type: {data_type}\n")
            f.write(f"Timestamp: {datetime.now()}\n\n")
            
            # Genre distribution
            genres = {}
            platforms = {}
            for example in examples:
                genre = getattr(example, 'genre', 'Unknown')
                platform = getattr(example, 'platform', 'Unknown')
                genres[genre] = genres.get(genre, 0) + 1
                platforms[platform] = platforms.get(platform, 0) + 1
            
            f.write("Genre Distribution:\n")
            for genre, count in sorted(genres.items()):
                f.write(f"  {genre}: {count}\n")
            
            f.write("\nPlatform Distribution:\n")
            for platform, count in sorted(platforms.items()):
                f.write(f"  {platform}: {count}\n")
        
        print(f"✅ {data_type} 训练数据已保存: {len(examples)} 个样例")
    
    def log_golden_examples(self, golden_examples: List[dspy.Example]):
        """Log golden examples with detailed analysis"""
        golden_dir = os.path.join(self.run_dir, "02_golden_examples")
        
        # Save detailed golden examples
        golden_data = []
        for i, example in enumerate(golden_examples):
            example_dict = {
                "index": i,
                "genre": getattr(example, 'genre', 'N/A'),
                "platform": getattr(example, 'platform', 'N/A'),
                "requirements": getattr(example, 'requirements_section', 'N/A'),
                "expected_content": getattr(example, 'ideas', [])
            }
            golden_data.append(example_dict)
        
        golden_file = os.path.join(golden_dir, "golden_examples_detailed.json")
        with open(golden_file, 'w', encoding='utf-8') as f:
            json.dump(golden_data, f, ensure_ascii=False, indent=2)
        
        # Create readable analysis
        analysis_file = os.path.join(golden_dir, "golden_examples_analysis.txt")
        with open(analysis_file, 'w', encoding='utf-8') as f:
            f.write("Golden Examples Analysis\n")
            f.write("=" * 50 + "\n\n")
            f.write(f"Total golden examples: {len(golden_examples)}\n")
            f.write(f"Analysis timestamp: {datetime.now()}\n\n")
            
            for i, example in enumerate(golden_examples):
                f.write(f"Golden Example {i+1}:\n")
                f.write(f"  Genre: {getattr(example, 'genre', 'N/A')}\n")
                f.write(f"  Platform: {getattr(example, 'platform', 'N/A')}\n")
                f.write(f"  Requirements: {getattr(example, 'requirements_section', 'N/A')}\n")
                if hasattr(example, 'ideas') and example.ideas:
                    content = example.ideas[0]
                    f.write(f"  Content Length: {len(content)} characters\n")
                    f.write(f"  Content Preview: {content[:100]}...\n")
                f.write("\n")
        
        print(f"✅ 黄金样例分析已保存: {len(golden_examples)} 个样例")
    
    def log_optimization_step(self, step_name: str, data: Dict, step_type: str = "general"):
        """Log optimization step with details"""
        self.step_counter += 1
        step_dir = os.path.join(self.run_dir, "03_optimization_process", f"step_{self.step_counter:02d}_{step_name}")
        os.makedirs(step_dir, exist_ok=True)
        
        # Save step data
        step_file = os.path.join(step_dir, "step_data.json")
        step_data = {
            "step_number": self.step_counter,
            "step_name": step_name,
            "step_type": step_type,
            "timestamp": datetime.now().isoformat(),
            "data": data
        }
        
        with open(step_file, 'w', encoding='utf-8') as f:
            json.dump(step_data, f, ensure_ascii=False, indent=2)
        
        # Save step summary
        summary_file = os.path.join(step_dir, "step_summary.txt")
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write(f"Optimization Step {self.step_counter}: {step_name}\n")
            f.write("=" * 50 + "\n")
            f.write(f"Step type: {step_type}\n")
            f.write(f"Timestamp: {datetime.now()}\n\n")
            f.write("Step Data Summary:\n")
            for key, value in data.items():
                if isinstance(value, (str, int, float, bool)):
                    f.write(f"  {key}: {value}\n")
                elif isinstance(value, (list, dict)):
                    f.write(f"  {key}: {type(value).__name__} with {len(value) if hasattr(value, '__len__') else 'N/A'} items\n")
                else:
                    f.write(f"  {key}: {type(value).__name__}\n")
        
        print(f"📝 优化步骤 {self.step_counter} 已记录: {step_name}")
        return step_dir
    
    def log_evaluation_results(self, results: Dict, test_name: str):
        """Log evaluation results"""
        eval_dir = os.path.join(self.run_dir, "04_evaluation_results")
        
        # Save results as JSON
        results_file = os.path.join(eval_dir, f"{test_name}_results.json")
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        
        # Save readable report
        report_file = os.path.join(eval_dir, f"{test_name}_report.txt")
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(f"Evaluation Report: {test_name}\n")
            f.write("=" * 50 + "\n")
            f.write(f"Timestamp: {datetime.now()}\n\n")
            
            if "overall_score" in results:
                f.write(f"Overall Score: {results['overall_score']:.2f}/10\n\n")
            
            if "detailed_scores" in results:
                f.write("Detailed Scores:\n")
                for metric, score in results["detailed_scores"].items():
                    f.write(f"  {metric}: {score:.2f}/10\n")
                f.write("\n")
            
            # Log test cases if available
            if "test_cases" in results:
                f.write("Test Cases:\n")
                for i, case in enumerate(results["test_cases"], 1):
                    f.write(f"  Case {i}: {case.get('genre', 'N/A')} - Score: {case.get('score', 'N/A')}\n")
        
        print(f"📊 评估结果已保存: {test_name}")
    
    def log_model_prompts(self, module, model_name: str):
        """Log model prompts and configurations"""
        prompts_dir = os.path.join(self.run_dir, "06_prompts_comparison")
        
        # Save prompts
        prompt_file = os.path.join(prompts_dir, f"{model_name}_prompts.txt")
        with open(prompt_file, 'w', encoding='utf-8') as f:
            f.write(f"Model Prompts: {model_name}\n")
            f.write("=" * 50 + "\n")
            f.write(f"Timestamp: {datetime.now()}\n\n")
            
            # Try to extract prompts from the module
            try:
                if hasattr(module, 'predictor'):
                    predictor = module.predictor
                    if hasattr(predictor, 'signature'):
                        f.write("Signature:\n")
                        f.write(str(predictor.signature) + "\n\n")
                    
                    if hasattr(predictor, 'lm') and hasattr(predictor.lm, 'history'):
                        f.write("Recent LM History:\n")
                        for i, entry in enumerate(predictor.lm.history[-3:]):  # Last 3 entries
                            f.write(f"Entry {i+1}:\n")
                            f.write(str(entry) + "\n\n")
                
                # Try to get the actual prompt template
                f.write("Module Structure:\n")
                f.write(str(type(module)) + "\n\n")
                
            except Exception as e:
                f.write(f"Error extracting prompts: {e}\n")
        
        print(f"📝 模型提示词已保存: {model_name}")
    
    def log_error(self, error: Exception, context: str):
        """Log errors with context"""
        error_dir = os.path.join(self.run_dir, "07_error_logs")
        
        error_file = os.path.join(error_dir, f"error_{datetime.now().strftime('%H%M%S')}.txt")
        with open(error_file, 'w', encoding='utf-8') as f:
            f.write(f"Error Log\n")
            f.write("=" * 30 + "\n")
            f.write(f"Timestamp: {datetime.now()}\n")
            f.write(f"Context: {context}\n")
            f.write(f"Error Type: {type(error).__name__}\n")
            f.write(f"Error Message: {str(error)}\n\n")
            
            # Try to get traceback
            import traceback
            f.write("Traceback:\n")
            f.write(traceback.format_exc())
        
        print(f"❌ 错误已记录: {context}")
    
    def log_generated_examples(self, examples: List[str], context: str):
        """Log generated examples in a readable format"""
        examples_dir = os.path.join(self.run_dir, "08_performance_metrics")
        
        examples_file = os.path.join(examples_dir, f"generated_examples_{context}.txt")
        with open(examples_file, 'w', encoding='utf-8') as f:
            f.write(f"Generated Examples - {context}\n")
            f.write("=" * 50 + "\n")
            f.write(f"Timestamp: {datetime.now()}\n")
            f.write(f"Total examples: {len(examples)}\n\n")
            
            for i, example in enumerate(examples, 1):
                f.write(f"Example {i}:\n")
                f.write(f"Length: {len(example)} characters\n")
                f.write(f"Content: {example}\n")
                f.write("-" * 30 + "\n")
        
        print(f"📝 生成样例已保存: {context}")
    
    def create_final_summary(self):
        """Create final optimization summary"""
        summary_file = os.path.join(self.run_dir, "OPTIMIZATION_SUMMARY.txt")
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write("Optimization Run Summary\n")
            f.write("=" * 50 + "\n")
            f.write(f"Mode: {OPTIMIZATION_MODE}\n")
            f.write(f"Timestamp: {datetime.now()}\n")
            f.write(f"Total steps: {self.step_counter}\n\n")
            
            f.write("Directory Structure:\n")
            f.write("├── 00_configuration/     - Optimization settings\n")
            f.write("├── 01_training_data/     - Training examples used\n") 
            f.write("├── 02_golden_examples/   - Golden examples analysis\n")
            f.write("├── 03_optimization_process/ - Step-by-step process\n")
            f.write("├── 04_evaluation_results/   - Performance evaluations\n")
            f.write("├── 05_final_models/         - Saved model artifacts\n")
            f.write("├── 06_prompts_comparison/   - Model prompts\n")
            f.write("├── 07_error_logs/           - Error logs\n")
            f.write("└── 08_performance_metrics/  - Performance data\n\n")
            
            f.write("To analyze results:\n")
            f.write("1. Check 04_evaluation_results for performance metrics\n")
            f.write("2. Review 03_optimization_process for step details\n")
            f.write("3. Compare 06_prompts_comparison to see prompt evolution\n")
            f.write("4. Check 07_error_logs if any issues occurred\n")
            f.write("5. Look at 08_performance_metrics for generated examples\n")
        
        print(f"📋 最终总结已保存: {summary_file}")
        return summary_file

# Initialize global logger
logger = ComprehensiveLogger()

def load_golden_examples() -> List[dspy.Example]:
    """Load golden examples from /examples directory"""
    examples_dir = "examples"
    golden_examples = []
    
    if not os.path.exists(examples_dir):
        print(f"❌ 黄金样例目录不存在: {examples_dir}")
        return []
    
    # Platform mapping for different genres
    platform_mapping = {
        "甜宠": "抖音",
        "虐恋": "小红书", 
        "复仇": "快手",
        "穿越": "抖音",
        "重生": "小红书",
        "马甲": "快手",
        "霸总": "抖音",
        "战神": "快手",
        "神豪": "抖音",
        "赘婿": "小红书",
        "玄幻": "快手",
        "末世": "抖音",
        "娱乐圈": "小红书",
        "萌宝": "抖音",
        "团宠": "快手"
    }
    
    # Load all JSON files from examples directory
    for filename in os.listdir(examples_dir):
        if filename.endswith('.json'):
            filepath = os.path.join(examples_dir, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Extract genre info
                genre_path = data.get('genre_path', [])
                if len(genre_path) >= 3:
                    genre = genre_path[2]  # The specific genre type
                elif len(genre_path) >= 2:
                    genre = genre_path[1]  # Subcategory
                else:
                    genre = "其他"
                
                # Map to platform
                platform = platform_mapping.get(genre, "抖音")
                
                # Create requirements from tags
                tags = data.get('tags', [])
                requirements = f"要求: {', '.join(tags[:5])}"  # Use first 5 tags
                
                # Create expected output - the golden example should generate similar content
                expected_ideas = [data['content']]
                
                # Create DSPy example with inputs and expected output
                example_data = {
                    "genre": genre,
                    "platform": platform, 
                    "requirements_section": requirements,
                    "ideas": expected_ideas  # This is the expected output
                }
                
                example = dspy.Example(**example_data)
                configured_example = example.with_inputs("genre", "platform", "requirements_section")
                golden_examples.append(configured_example)
                
                print(f"  加载黄金样例: {filename} -> {genre} ({platform})")
                
            except Exception as e:
                print(f"  ❌ 加载 {filename} 失败: {e}")
                continue
    
    print(f"✅ 成功加载 {len(golden_examples)} 个黄金样例")
    return golden_examples

def create_synthetic_training_examples() -> List[dspy.Example]:
    """Create diverse synthetic training examples for optimization using real genre system"""
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

def create_training_examples() -> List[dspy.Example]:
    """Create combined training examples using both golden examples and synthetic examples"""
    print("📚 加载训练样例...")
    
    # Load golden examples first
    golden_examples = load_golden_examples()
    
    # Load synthetic examples
    synthetic_examples = create_synthetic_training_examples()
    
    # Combine them, prioritizing golden examples
    all_examples = golden_examples + synthetic_examples
    
    print(f"📊 训练样例统计:")
    print(f"  - 黄金样例: {len(golden_examples)} 个")
    print(f"  - 合成样例: {len(synthetic_examples)} 个") 
    print(f"  - 总计: {len(all_examples)} 个")
    
    return all_examples

def create_group_specific_training_examples(group_name: str) -> List[dspy.Example]:
    """Create training examples tailored for specific evaluation groups"""
    # First get all examples (golden + synthetic)
    base_examples = create_training_examples()
    
    # Always include golden examples as they are high-quality
    golden_examples = load_golden_examples()
    
    if group_name == "creativity":
        # Focus on genres that require high creativity and engagement
        creative_genres = ["穿越", "重生", "马甲", "替身", "玄幻", "末世", "金手指", "复仇"]
        filtered_examples = [ex for ex in base_examples if ex.genre in creative_genres]
        # Always include golden examples for creativity training
        return golden_examples + filtered_examples
    elif group_name == "feasibility":
        # Focus on practical, cost-effective genres
        practical_genres = ["甜宠", "霸总", "萌宝", "团宠", "娱乐圈", "神医"]
        filtered_examples = [ex for ex in base_examples if ex.genre in practical_genres]
        return golden_examples + filtered_examples
    elif group_name == "content_quality":
        # Focus on genres requiring detailed storytelling and logical coherence
        quality_genres = ["虐恋", "穿越", "重生", "战神", "逆袭", "高手下山", "复仇"]
        filtered_examples = [ex for ex in base_examples if ex.genre in quality_genres]
        # Golden examples are especially important for content quality
        return golden_examples + filtered_examples
    else:
        # Return all examples for overall/flat optimization
        return base_examples

def generate_ideas(module, request: BrainstormRequest, num_ideas: int = 2):
    """Generate ideas using DSPy module - pure DSPy approach"""
    ideas = []
    for i in range(num_ideas):
        prediction = module(
                genre=request.genre,
                platform=request.platform,
                requirements_section=request.requirements_section
            )
        # Extract StoryIdea from DSPy prediction
        idea = prediction.story_idea if hasattr(prediction, 'story_idea') else StoryIdea(title=prediction.title, body=prediction.body)
        ideas.append(idea)
    
    # Log successful generation
    logger.log_optimization_step("idea_generation_success", {
        "genre": request.genre,
        "platform": request.platform,
        "requirements": request.requirements_section,
        "generated_ideas_count": len(ideas),
        "ideas_preview": [f"{idea.title}: {idea.body[:100]}..." if len(idea.body) > 100 else f"{idea.title}: {idea.body}" for idea in ideas[:2]]
    }, "generation")
    
    return ideas

def run_flat_optimization(auto_mode: str = "medium") -> Tuple[dspy.Module, List[dspy.Example]]:
    """Run flat (single-group) optimization - current approach"""
    print(f"🚀 开始平面优化 (模式: {auto_mode}) - 所有指标统一优化")
    print("=" * 60)
    
    try:
        # Log optimization start
        logger.log_optimization_step("flat_optimization_start", {
            "auto_mode": auto_mode,
            "max_bootstrapped_demos": 4,
            "num_threads": 8,
            "max_labeled_demos": 4,
            "seed": 42
        }, "optimization_start")
        
        # Create training examples
        train_examples = create_training_examples()
        print(f"创建了 {len(train_examples)} 个训练样例")
        
        # Log training data
        logger.log_training_data(train_examples, "flat_optimization_training")
        golden_examples = load_golden_examples()
        if golden_examples:
            logger.log_golden_examples(golden_examples)
        
        # Create evaluator and metric (single overall metric)
        evaluator = StoryIdeaEvaluator()
        metric = create_evaluation_metric(evaluator)  # This uses the overall score
        
        logger.log_optimization_step("metric_creation", {
            "evaluator_type": "StoryIdeaEvaluator",
            "metric_type": "single_overall_metric"
        }, "configuration")
        
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
        
        logger.log_optimization_step("optimizer_configuration", {
            "optimizer_type": "MIPROv2",
            "auto_mode": auto_mode,
            "training_examples_count": len(train_examples)
        }, "configuration")
        
        print(f"配置平面优化器完成，开始训练...")
        
        # Compile the module
        base_module = BrainstormModule()
        logger.log_optimization_step("module_compilation_start", {
            "base_module_type": "BrainstormModule"
        }, "compilation")
        
        compiled_module = optimizer.compile(
            base_module, 
            trainset=train_examples,
            requires_permission_to_run=False
        )
        
        logger.log_optimization_step("module_compilation_complete", {
            "compiled_module_type": str(type(compiled_module)),
            "success": True
        }, "compilation")
        
        # Log model prompts
        logger.log_model_prompts(compiled_module, "flat_optimized_model")
        
        print(f"✅ 平面优化完成!")
        return compiled_module, train_examples
        
    except Exception as e:
        logger.log_error(e, "flat_optimization")
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
    
    # Log evaluation start
    logger.log_optimization_step(f"evaluation_start_{name}", {
        "model_name": name,
        "test_examples_count": len(test_examples),
        "evaluation_limit": 5
    }, "evaluation")
    
    evaluator = StoryIdeaEvaluator()
    total_scores = []
    detailed_scores = {
        'novelty': [], 'feasibility': [], 'structure': [], 
        'detail': [], 'logical_coherence': [], 'genre': [], 'engagement': []
    }
    
    test_cases_results = []
    
    for i, example in enumerate(test_examples[:MAX_TEST_EXAMPLES]):
        try:
            request = BrainstormRequest(
                genre=example.genre,
                platform=example.platform,
                requirements_section=example.requirements_section
            )
            
            # Generate ideas using DSPy
            ideas = generate_ideas(module, request)
            
            # Log generated examples for this test case
            ideas_as_strings = [f"{idea.title}: {idea.body}" for idea in ideas]
            logger.log_generated_examples(ideas_as_strings, f"{name}_case_{i+1}_{example.genre}")
            
            # Evaluate
            result = evaluator.evaluate(ideas[0], request)
            total_scores.append(result.overall_score)
            
            # Collect detailed scores
            detailed_scores['novelty'].append(result.novelty_score)
            detailed_scores['feasibility'].append(result.feasibility_score)
            detailed_scores['structure'].append(result.structure_score)
            detailed_scores['detail'].append(result.detail_score)
            detailed_scores['logical_coherence'].append(result.logical_coherence_score)
            detailed_scores['genre'].append(result.genre_score)
            detailed_scores['engagement'].append(result.engagement_score)
            
            # Store test case result for logging
            test_case_result = {
                "case_number": i + 1,
                "genre": example.genre,
                "platform": example.platform,
                "requirements": example.requirements_section,
                "generated_ideas": [{"title": idea.title, "body": idea.body} for idea in ideas],
                "overall_score": result.overall_score,
                "detailed_scores": {
                    "novelty": result.novelty_score,
                    "feasibility": result.feasibility_score,
                    "structure": result.structure_score,
                    "detail": result.detail_score,
                    "logical_coherence": result.logical_coherence_score,
                    "genre": result.genre_score,
                    "engagement": result.engagement_score
                }
            }
            test_cases_results.append(test_case_result)
            
            print(f"  案例 {i+1} ({example.genre}): {result.overall_score:.1f}/10")
            
        except Exception as e:
            logger.log_error(e, f"evaluate_model_performance_case_{i+1}")
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
        
        # Log evaluation results
        evaluation_results = {
            "model_name": name,
            "overall_score": avg_score,
            "detailed_scores": avg_detailed_scores,
            "test_cases": test_cases_results,
            "total_test_cases": len(test_cases_results)
        }
        logger.log_evaluation_results(evaluation_results, f"evaluation_{name}")
        
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

def save_optimized_model(module, name: str, score: float, detailed_scores: Dict[str, float] = None, mode: str = "flat"):
    """Save optimized model with MLflow"""
    try:
        run_name = f"brainstorm_{mode}_{name}"
        with mlflow.start_run(run_name=run_name):
            # Log parameters
            mlflow.log_param("optimization_mode", mode)
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

def show_golden_examples_summary():
    """Show a summary of loaded golden examples"""
    golden_examples = load_golden_examples()
    if not golden_examples:
        return
        
    print(f"\n📋 黄金样例详情:")
    print("-" * 50)
    for i, example in enumerate(golden_examples[:3], 1):  # Show first 3 examples
        print(f"  样例 {i}:")
        print(f"    类型: {example.genre}")
        print(f"    平台: {example.platform}")
        print(f"    要求: {example.requirements_section}")
        if hasattr(example, 'ideas') and example.ideas:
            content_preview = example.ideas[0][:50] + "..." if len(example.ideas[0]) > 50 else example.ideas[0]
            print(f"    内容: {content_preview}")
        print()
    
    if len(golden_examples) > 3:
        print(f"  ...还有 {len(golden_examples) - 3} 个样例")

def run_optimization():
    """Run optimization based on the configured mode"""
    print(f"🧪 故事创意生成优化系统 - {OPTIMIZATION_MODE.upper()} 模式")
    print("=" * 70)
    
    # Show summary of golden examples
    show_golden_examples_summary()
    
    # Create test examples for evaluation
    test_examples = [
        dspy.Example(genre="先婚后爱", platform="抖音", requirements_section="契约婚姻，情感真实"),
        dspy.Example(genre="恶女", platform="小红书", requirements_section="恶毒女配逆袭，双重人格"),
        dspy.Example(genre="残疾大佬", platform="快手", requirements_section="残疾大佬隐藏身份"),
        dspy.Example(genre="后宫", platform="抖音", requirements_section="后宫争斗，权谋设计"),
        dspy.Example(genre="复仇", platform="小红书", requirements_section="复仇主题，情节紧凑")
    ]
    
    if OPTIMIZATION_MODE == "flat":
        # Run flat optimization
        print("📋 运行平面优化模式...")
        optimized_module, _ = run_flat_optimization("medium")
        
        # Evaluate the optimized model
        score, detailed_scores = evaluate_model_performance(optimized_module, test_examples, "平面优化模型")
        
        # Inspect and save results
        print(f"\n🔍 检查优化结果:")
        inspect_optimized_module(optimized_module, "平面优化")
        save_optimized_prompts(optimized_module, f"{OPTIMIZATION_MODE}_optimization")
        save_optimized_model(optimized_module, "miprov2_medium", score, detailed_scores, OPTIMIZATION_MODE)
        
        print(f"\n✅ 平面优化完成! 最终得分: {score:.1f}/10")
        
    elif OPTIMIZATION_MODE == "grouped":
        # Run grouped optimization
        print("📋 运行分组优化模式...")
        grouped_modules, _ = run_grouped_optimization("medium")
        
        # Evaluate the grouped models
        final_score, final_detailed_scores = evaluate_grouped_models(grouped_modules, test_examples)
        
        # Inspect and save results for each group
        print(f"\n🔍 检查分组优化结果:")
        for group_name, module in grouped_modules.items():
            inspect_optimized_module(module, f"分组优化-{group_name}")
            save_optimized_prompts(module, f"{OPTIMIZATION_MODE}_optimization_{group_name}")
            
            # Save individual group models
            group_score, group_detailed = evaluate_model_performance(module, test_examples[:2], f"分组-{group_name}")
            save_optimized_model(module, f"miprov2_{group_name}", group_score, group_detailed, OPTIMIZATION_MODE)
        
        print(f"\n✅ 分组优化完成! 最终平均得分: {final_score:.1f}/10")
        
    else:
        print(f"❌ 未知的优化模式: {OPTIMIZATION_MODE}")
        print("请将 OPTIMIZATION_MODE 设置为 'flat' 或 'grouped'")
        sys.exit(1)

def main():
    """Main optimization workflow"""
    try:
        # Log initial configuration
        config = {
            "optimization_mode": OPTIMIZATION_MODE,
            "timestamp": datetime.now().isoformat(),
            "mlflow_experiment": f"Brainstorm_{OPTIMIZATION_MODE.title()}_Optimization",
            "python_version": sys.version,
            "script_path": __file__
        }
        logger.log_configuration(config)
        
        # Setup MLflow with mode-specific experiment name
        experiment_name = f"Brainstorm_{OPTIMIZATION_MODE.title()}_Optimization"
        mlflow.set_experiment(experiment_name)
        mlflow.dspy.autolog()
        
        print(f"📊 MLflow 实验: {experiment_name}")
        
        # Log MLflow setup
        logger.log_optimization_step("mlflow_setup", {
            "experiment_name": experiment_name,
            "autolog_enabled": True
        }, "initialization")
        
        # Run optimization
        run_optimization()
        
        # Create final summary
        summary_file = logger.create_final_summary()
        
        print(f"\n📝 优化完成总结:")
        print(f"1. 优化模式: {OPTIMIZATION_MODE.upper()}")
        print(f"2. 缓存机制: 启用 (避免重复评估)")
        print(f"3. MLflow 实验: {experiment_name}")
        print(f"4. 提示词文件: optimized_prompts/{OPTIMIZATION_MODE}_optimization_*.txt")
        print(f"5. 详细日志: {logger.run_dir}")
        print(f"6. 总结文件: {summary_file}")
        print(f"7. 要切换模式，请修改代码中的 OPTIMIZATION_MODE 常量")
        
    except Exception as e:
        logger.log_error(e, "main_workflow")
        print(f"❌ 主流程发生错误: {e}")
        print("程序终止")
        sys.exit(1)

if __name__ == "__main__":
    main()
