#!/usr/bin/env python3
"""
Utilities for inspecting optimized DSPy modules and prompts
"""

import json
import os
from typing import Dict, Any, List
import dspy
from brainstorm_module import BrainstormModule
from common import BrainstormRequest
import pandas as pd

def inspect_optimized_module(optimized_module, name: str = "optimized_module"):
    """Inspect the optimized DSPy module to see what changed"""
    print(f"🔍 检查优化后的模块状态: {name}")
    print("=" * 60)
    
    # Inspect the main predictor
    if hasattr(optimized_module, 'generate_ideas'):
        predictor = optimized_module.generate_ideas
        print(f"Predictor类型: {type(predictor).__name__}")
        
        # Check if it's a few-shot predictor with demos
        if hasattr(predictor, 'demos'):
            print(f"\n📚 Few-shot demonstrations: {len(predictor.demos)} 个示例")
            for i, demo in enumerate(predictor.demos):
                print(f"\n  示例 {i+1}:")
                print(f"    题材: {demo.genre}")
                print(f"    平台: {demo.platform}")
                print(f"    要求: {demo.requirements_section[:50]}...")
                if hasattr(demo, 'story_ideas'):
                    story_preview = demo.story_ideas[:100] + "..." if len(demo.story_ideas) > 100 else demo.story_ideas
                    print(f"    创意: {story_preview}")
        else:
            print("\n📚 无 Few-shot demonstrations")
        
        # Check the signature
        if hasattr(predictor, 'signature'):
            sig = predictor.signature
            print(f"\n🏷️  Signature: {sig.__class__.__name__}")
            print("  输入字段:")
            for name, field in sig.input_fields.items():
                print(f"    - {name}: {field.desc}")
            print("  输出字段:")
            for name, field in sig.output_fields.items():
                print(f"    - {name}: {field.desc}")
        
        # Look for optimized prompts/instructions
        if hasattr(predictor, 'extended_signature'):
            print(f"\n📝 扩展 Signature: {predictor.extended_signature}")
    
    print("\n" + "=" * 60)

def save_optimized_prompts(module, name: str) -> str:
    """Save the optimized prompts to files for inspection"""
    prompts_dir = "optimized_prompts"
    os.makedirs(prompts_dir, exist_ok=True)
    
    module_info = {
        "name": name,
        "type": type(module).__name__,
        "timestamp": str(pd.Timestamp.now()) if 'pd' in globals() else "unknown"
    }
    
    if hasattr(module, 'generate_ideas'):
        predictor = module.generate_ideas
        predictor_info = {
            "type": type(predictor).__name__,
            "has_demos": hasattr(predictor, 'demos')
        }
        
        # Save few-shot demonstrations
        if hasattr(predictor, 'demos'):
            demos_data = []
            for demo in predictor.demos:
                demo_dict = {
                    'genre': demo.genre,
                    'platform': demo.platform,
                    'requirements_section': getattr(demo, 'requirements_section', ''),
                }
                if hasattr(demo, 'story_ideas'):
                    demo_dict['story_ideas'] = demo.story_ideas
                demos_data.append(demo_dict)
            predictor_info['demos'] = demos_data
            predictor_info['num_demos'] = len(demos_data)
        
        # Save signature information
        if hasattr(predictor, 'signature'):
            sig = predictor.signature
            predictor_info['signature'] = {
                'name': sig.__class__.__name__,
                'fields': {
                    'inputs': {name: field.desc for name, field in sig.input_fields.items()},
                    'outputs': {name: field.desc for name, field in sig.output_fields.items()}
                }
            }
        
        module_info['predictor'] = predictor_info
    
    # Save to file
    filename = f"{prompts_dir}/{name}_optimized_prompts.json"
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(module_info, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 优化后的提示词信息已保存到: {filename}")
    return filename

def trace_module_execution(module, request: BrainstormRequest, name: str = "module"):
    """Trace the execution of a module to see actual prompts used"""
    print(f"🔍 追踪模块执行过程: {name}")
    print("-" * 40)
    
    # Enable DSPy history tracking
    with dspy.context(trace=[]):
        try:
            ideas = module(request)
            
            # Get the execution trace
            if dspy.settings.trace:
                print("📋 执行追踪:")
                for i, trace_item in enumerate(dspy.settings.trace):
                    print(f"  步骤 {i+1}: {trace_item}")
            else:
                print("⚠️  无执行追踪信息")
            
            print(f"\n✅ 生成了 {len(ideas)} 个创意")
            for i, idea in enumerate(ideas, 1):
                print(f"  {i}. 【{idea.title}】{idea.body[:50]}...")
            
            return ideas
            
        except Exception as e:
            print(f"❌ 执行追踪失败: {e}")
            return []

def compare_baseline_vs_optimized(baseline_module, optimized_module, test_request: BrainstormRequest):
    """Compare baseline vs optimized module responses"""
    print("🆚 基础模型 vs 优化模型对比")
    print("=" * 50)
    
    print("🔸 基础模型响应:")
    baseline_ideas = trace_module_execution(baseline_module, test_request, "基础模型")
    
    print(f"\n🔹 优化模型响应:")
    optimized_ideas = trace_module_execution(optimized_module, test_request, "优化模型")
    
    print(f"\n📊 对比结果:")
    print(f"  基础模型创意数量: {len(baseline_ideas)}")
    print(f"  优化模型创意数量: {len(optimized_ideas)}")
    
    if baseline_ideas and optimized_ideas:
        print(f"\n📝 创意对比:")
        for i in range(min(len(baseline_ideas), len(optimized_ideas))):
            print(f"  创意 {i+1}:")
            print(f"    基础: 【{baseline_ideas[i].title}】")
            print(f"    优化: 【{optimized_ideas[i].title}】")
    
    return baseline_ideas, optimized_ideas

def extract_prompt_templates(module) -> Dict[str, Any]:
    """Extract prompt templates from a DSPy module"""
    templates = {}
    
    if hasattr(module, 'generate_ideas'):
        predictor = module.generate_ideas
        
        # Extract basic signature template
        if hasattr(predictor, 'signature'):
            sig = predictor.signature
            templates['signature'] = {
                'inputs': list(sig.input_fields.keys()),
                'outputs': list(sig.output_fields.keys()),
                'instructions': getattr(sig, 'instructions', 'None')
            }
        
        # Extract few-shot examples as templates
        if hasattr(predictor, 'demos') and predictor.demos:
            templates['few_shot_examples'] = []
            for demo in predictor.demos:
                example = {
                    'input': {
                        'genre': demo.genre,
                        'platform': demo.platform,
                        'requirements_section': getattr(demo, 'requirements_section', '')
                    }
                }
                if hasattr(demo, 'story_ideas'):
                    example['output'] = {'story_ideas': demo.story_ideas}
                templates['few_shot_examples'].append(example)
    
    return templates

def main():
    """Demo function showing how to use the inspection utilities"""
    print("🔧 DSPy 模块检查工具演示")
    print("=" * 50)
    
    # Create a test request
    test_request = BrainstormRequest(
        genre="甜宠",
        platform="抖音",
        requirements_section="浪漫甜蜜的爱情故事"
    )
    
    # Create baseline module
    baseline_module = BrainstormModule()
    print("📋 基础模块信息:")
    inspect_optimized_module(baseline_module, "基础模块")
    
    # Note: In real usage, you would load an optimized module here
    # optimized_module = load_optimized_module()
    # inspect_optimized_module(optimized_module, "优化模块")
    # compare_baseline_vs_optimized(baseline_module, optimized_module, test_request)

if __name__ == "__main__":
    main() 