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
        
        # Pure DSPy approach - let DSPy figure out the optimal prompt
        # Only pass user requirements, no baseline prompt
        response = self.generate_idea(
            genre=genre,
            platform=platform,
            requirements_section=requirements_section
        )
        
        # Return DSPy prediction with StoryIdea for compatibility
        return dspy.Prediction(
            title=response.title,
            body=response.body,
            story_idea=StoryIdea(title=response.title, body=response.body)
        )

 