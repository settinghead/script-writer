import React, { useMemo } from 'react';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { TypedJsondoc } from '@/common/types';


interface SectionWrapperProps {
    schemaType: TypedJsondoc['schema_type'];
    title: React.ReactNode;
    children: React.ReactNode;
    sectionId?: string;
    // Optional override for jsondoc resolution
    jsondocId?: string;
    // Optional override for mode detection
    mode?: 'normal' | 'loading' | 'failed';
}

export const SectionWrapper: React.FC<SectionWrapperProps> = ({
    schemaType,
    title,
    children,
    sectionId,
    jsondocId,
    mode: overrideMode
}) => {
    const projectData = useProjectData();
    const jsondocs = projectData.jsondocs;
    const transforms = projectData.transforms;
    const transformInputs = projectData.transformInputs;
    const transformOutputs = projectData.transformOutputs;
    const getJsondocById = projectData.getJsondocById;

    // Find the deepest/latest jsondoc of the specified schema type
    const latestJsondoc = useMemo(() => {
        if (jsondocs === "pending" || jsondocs === "error" || transformInputs === "pending" || transformInputs === "error" || transformOutputs === "pending" || transformOutputs === "error") {
            return null;
        }

        if (jsondocId) {
            // Use provided jsondoc ID
            const foundJsondoc = getJsondocById(jsondocId);
            return foundJsondoc;
        }

        // Find all jsondocs of the specified schema type
        const matchingJsondocs = jsondocs.filter(jsondoc =>
            jsondoc.schema_type === schemaType
        );

        if (matchingJsondocs.length === 0) {
            return null;
        }

        // For each jsondoc, check if it has descendants (is used as input to other transforms)
        const jsondocsWithDescendantInfo = matchingJsondocs.map(jsondoc => {
            const hasDescendants = transformInputs.some(input =>
                input.jsondoc_id === jsondoc.id
            );
            return { jsondoc, hasDescendants };
        });

        // Prefer leaf nodes (no descendants) as they represent the latest version
        const leafJsondocs = jsondocsWithDescendantInfo.filter(item => !item.hasDescendants);

        if (leafJsondocs.length > 0) {
            // Sort leaf jsondocs by creation date (most recent first)
            leafJsondocs.sort((a, b) =>
                new Date(b.jsondoc.created_at).getTime() - new Date(a.jsondoc.created_at).getTime()
            );
            return leafJsondocs[0].jsondoc;
        }

        // If no leaf jsondocs, use the most recent jsondoc
        matchingJsondocs.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        return matchingJsondocs[0];
    }, [schemaType, jsondocId, jsondocs, transformInputs, getJsondocById]);

    // Determine the mode based on transform status
    const detectedMode = useMemo(() => {
        if (overrideMode) {
            return overrideMode;
        }

        if (!latestJsondoc) {
            // No jsondoc exists, check if there's a running transform that would produce this type
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
                    const outputJsondoc = getJsondocById(output.jsondoc_id);
                    return outputJsondoc?.schema_type === schemaType;
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

        // Jsondoc exists, check the transform that created it
        const creatingTransformOutput = transformOutputs.find(output =>
            output.jsondoc_id === latestJsondoc.id
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

        // Check if there are any running transforms that use this jsondoc as input
        // (indicating an update/edit is in progress)
        const runningTransformsUsingJsondoc = transforms.filter(transform => {
            if (transform.status !== 'running' && transform.status !== 'pending') {
                return false;
            }

            if (transformInputs === "pending" || transformInputs === "error") {
                return false;
            }

            const inputs = transformInputs.filter(input =>
                input.transform_id === transform.id
            );
            return inputs.some(input => input.jsondoc_id === latestJsondoc.id);
        });

        if (runningTransformsUsingJsondoc.length > 0) {
            return 'loading';
        }

        return 'normal';
    }, [overrideMode, latestJsondoc, transforms, transformOutputs, transformInputs, getJsondocById, schemaType]);

    // Generate section ID
    const finalSectionId = sectionId || `section-${schemaType.replace('_schema', '').replace('_', '-')}`;

    // Convert title to string for TextDivider
    const titleString = typeof title === 'string' ? title : finalSectionId;

    return (
        <>
            {/* CSS for smooth moving linear gradient animation */}
            <style>{`
                @keyframes moving-gradient {
                    0% { background-position: -800px 0; }
                    100% { background-position: 800px 0; }
                }
                .gradient-section {
                    /* Darker purple-tinted background for better contrast */
                    background-color: rgba(26, 16, 51, 1); /* darker, more purple base */
                    /* Gradient that tiles seamlessly - purple at edges and middle */
                    background-image: linear-gradient(
                        90deg,
                        rgba(139, 69, 255, 0.25) 0%,
                        rgba(139, 69, 255, 0.15) 12.5%,
                        rgba(139, 69, 255, 0) 25%,
                        rgba(139, 69, 255, 0) 37.5%,
                        rgba(139, 69, 255, 0.15) 50%,
                        rgba(139, 69, 255, 0.25) 62.5%,
                        rgba(139, 69, 255, 0.15) 75%,
                        rgba(139, 69, 255, 0) 87.5%,
                        rgba(139, 69, 255, 0.25) 100%
                    );
                    background-size: 800px 100%;
                    animation: moving-gradient 6s linear infinite;
                    will-change: background-position;
                }
            `}</style>

            <SectionTitle
                title={titleString}
                id={finalSectionId}
                mode={detectedMode}
            />
            <section
                id={finalSectionId}
                className={detectedMode === 'loading' ? 'gradient-section' : undefined}
                style={{ transition: 'background-position 0.3s ease' }}
            >
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
                    margin: '0px 0',
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
