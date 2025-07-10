import React, { CSSProperties } from 'react';
import { Button, ButtonProps } from 'antd';
import { Cpu } from 'iconoir-react';
import { AppColors } from '../../../common/theme/colors';

interface AIButtonProps extends Omit<ButtonProps, 'variant' | 'icon'> {
    aiVariant?: 'primary' | 'secondary';
    animated?: boolean;
    children: React.ReactNode;
    showIcon?: boolean;
}

const AIButton: React.FC<AIButtonProps> = ({
    aiVariant = 'primary',
    animated = true,
    showIcon = true,
    children,
    style,
    ...props
}) => {
    const baseStyle: CSSProperties = {
        border: 'none',
        borderRadius: '12px',
        fontWeight: 500,
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
        ...style
    };

    const primaryStyle: CSSProperties = {
        ...baseStyle,
        background: animated ? AppColors.ai.gradientAnimated : AppColors.ai.gradient,
        backgroundSize: animated ? '200% 200%' : '100% 100%',
        backgroundPosition: '0% 50%',
        boxShadow: `0 4px 12px ${AppColors.ai.shadow}`,
        color: AppColors.text.white,
    };

    const secondaryStyle: CSSProperties = {
        ...baseStyle,
        background: AppColors.ai.gradientDark,
        boxShadow: `0 2px 8px ${AppColors.ai.shadow}`,
        color: AppColors.text.white,
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
        if (!animated) return;

        const target = e.currentTarget as HTMLElement;
        if (aiVariant === 'primary') {
            target.style.background = AppColors.ai.gradientAnimatedHover;
            target.style.backgroundSize = '200% 200%';
            target.style.backgroundPosition = '100% 50%';
            target.style.boxShadow = `0 6px 16px ${AppColors.ai.shadowHover}`;
            target.style.transform = 'translateY(-2px)';
        }
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
        if (!animated) return;

        const target = e.currentTarget as HTMLElement;
        if (aiVariant === 'primary') {
            target.style.background = AppColors.ai.gradientAnimated;
            target.style.backgroundSize = '200% 200%';
            target.style.backgroundPosition = '0% 50%';
            target.style.boxShadow = `0 4px 12px ${AppColors.ai.shadow}`;
            target.style.transform = 'translateY(0)';
        }
    };

    return (
        <Button
            {...props}
            style={aiVariant === 'primary' ? primaryStyle : secondaryStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            icon={showIcon ? <Cpu style={{ fontSize: '12px', opacity: 1 }} /> : undefined}
        >
            {children}
        </Button>
    );
};

export default AIButton; 