import React, { CSSProperties } from 'react';
import { Button, ButtonProps } from 'antd';
import { User } from 'iconoir-react';
import { AppColors } from '../../../common/theme/colors';

interface HumanButtonProps extends Omit<ButtonProps, 'variant' | 'icon'> {
    humanVariant?: 'primary' | 'secondary';
    animated?: boolean;
    children: React.ReactNode;
    showIcon?: boolean;
}

const HumanButton: React.FC<HumanButtonProps> = ({
    humanVariant = 'primary',
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
        background: animated ?
            'linear-gradient(135deg, #237804, #389e0d, #52c41a, #237804)' :
            'linear-gradient(135deg, #237804 0%, #389e0d 50%, #52c41a 100%)',
        backgroundSize: animated ? '200% 200%' : '100% 100%',
        backgroundPosition: '0% 50%',
        boxShadow: '0 4px 12px rgba(35, 120, 4, 0.4)',
        color: AppColors.text.white,
    };

    const secondaryStyle: CSSProperties = {
        ...baseStyle,
        background: 'linear-gradient(135deg, #135200 0%, #237804 50%, #389e0d 100%)',
        boxShadow: '0 2px 8px rgba(35, 120, 4, 0.4)',
        color: AppColors.text.white,
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
        if (!animated) return;

        const target = e.currentTarget as HTMLElement;
        if (humanVariant === 'primary') {
            target.style.background = 'linear-gradient(135deg, #52c41a, #237804, #389e0d, #52c41a)';
            target.style.backgroundSize = '200% 200%';
            target.style.backgroundPosition = '100% 50%';
            target.style.boxShadow = '0 6px 16px rgba(35, 120, 4, 0.6)';
            target.style.transform = 'translateY(-2px)';
        }
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
        if (!animated) return;

        const target = e.currentTarget as HTMLElement;
        if (humanVariant === 'primary') {
            target.style.background = 'linear-gradient(135deg, #237804, #389e0d, #52c41a, #237804)';
            target.style.backgroundSize = '200% 200%';
            target.style.backgroundPosition = '0% 50%';
            target.style.boxShadow = '0 4px 12px rgba(35, 120, 4, 0.4)';
            target.style.transform = 'translateY(0)';
        }
    };

    return (
        <Button
            {...props}
            style={humanVariant === 'primary' ? primaryStyle : secondaryStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            icon={showIcon ? <User style={{ fontSize: '12px', opacity: 1 }} /> : undefined}
        >
            {children}
        </Button>
    );
};

export default HumanButton; 