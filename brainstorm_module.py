import dspy
from typing import List
from common import StoryIdea, BrainstormRequest

class BrainstormSignature(dspy.Signature):
    """Signature for brainstorming a single story idea"""
    genre = dspy.InputField(desc="故事类型/题材")
    platform = dspy.InputField(desc="目标平台")
    requirements_section = dspy.InputField(desc="额外要求", default="")
    title = dspy.OutputField(desc="故事创意的标题（3-7个字符）")
    body = dspy.OutputField(desc="完整的故事梗概（180字以内，包含起承转合结构）")

class BrainstormModule(dspy.Module):
    """DSPy module for generating story brainstorming ideas"""
    
    def __init__(self):
        super().__init__()
        self.generate_idea = dspy.Predict(BrainstormSignature)
    
    def forward(self, genre: str, platform: str, requirements_section: str = "") -> StoryIdea:
        """Generate a single story idea based on the input parameters"""
        
        # Build the requirements section
        requirements_text = requirements_section if requirements_section else ""
        
        # Add the core prompt instructions
        base_prompt = """
要求：
- 生成一个完整的故事情节梗概灵感
- 题材不要老旧，要新颖有创意，避免套路化内容
- 创意包含一个标题（3-7个字符）和一个完整的故事梗概灵感（严格控制在180字以内）
- 故事梗概包含完整的起承转合结构
- 有明确的主角、冲突、发展和结局
- 适合短视频/短剧格式
- 创意要兼顾拍摄的难度和可行性
- 确保与指定题材类型高度一致
"""
        
        full_requirements = f"{requirements_text}\n{base_prompt}" if requirements_text else base_prompt
        
        # Generate single idea via DSPy
        response = self.generate_idea(
            genre=genre,
            platform=platform,
            requirements_section=full_requirements
        )
        
        # Create StoryIdea directly from DSPy response
        return StoryIdea(title=response.title, body=response.body)

class OptimizedBrainstormModule(dspy.Module):
    """Enhanced brainstorm module with additional reasoning capabilities"""
    
    def __init__(self):
        super().__init__()
        self.analyze_genre = dspy.ChainOfThought("genre -> genre_analysis")
        self.generate_idea = dspy.ChainOfThought(BrainstormSignature)
    
    def forward(self, genre: str, platform: str, requirements_section: str = "") -> StoryIdea:
        """Generate a single story idea with enhanced analysis"""
        
        # First, analyze the genre for better understanding
        genre_analysis = self.analyze_genre(genre=genre)
        
        # Build enhanced requirements
        requirements_text = requirements_section if requirements_section else ""
        
        enhanced_prompt = f"""
基于题材分析: {genre_analysis.genre_analysis}

要求：
- 生成一个完整的故事情节梗概灵感
- 题材必须新颖创新，深度理解{genre}类型的核心特点，避免陈旧套路
- 创意包含一个吸引人的标题（3-7个字符）和完整故事梗概（不低于180字）
- 故事结构：起承转合完整，主角鲜明，冲突强烈，发展合理，结局满意
- 高度适配{platform}平台特点和用户偏好
- 制作可行性：考虑拍摄成本、场景复杂度、演员要求等实际因素
- 题材一致性：严格符合{genre}类型的核心要素和观众期待
- 吸引度：具备强烈的情感共鸣和观看动机
"""
        
        full_requirements = f"{requirements_text}\n{enhanced_prompt}" if requirements_text else enhanced_prompt
        
        # Generate single idea via DSPy
        response = self.generate_idea(
            genre=genre,
            platform=platform,
            requirements_section=full_requirements
        )
        
        # Create StoryIdea directly from DSPy response
        return StoryIdea(title=response.title, body=response.body) 