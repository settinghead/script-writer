import React, { useMemo } from 'react';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useLineageResolution } from '../../transform-artifact-framework/useLineageResolution';

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
    const artifacts = projectData.artifacts;
    const transforms = projectData.transforms;
    const transformInputs = projectData.transformInputs;
    const transformOutputs = projectData.transformOutputs;
    const getArtifactById = projectData.getArtifactById;

    // Find the deepest/latest artifact of the specified schema type
    const latestArtifact = useMemo(() => {
        if (artifacts === "pending" || artifacts === "error" || transformInputs === "pending" || transformInputs === "error" || transformOutputs === "pending" || transformOutputs === "error") {
            return null;
        }

        if (artifactId) {
            // Use provided artifact ID
            return getArtifactById(artifactId);
        }

        // Find all artifacts of the specified schema type
        const matchingArtifacts = artifacts.filter(artifact =>
            artifact.schema_type === schemaType
        );

        if (matchingArtifacts.length === 0) {
            return null;
        }

        // For each artifact, check if it has descendants (is used as input to other transforms)
        const artifactsWithDescendantInfo = matchingArtifacts.map(artifact => {
            const hasDescendants = transformInputs.some(input =>
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
    }, [schemaType, artifactId, artifacts, transformInputs, getArtifactById]);

    // Determine the mode based on transform status
    const detectedMode = useMemo(() => {
        if (overrideMode) {
            return overrideMode;
        }

        if (!latestArtifact) {
            // No artifact exists, check if there's a running transform that would produce this type
            if (transforms === "pending" || transforms === "error") {
                return 'loading';
            }
            const runningTransforms = transforms.filter(transform =>
                transform.status === 'running' || transform.status === 'pending'
            );

            // Check if any running transform would produce this schema type
            const hasRunningTransformForType = runningTransforms.some(transform => {
                if (transformOutputs === "pending" || transformOutputs === "error") {
                    return false;
                }
                const outputs = transformOutputs.filter(output =>
                    output.transform_id === transform.id
                );
                return outputs.some(output => {
                    const outputArtifact = getArtifactById(output.artifact_id);
                    return outputArtifact?.schema_type === schemaType;
                });
            });

            if (hasRunningTransformForType) {
                return 'loading';
            }


            const failedTransforms = transforms.filter(transform =>
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

        if (transforms === "pending" || transforms === "error" || transformOutputs === "pending" || transformOutputs === "error") {
            return 'loading';
        }

        // Artifact exists, check the transform that created it
        const creatingTransformOutput = transformOutputs.find(output =>
            output.artifact_id === latestArtifact.id
        );

        if (creatingTransformOutput) {
            const creatingTransform = transforms.find(transform =>
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
        const runningTransformsUsingArtifact = transforms.filter(transform => {
            if (transform.status !== 'running' && transform.status !== 'pending') {
                return false;
            }

            if (transformInputs === "pending" || transformInputs === "error") {
                return false;
            }

            const inputs = transformInputs.filter(input =>
                input.transform_id === transform.id
            );
            return inputs.some(input => input.artifact_id === latestArtifact.id);
        });

        if (runningTransformsUsingArtifact.length > 0) {
            return 'loading';
        }

        return 'normal';
    }, [overrideMode, latestArtifact, transforms, transformOutputs, transformInputs, getArtifactById, schemaType]);

    // Generate section ID
    const finalSectionId = sectionId || `section-${schemaType.replace('_schema', '').replace('_', '-')}`;

    // Convert title to string for TextDivider
    const titleString = typeof title === 'string' ? title : finalSectionId;

    return (
        <>
            <SectionTitle
                title={titleString}
                id={finalSectionId}
                mode={detectedMode}
            />
            <section id={finalSectionId}>
                {children}
            </section>
        </>
    );
}; export const SectionTitle = ({
    title, id, mode
}: {
    title: string;
    id: string;
    mode: "normal" | "loading" | "failed";
}) => {
    const isLoading = mode === "loading";
    const isFailed = mode === "failed";
    const animationId = `moveStripes-${id}`;

    // Color schemes for different modes
    const getColorScheme = () => {
        if (isFailed) {
            return {
                borderTop: '2px solid rgb(255, 77, 79)',
                borderBottom: '2px solid rgb(255, 77, 79)',
                background: `
                    linear-gradient(135deg, 
                        rgb(139, 0, 0) 25%, transparent 25%, 
                        transparent 50%, rgb(139, 0, 0) 50%, 
                        rgb(139, 0, 0) 75%, transparent 75%, transparent
                    ),
                    linear-gradient(135deg, rgb(60, 20, 20) 0%, rgb(80, 30, 30) 50%, rgb(60, 20, 20) 100%)
                `,
                color: '#ff4d4f'
            };
        }

        return {
            borderTop: '2px solid rgb(16, 83, 146)',
            borderBottom: '2px solid rgb(18, 85, 147)',
            background: `
                linear-gradient(135deg, 
                    rgb(0, 49, 94) 25%, transparent 25%, 
                    transparent 50%, rgb(0, 49, 94) 50%, 
                    rgb(0, 49, 94) 75%, transparent 75%, transparent
                ),
                linear-gradient(135deg, rgb(16, 26, 34) 0%, rgb(29, 39, 61) 50%, rgb(17, 25, 35) 100%)
            `,
            color: '#fff'
        };
    };

    const colorScheme = getColorScheme();

    return (
        <>
            {isLoading && (
                <style>
                    {`
                        @keyframes ${animationId} {
                            0% {
                                background-position: 0 0, 0 0;
                            }
                            100% {
                                background-position: 120px 0, 0 0;
                            }
                        }
                    `}
                </style>
            )}
            <div
                id={id}
                style={{
                    margin: '10px 0',
                    padding: '10px 0',
                    borderTop: colorScheme.borderTop,
                    borderBottom: colorScheme.borderBottom,
                    background: colorScheme.background,
                    backgroundSize: '120px 120px, 100% 100%',
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: colorScheme.color,
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                    textAlign: 'center',
                    ...(isLoading && {
                        animation: `${animationId} 1.5s linear infinite`,
                    }),
                    ...(isFailed && {
                        position: 'relative' as const,
                    })
                }}>
                {isFailed && '⚠️ '}{title}
            </div>
        </>
    );
};
