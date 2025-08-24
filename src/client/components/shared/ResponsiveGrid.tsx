import React from 'react';
import { Grid } from 'antd';

interface ResponsiveGridProps {
    children: React.ReactNode;
    minItemWidth?: number; // px
    mobileMinItemWidth?: number; // px
    mobileColumns?: number; // force columns on mobile if provided
    desktopColumns?: number; // force columns on desktop if provided
    gap?: number; // px
    center?: boolean;
    style?: React.CSSProperties;
    maxWidth?: number | string;
    paddingX?: number; // px
}

// Generic responsive grid that stacks to single column on mobile
const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
    children,
    minItemWidth = 280,
    mobileMinItemWidth = 160,
    mobileColumns,
    desktopColumns,
    gap = 16,
    center = true,
    style,
    maxWidth,
    paddingX = 16,
}) => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.md;

    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: isMobile
                    ? (mobileColumns ? `repeat(${mobileColumns}, minmax(0, 1fr))` : `repeat(auto-fit, minmax(${mobileMinItemWidth}px, 1fr))`)
                    : (desktopColumns ? `repeat(${desktopColumns}, minmax(0, 1fr))` : `repeat(auto-fit, minmax(${minItemWidth}px, 1fr))`),
                gap: `${gap}px`,
                width: '100%',
                maxWidth: maxWidth ?? '100%',
                margin: center ? '0 auto' : undefined,
                padding: isMobile ? `0 ${paddingX}px` : 0,
                boxSizing: 'border-box',
                justifyItems: 'stretch',
                ...style,
            }}
        >
            {children}
        </div>
    );
};

export default ResponsiveGrid;


