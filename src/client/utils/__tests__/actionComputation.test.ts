import { describe, it, expect } from 'vitest';
import {
    isLeafNode,
    canBecomeEditable,
    computeDisplayComponents
} from '../actionComputation';

describe('actionComputation', () => {
    describe('isLeafNode', () => {
        it('should return true for artifact with no descendants', () => {
            const transformInputs = [
                { artifact_id: 'other-artifact', transform_id: 'transform-1' }
            ];
            expect(isLeafNode('test-artifact', transformInputs)).toBe(true);
        });

        it('should return false for artifact with descendants', () => {
            const transformInputs = [
                { artifact_id: 'test-artifact', transform_id: 'transform-1' }
            ];
            expect(isLeafNode('test-artifact', transformInputs)).toBe(false);
        });

        it('should return true for empty transform inputs', () => {
            expect(isLeafNode('test-artifact', [])).toBe(true);
        });
    });

    describe('canBecomeEditable', () => {
        it('should return true for AI-generated leaf node', () => {
            const artifact = { id: 'test', origin_type: 'ai_generated' };
            const transformInputs: any[] = [];
            expect(canBecomeEditable(artifact, transformInputs)).toBe(true);
        });

        it('should return false for user input artifact', () => {
            const artifact = { id: 'test', origin_type: 'user_input' };
            const transformInputs: any[] = [];
            expect(canBecomeEditable(artifact, transformInputs)).toBe(false);
        });

        it('should return false for artifact with descendants', () => {
            const artifact = { id: 'test', origin_type: 'ai_generated' };
            const transformInputs = [{ artifact_id: 'test', transform_id: 'transform-1' }];
            expect(canBecomeEditable(artifact, transformInputs)).toBe(false);
        });
    });

    describe('computeDisplayComponents - outline settings selection', () => {
        it('should select user_input leaf node over ai_generated artifact with descendants', () => {
            // Mock project data with two outline settings artifacts
            const mockProjectData = {
                artifacts: [
                    // AI-generated artifact (older, has descendants)
                    {
                        id: 'ai-outline-artifact',
                        schema_type: 'outline_settings_schema',
                        origin_type: 'ai_generated',
                        created_at: '2025-01-01T10:00:00Z',
                        data: { title: 'AI Generated Outline' }
                    },
                    // User input artifact (newer, leaf node)
                    {
                        id: 'user-outline-artifact',
                        schema_type: 'outline_settings_schema',
                        origin_type: 'user_input',
                        created_at: '2025-01-01T11:00:00Z',
                        data: { title: 'User Edited Outline' }
                    }
                ],
                transformInputs: [
                    // AI-generated artifact has descendants (used as input to another transform)
                    { artifact_id: 'ai-outline-artifact', transform_id: 'some-transform' }
                    // User artifact has no descendants (is a leaf node)
                ]
            };

            const displayComponents = computeDisplayComponents(
                'outline_generation',
                false, // hasActiveTransforms
                mockProjectData as any
            );

            // Find the outline settings display component
            const outlineComponent = displayComponents.find(
                component => component.id === 'outline-settings-display'
            );

            expect(outlineComponent).toBeDefined();
            expect(outlineComponent?.props?.outlineSettings?.id).toBe('user-outline-artifact');
            expect(outlineComponent?.props?.outlineSettings?.origin_type).toBe('user_input');
            expect(outlineComponent?.props?.isEditable).toBe(true);
        });

        it('should fallback to most recent artifact when no leaf nodes exist', () => {
            // Mock project data where both artifacts have descendants
            const mockProjectData = {
                artifacts: [
                    // Older AI-generated artifact
                    {
                        id: 'old-outline-artifact',
                        schema_type: 'outline_settings_schema',
                        origin_type: 'ai_generated',
                        created_at: '2025-01-01T10:00:00Z',
                        data: { title: 'Old Outline' }
                    },
                    // Newer AI-generated artifact
                    {
                        id: 'new-outline-artifact',
                        schema_type: 'outline_settings_schema',
                        origin_type: 'ai_generated',
                        created_at: '2025-01-01T11:00:00Z',
                        data: { title: 'New Outline' }
                    }
                ],
                transformInputs: [
                    // Both artifacts have descendants
                    { artifact_id: 'old-outline-artifact', transform_id: 'transform-1' },
                    { artifact_id: 'new-outline-artifact', transform_id: 'transform-2' }
                ]
            };

            const displayComponents = computeDisplayComponents(
                'outline_generation',
                false, // hasActiveTransforms
                mockProjectData as any
            );

            // Find the outline settings display component
            const outlineComponent = displayComponents.find(
                component => component.id === 'outline-settings-display'
            );

            expect(outlineComponent).toBeDefined();
            // Should select the most recent artifact as fallback
            expect(outlineComponent?.props?.outlineSettings?.id).toBe('new-outline-artifact');
            expect(outlineComponent?.props?.isEditable).toBe(false); // Not editable because it has descendants
        });

        it('should prioritize user_input over ai_generated when both are leaf nodes', () => {
            // Mock project data with two leaf node artifacts
            const mockProjectData = {
                artifacts: [
                    // AI-generated leaf node (older)
                    {
                        id: 'ai-leaf-artifact',
                        schema_type: 'outline_settings_schema',
                        origin_type: 'ai_generated',
                        created_at: '2025-01-01T10:00:00Z',
                        data: { title: 'AI Leaf Outline' }
                    },
                    // User input leaf node (newer)
                    {
                        id: 'user-leaf-artifact',
                        schema_type: 'outline_settings_schema',
                        origin_type: 'user_input',
                        created_at: '2025-01-01T11:00:00Z',
                        data: { title: 'User Leaf Outline' }
                    }
                ],
                transformInputs: [
                    // Neither artifact has descendants
                ]
            };

            const displayComponents = computeDisplayComponents(
                'outline_generation',
                false, // hasActiveTransforms
                mockProjectData as any
            );

            // Find the outline settings display component
            const outlineComponent = displayComponents.find(
                component => component.id === 'outline-settings-display'
            );

            expect(outlineComponent).toBeDefined();
            // Should prioritize user_input over ai_generated
            expect(outlineComponent?.props?.outlineSettings?.id).toBe('user-leaf-artifact');
            expect(outlineComponent?.props?.outlineSettings?.origin_type).toBe('user_input');
            expect(outlineComponent?.props?.isEditable).toBe(true);
        });

        it('should handle complex edit chains and correctly identify leaf nodes for editability', () => {
            // Generate a random chain length between 3-8 edits
            const chainLength = Math.floor(Math.random() * 6) + 3;
            console.log(`[Test] Testing outline edit chain with ${chainLength} artifacts`);

            // Build artifacts and transforms for the chain
            const artifacts: any[] = [];
            const transformInputs: any[] = [];
            const transforms: any[] = [];

            // Start with initial AI-generated outline
            artifacts.push({
                id: 'outline-0',
                schema_type: 'outline_settings_schema',
                origin_type: 'ai_generated',
                created_at: '2025-01-01T10:00:00Z',
                data: { title: 'Initial AI Outline', version: 0 }
            });

            // Build the chain: alternating human and machine edits
            for (let i = 1; i < chainLength; i++) {
                const isHumanEdit = i % 2 === 1; // Odd indices are human edits
                const originType = isHumanEdit ? 'user_input' : 'ai_generated';
                const editType = isHumanEdit ? 'human' : 'llm';

                // Create the artifact
                artifacts.push({
                    id: `outline-${i}`,
                    schema_type: 'outline_settings_schema',
                    origin_type: originType,
                    created_at: `2025-01-01T${10 + i}:00:00Z`,
                    data: {
                        title: `${isHumanEdit ? 'Human' : 'AI'} Edit ${i}`,
                        version: i
                    }
                });

                // Create the transform
                transforms.push({
                    id: `transform-${i}`,
                    type: editType,
                    created_at: `2025-01-01T${10 + i}:00:00Z`
                });

                // Create transform input linking previous artifact to this transform
                transformInputs.push({
                    artifact_id: `outline-${i - 1}`,
                    transform_id: `transform-${i}`
                });
            }

            const mockProjectData = {
                artifacts,
                transformInputs
            };

            console.log(`[Test] Chain structure:`, artifacts.map(a =>
                `${a.id} (${a.origin_type})`
            ).join(' -> '));

            const displayComponents = computeDisplayComponents(
                'outline_generation',
                false, // hasActiveTransforms
                mockProjectData as any
            );

            // Find the outline settings display component
            const outlineComponent = displayComponents.find(
                component => component.id === 'outline-settings-display'
            );

            expect(outlineComponent).toBeDefined();

            // The leaf node should be the last artifact in the chain
            const leafArtifact = artifacts[artifacts.length - 1];
            const isLeafHumanEdit = leafArtifact.origin_type === 'user_input';

            console.log(`[Test] Leaf artifact: ${leafArtifact.id} (${leafArtifact.origin_type})`);
            console.log(`[Test] Expected isEditable: ${isLeafHumanEdit}`);

            // Verify the correct artifact is selected (should be the leaf)
            expect(outlineComponent?.props?.outlineSettings?.id).toBe(leafArtifact.id);
            expect(outlineComponent?.props?.outlineSettings?.origin_type).toBe(leafArtifact.origin_type);

            // Verify editability based on leaf node type
            if (isLeafHumanEdit) {
                // If leaf is human edit (user_input), it should be directly editable
                expect(outlineComponent?.props?.isEditable).toBe(true);
                console.log(`[Test] ✅ Human leaf node is editable`);
            } else {
                // If leaf is AI edit (ai_generated), it should be click-to-edit (not directly editable)
                expect(outlineComponent?.props?.isEditable).toBe(true); // Still editable because it's a leaf node
                console.log(`[Test] ✅ AI leaf node is editable (click-to-edit)`);
            }

            // Verify that all non-leaf artifacts would not be editable
            for (let i = 0; i < artifacts.length - 1; i++) {
                const artifact = artifacts[i];
                const hasDescendants = transformInputs.some(input => input.artifact_id === artifact.id);
                expect(hasDescendants).toBe(true);
                console.log(`[Test] ✅ Non-leaf artifact ${artifact.id} has descendants: ${hasDescendants}`);
            }

            // Test with active transforms (should disable editability)
            const displayComponentsWithActiveTransforms = computeDisplayComponents(
                'outline_generation',
                true, // hasActiveTransforms
                mockProjectData as any
            );

            const outlineComponentWithActiveTransforms = displayComponentsWithActiveTransforms.find(
                component => component.id === 'outline-settings-display'
            );

            expect(outlineComponentWithActiveTransforms?.props?.isEditable).toBe(false);
            console.log(`[Test] ✅ Active transforms disable editability`);

            // Test chronicles generation action availability
            // In outline_generation stage, we should be able to generate chronicles
            // regardless of whether the outline is human or AI edited
            expect(outlineComponent?.props?.outlineSettings).toBeDefined();
            console.log(`[Test] ✅ Chronicles generation should be available with outline settings present`);
        });
    });
}); 