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

# CONFIGURATION CONSTANTS
IDEAS_PER_EVALUATION = 2  # Number of ideas to generate per evaluation (reduced for faster optimization)
MAX_TOKENS_GENERATION = 3000  # Further increased to prevent JSON truncation
MAX_TOKENS_EVALUATION = 2000  # For evaluation tasks

# Configure DSPy LLM
lm = dspy.LM(
    model=f"openai/{LLM_MODEL_NAME}",
    api_key=LLM_API_KEY,
    api_base=LLM_BASE_URL,
    max_tokens=MAX_TOKENS_GENERATION,  # Increased to prevent truncation
    temperature=1.7,  # Increased from 0.7 for more creative brainstorming
)
dspy.settings.configure(lm=lm)

# Evaluation LLM with different temperature for consistency
eval_lm = dspy.LM(
    model=f"openai/{LLM_MODEL_NAME}",
    api_key=LLM_API_KEY,
    api_base=LLM_BASE_URL,
    max_tokens=MAX_TOKENS_EVALUATION,  # Use constant
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
    logical_coherence_score: float
    genre_score: float  # Changed from genre_consistency_score to match evaluators.py
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
        elif cleaned_response.startswith("```"):
            cleaned_response = cleaned_response.replace("```", "").strip()
            
        # Remove control characters that might cause JSON parsing issues
        # Replace common problematic characters
        cleaned_response = cleaned_response.replace('\n', ' ').replace('\t', ' ').replace('\r', ' ')
        # Remove other control characters (ASCII 0-31 except space)
        cleaned_response = re.sub(r'[\x00-\x1f\x7f]', ' ', cleaned_response)
        # Normalize multiple spaces to single space
        cleaned_response = re.sub(r'\s+', ' ', cleaned_response)
        
        # Try to extract JSON from the response using regex if direct parsing fails
        try:
            ideas_data = json.loads(cleaned_response)
        except json.JSONDecodeError as e:
            print(f"Initial JSON parsing failed: {e}")
            
            # Check if response appears to be truncated (common issue)
            if "Unterminated string" in str(e) or cleaned_response.endswith('...'):
                print("Detected truncated response, attempting to fix...")
                # Try to fix truncated JSON by finding the last complete object
                truncated_json = attempt_fix_truncated_json(cleaned_response)
                if truncated_json:
                    try:
                        ideas_data = json.loads(truncated_json)
                        print("Successfully parsed truncated JSON after repair")
                    except:
                        print("Failed to parse repaired JSON, trying regex extraction")
                        ideas_data = extract_json_with_regex(cleaned_response)
                else:
                    ideas_data = extract_json_with_regex(cleaned_response)
            else:
                ideas_data = extract_json_with_regex(cleaned_response)
        
        # Validate the structure
        if not isinstance(ideas_data, list):
            raise ValueError(f"Expected list, got {type(ideas_data)}")
        
        ideas = []
        for i, idea in enumerate(ideas_data):
            if not isinstance(idea, dict):
                raise ValueError(f"Idea {i+1} is not a dictionary: {idea}")
            
            if "title" not in idea or "body" not in idea:
                raise KeyError(f"Idea {i+1} missing required fields 'title' or 'body': {idea}")
            
            # Clean the title and body text as well
            title = str(idea["title"]).strip()
            body = str(idea["body"]).strip()
            
            ideas.append(StoryIdea(title=title, body=body))
        
        return ideas
        
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        print(f"Error parsing story ideas: {e}")
        print(f"Raw response: {json_response[:500]}...")
        return []

def attempt_fix_truncated_json(json_text: str) -> str:
    """Attempt to fix truncated JSON by finding the last complete object"""
    try:
        # Find the last complete JSON object by looking for complete braces
        if not json_text.startswith('['):
            return None
            
        # Count braces to find where we have complete objects
        brace_count = 0
        in_string = False
        escape_next = False
        last_complete_pos = -1
        
        for i, char in enumerate(json_text):
            if escape_next:
                escape_next = False
                continue
                
            if char == '\\':
                escape_next = True
                continue
                
            if char == '"' and not escape_next:
                in_string = not in_string
                continue
                
            if not in_string:
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        # Found end of complete object
                        last_complete_pos = i + 1
        
        if last_complete_pos > 0:
            # Extract up to last complete object and close the array
            truncated = json_text[:last_complete_pos]
            if truncated.endswith(','):
                truncated = truncated[:-1]  # Remove trailing comma
            if not truncated.endswith(']'):
                truncated += ']'
            return truncated
            
    except Exception as e:
        print(f"Error attempting to fix truncated JSON: {e}")
    
    return None

def extract_json_with_regex(cleaned_response: str) -> List:
    """Extract JSON using regex patterns as fallback"""
    # Try to find JSON array pattern in the text
    json_pattern = r'\[.*?\]'
    matches = re.findall(json_pattern, cleaned_response, re.DOTALL)
    if matches:
        # Try parsing the first match
        json_text = matches[0]
        # Additional cleaning for the extracted JSON
        json_text = re.sub(r'[\x00-\x1f\x7f]', ' ', json_text)
        json_text = re.sub(r'\s+', ' ', json_text)
        
        # Try to fix common issues
        if json_text.count('{') > json_text.count('}'):
            # Try to balance braces
            missing_braces = json_text.count('{') - json_text.count('}')
            json_text = json_text.rstrip('.,') + '}' * missing_braces
            if not json_text.endswith(']'):
                json_text += ']'
        
        return json.loads(json_text)
    else:
        print(f"No JSON array pattern found in response")
        raise json.JSONDecodeError("No valid JSON array found", cleaned_response, 0)

def format_ideas_for_evaluation(ideas: List[StoryIdea]) -> str:
    """Format story ideas for evaluation"""
    formatted = ""
    for i, idea in enumerate(ideas, 1):
        formatted += f"{i}. 标题: {idea.title}\n   故事: {idea.body}\n\n"
    return formatted.strip() 