import dspy
from typing import List, Dict, Tuple, Optional
from common import StoryIdea, BrainstormRequest, EvaluationResult, format_ideas_for_evaluation, eval_lm
import hashlib
import json
import pickle
import os

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

class DetailEvaluationSignature(dspy.Signature):
    """Evaluate the level of detail in story ideas"""
    story_ideas = dspy.InputField(desc="待评估的故事创意列表")
    detail_score = dspy.OutputField(desc="详细程度评分(1-10分)，评估故事梗概的丰富性、细节描述和情节展开程度")
    detail_feedback = dspy.OutputField(desc="详细程度评价反馈，分析哪些创意描述充分，哪些过于简略")

class LogicalCoherenceEvaluationSignature(dspy.Signature):
    """Evaluate logical coherence and internal consistency of story ideas"""
    genre = dspy.InputField(desc="故事题材类型")
    story_ideas = dspy.InputField(desc="待评估的故事创意列表")
    logical_coherence_score = dspy.OutputField(desc="逻辑连贯性评分(1-10分)，评估故事内在逻辑、时间线一致性、因果关系合理性，特别关注穿越、重生、多时空等复杂设定的逻辑漏洞")
    logical_coherence_feedback = dspy.OutputField(desc="逻辑连贯性评价反馈，指出故事中的逻辑漏洞、时间线矛盾、因果关系不合理等问题")

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
    
    def __init__(self, cache_file: str = "evaluation_cache.pkl"):
        # Configure evaluators to use evaluation LLM
        with dspy.context(lm=eval_lm):
            self.novelty_evaluator = dspy.Predict(NoveltyEvaluationSignature)
            self.feasibility_evaluator = dspy.Predict(FeasibilityEvaluationSignature)
            self.structure_evaluator = dspy.Predict(StructureEvaluationSignature)
            self.detail_evaluator = dspy.Predict(DetailEvaluationSignature)
            self.logical_coherence_evaluator = dspy.Predict(LogicalCoherenceEvaluationSignature)
            self.genre_evaluator = dspy.Predict(GenreConsistencySignature)
            self.engagement_evaluator = dspy.Predict(EngagementEvaluationSignature)
        
        # Initialize cache
        self.cache_file = cache_file
        self.cache = self._load_cache()
    
    def _load_cache(self) -> Dict[str, EvaluationResult]:
        """Load evaluation cache from disk"""
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, 'rb') as f:
                    return pickle.load(f)
            except Exception as e:
                print(f"Warning: Failed to load cache: {e}")
                return {}
        return {}
    
    def _save_cache(self):
        """Save evaluation cache to disk"""
        try:
            with open(self.cache_file, 'wb') as f:
                pickle.dump(self.cache, f)
        except Exception as e:
            print(f"Warning: Failed to save cache: {e}")
    
    def _get_cache_key(self, ideas: List[StoryIdea], request: BrainstormRequest) -> str:
        """Generate a cache key for the given ideas and request"""
        content = {
            'ideas': [{'title': idea.title, 'body': idea.body} for idea in ideas],
            'genre': request.genre,
            'platform': request.platform,
            'requirements': request.requirements_section
        }
        content_str = json.dumps(content, sort_keys=True, ensure_ascii=False)
        return hashlib.md5(content_str.encode('utf-8')).hexdigest()
    
    def evaluate(self, ideas: List[StoryIdea], request: BrainstormRequest) -> EvaluationResult:
        """Comprehensive evaluation of story ideas with caching"""
        
        # Check cache first
        cache_key = self._get_cache_key(ideas, request)
        if cache_key in self.cache:
            print("  📋 使用缓存的评估结果")
            return self.cache[cache_key]
        
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
            
            # Evaluate detail level
            detail_result = self.detail_evaluator(
                story_ideas=formatted_ideas
            )
            
            # Evaluate logical coherence
            logical_coherence_result = self.logical_coherence_evaluator(
                genre=request.genre,
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
        detail_score = self._parse_score(detail_result.detail_score)
        logical_coherence_score = self._parse_score(logical_coherence_result.logical_coherence_score)
        genre_score = self._parse_score(genre_result.genre_score)
        engagement_score = self._parse_score(engagement_result.engagement_score)
        
        # Calculate weighted overall score
        weights = {
            'novelty': 0.18,
            'feasibility': 0.12,
            'structure': 0.08,
            'detail': 0.18,
            'logical_coherence': 0.16,
            'genre': 0.10,
            'engagement': 0.18
        }
        
        overall_score = (
            novelty_score * weights['novelty'] +
            feasibility_score * weights['feasibility'] +
            structure_score * weights['structure'] +
            detail_score * weights['detail'] +
            logical_coherence_score * weights['logical_coherence'] +
            genre_score * weights['genre'] +
            engagement_score * weights['engagement']
        )
        
        # Combine feedback
        combined_feedback = f"""
评估结果详情：

新颖性评分：{novelty_score}/10
{novelty_result.novelty_feedback}

可行性评分：{feasibility_score}/10
{feasibility_result.feasibility_feedback}

结构评分：{structure_score}/10
{structure_result.structure_feedback}

详细程度评分：{detail_score}/10
{detail_result.detail_feedback}

逻辑连贯性评分：{logical_coherence_score}/10
{logical_coherence_result.logical_coherence_feedback}

题材一致性评分：{genre_score}/10
{genre_result.genre_feedback}

吸引力评分：{engagement_score}/10
{engagement_result.engagement_feedback}

总体评分：{overall_score:.1f}/10
"""
        
        # Create result
        result = EvaluationResult(
            overall_score=overall_score,
            novelty_score=novelty_score,
            feasibility_score=feasibility_score,
            structure_score=structure_score,
            detail_score=detail_score,
            logical_coherence_score=logical_coherence_score,
            genre_score=genre_score,
            engagement_score=engagement_score,
            feedback=combined_feedback.strip()
        )
        
        # Cache the result
        self.cache[cache_key] = result
        self._save_cache()
        
        return result

    def _parse_score(self, score_str: str) -> float:
        """Parse score string, handling various formats"""
        if isinstance(score_str, (int, float)):
            return float(score_str)
        
        # Try to extract number from string
        import re
        matches = re.findall(r'(\d+(?:\.\d+)?)', str(score_str))
        if matches:
            try:
                score = float(matches[0])
                return min(max(score, 0.0), 10.0)  # Clamp to 0-10 range
            except ValueError:
                pass
        
        print(f"Warning: Could not parse score '{score_str}', defaulting to 5.0")
        return 5.0

# Grouped optimization support
class GroupedEvaluationMetrics:
    """Metrics for grouped optimization of different evaluation aspects"""
    
    def __init__(self, evaluator: StoryIdeaEvaluator):
        self.evaluator = evaluator
        
        # Define evaluation groups
        self.groups = {
            'creativity': ['novelty', 'engagement'],
            'feasibility': ['feasibility', 'structure'], 
            'content_quality': ['detail', 'logical_coherence', 'genre']
        }
        
        # Single group for compatibility with current approach
        self.single_group = {
            'overall': ['novelty', 'feasibility', 'structure', 'detail', 'logical_coherence', 'genre', 'engagement']
        }
    
    def create_group_metric(self, group_name: str, metric_names: List[str]):
        """Create a metric function for a specific group of evaluation criteria"""
        def group_metric(example, prediction, trace=None) -> float:
            """Metric function for a specific group"""
            try:
                # Extract ideas from prediction
                # With the new DSPy approach, prediction should be a list of StoryIdea objects
                if hasattr(prediction, '__iter__') and not isinstance(prediction, str):
                    ideas = list(prediction)
                else:
                    print(f"Warning: Unexpected prediction type: {type(prediction)}")
                    return 0.0
                
                # Create request from example
                request = BrainstormRequest(
                    genre=example.genre,
                    platform=example.platform,
                    requirements_section=getattr(example, 'requirements_section', '')
                )
                
                # Evaluate ideas
                result = self.evaluator.evaluate(ideas, request)
                
                # Calculate group score
                if group_name == 'overall':
                    # Use overall score for single-group optimization (current approach)
                    return result.overall_score / 10.0
                else:
                    # Calculate average of metrics in this group
                    group_scores = []
                    for metric_name in metric_names:
                        score = getattr(result, f'{metric_name}_score', 0)
                        group_scores.append(score)
                    
                    if group_scores:
                        return sum(group_scores) / len(group_scores) / 10.0
                    else:
                        return 0.0
                
            except Exception as e:
                print(f"Group evaluation error ({group_name}): {e}")
                return 0.0
        
        return group_metric
    
    def get_all_group_metrics(self, use_single_group: bool = False) -> Dict[str, callable]:
        """Get all group metrics for optimization"""
        if use_single_group:
            # Return single group (current approach)
            return {
                'overall': self.create_group_metric('overall', self.single_group['overall'])
            }
        else:
            # Return grouped metrics
            metrics = {}
            for group_name, metric_names in self.groups.items():
                metrics[group_name] = self.create_group_metric(group_name, metric_names)
            return metrics

def create_evaluation_metric(evaluator: StoryIdeaEvaluator):
    """Create a metric function for DSPy optimization (backwards compatibility)"""
    grouped_metrics = GroupedEvaluationMetrics(evaluator)
    overall_metrics = grouped_metrics.get_all_group_metrics(use_single_group=True)
    return overall_metrics['overall']

def create_grouped_evaluation_metrics(evaluator: StoryIdeaEvaluator, use_single_group: bool = False):
    """Create grouped evaluation metrics for advanced optimization"""
    grouped_metrics = GroupedEvaluationMetrics(evaluator)
    return grouped_metrics.get_all_group_metrics(use_single_group=use_single_group) 