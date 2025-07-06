import React from 'react';

export const TextDivider = ({
    title,
    id,
    mode
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
