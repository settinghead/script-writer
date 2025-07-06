import React, { useMemo } from 'react';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useLineageResolution } from '../../transform-artifact-framework/useLineageResolution';
import { TextDivider } from '../TextDivider';

// Define the schema types enum
export enum ArtifactSchemaType {
    BRAINSTORM_COLLECTION = 'brainstorm_collection_schema',
    BRAINSTORM_ITEM = 'brainstorm_item_schema',
    OUTLINE_SETTINGS = 'outline_settings_schema',
    CHRONICLES = 'chronicles_schema',
    SCRIPT = 'script_schema',
    USER_INPUT = 'user_input_schema'
}

interface SectionWrapperProps {
    schemaType: ArtifactSchemaType;
    title: React.ReactNode;
    children: React.ReactNode;
    sectionId?: string;
    // Optional override for artifact resolution
    artifactId?: string;
    // Optional override for mode detection
    mode?: 'normal' | 'loading' | 'failed';
}

export const SectionWrapper: React.FC<SectionWrapperProps> = ({
    schemaType,
    title,
    children,
    sectionId,
    artifactId,
    mode: overrideMode
}) => {
    const projectData = useProjectData();

    // Find the deepest/latest artifact of the specified schema type
    const latestArtifact = useMemo(() => {
        if (artifactId) {
            // Use provided artifact ID
            return projectData.getArtifactById(artifactId);
        }

        // Find all artifacts of the specified schema type
        const matchingArtifacts = projectData.artifacts.filter(artifact =>
            artifact.schema_type === schemaType
        );

        if (matchingArtifacts.length === 0) {
            return null;
        }

        // For each artifact, check if it has descendants (is used as input to other transforms)
        const artifactsWithDescendantInfo = matchingArtifacts.map(artifact => {
            const hasDescendants = projectData.transformInputs.some(input =>
                input.artifact_id === artifact.id
            );
            return { artifact, hasDescendants };
        });

        // Prefer leaf nodes (no descendants) as they represent the latest version
        const leafArtifacts = artifactsWithDescendantInfo.filter(item => !item.hasDescendants);

        if (leafArtifacts.length > 0) {
            // Sort leaf artifacts by creation date (most recent first)
            leafArtifacts.sort((a, b) =>
                new Date(b.artifact.created_at).getTime() - new Date(a.artifact.created_at).getTime()
            );
            return leafArtifacts[0].artifact;
        }

        // If no leaf artifacts, use the most recent artifact
        matchingArtifacts.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        return matchingArtifacts[0];
    }, [schemaType, artifactId, projectData.artifacts, projectData.transformInputs, projectData.getArtifactById]);

    // Determine the mode based on transform status
    const detectedMode = useMemo(() => {
        if (overrideMode) {
            return overrideMode;
        }

        if (!latestArtifact) {
            // No artifact exists, check if there's a running transform that would produce this type
            const runningTransforms = projectData.transforms.filter(transform =>
                transform.status === 'running' || transform.status === 'pending'
            );

            // Check if any running transform would produce this schema type
            const hasRunningTransformForType = runningTransforms.some(transform => {
                const outputs = projectData.transformOutputs.filter(output =>
                    output.transform_id === transform.id
                );
                return outputs.some(output => {
                    const outputArtifact = projectData.getArtifactById(output.artifact_id);
                    return outputArtifact?.schema_type === schemaType;
                });
            });

            if (hasRunningTransformForType) {
                return 'loading';
            }

            // Check if there are any failed transforms that should have produced this type
            const failedTransforms = projectData.transforms.filter(transform =>
                transform.status === 'failed'
            );

            const hasFailedTransformForType = failedTransforms.some(transform => {
                // For failed transforms, we need to check the intended output type
                // This is a bit tricky since failed transforms might not have outputs
                // We'll use a heuristic based on transform names and types
                const transformName = transform.transform_name;
                if (typeof transformName === 'string') {
                    return transformName.includes(schemaType.replace('_schema', '')) ||
                        transformName.includes(schemaType.split('_')[0]);
                }
                return false;
            });

            if (hasFailedTransformForType) {
                return 'failed';
            }

            return 'normal';
        }

        // Artifact exists, check the transform that created it
        const creatingTransformOutput = projectData.transformOutputs.find(output =>
            output.artifact_id === latestArtifact.id
        );

        if (creatingTransformOutput) {
            const creatingTransform = projectData.transforms.find(transform =>
                transform.id === creatingTransformOutput.transform_id
            );

            if (creatingTransform) {
                switch (creatingTransform.status) {
                    case 'running':
                    case 'pending':
                        return 'loading';
                    case 'failed':
                        return 'failed';
                    default:
                        return 'normal';
                }
            }
        }

        // Check if there are any running transforms that use this artifact as input
        // (indicating an update/edit is in progress)
        const runningTransformsUsingArtifact = projectData.transforms.filter(transform => {
            if (transform.status !== 'running' && transform.status !== 'pending') {
                return false;
            }

            const inputs = projectData.transformInputs.filter(input =>
                input.transform_id === transform.id
            );
            return inputs.some(input => input.artifact_id === latestArtifact.id);
        });

        if (runningTransformsUsingArtifact.length > 0) {
            return 'loading';
        }

        return 'normal';
    }, [overrideMode, latestArtifact, projectData.transforms, projectData.transformOutputs, projectData.transformInputs, projectData.getArtifactById, schemaType]);

    // Generate section ID
    const finalSectionId = sectionId || `section-${schemaType.replace('_schema', '').replace('_', '-')}`;

    // Convert title to string for TextDivider
    const titleString = typeof title === 'string' ? title : finalSectionId;

    return (
        <>
            <TextDivider
                title={titleString}
                id={finalSectionId}
                mode={detectedMode}
            />
            <section id={finalSectionId}>
                {children}
            </section>
        </>
    );
}; 