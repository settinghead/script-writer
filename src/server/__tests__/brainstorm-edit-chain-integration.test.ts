import { describe, it, expect } from 'vitest';
import { buildLineageGraph, findLatestJsondoc, findMainWorkflowPath } from '../../common/transform-jsondoc-framework/lineageResolution';
import { computeActionsFromLineage } from '../../client/utils/lineageBasedActionComputation';
import type {
    ElectricJsondoc,
    ElectricTransform,
    ElectricHumanTransform,
    ElectricTransformInput,
    ElectricTransformOutput
} from '../../common/types';

describe('Brainstorm Edit Chain Integration Test', () => {
    it('should properly track lineage through a complete brainstorm edit chain', async () => {
        console.log('🚀 Starting brainstorm edit chain integration test...');

        // Test constants
        const projectId = 'test-project-1';

        // Step 1: Create initial 灵感创意 jsondoc
        const jsondocs: ElectricJsondoc[] = [
            {
                id: 'jsondoc-1',
                project_id: projectId,
                schema_type: '灵感创意',
                schema_version: 'v1',
                origin_type: 'user_input',
                data: JSON.stringify({
                    title: "误爱成宠",
                    body: "现代都市背景下，霸道总裁林慕琛因为一个误会将普通女孩夏栀误认为是富家千金，从而展开了一段充满误会与甜蜜的爱恋故事。"
                }),
                streaming_status: 'completed',
                created_at: '2024-01-01T10:00:00Z',
                updated_at: '2024-01-01T10:00:00Z',
            }
        ];

        console.log('✅ Step 1: Created initial 灵感创意 jsondoc:', jsondocs[0].id);

        // Step 2: LLM transform changes style
        const transforms: ElectricTransform[] = [
            {
                id: 'transform-1',
                project_id: projectId,
                type: 'llm',
                type_version: '1.0',
                status: 'completed',
                streaming_status: 'completed',
                retry_count: 0,
                max_retries: 3,
                created_at: '2024-01-01T10:05:00Z',
                updated_at: '2024-01-01T10:05:00Z',
                execution_context: JSON.stringify({
                    tool: 'brainstorm_edit',
                    derivation_path: '$'
                })
            }
        ];

        // Add edited jsondoc from LLM transform
        jsondocs.push({
            id: 'jsondoc-2',
            project_id: projectId,
            schema_type: '灵感创意',
            schema_version: 'v1',
            origin_type: 'ai_generated',
            data: JSON.stringify({
                title: "凤凰于飞",
                body: "古代宫廷背景下，聪明独立的女医师凤清羽与深藏不露的太子司马瑾因为一次医治事件相遇。她不依附权势，凭借医术和智慧在宫廷中立足，两人在相互尊重中发展出平等的感情。"
            }),
            streaming_status: 'completed',
            created_at: '2024-01-01T10:05:00Z',
            updated_at: '2024-01-01T10:05:00Z',
        });

        console.log('✅ Step 2: LLM transform created edited jsondoc:', jsondocs[1].id);

        // Step 3: Human transform for manual edits
        transforms.push({
            id: 'transform-2',
            project_id: projectId,
            type: 'human',
            type_version: '1.0',
            status: 'completed',
            streaming_status: 'completed',
            retry_count: 0,
            max_retries: 3,
            created_at: '2024-01-01T10:10:00Z',
            updated_at: '2024-01-01T10:10:00Z',
            execution_context: undefined
        });

        const humanTransforms: ElectricHumanTransform[] = [
            {
                transform_id: 'transform-2',
                project_id: projectId,
                action_type: 'manual_edit',
                interface_context: 'brainstorm_editor',
                change_description: '用户手动调整了角色设定和情节发展',
                source_jsondoc_id: 'jsondoc-2',
                derivation_path: '$',
                derived_jsondoc_id: 'jsondoc-3',
                transform_name: 'manual_character_adjustment'
            }
        ];

        // Add manually edited jsondoc
        jsondocs.push({
            id: 'jsondoc-3',
            project_id: projectId,
            schema_type: '灵感创意',
            schema_version: 'v1',
            origin_type: 'user_input',
            data: JSON.stringify({
                title: "凤凰于飞·医者仁心",
                body: "古代宫廷背景下，聪明独立的女医师凤清羽不仅医术精湛，更有着济世救人的仁者情怀。太子司马瑾因为一次意外中毒事件与她相遇，被她的医者风范和独立人格深深吸引。两人从医患关系发展为知己，最终在相互尊重和理解中结为伴侣。"
            }),
            streaming_status: 'completed',
            created_at: '2024-01-01T10:10:00Z',
            updated_at: '2024-01-01T10:10:00Z',
        });

        console.log('✅ Step 3: Human transform created manually edited jsondoc:', jsondocs[2].id);

        // Step 4: Second LLM transform extends the story
        transforms.push({
            id: 'transform-3',
            project_id: projectId,
            type: 'llm',
            type_version: '1.0',
            status: 'completed',
            streaming_status: 'completed',
            retry_count: 0,
            max_retries: 3,
            created_at: '2024-01-01T10:15:00Z',
            updated_at: '2024-01-01T10:15:00Z',
            execution_context: JSON.stringify({
                tool: 'brainstorm_edit',
                derivation_path: '$'
            })
        });

        // Add final extended jsondoc
        jsondocs.push({
            id: 'jsondoc-4',
            project_id: projectId,
            schema_type: '灵感创意',
            schema_version: 'v1',
            origin_type: 'ai_generated',
            data: JSON.stringify({
                title: "凤凰于飞·医者仁心（完整版）",
                body: "古代宫廷背景下，聪明独立的女医师凤清羽不仅医术精湛，更有着济世救人的仁者情怀。太子司马瑾因为一次意外中毒事件与她相遇，被她的医者风范和独立人格深深吸引。故事展现了两人从初次相遇的戒备，到医患关系的建立，再到相互欣赏的知己情谊，最终发展为平等相爱的伴侣关系。期间穿插了宫廷斗争、医者救人的紧张情节，以及两人在价值观念上的碰撞与融合，体现了去脸谱化的现代价值观在古装背景下的精彩演绎。"
            }),
            streaming_status: 'completed',
            created_at: '2024-01-01T10:15:00Z',
            updated_at: '2024-01-01T10:15:00Z',
        });

        console.log('✅ Step 4: Second LLM transform created extended jsondoc:', jsondocs[3].id);

        // Step 5: Create transform inputs and outputs to link the chain
        const transformInputs: ElectricTransformInput[] = [
            {
                id: 1,
                project_id: projectId,
                transform_id: 'transform-1',
                jsondoc_id: 'jsondoc-1',
                input_role: 'source'
            },
            {
                id: 2,
                project_id: projectId,
                transform_id: 'transform-2',
                jsondoc_id: 'jsondoc-2',
                input_role: 'source'
            },
            {
                id: 3,
                project_id: projectId,
                transform_id: 'transform-3',
                jsondoc_id: 'jsondoc-3',
                input_role: 'source'
            }
        ];

        const transformOutputs: ElectricTransformOutput[] = [
            {
                id: 1,
                project_id: projectId,
                transform_id: 'transform-1',
                jsondoc_id: 'jsondoc-2',
                output_role: 'result'
            },
            {
                id: 2,
                project_id: projectId,
                transform_id: 'transform-2',
                jsondoc_id: 'jsondoc-3',
                output_role: 'result'
            },
            {
                id: 3,
                project_id: projectId,
                transform_id: 'transform-3',
                jsondoc_id: 'jsondoc-4',
                output_role: 'result'
            }
        ];

        console.log('✅ Step 5: Created transform input/output linkages');

        // Step 6: Build lineage graph and verify structure
        const lineageGraph = buildLineageGraph(
            jsondocs,
            transforms,
            humanTransforms,
            transformInputs,
            transformOutputs
        );

        // Verify lineage graph structure
        expect(lineageGraph.nodes.size).toBe(7); // 4 jsondocs + 3 transforms
        expect(lineageGraph.paths.size).toBeGreaterThan(0);

        console.log('✅ Step 6: Built lineage graph with', lineageGraph.nodes.size, 'nodes');

        // Step 7: Test lineage resolution functions
        const latestJsondocResult = findLatestJsondoc('jsondoc-1', '$', lineageGraph, jsondocs);
        expect(latestJsondocResult.jsondocId).toBe('jsondoc-4');

        const mainPath = findMainWorkflowPath(jsondocs, lineageGraph);
        expect(mainPath).toBeDefined();
        expect(mainPath.length).toBeGreaterThan(0);

        console.log('✅ Step 7: Verified lineage resolution - latest jsondoc:', latestJsondocResult.jsondocId);

        // Step 8: Test action computation
        const availableActions = computeActionsFromLineage(
            lineageGraph,
            jsondocs,
            transforms,
            humanTransforms,
            transformInputs,
            transformOutputs
        );

        expect(availableActions).toBeDefined();
        expect(typeof availableActions === 'object').toBe(true);
        expect(availableActions.actions).toBeDefined();
        expect(Array.isArray(availableActions.actions)).toBe(true);

        console.log('✅ Step 8: Computed available actions:', availableActions.actions.length, 'actions');

        // Step 9: Verify the complete jsondoc chain
        const sortedJsondocs = jsondocs
            .filter(a => a.schema_type === '灵感创意')
            .sort((a, b) => a.created_at.localeCompare(b.created_at));

        expect(sortedJsondocs).toHaveLength(4);
        expect(sortedJsondocs[0].id).toBe('jsondoc-1');
        expect(sortedJsondocs[3].id).toBe('jsondoc-4');

        // Verify transform types in sequence
        const sortedTransforms = transforms.sort((a, b) => a.created_at.localeCompare(b.created_at));
        expect(sortedTransforms[0].type).toBe('llm');
        expect(sortedTransforms[1].type).toBe('human');
        expect(sortedTransforms[2].type).toBe('llm');

        console.log('✅ Step 9: Verified complete jsondoc chain');

        // Step 10: Test lineage graph node relationships
        const jsondoc1Node = lineageGraph.nodes.get('jsondoc-1');
        const jsondoc4Node = lineageGraph.nodes.get('jsondoc-4');

        expect(jsondoc1Node?.type).toBe('jsondoc');
        expect(jsondoc4Node?.type).toBe('jsondoc');

        if (jsondoc1Node?.type === 'jsondoc' && jsondoc4Node?.type === 'jsondoc') {
            expect(jsondoc1Node.sourceTransform).toBe('none'); // Root jsondoc
            expect(jsondoc4Node.sourceTransform).not.toBe('none'); // Has source transform
        }

        console.log('✅ Step 10: Verified lineage graph node relationships');

        // Final verification: Display complete chain summary
        console.log('🎉 Integration test completed successfully!');
        console.log('📊 Summary:');
        console.log('  - Jsondocs created:', jsondocs.length);
        console.log('  - Transforms executed:', transforms.length);
        console.log('  - Human transforms:', humanTransforms.length);
        console.log('  - Lineage nodes:', lineageGraph.nodes.size);
        console.log('  - Available actions:', availableActions.actions.length);

        console.log('🔗 Jsondoc Chain:');
        sortedJsondocs.forEach((jsondoc, index) => {
            const data = JSON.parse(jsondoc.data);
            console.log(`  ${index + 1}. ${jsondoc.id} (${jsondoc.origin_type}): "${data.title}"`);
        });

        console.log('⚡ Transform Sequence:');
        sortedTransforms.forEach((transform, index) => {
            console.log(`  ${index + 1}. ${transform.id} (${transform.type})`);
        });

        // Step 11: Test UI display logic for SingleBrainstormIdeaEditor
        console.log('✅ Step 11: Testing UI display logic...');

        // Test case 1: AI-generated jsondoc with no descendants (canBecomeEditable = true)
        const aiGeneratedNoDescendants = jsondocs.find(a => a.id === 'jsondoc-4');
        expect(aiGeneratedNoDescendants?.origin_type).toBe('ai_generated');
        const jsondoc4HasDescendants = transformInputs.some(input => input.jsondoc_id === 'jsondoc-4');
        expect(jsondoc4HasDescendants).toBe(false); // Should be clickable to edit
        console.log('  - AI-generated jsondoc (jsondoc-4): canBecomeEditable = true');

        // Test case 2: User-input jsondoc with no descendants (isEditable = true)
        const userInputNoDescendants = jsondocs.find(a => a.id === 'jsondoc-3');
        expect(userInputNoDescendants?.origin_type).toBe('user_input');
        const jsondoc3HasDescendants = transformInputs.some(input => input.jsondoc_id === 'jsondoc-3');
        expect(jsondoc3HasDescendants).toBe(true); // Has descendants, not editable
        console.log('  - User-input jsondoc (jsondoc-3): has descendants, read-only');

        // Test case 3: AI-generated jsondoc with descendants (read-only)
        const aiGeneratedWithDescendants = jsondocs.find(a => a.id === 'jsondoc-2');
        expect(aiGeneratedWithDescendants?.origin_type).toBe('ai_generated');
        const jsondoc2HasDescendants = transformInputs.some(input => input.jsondoc_id === 'jsondoc-2');
        expect(jsondoc2HasDescendants).toBe(true); // Has descendants, read-only
        console.log('  - AI-generated jsondoc (jsondoc-2): has descendants, read-only');

        // Test case 4: Initial jsondoc with descendants (read-only)
        const initialJsondoc = jsondocs.find(a => a.id === 'jsondoc-1');
        expect(initialJsondoc?.origin_type).toBe('user_input');
        const jsondoc1HasDescendants = transformInputs.some(input => input.jsondoc_id === 'jsondoc-1');
        expect(jsondoc1HasDescendants).toBe(true); // Has descendants, read-only
        console.log('  - Initial jsondoc (jsondoc-1): has descendants, read-only');

        // Verify UI state logic
        const uiStates = jsondocs.map(jsondoc => {
            const hasDescendants = transformInputs.some(input => input.jsondoc_id === jsondoc.id);
            const isEditable = jsondoc.origin_type === 'user_input' && !hasDescendants;
            const canBecomeEditable = jsondoc.origin_type === 'ai_generated' && !hasDescendants;
            const isReadOnly = hasDescendants;

            return {
                jsondocId: jsondoc.id,
                originType: jsondoc.origin_type,
                hasDescendants,
                isEditable,
                canBecomeEditable,
                isReadOnly,
                displayMode: isEditable ? 'editable' : canBecomeEditable ? 'clickable' : 'readonly'
            };
        });

        console.log('  - UI States:');
        uiStates.forEach(state => {
            console.log(`    ${state.jsondocId}: ${state.displayMode} (${state.originType})`);
        });

        // Verify the chain shows the correct progression
        expect(uiStates[0].displayMode).toBe('readonly'); // jsondoc-1: initial, has descendants
        expect(uiStates[1].displayMode).toBe('readonly'); // jsondoc-2: AI-generated, has descendants  
        expect(uiStates[2].displayMode).toBe('readonly'); // jsondoc-3: user-input, has descendants
        expect(uiStates[3].displayMode).toBe('clickable'); // jsondoc-4: AI-generated, no descendants

        // Step 12: Test actual display component computation
        console.log('✅ Step 12: Testing display component computation...');

        // Import the unified workflow computation function
        const { computeUnifiedWorkflowState } = await import('../../client/utils/actionComputation.js');

        // Create mock project data context with minimal required properties
        const mockProjectData = {
            jsondocs,
            transforms,
            humanTransforms,
            transformInputs,
            transformOutputs,
            lineageGraph, // Add the lineage graph that was built earlier
            isLoading: false,
            isError: false,
            error: null
        } as any; // Type cast to avoid missing properties for test

        // Test current stage detection using the unified workflow system
        const workflowState = computeUnifiedWorkflowState(mockProjectData, 'test-project');
        // Remove expect(workflowState.parameters.currentStage).toBe('idea_editing');
        // Add assertions on workflowState.displayComponents, e.g. expect to find 'single-idea-editor' with editable mode

        // Test brainstorm idea jsondocs detection
        const brainstormIdeas = jsondocs.filter(a =>
            a.schema_type === '灵感创意'
        );
        console.log(`  - Found ${brainstormIdeas.length} brainstorm ideas`);
        expect(brainstormIdeas).toHaveLength(4);

        // Test chosen brainstorm idea detection (leaf node without descendants)
        const chosenIdea = brainstormIdeas.find(idea => {
            const hasDescendants = transformInputs.some(input => input.jsondoc_id === idea.id);
            return !hasDescendants;
        });
        console.log(`  - Chosen idea: ${chosenIdea?.id || 'none'}`);
        expect(chosenIdea).toBeTruthy();
        expect(chosenIdea?.id).toBe('jsondoc-4'); // Latest jsondoc with no descendants

        // Test display components computation
        const displayComponents = workflowState.displayComponents;
        console.log(`  - Generated ${displayComponents.length} display components`);

        // Verify that SingleBrainstormIdeaEditor is included
        const singleIdeaEditor = displayComponents.find((component: any) =>
            component.id === 'single-idea-editor'
        );
        expect(singleIdeaEditor).toBeTruthy();
        expect(singleIdeaEditor?.mode).toBe('editable');
        expect(singleIdeaEditor?.props.brainstormIdea).toBeTruthy();
        expect(singleIdeaEditor?.props.brainstormIdea.id).toBe('jsondoc-4');

        // Verify that ProjectBrainstormPage is NOT included in manual path idea_editing stage
        const brainstormPage = displayComponents.find((component: any) =>
            component.id === 'idea-colletion'
        );
        expect(brainstormPage).toBeFalsy(); // Should NOT be present in manual path

        // Verify other expected components
        const brainstormInputEditor = displayComponents.find((component: any) =>
            component.id === 'brainstorm-input-editor'
        );
        // Note: brainstorm-input-editor should NOT be present in manual path (no brainstorm_input_params)
        expect(brainstormInputEditor).toBeFalsy(); // Should NOT be present in manual path

        console.log('  - Display components:');
        displayComponents.forEach((component: any) => {
            console.log(`    ${component.id}: ${component.mode} (priority: ${component.priority})`);
        });

        // This should catch the bug where SingleBrainstormIdeaEditor is not showing
        expect(displayComponents.length).toBeGreaterThan(0);
        expect(singleIdeaEditor).toBeDefined();

        console.log('✅ Step 12: Display component computation verified');

        // Step 13: Test active transforms disable editability
        console.log('✅ Step 13: Testing active transforms disable editability...');

        // Create a mock with running transforms
        const mockProjectDataWithActiveTransforms = {
            ...mockProjectData,
            transforms: [
                ...transforms,
                {
                    id: 'active-transform',
                    type: 'llm',
                    status: 'running',
                    created_at: new Date().toISOString(),
                    project_id: 'test-project',
                    transform_name: 'test-transform',
                    user_id: 'test-user',
                    updated_at: new Date().toISOString()
                }
            ]
        };

        // Test that hasActiveTransforms is correctly detected
        const activeTransformWorkflowState = computeUnifiedWorkflowState(mockProjectDataWithActiveTransforms, 'test-project');
        console.log(`  - hasActiveTransforms: ${activeTransformWorkflowState.parameters.hasActiveTransforms}`);
        expect(activeTransformWorkflowState.parameters.hasActiveTransforms).toBe(true);

        // Test that display components reflect the disabled state
        const activeTransformComponents = activeTransformWorkflowState.displayComponents;

        const disabledSingleIdeaEditor = activeTransformComponents.find((component: any) =>
            component.id === 'single-idea-editor'
        );
        expect(disabledSingleIdeaEditor).toBeTruthy();
        expect(disabledSingleIdeaEditor?.props.isEditable).toBe(false); // Should be disabled

        console.log('  - Component isEditable when transforms active:', disabledSingleIdeaEditor?.props.isEditable);
        console.log('✅ Step 13: Active transforms correctly disable editability');

        // Assert final expectations
        expect(jsondocs).toHaveLength(4);
        expect(transforms).toHaveLength(3);
        expect(humanTransforms).toHaveLength(1);
        expect(lineageGraph.nodes.size).toBe(7);
        expect(latestJsondocResult.jsondocId).toBe('jsondoc-4');
        expect(displayComponents.length).toBeGreaterThan(0);
        expect(singleIdeaEditor).toBeDefined();
    });
}); 