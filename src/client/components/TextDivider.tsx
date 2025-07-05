import React from 'react';

export const TextDivider = ({ title, id }: { title: string; id: string; }) => {
    return (
        <div
            id={id}
            style={{
                margin: '10px 0',
                padding: '10px 0',
                borderTop: '2px solidrgb(16, 83, 146)',
                borderBottom: '2px solidrgb(18, 85, 147)',
                background: `
                linear-gradient(135deg, 
                    rgb(0, 49, 94) 25%, transparent 25%, 
                    transparent 50%,rgb(0, 49, 94) 50%, 
                    rgb(0, 49, 94) 75%, transparent 75%, transparent
                ),
                linear-gradient(135deg,rgb(16, 26, 34) 0%,rgb(29, 39, 61) 50%,rgb(17, 25, 35) 100%)
            `,
                backgroundSize: '120px 120px, 100% 100%',
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#fff',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                textAlign: 'center'
            }}>
            {title}
        </div>
    );
};
