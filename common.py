import os
import dspy
from dotenv import dotenv_values
from typing import List, Dict, Any
from dataclasses import dataclass

# Load configuration
config = dotenv_values(".env")
LLM_API_KEY = config["LLM_API_KEY"]
LLM_BASE_URL = config["LLM_BASE_URL"]
LLM_MODEL_NAME = config["LLM_MODEL_NAME"]

# Configure DSPy LLM
lm = dspy.LM(
    model=f"openai/{LLM_MODEL_NAME}",
    api_key=LLM_API_KEY,
    api_base=LLM_BASE_URL,
    max_tokens=1000,
    temperature=1.2,  # Increased from 0.7 for more creative brainstorming
)
dspy.settings.configure(lm=lm)

# Evaluation LLM with different temperature for consistency
eval_lm = dspy.LM(
    model=f"openai/{LLM_MODEL_NAME}",
    api_key=LLM_API_KEY,
    api_base=LLM_BASE_URL,
    max_tokens=1500,  # Increased from 500 to prevent truncation
    temperature=0.3,  # Increased from 0.1 to reduce repetition
)

@dataclass
class StoryIdea:
    """Data class for a single story idea"""
    title: str
    body: str

@dataclass
class BrainstormRequest:
    """Input parameters for brainstorming"""
    genre: str
    platform: str
    requirements_section: str = ""

@dataclass
class EvaluationResult:
    """Result from evaluating story ideas"""
    novelty_score: float
    feasibility_score: float
    structure_score: float
    genre_consistency_score: float
    engagement_score: float
    overall_score: float
    feedback: str

def parse_story_ideas(json_response: str) -> List[StoryIdea]:
    """Parse JSON response into StoryIdea objects"""
    import json
    try:
        ideas_data = json.loads(json_response)
        return [StoryIdea(title=idea["title"], body=idea["body"]) for idea in ideas_data]
    except (json.JSONDecodeError, KeyError) as e:
        print(f"Error parsing story ideas: {e}")
        return []

def format_ideas_for_evaluation(ideas: List[StoryIdea]) -> str:
    """Format story ideas for evaluation"""
    formatted = ""
    for i, idea in enumerate(ideas, 1):
        formatted += f"{i}. 标题: {idea.title}\n   故事: {idea.body}\n\n"
    return formatted.strip() 