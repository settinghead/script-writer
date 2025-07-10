import { describe, it, expect, vi } from 'vitest';
import { detectStageFromWorkflowNodes } from '../lineageBasedActionComputation';

// Mock the component imports to avoid import errors
vi.mock('../../../common/transform-artifact-framework/lineageResolution', () => ({
    extractEffectiveBrainstormIdeas: vi.fn(() => []),
    findMainWorkflowPath: vi.fn(() => []),
    findChosenIdeaFromLineage: vi.fn(() => null),
    LineageGraph: vi.fn(),
    createLineageGraph: vi.fn(() => ({
        nodes: new Map(),
        edges: new Map(),
        rootNodes: new Set(),
        leafNodes: new Set()
    }))
}));

// Mock the action components
vi.mock('../../components/actions', () => ({
    BrainstormCreationActions: vi.fn(),
    BrainstormInputForm: vi.fn(),
    BrainstormIdeaSelection: vi.fn(),
    OutlineGenerationForm: vi.fn(),
    ChroniclesGenerationAction: vi.fn(),
    EpisodeGenerationAction: vi.fn()
}));

describe('Brainstorm Selection Stage Detection', () => {
    describe('detectStageFromWorkflowNodes', () => {
        it('should return initial stage when no workflow nodes exist', () => {
            const result = detectStageFromWorkflowNodes([]);
            expect(result).toBe('initial');
        });

        it('should return brainstorm_selection stage when brainstorm_collection is the last node', () => {
            const workflowNodes = [
                {
                    id: 'collection-1',
                    type: 'brainstorm_collection',
                    title: '创意构思',
                    navigationTarget: '#brainstorm-ideas',
                    x: 100,
                    y: 100,
                    isLatest: true
                }
            ];

            const result = detectStageFromWorkflowNodes(workflowNodes);
            expect(result).toBe('brainstorm_selection');
        });

        it('should return idea_editing stage when brainstorm_idea is the last node', () => {
            const workflowNodes = [
                {
                    id: 'idea-1',
                    type: 'brainstorm_idea',
                    title: '选中创意',
                    navigationTarget: '#ideation-edit',
                    x: 100,
                    y: 100,
                    isLatest: true
                }
            ];

            const result = detectStageFromWorkflowNodes(workflowNodes);
            expect(result).toBe('idea_editing');
        });

        it('should return brainstorm_input stage when brainstorm_input is the last node', () => {
            const workflowNodes = [
                {
                    id: 'input-1',
                    type: 'brainstorm_input',
                    title: '头脑风暴输入',
                    navigationTarget: '#brainstorm-input',
                    x: 100,
                    y: 100,
                    isLatest: true
                }
            ];

            const result = detectStageFromWorkflowNodes(workflowNodes);
            expect(result).toBe('brainstorm_input');
        });

        it('should return outline_generation stage when outline is the last node', () => {
            const workflowNodes = [
                {
                    id: 'outline-1',
                    type: 'outline',
                    title: '大纲设置',
                    navigationTarget: '#outline-settings',
                    x: 100,
                    y: 100,
                    isLatest: true
                }
            ];

            const result = detectStageFromWorkflowNodes(workflowNodes);
            expect(result).toBe('outline_generation');
        });

        it('should return chronicles_generation stage when chronicles is the last node', () => {
            const workflowNodes = [
                {
                    id: 'chronicles-1',
                    type: 'chronicles',
                    title: '分集大纲',
                    navigationTarget: '#chronicles',
                    x: 100,
                    y: 100,
                    isLatest: true
                }
            ];

            const result = detectStageFromWorkflowNodes(workflowNodes);
            expect(result).toBe('chronicles_generation');
        });

        it('should return episode_synopsis_generation stage when episode_synopsis is the last node', () => {
            const workflowNodes = [
                {
                    id: 'episode-1',
                    type: 'episode_synopsis',
                    title: '分集剧本',
                    navigationTarget: '#episode-synopsis',
                    x: 100,
                    y: 100,
                    isLatest: true
                }
            ];

            const result = detectStageFromWorkflowNodes(workflowNodes);
            expect(result).toBe('episode_synopsis_generation');
        });

        it('should return initial stage for unknown node types', () => {
            const workflowNodes = [
                {
                    id: 'unknown-1',
                    type: 'unknown_type',
                    title: '未知类型',
                    navigationTarget: '#unknown',
                    x: 100,
                    y: 100,
                    isLatest: true
                }
            ];

            const result = detectStageFromWorkflowNodes(workflowNodes);
            expect(result).toBe('initial');
        });

        it('should use the last node when multiple nodes are present', () => {
            const workflowNodes = [
                {
                    id: 'input-1',
                    type: 'brainstorm_input',
                    title: '头脑风暴输入',
                    navigationTarget: '#brainstorm-input',
                    x: 100,
                    y: 100,
                    isLatest: false
                },
                {
                    id: 'collection-1',
                    type: 'brainstorm_collection',
                    title: '创意构思',
                    navigationTarget: '#brainstorm-ideas',
                    x: 100,
                    y: 200,
                    isLatest: true
                }
            ];

            const result = detectStageFromWorkflowNodes(workflowNodes);
            expect(result).toBe('brainstorm_selection');
        });
    });
}); 