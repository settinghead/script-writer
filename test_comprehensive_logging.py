#!/usr/bin/env python3
"""
Simple test script to verify the comprehensive logging system
"""

import sys
sys.path.append('.')

from optimize_brainstorm import ComprehensiveLogger, load_golden_examples, create_training_examples

def test_logging_system():
    """Test the comprehensive logging system"""
    print("🧪 测试综合日志系统")
    print("=" * 50)
    
    # Test logger initialization
    logger = ComprehensiveLogger("test_logs")
    print(f"✅ 日志器初始化成功: {logger.run_dir}")
    
    # Test configuration logging
    test_config = {
        "test_mode": "verification",
        "features": ["golden_examples", "file_logging", "mlflow_integration"]
    }
    logger.log_configuration(test_config)
    
    # Test golden examples loading
    print("\n📚 测试黄金样例加载...")
    golden_examples = load_golden_examples()
    if golden_examples:
        logger.log_golden_examples(golden_examples)
        print(f"✅ 成功加载并记录 {len(golden_examples)} 个黄金样例")
    else:
        print("⚠️ 未找到黄金样例")
    
    # Test training data logging
    print("\n📊 测试训练数据记录...")
    training_examples = create_training_examples()
    logger.log_training_data(training_examples, "test_training_data")
    
    # Test optimization step logging
    logger.log_optimization_step("test_step", {
        "step_description": "Testing logging functionality",
        "parameters": {"test_param": "test_value"},
        "success": True
    }, "test")
    
    # Test evaluation results logging
    test_evaluation = {
        "model_name": "test_model",
        "overall_score": 8.5,
        "detailed_scores": {
            "novelty": 8.0,
            "feasibility": 9.0,
            "engagement": 8.5
        },
        "test_cases": [
            {"case": 1, "genre": "甜宠", "score": 8.5},
            {"case": 2, "genre": "虐恋", "score": 8.0}
        ]
    }
    logger.log_evaluation_results(test_evaluation, "test_evaluation")
    
    # Test generated examples logging
    test_examples = [
        "这是一个测试生成的故事创意，关于甜宠题材的浪漫爱情故事，男女主角在校园相遇后发生的一系列温馨故事。",
        "这是另一个测试创意，讲述虐恋题材中两个相爱却不能在一起的人之间的痛苦纠葛和最终的救赎。"
    ]
    logger.log_generated_examples(test_examples, "test_generation")
    
    # Create final summary
    summary_file = logger.create_final_summary()
    
    print(f"\n✅ 日志系统测试完成!")
    print(f"📁 测试日志目录: {logger.run_dir}")
    print(f"📋 总结文件: {summary_file}")
    print(f"🔍 可以查看各个子目录了解详细记录")

if __name__ == "__main__":
    test_logging_system() 