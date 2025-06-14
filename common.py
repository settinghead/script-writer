import os
import dspy
from dotenv import dotenv_values
from typing import List, Dict, Any
from dataclasses import dataclass
import json
import re

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
    detail_score: float
    genre_consistency_score: float
    engagement_score: float
    overall_score: float
    feedback: str

def parse_story_ideas(json_response: str) -> List[StoryIdea]:
    """Parse JSON response into StoryIdea objects with improved error handling"""
    try:
        # Clean the response - remove markdown formatting if present
        cleaned_response = json_response.strip()
        if cleaned_response.startswith("```json"):
            cleaned_response = cleaned_response.replace("```json", "").replace("```", "").strip()
        
        # Try to extract JSON from the response using regex if direct parsing fails
        try:
            ideas_data = json.loads(cleaned_response)
        except json.JSONDecodeError:
            # Try to find JSON array pattern in the text
            json_pattern = r'\[.*?\]'
            matches = re.findall(json_pattern, cleaned_response, re.DOTALL)
            if matches:
                ideas_data = json.loads(matches[0])
            else:
                raise json.JSONDecodeError("No valid JSON array found", cleaned_response, 0)
        
        # Validate the structure
        if not isinstance(ideas_data, list):
            raise ValueError(f"Expected list, got {type(ideas_data)}")
        
        ideas = []
        for i, idea in enumerate(ideas_data):
            if not isinstance(idea, dict):
                raise ValueError(f"Idea {i+1} is not a dictionary: {idea}")
            
            if "title" not in idea or "body" not in idea:
                raise KeyError(f"Idea {i+1} missing required fields 'title' or 'body': {idea}")
            
            ideas.append(StoryIdea(title=str(idea["title"]), body=str(idea["body"])))
        
        return ideas
        
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        print(f"Error parsing story ideas: {e}")
        print(f"Raw response: {json_response[:200]}...")
        return []

def format_ideas_for_evaluation(ideas: List[StoryIdea]) -> str:
    """Format story ideas for evaluation"""
    formatted = ""
    for i, idea in enumerate(ideas, 1):
        formatted += f"{i}. 标题: {idea.title}\n   故事: {idea.body}\n\n"
    return formatted.strip() 