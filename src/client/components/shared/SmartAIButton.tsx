import React, { CSSProperties } from 'react';
import { Button, ButtonProps, Tooltip } from 'antd';
import { Cpu } from 'iconoir-react';
import { AppColors } from '../../../common/theme/colors';
import { useGenerationState } from '../../hooks/useGenerationState';

interface SmartAIButtonProps extends Omit<ButtonProps, 'variant' | 'icon' | 'disabled'> {
    /** Visual variant for the button */
    aiVariant?: 'primary' | 'secondary';
    /** Enable hover animations */
    animated?: boolean;
    /** Show the AI CPU icon */
    showIcon?: boolean;
    /** Component ID for tracking local generation state */
    componentId?: string;
    /** Manually disable the button (in addition to generation state) */
    manuallyDisabled?: boolean;
    /** Custom disabled reason tooltip (overrides automatic generation state reason) */
    customDisabledReason?: string;
    /** Text to show when button is disabled due to generation */
    generatingText?: string;
    /** Allow clicks even during generation (bypass automatic disabling) */
    allowClickDuringGeneration?: boolean;
    children: React.ReactNode;
}

/**
 * Smart AI Button that automatically disables during any generation state
 * 
 * This button automatically:
 * 1. Disables when any project-wide transforms are running
 * 2. Disables when any local component is generating  
 * 3. Shows helpful tooltips explaining why it's disabled
 * 4. Changes text to indicate when it will be clickable again
 * 
 * Usage:
 * ```tsx
 * <SmartAIButton
 *   componentId="my-generate-action"
 *   generatingText="处理中..."
 *   onClick={handleGenerate}
 * >
 *   生成内容
 * </SmartAIButton>
 * ```
 */
const SmartAIButton: React.FC<SmartAIButtonProps> = ({
    aiVariant = 'primary',
    animated = true,
    showIcon = true,
    componentId,
    manuallyDisabled = false,
    customDisabledReason,
    generatingText = '处理中...',
    allowClickDuringGeneration = false,
    children,
    style,
    onClick,
    ...props
}) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const {
        isAnyGenerating,
        getDisabledReason,
        activeTransformTypes
    } = useGenerationState(componentId);

    // Determine if button should be disabled
    const isDisabledByGeneration = !allowClickDuringGeneration && isAnyGenerating;
    const isDisabled = manuallyDisabled || isDisabledByGeneration || !!props.loading;

    // Determine button text
    const buttonText = isDisabledByGeneration ? generatingText : children;

    // Determine tooltip text
    const tooltipText = customDisabledReason || getDisabledReason();

    // Handle click - prevent if disabled
    const handleClick = (e: React.MouseEvent<HTMLElement>) => {
        if (isDisabled) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        onClick?.(e);
    };

    const baseStyle: CSSProperties = {
        border: 'none',
        borderRadius: '12px',
        fontWeight: 500,
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
        fontSize: isMobile ? '12px' : '18px',
        padding: isMobile ? '8px 16px' : '12px 24px',
        minWidth: isMobile ? 'auto' : '140px',
        opacity: isDisabled ? 0.7 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        ...style
    };

    const primaryStyle: CSSProperties = {
        ...baseStyle,
        background: animated && !isDisabled ? AppColors.ai.gradientAnimated : AppColors.ai.gradient,
        backgroundSize: animated && !isDisabled ? '200% 200%' : '100% 100%',
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
        if (!animated || isDisabled) return;

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
        if (!animated || isDisabled) return;

        const target = e.currentTarget as HTMLElement;
        if (aiVariant === 'primary') {
            target.style.background = AppColors.ai.gradientAnimated;
            target.style.backgroundSize = '200% 200%';
            target.style.backgroundPosition = '0% 50%';
            target.style.boxShadow = `0 4px 12px ${AppColors.ai.shadow}`;
            target.style.transform = 'translateY(0)';
        }
    };

    const buttonElement = (
        <Button
            {...props}
            disabled={isDisabled}
            style={aiVariant === 'primary' ? primaryStyle : secondaryStyle}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            icon={showIcon ? <Cpu style={{ fontSize: isMobile ? '10px' : '12px', opacity: 1 }} /> : undefined}
        >
            {buttonText}
        </Button>
    );

    // Wrap with tooltip if there's a disabled reason
    if (isDisabled && tooltipText) {
        return (
            <Tooltip
                title={tooltipText}
                placement="top"
                color="#1f1f1f"
            >
                {buttonElement}
            </Tooltip>
        );
    }

    return buttonElement;
};

export default SmartAIButton;
