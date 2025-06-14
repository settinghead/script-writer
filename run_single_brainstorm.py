#!/usr/bin/env python3
"""
Single brainstorm run script
Demonstrates basic brainstorming functionality and evaluation
"""

import json
from brainstorm_module import BrainstormModule
from evaluators import StoryIdeaEvaluator
from common import BrainstormRequest

def main():
    print("🎬 Story Brainstorming - Single Run")
    print("=" * 50)
    
    # Initialize modules
    print("初始化模块...")
    brainstorm_module = BrainstormModule()
    evaluator = StoryIdeaEvaluator()
    
    # Define test cases using real genre system
    test_cases = [
        {
            "name": "甜宠爱情",
            "request": BrainstormRequest(
                genre="甜宠",
                platform="抖音",
                requirements_section="浪漫甜蜜的爱情故事，适合年轻观众"
            )
        },
        {
            "name": "穿越设定",
            "request": BrainstormRequest(
                genre="穿越",
                platform="小红书",
                requirements_section="身穿或魂穿，古代现代背景都可"
            )
        },
        {
            "name": "赘婿逆袭",
            "request": BrainstormRequest(
                genre="赘婿",
                platform="快手",
                requirements_section="赘婿逆袭，扮猪吃老虎"
            )
        }
    ]
    
    # Run brainstorming for each test case
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📝 测试案例 {i}: {test_case['name']}")
        print("-" * 30)
        
        try:
            # Generate ideas
            print("正在生成创意...")
            ideas = brainstorm_module(
                genre=test_case["request"].genre,
                platform=test_case["request"].platform,
                requirements_section=test_case["request"].requirements_section
            )
            
            print(f"生成了 {len(ideas)} 个创意:")
            for j, idea in enumerate(ideas, 1):
                print(f"  {j}. 【{idea.title}】{idea.body}")
            
            # Evaluate ideas
            print("\n正在评估创意质量...")
            evaluation = evaluator.evaluate(ideas, test_case["request"])
            
            # Display evaluation results
            print("\n📊 评估结果:")
            print(f"  新颖性: {evaluation.novelty_score:.1f}/10")
            print(f"  可行性: {evaluation.feasibility_score:.1f}/10")
            print(f"  结构性: {evaluation.structure_score:.1f}/10")
            print(f"  题材一致性: {evaluation.genre_score:.1f}/10")
            print(f"  吸引力: {evaluation.engagement_score:.1f}/10")
            print(f"  总体评分: {evaluation.overall_score:.1f}/10")
            
            print(f"\n💡 详细反馈:")
            print(evaluation.feedback)
            
        except Exception as e:
            print(f"❌ 执行失败: {e}")
            continue
        
        if i < len(test_cases):
            input("\n按回车键继续下一个测试...")
    
    print("\n✅ 单次运行测试完成!")

def interactive_mode():
    """Interactive mode for custom testing"""
    print("\n🎮 交互模式")
    print("=" * 50)
    
    brainstorm_module = BrainstormModule()
    evaluator = StoryIdeaEvaluator()
    
    while True:
        print("\n请输入参数 (输入 'quit' 退出):")
        
        genre = input("题材类型 (例: 甜宠, 穿越, 赘婿, 神豪): ").strip()
        if genre.lower() == 'quit':
            break
            
        platform = input("目标平台 (例: 抖音): ").strip()
        if platform.lower() == 'quit':
            break
            
        requirements = input("额外要求 (可选): ").strip()
        
        request = BrainstormRequest(
            genre=genre,
            platform=platform,
            requirements_section=requirements
        )
        
        try:
            print("\n🎬 正在生成创意...")
            ideas = brainstorm_module(
                genre=request.genre,
                platform=request.platform,
                requirements_section=request.requirements_section
            )
            
            print(f"\n生成的创意:")
            for i, idea in enumerate(ideas, 1):
                print(f"  {i}. 【{idea.title}】")
                print(f"     {idea.body}")
            
            # Ask if user wants evaluation
            evaluate = input("\n是否进行评估? (y/n): ").strip().lower()
            if evaluate == 'y':
                print("\n🔍 正在评估...")
                evaluation = evaluator.evaluate(ideas, request)
                
                print(f"\n📊 评估结果:")
                print(f"  总体评分: {evaluation.overall_score:.1f}/10")
                print(f"\n详细评分:")
                print(f"  新颖性: {evaluation.novelty_score:.1f}")
                print(f"  可行性: {evaluation.feasibility_score:.1f}")
                print(f"  结构性: {evaluation.structure_score:.1f}")
                print(f"  题材一致性: {evaluation.genre_score:.1f}")
                print(f"  吸引力: {evaluation.engagement_score:.1f}")
                
        except Exception as e:
            print(f"❌ 错误: {e}")

if __name__ == "__main__":
    # Run predefined test cases
    main()
    
    # Ask if user wants interactive mode
    interactive = input("\n是否进入交互模式? (y/n): ").strip().lower()
    if interactive == 'y':
        interactive_mode()
    
    print("\n👋 再见!") 