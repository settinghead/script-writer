import dspy
from typing import List, Dict
from common import StoryIdea, BrainstormRequest, EvaluationResult, format_ideas_for_evaluation, eval_lm

class NoveltyEvaluationSignature(dspy.Signature):
    """Evaluate novelty and originality of story ideas"""
    genre = dspy.InputField(desc="故事题材类型")
    story_ideas = dspy.InputField(desc="待评估的故事创意列表")
    novelty_score = dspy.OutputField(desc="新颖性评分(1-10分)，评估创意的原创性和避免套路程度")
    novelty_feedback = dspy.OutputField(desc="新颖性评价反馈，指出哪些创意新颖，哪些套路化")

class FeasibilityEvaluationSignature(dspy.Signature):
    """Evaluate production feasibility of story ideas"""
    platform = dspy.InputField(desc="目标平台")
    story_ideas = dspy.InputField(desc="待评估的故事创意列表")
    feasibility_score = dspy.OutputField(desc="拍摄可行性评分(1-10分)，考虑成本、场景、演员等因素")
    feasibility_feedback = dspy.OutputField(desc="可行性评价反馈，分析制作难度和实际约束")

class StructureEvaluationSignature(dspy.Signature):
    """Evaluate structural clarity of story ideas"""
    story_ideas = dspy.InputField(desc="待评估的故事创意列表")
    structure_score = dspy.OutputField(desc="结构明晰度评分(1-10分)，评估起承转合的完整性")
    structure_feedback = dspy.OutputField(desc="结构评价反馈，分析故事结构的清晰度和逻辑性")

class GenreConsistencySignature(dspy.Signature):
    """Evaluate genre consistency of story ideas"""
    genre = dspy.InputField(desc="预期的故事题材类型")
    story_ideas = dspy.InputField(desc="待评估的故事创意列表")
    genre_score = dspy.OutputField(desc="题材一致性评分(1-10分)，评估与指定题材的匹配度")
    genre_feedback = dspy.OutputField(desc="题材一致性反馈，分析是否符合题材特征")

class EngagementEvaluationSignature(dspy.Signature):
    """Evaluate engagement potential of story ideas"""
    platform = dspy.InputField(desc="目标平台")
    story_ideas = dspy.InputField(desc="待评估的故事创意列表")
    engagement_score = dspy.OutputField(desc="吸引力评分(1-10分)，评估观众兴趣和情感共鸣")
    engagement_feedback = dspy.OutputField(desc="吸引力评价反馈，分析观众接受度和传播潜力")

class StoryIdeaEvaluator:
    """Comprehensive evaluator for story ideas using multiple LLM judges"""
    
    def __init__(self):
        # Configure evaluators to use evaluation LLM
        with dspy.context(lm=eval_lm):
            self.novelty_evaluator = dspy.Predict(NoveltyEvaluationSignature)
            self.feasibility_evaluator = dspy.Predict(FeasibilityEvaluationSignature)
            self.structure_evaluator = dspy.Predict(StructureEvaluationSignature)
            self.genre_evaluator = dspy.Predict(GenreConsistencySignature)
            self.engagement_evaluator = dspy.Predict(EngagementEvaluationSignature)
    
    def evaluate(self, ideas: List[StoryIdea], request: BrainstormRequest) -> EvaluationResult:
        """Comprehensive evaluation of story ideas"""
        
        formatted_ideas = format_ideas_for_evaluation(ideas)
        
        # Use evaluation LLM for all evaluations
        with dspy.context(lm=eval_lm):
            # Evaluate novelty
            novelty_result = self.novelty_evaluator(
                genre=request.genre,
                story_ideas=formatted_ideas
            )
            
            # Evaluate feasibility
            feasibility_result = self.feasibility_evaluator(
                platform=request.platform,
                story_ideas=formatted_ideas
            )
            
            # Evaluate structure
            structure_result = self.structure_evaluator(
                story_ideas=formatted_ideas
            )
            
            # Evaluate genre consistency
            genre_result = self.genre_evaluator(
                genre=request.genre,
                story_ideas=formatted_ideas
            )
            
            # Evaluate engagement
            engagement_result = self.engagement_evaluator(
                platform=request.platform,
                story_ideas=formatted_ideas
            )
        
        # Parse scores (handle potential parsing errors)
        novelty_score = self._parse_score(novelty_result.novelty_score)
        feasibility_score = self._parse_score(feasibility_result.feasibility_score)
        structure_score = self._parse_score(structure_result.structure_score)
        genre_score = self._parse_score(genre_result.genre_score)
        engagement_score = self._parse_score(engagement_result.engagement_score)
        
        # Calculate weighted overall score
        overall_score = self._calculate_overall_score(
            novelty_score, feasibility_score, structure_score, 
            genre_score, engagement_score
        )
        
        # Combine feedback
        combined_feedback = self._combine_feedback(
            novelty_result.novelty_feedback,
            feasibility_result.feasibility_feedback,
            structure_result.structure_feedback,
            genre_result.genre_feedback,
            engagement_result.engagement_feedback
        )
        
        return EvaluationResult(
            novelty_score=novelty_score,
            feasibility_score=feasibility_score,
            structure_score=structure_score,
            genre_consistency_score=genre_score,
            engagement_score=engagement_score,
            overall_score=overall_score,
            feedback=combined_feedback
        )
    
    def _parse_score(self, score_str: str) -> float:
        """Parse score from string, handling various formats"""
        try:
            # Try to extract number from string
            import re
            numbers = re.findall(r'\d+(?:\.\d+)?', str(score_str))
            if numbers:
                score = float(numbers[0])
                return max(1.0, min(10.0, score))  # Clamp between 1-10
            return 5.0  # Default to middle score if parsing fails
        except:
            return 5.0
    
    def _calculate_overall_score(self, novelty: float, feasibility: float, 
                               structure: float, genre: float, engagement: float) -> float:
        """Calculate weighted overall score"""
        # Weights: novelty and engagement are most important
        weights = {
            'novelty': 0.25,
            'feasibility': 0.20,
            'structure': 0.15,
            'genre': 0.20,
            'engagement': 0.20
        }
        
        return (novelty * weights['novelty'] + 
                feasibility * weights['feasibility'] + 
                structure * weights['structure'] + 
                genre * weights['genre'] + 
                engagement * weights['engagement'])
    
    def _combine_feedback(self, *feedbacks) -> str:
        """Combine individual feedback into comprehensive feedback"""
        sections = [
            f"【新颖性】{feedbacks[0]}",
            f"【可行性】{feedbacks[1]}",
            f"【结构性】{feedbacks[2]}",
            f"【题材一致性】{feedbacks[3]}",
            f"【吸引力】{feedbacks[4]}"
        ]
        return "\n\n".join(sections)

def create_evaluation_metric(evaluator: StoryIdeaEvaluator):
    """Create a metric function for DSPy optimization"""
    def evaluation_metric(example, prediction, trace=None) -> float:
        """Metric function for DSPy optimizer"""
        try:
            # Extract ideas from prediction
            if hasattr(prediction, 'story_ideas') and isinstance(prediction.story_ideas, str):
                from common import parse_story_ideas
                ideas = parse_story_ideas(prediction.story_ideas)
            elif hasattr(prediction, '__iter__') and not isinstance(prediction, str):
                ideas = list(prediction)
            else:
                return 0.0
            
            # Create request from example
            request = BrainstormRequest(
                genre=example.genre,
                platform=example.platform,
                requirements_section=getattr(example, 'requirements_section', '')
            )
            
            # Evaluate ideas
            result = evaluator.evaluate(ideas, request)
            
            # Return normalized score (0-1 range for DSPy)
            return result.overall_score / 10.0
            
        except Exception as e:
            print(f"Evaluation error: {e}")
            return 0.0
    
    return evaluation_metric 