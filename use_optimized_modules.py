#!/usr/bin/env python3
"""
Script to demonstrate how to use optimized DSPy modules
Shows different ways to load and use optimized models from the optimization process
"""

import os
import json
import mlflow
import dspy
import random
import itertools
from typing import Optional, Dict, Any, List
from brainstorm_module import BrainstormModule
from common import BrainstormRequest, StoryIdea

class RequirementsVariator:
    """Generate varied requirements to avoid caching"""
    
    def __init__(self):
        # Story setting categories
        self.settings = [
            "现代都市", "古装宫廷", "校园青春", "职场商战", "豪门世家", 
            "医院", "律师事务所", "娱乐圈", "军营", "乡村田园",
            "海外留学", "小镇生活", "网络游戏", "直播平台", "创业公司"
        ]
        
        # Character archetypes
        self.male_leads = [
            "霸道总裁", "温润学霸", "冷酷医生", "正义律师", "天才程序员",
            "职业军人", "知名导演", "人气歌手", "体育健将", "厨艺大师",
            "投资天才", "科研学者", "时尚设计师", "游戏主播", "创业青年"
        ]
        
        self.female_leads = [
            "独立女强人", "软萌小护士", "天才设计师", "知性编辑", "活泼记者",
            "温柔教师", "冷静法医", "甜美主播", "坚强单亲妈妈", "文艺作家",
            "时尚博主", "心理咨询师", "美食博主", "健身教练", "公益志愿者"
        ]
        
        # Relationship dynamics
        self.relationships = [
            "双强CP", "青梅竹马", "敌人变恋人", "假戏真做", "契约关系",
            "暗恋成真", "重逢恋人", "师生恋", "上司下属", "竞争对手",
            "网友见面", "相亲对象", "邻居关系", "合作伙伴", "救命恩人"
        ]
        
        # Plot elements
        self.plot_elements = [
            "误会分离", "追妻火葬场", "失忆梗", "身份互换", "时空穿越",
            "豪门争产", "职场升级", "创业奋斗", "医疗救治", "法庭辩护",
            "娱乐圈风波", "网络危机", "家族秘密", "国际竞赛", "公益救助"
        ]
        
        # Emotional tones
        self.tones = [
            "甜宠日常", "虐恋情深", "搞笑轻松", "治愈温暖", "励志向上",
            "悬疑刺激", "浪漫唯美", "现实向", "爽文节奏", "细水长流"
        ]
        
        # Special requirements
        self.special_tags = [
            "去脸谱化", "反套路", "现实主义", "双向奔赴", "成长向",
            "群像剧", "多线叙事", "时间跨度大", "国际背景", "科技元素",
            "环保主题", "社会议题", "代际沟通", "文化传承", "创新题材"
        ]
        
        # Generate all possible combinations for uniqueness tracking
        self._used_combinations = set()
        self.combination_pool = self._generate_combination_pool()
        random.shuffle(self.combination_pool)
        self.current_index = 0
        
    def _generate_combination_pool(self) -> List[str]:
        """Generate a large pool of unique requirement combinations"""
        combinations = []
        
        # Generate different combination patterns
        patterns = [
            # Pattern 1: Setting + Male Lead + Female Lead + Relationship
            lambda: f"{random.choice(self.settings)}, {random.choice(self.male_leads)}x{random.choice(self.female_leads)}, {random.choice(self.relationships)}",
            
            # Pattern 2: Setting + Relationship + Plot Element + Tone
            lambda: f"{random.choice(self.settings)}, {random.choice(self.relationships)}, {random.choice(self.plot_elements)}, {random.choice(self.tones)}",
            
            # Pattern 3: Character Types + Plot Elements + Special Tags
            lambda: f"{random.choice(self.male_leads)}x{random.choice(self.female_leads)}, {random.choice(self.plot_elements)}, {random.choice(self.special_tags)}",
            
            # Pattern 4: Setting + Multiple Plot Elements
            lambda: f"{random.choice(self.settings)}, {random.choice(self.plot_elements)}, {random.choice(self.plot_elements)}, {random.choice(self.tones)}",
            
            # Pattern 5: Comprehensive combination
            lambda: f"{random.choice(self.settings)}, {random.choice(self.male_leads)}x{random.choice(self.female_leads)}, {random.choice(self.relationships)}, {random.choice(self.plot_elements)}, {random.choice(self.tones)}, {random.choice(self.special_tags)}",
        ]
        
        # Generate combinations using different patterns
        for _ in range(1000):  # Generate 1000 unique combinations
            pattern = random.choice(patterns)
            combo = pattern()
            if combo not in combinations:
                combinations.append(combo)
                
        return combinations
    
    def get_unique_requirements(self) -> str:
        """Get a unique requirements string, cycling through the pool"""
        if self.current_index >= len(self.combination_pool):
            # Reshuffle and reset if we've used all combinations
            random.shuffle(self.combination_pool)
            self.current_index = 0
            print("🔄 重新打乱需求组合池")
            
        requirements = self.combination_pool[self.current_index]
        self.current_index += 1
        return requirements
    
    def get_unique_request(self, genre: str, platform: str) -> BrainstormRequest:
        """Generate a BrainstormRequest with unique requirements"""
        return BrainstormRequest(
            genre=genre,
            platform=platform,
            requirements_section=self.get_unique_requirements()
        )
    
    def get_batch_requests(self, genre: str, platform: str, count: int) -> List[BrainstormRequest]:
        """Generate a batch of unique requests"""
        return [self.get_unique_request(genre, platform) for _ in range(count)]
    
    def get_stats(self) -> Dict[str, int]:
        """Get statistics about the variator"""
        return {
            "total_combinations": len(self.combination_pool),
            "used_combinations": self.current_index,
            "remaining_combinations": len(self.combination_pool) - self.current_index
        }

# Global variator instance
requirements_variator = RequirementsVariator()

def extract_prompts_from_module(module: dspy.Module, output_file: str = "extracted_prompts.json") -> bool:
    """Extract system and user prompts from a DSPy module and save to file for TypeScript usage"""
    print(f"🔍 提取模块提示词到文件: {output_file}")
    
    try:
        prompts_data = {
            "extracted_at": None,
            "module_type": type(module).__name__,
            "prompts": {},
            "demos": [],
            "metadata": {}
        }
        
        import datetime
        prompts_data["extracted_at"] = datetime.datetime.now().isoformat()
        
        # Extract prompts from the main predictor
        if hasattr(module, 'generate_idea'):
            predictor = module.generate_idea
            
            # Try to get the signature
            if hasattr(predictor, 'signature'):
                signature = predictor.signature
                prompts_data["metadata"]["signature_instructions"] = getattr(signature, 'instructions', '')
                prompts_data["metadata"]["input_fields"] = list(signature.input_fields.keys()) if hasattr(signature, 'input_fields') else []
                prompts_data["metadata"]["output_fields"] = list(signature.output_fields.keys()) if hasattr(signature, 'output_fields') else []
            
            # Try to extract the actual prompt templates used
            # This varies depending on DSPy version and LM type
            if hasattr(predictor, 'lm') and predictor.lm:
                lm = predictor.lm
                
                # Get the last request if available (from DSPy's request history)
                if hasattr(lm, 'history') and lm.history:
                    last_request = lm.history[-1]
                    if 'prompt' in last_request:
                        prompts_data["prompts"]["last_full_prompt"] = last_request['prompt']
                    if 'messages' in last_request:
                        prompts_data["prompts"]["last_messages"] = last_request['messages']
            
            # Try to construct a sample prompt by calling the predictor's _generate method
            try:
                # Create a sample input
                sample_input = {
                    'genre': '甜宠',
                    'platform': '抖音',  
                    'requirements_section': '现代都市, 霸道总裁x独立女强人, 双强CP'
                }
                
                # Get the formatted prompt (this might trigger LM call, so we'll catch any errors)
                if hasattr(predictor, '_generate'):
                    # Try to intercept the prompt before it goes to LM
                    original_lm = predictor.lm
                    
                    class MockLM:
                        def __init__(self):
                            self.captured_prompt = None
                            self.captured_messages = None
                            
                        def __call__(self, prompt=None, messages=None, **kwargs):
                            self.captured_prompt = prompt
                            self.captured_messages = messages
                            # Return a mock response to avoid actual LM call
                            return ["title: 示例标题\nbody: 示例内容"]
                        
                        def generate(self, prompt=None, messages=None, **kwargs):
                            return self.__call__(prompt, messages, **kwargs)
                    
                    mock_lm = MockLM()
                    predictor.lm = mock_lm
                    
                    try:
                        # This should capture the prompt without making real LM call
                        predictor(**sample_input)
                        
                        if mock_lm.captured_prompt:
                            prompts_data["prompts"]["system_user_prompt"] = mock_lm.captured_prompt
                        if mock_lm.captured_messages:
                            prompts_data["prompts"]["messages_format"] = mock_lm.captured_messages
                            
                    except Exception as e:
                        print(f"⚠️ 模拟调用失败: {e}")
                    finally:
                        # Restore original LM
                        predictor.lm = original_lm
                        
            except Exception as e:
                print(f"⚠️ 提示词构建失败: {e}")
            
            # Extract demonstrations/examples
            if hasattr(predictor, 'demos') and predictor.demos:
                print(f"📚 发现 {len(predictor.demos)} 个演示示例")
                for i, demo in enumerate(predictor.demos):
                    demo_data = {}
                    
                    # Extract input fields
                    for field in ['genre', 'platform', 'requirements_section']:
                        if hasattr(demo, field):
                            demo_data[field] = getattr(demo, field)
                    
                    # Extract output fields  
                    for field in ['title', 'body']:
                        if hasattr(demo, field):
                            demo_data[field] = getattr(demo, field)
                    
                    prompts_data["demos"].append({
                        "demo_index": i,
                        "data": demo_data
                    })
        
        # Try to extract template/instruction patterns
        try:
            # Look for common DSPy prompt patterns
            if hasattr(module, 'generate_idea') and hasattr(module.generate_idea, 'signature'):
                sig = module.generate_idea.signature
                
                # Build a template based on signature
                template_parts = []
                
                if hasattr(sig, 'instructions') and sig.instructions:
                    template_parts.append(f"Instructions: {sig.instructions}")
                
                # Add input format
                if hasattr(sig, 'input_fields'):
                    input_template = "Input Format:\n"
                    for name, field in sig.input_fields.items():
                        desc = getattr(field, 'desc', '') or name
                        input_template += f"- {name}: {desc}\n"
                    template_parts.append(input_template)
                
                # Add output format
                if hasattr(sig, 'output_fields'):
                    output_template = "Output Format:\n"
                    for name, field in sig.output_fields.items():
                        desc = getattr(field, 'desc', '') or name
                        output_template += f"- {name}: {desc}\n"
                    template_parts.append(output_template)
                
                if template_parts:
                    prompts_data["prompts"]["template_structure"] = "\n\n".join(template_parts)
                    
        except Exception as e:
            print(f"⚠️ 模板提取失败: {e}")
        
        # Write to file
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(prompts_data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 提示词已保存到: {output_file}")
        print(f"   - 模块类型: {prompts_data['module_type']}")
        print(f"   - 演示示例数: {len(prompts_data['demos'])}")
        print(f"   - 提取的提示词类型: {list(prompts_data['prompts'].keys())}")
        
        return True
        
    except Exception as e:
        print(f"❌ 提示词提取失败: {e}")
        return False

def setup_environment():
    """Setup LLM and MLflow environment"""
    print("🔧 设置环境...")
    
    # LLM is automatically configured when importing common.py
    # Set MLflow tracking URI (optional)
    # mlflow.set_tracking_uri("sqlite:///mlflow.db")
    
    print("✅ 环境设置完成")

def load_optimized_from_mlflow(experiment_name: str = "Brainstorm_Flat_deepseek-chat_Optimization") -> Optional[dspy.Module]:
    """Load optimized module from MLflow"""
    print(f"📦 从 MLflow 加载优化模型 (实验: {experiment_name})")
    
    try:
        # Set the experiment
        experiment = mlflow.get_experiment_by_name(experiment_name)
        if not experiment:
            print(f"❌ 实验 '{experiment_name}' 不存在")
            return None
        
        # Get the latest run
        runs = mlflow.search_runs(
            experiment_ids=[experiment.experiment_id],
            order_by=["start_time DESC"],
            max_results=1
        )
        
        if runs.empty:
            print(f"❌ 实验 '{experiment_name}' 中没有运行记录")
            return None
        
        run_id = runs.iloc[0].run_id
        print(f"📋 找到最新运行: {run_id}")
        
        # Load the model
        model_uri = f"runs:/{run_id}/model"
        loaded_model = mlflow.dspy.load_model(model_uri)
        
        print(f"✅ 成功从 MLflow 加载优化模型")
        return loaded_model
        
    except Exception as e:
        print(f"❌ 从 MLflow 加载模型失败: {e}")
        return None

def load_optimized_from_prompts(prompts_file: str = "optimized_prompts/flat_optimization_optimized_prompts.json") -> Optional[dspy.Module]:
    """Load optimized module by recreating it from saved prompt information"""
    print(f"📄 从提示词文件重建优化模型: {prompts_file}")
    
    try:
        if not os.path.exists(prompts_file):
            print(f"❌ 提示词文件不存在: {prompts_file}")
            return None
        
        # Load the prompt information
        with open(prompts_file, 'r', encoding='utf-8') as f:
            prompt_info = json.load(f)
        
        # Create a new module
        module = BrainstormModule()
        
        # If the optimized module has demonstrations, add them
        if 'predictor' in prompt_info and 'demos' in prompt_info['predictor']:
            demos_data = prompt_info['predictor']['demos']
            print(f"📚 发现 {len(demos_data)} 个示例演示")
            
            # Convert demo data to DSPy examples
            demos = []
            for demo_data in demos_data:
                # Create a DSPy example from the demo data
                if 'title' in demo_data and 'body' in demo_data:
                    demo = dspy.Example(
                        genre=demo_data.get('genre', ''),
                        platform=demo_data.get('platform', ''),
                        requirements_section=demo_data.get('requirements_section', ''),
                        title=demo_data['title'],
                        body=demo_data['body']
                    ).with_inputs('genre', 'platform', 'requirements_section')
                    demos.append(demo)
            
            # Set the demonstrations on the predictor
            if demos:
                module.generate_idea.demos = demos
                print(f"✅ 设置了 {len(demos)} 个示例演示")
        
        print(f"✅ 成功从提示词文件重建优化模型")
        return module
        
    except Exception as e:
        print(f"❌ 从提示词文件重建模型失败: {e}")
        return None

def compare_models(baseline_module: dspy.Module, optimized_module: dspy.Module, test_requests: list, max_content_length: int = None):
    """Compare baseline vs optimized model performance"""
    print(f"\n🆚 模型对比测试")
    print("=" * 60)
    
    for i, request in enumerate(test_requests, 1):
        print(f"\n测试案例 {i}: {request.genre} - {request.platform}")
        print(f"要求: {request.requirements_section}")
        print("-" * 40)
        
        # Generate with baseline
        # print("🔸 基础模型:")
        # try:
        #     baseline_result = baseline_module(
        #         genre=request.genre,
        #         platform=request.platform,
        #         requirements_section=request.requirements_section
        #     )
        #     baseline_idea = baseline_result.story_idea if hasattr(baseline_result, 'story_idea') else StoryIdea(title=baseline_result.title, body=baseline_result.body)
        #     print(f"  标题: {baseline_idea.title}")
            
        #     # Show full content or truncated based on max_content_length
        #     if max_content_length and len(baseline_idea.body) > max_content_length:
        #         print(f"  内容: {baseline_idea.body[:max_content_length]}...")
        #         print(f"  (内容长度: {len(baseline_idea.body)} 字符，已截取前 {max_content_length} 字符)")
        #     else:
        #         print(f"  内容: {baseline_idea.body}")
        #         print(f"  (内容长度: {len(baseline_idea.body)} 字符)")
        # except Exception as e:
        #     print(f"  ❌ 生成失败: {e}")
        
        # Generate with optimized
        print("\n🔹 优化模型:")
        try:
            optimized_result = optimized_module(
                genre=request.genre,
                platform=request.platform,
                requirements_section=request.requirements_section
            )
            optimized_idea = optimized_result.story_idea if hasattr(optimized_result, 'story_idea') else StoryIdea(title=optimized_result.title, body=optimized_result.body)
            print(f"  标题: {optimized_idea.title}")
            
            # Show full content or truncated based on max_content_length
            if max_content_length and len(optimized_idea.body) > max_content_length:
                print(f"  内容: {optimized_idea.body[:max_content_length]}...")
                print(f"  (内容长度: {len(optimized_idea.body)} 字符，已截取前 {max_content_length} 字符)")
            else:
                print(f"  内容: {optimized_idea.body}")
                print(f"  (内容长度: {len(optimized_idea.body)} 字符)")
        except Exception as e:
            print(f"  ❌ 生成失败: {e}")

def demonstrate_usage():
    """Demonstrate different ways to use optimized modules"""
    print("🚀 优化模块使用演示")
    print("=" * 60)
    
    # Setup environment
    setup_environment()
    
    # Create varied test requests using the requirements variator
    print(f"📋 生成变化的测试请求...")
    stats = requirements_variator.get_stats()
    print(f"   可用组合总数: {stats['total_combinations']}")
    print(f"   已使用组合: {stats['used_combinations']}")
    
    test_requests = [
        requirements_variator.get_unique_request("甜宠", "抖音"),
        requirements_variator.get_unique_request("复仇", "快手"),
        requirements_variator.get_unique_request("虐恋", "小红书"),
    ]
    
    # Show the unique requirements generated
    print("\n📝 生成的独特需求:")
    for i, req in enumerate(test_requests, 1):
        print(f"  {i}. {req.genre} ({req.platform}): {req.requirements_section}")
    
    # Create baseline module for comparison
    baseline_module = BrainstormModule()
    print("\n✅ 创建基础模型")
    
    # Method 1: Load from MLflow (recommended for production)
    print(f"\n📦 方法1: 从 MLflow 加载优化模型")
    mlflow_model = load_optimized_from_mlflow()
    
    if mlflow_model:
        print("✅ 成功加载 MLflow 模型，开始对比测试...")
        compare_models(baseline_module, mlflow_model, test_requests[:1])
    else:
        print("⚠️  MLflow 模型加载失败，跳过此方法")
    
    # Method 2: Load from prompts file (fallback method)
    print(f"\n📄 方法2: 从提示词文件重建优化模型")
    prompts_model = load_optimized_from_prompts()
    
    if prompts_model:
        print("✅ 成功重建优化模型，开始对比测试...")
        compare_models(baseline_module, prompts_model, test_requests[1:])
    else:
        print("⚠️  提示词文件重建失败，跳过此方法")
    
    # Method 3: Direct usage example with unique request
    print(f"\n💡 方法3: 直接使用优化模型示例")
    active_model = mlflow_model or prompts_model or baseline_module
    model_type = "优化模型" if (mlflow_model or prompts_model) else "基础模型"
    
    print(f"使用 {model_type} 生成创意...")
    request = requirements_variator.get_unique_request("玄幻", "抖音")
    print(f"独特需求: {request.requirements_section}")
    
    try:
        result = active_model(
            genre=request.genre,
            platform=request.platform,
            requirements_section=request.requirements_section
        )
        idea = result.story_idea if hasattr(result, 'story_idea') else StoryIdea(title=result.title, body=result.body)
        
        print(f"✅ 生成成功:")
        print(f"  标题: {idea.title}")
        print(f"  内容: {idea.body}")
        print(f"  (内容长度: {len(idea.body)} 字符)")
        
    except Exception as e:
        print(f"❌ 生成失败: {e}")

def production_usage_example():
    """Show how to use optimized models in production code"""
    print(f"\n🏭 生产环境使用示例")
    print("=" * 60)
    
    # This is how you would typically use optimized models in your application
    class OptimizedBrainstormService:
        def __init__(self):
            self.model = None
            self.variator = RequirementsVariator()
            self._load_best_model()
        
        def _load_best_model(self):
            """Load the best available optimized model"""
            # Try MLflow first
            self.model = load_optimized_from_mlflow()
            
            # Fallback to prompts file
            if not self.model:
                self.model = load_optimized_from_prompts()
            
            # Ultimate fallback to baseline
            if not self.model:
                print("⚠️ 使用基础模型作为后备")
                self.model = BrainstormModule()
        
        def generate_ideas(self, genre: str, platform: str, base_requirements: str = "") -> StoryIdea:
            """Generate story ideas using the optimized model with varied requirements"""
            if not self.model:
                raise RuntimeError("模型未加载")
            
            # Add variation to requirements to avoid caching
            if base_requirements:
                unique_requirements = f"{base_requirements}, {self.variator.get_unique_requirements()}"
            else:
                unique_requirements = self.variator.get_unique_requirements()
            
            result = self.model(
                genre=genre,
                platform=platform,
                requirements_section=unique_requirements
            )
            
            return result.story_idea if hasattr(result, 'story_idea') else StoryIdea(title=result.title, body=result.body)
        
        def generate_batch_ideas(self, genre: str, platform: str, count: int, base_requirements: str = "") -> List[StoryIdea]:
            """Generate multiple unique ideas"""
            ideas = []
            for i in range(count):
                try:
                    idea = self.generate_ideas(genre, platform, base_requirements)
                    ideas.append(idea)
                    print(f"  ✅ 生成创意 {i+1}/{count}: {idea.title}")
                except Exception as e:
                    print(f"  ❌ 生成创意 {i+1}/{count} 失败: {e}")
            return ideas
    
    # Example usage
    try:
        service = OptimizedBrainstormService()
        
        # Generate single idea
        idea = service.generate_ideas(
            genre="玄幻",
            platform="抖音",
            base_requirements="修仙世界, 天才少年"
        )
        
        print(f"🎯 单个创意生成结果:")
        print(f"  标题: {idea.title}")
        print(f"  内容: {idea.body}")
        print(f"  (内容长度: {len(idea.body)} 字符)")
        
        # Generate batch ideas
        print(f"\n🎯 批量创意生成 (3个):")
        ideas = service.generate_batch_ideas(
            genre="都市",
            platform="快手", 
            count=3,
            base_requirements="职场"
        )
        
        # Show variator stats
        stats = service.variator.get_stats()
        print(f"\n📊 需求变化器统计:")
        print(f"  总组合数: {stats['total_combinations']}")
        print(f"  已使用: {stats['used_combinations']}")
        print(f"  剩余: {stats['remaining_combinations']}")
        
    except Exception as e:
        print(f"❌ 生产环境示例失败: {e}")

def test_cache_avoidance():
    """Test that the requirements variator successfully avoids caching"""
    print(f"\n🧪 缓存规避测试")
    print("=" * 60)
    
    module = BrainstormModule()
    
    print("生成5个相同题材的请求，观察是否避免了缓存...")
    
    requests = requirements_variator.get_batch_requests("甜宠", "抖音", 5)
    
    for i, request in enumerate(requests, 1):
        print(f"\n请求 {i}:")
        print(f"  需求: {request.requirements_section}")
        
        try:
            import time
            start_time = time.time()
            
            result = module(
                genre=request.genre,
                platform=request.platform,
                requirements_section=request.requirements_section
            )
            
            end_time = time.time()
            duration = end_time - start_time
            
            idea = result.story_idea if hasattr(result, 'story_idea') else StoryIdea(title=result.title, body=result.body)
            
            print(f"  用时: {duration:.2f}秒")
            print(f"  结果: 【{idea.title}】{idea.body}")
            print(f"  (内容长度: {len(idea.body)} 字符)")
            
            if duration < 0.1:
                print("  ⚠️  可能使用了缓存 (响应过快)")
            else:
                print("  ✅ 可能避免了缓存 (正常LLM响应时间)")
                
        except Exception as e:
            print(f"  ❌ 生成失败: {e}")

def extract_all_prompts():
    """Extract prompts from all available modules for TypeScript usage"""
    print(f"\n📤 提示词提取模式")
    print("=" * 60)
    
    setup_environment()
    
    # Extract from baseline module
    print("🔸 提取基础模型提示词...")
    baseline_module = BrainstormModule()
    baseline_success = extract_prompts_from_module(baseline_module, "baseline_prompts.json")
    
    # Extract from optimized modules
    print("\n🔹 提取优化模型提示词...")
    
    # Try MLflow first
    mlflow_model = load_optimized_from_mlflow()
    if mlflow_model:
        mlflow_success = extract_prompts_from_module(mlflow_model, "optimized_mlflow_prompts.json")
    else:
        mlflow_success = False
        print("⚠️ MLflow 模型不可用")
    
    # Try prompts file method
    prompts_model = load_optimized_from_prompts()
    if prompts_model:
        prompts_success = extract_prompts_from_module(prompts_model, "optimized_prompts_file_prompts.json")
    else:
        prompts_success = False
        print("⚠️ 提示词文件模型不可用")
    
    # Create a combined TypeScript-friendly export
    print("\n🎯 创建TypeScript友好的合并文件...")
    try:
        combined_data = {
            "extraction_info": {
                "extracted_at": None,
                "baseline_available": baseline_success,
                "mlflow_optimized_available": mlflow_success,
                "prompts_file_optimized_available": prompts_success
            },
            "baseline": {},
            "optimized_mlflow": {},
            "optimized_prompts_file": {}
        }
        
        import datetime
        combined_data["extraction_info"]["extracted_at"] = datetime.datetime.now().isoformat()
        
        # Load each file if it exists
        files_to_load = [
            ("baseline_prompts.json", "baseline"),
            ("optimized_mlflow_prompts.json", "optimized_mlflow"), 
            ("optimized_prompts_file_prompts.json", "optimized_prompts_file")
        ]
        
        for filename, key in files_to_load:
            if os.path.exists(filename):
                try:
                    with open(filename, 'r', encoding='utf-8') as f:
                        combined_data[key] = json.load(f)
                except Exception as e:
                    print(f"⚠️ 无法加载 {filename}: {e}")
                    combined_data[key] = {"error": str(e)}
        
        # Write combined file
        with open("all_prompts_for_typescript.json", 'w', encoding='utf-8') as f:
            json.dump(combined_data, f, ensure_ascii=False, indent=2)
        
        print("✅ TypeScript友好的合并文件已创建: all_prompts_for_typescript.json")
        
        # Create a TypeScript interface file
        ts_interface = '''// Auto-generated TypeScript interfaces for extracted DSPy prompts
// Generated at: ''' + datetime.datetime.now().isoformat() + '''

export interface ExtractedPrompt {
  system_user_prompt?: string;
  messages_format?: Array<{role: string, content: string}>;
  last_full_prompt?: string;
  last_messages?: Array<{role: string, content: string}>;
  template_structure?: string;
}

export interface DemoData {
  genre?: string;
  platform?: string;
  requirements_section?: string;
  title?: string;
  body?: string;
}

export interface ExtractedDemo {
  demo_index: number;
  data: DemoData;
}

export interface ModuleMetadata {
  signature_instructions?: string;
  input_fields?: string[];
  output_fields?: string[];
}

export interface ExtractedModuleData {
  extracted_at?: string;
  module_type?: string;
  prompts: ExtractedPrompt;
  demos: ExtractedDemo[];
  metadata: ModuleMetadata;
  error?: string;
}

export interface AllPromptsData {
  extraction_info: {
    extracted_at: string;
    baseline_available: boolean;
    mlflow_optimized_available: boolean;
    prompts_file_optimized_available: boolean;
  };
  baseline: ExtractedModuleData;
  optimized_mlflow: ExtractedModuleData;
  optimized_prompts_file: ExtractedModuleData;
}

// Usage example:
// import promptsData from './all_prompts_for_typescript.json';
// const data: AllPromptsData = promptsData;
// 
// // Get the best available optimized prompt
// const getBestPrompt = (): ExtractedPrompt => {
//   if (data.extraction_info.mlflow_optimized_available && data.optimized_mlflow.prompts) {
//     return data.optimized_mlflow.prompts;
//   }
//   if (data.extraction_info.prompts_file_optimized_available && data.optimized_prompts_file.prompts) {
//     return data.optimized_prompts_file.prompts;
//   }
//   return data.baseline.prompts;
// };
'''
        
        with open("prompts-types.ts", 'w', encoding='utf-8') as f:
            f.write(ts_interface)
        
        print("✅ TypeScript接口文件已创建: prompts-types.ts")
        
    except Exception as e:
        print(f"❌ 创建合并文件失败: {e}")
    
    print(f"\n📋 提示词提取总结:")
    print(f"   基础模型: {'✅ 成功' if baseline_success else '❌ 失败'}")
    print(f"   MLflow优化模型: {'✅ 成功' if mlflow_success else '❌ 不可用'}")
    print(f"   提示词文件优化模型: {'✅ 成功' if prompts_success else '❌ 不可用'}")
    print()
    print("📁 生成的文件:")
    print("   - baseline_prompts.json (基础模型提示词)")
    print("   - optimized_mlflow_prompts.json (MLflow优化模型提示词)")  
    print("   - optimized_prompts_file_prompts.json (提示词文件优化模型)")
    print("   - all_prompts_for_typescript.json (TypeScript使用的合并文件)")
    print("   - prompts-types.ts (TypeScript接口定义)")

def main():
    """Main function"""
    print("🎉 优化模块使用指南")
    print("=" * 60)
    print("本脚本演示如何使用 DSPy 优化后的模块")
    print("支持从 MLflow 加载和从提示词文件重建两种方式")
    print("✨ 新增: 智能需求变化器，避免缓存影响测试结果")
    print("✨ 新增: 提示词提取功能，用于TypeScript集成")
    print()
    
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--extract-prompts":
        # Run only prompt extraction
        extract_all_prompts()
        return
    
    # Run demonstrations
    demonstrate_usage()
    production_usage_example()
    test_cache_avoidance()
    
    # Also extract prompts by default
    print("\n" + "="*60)
    extract_all_prompts()
    
    print(f"\n📋 使用总结:")
    print("1. 优先使用 MLFlow 加载方式（完整保存了优化状态）")
    print("2. 提示词文件重建是备用方案（主要保存了示例演示）")
    print("3. 在生产环境中建议实现自动回退机制")
    print("4. 优化模型包含了学习到的示例演示，性能通常优于基础模型")
    print("5. ✨ 使用需求变化器确保每次测试都有独特输入，避免缓存影响")
    print("6. ✨ 使用 --extract-prompts 参数仅运行提示词提取")
    print()
    print("✅ 演示完成！")

if __name__ == "__main__":
    main() 