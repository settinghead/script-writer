import React from 'react';
import styled, { css } from 'styled-components';
import { motion } from 'framer-motion';
import { Button, ButtonProps } from 'antd';
import { aiButtonVariants, humanButtonVariants, buttonPressVariants } from '../../motion/variants';

// Button variants for different contexts
type ButtonVariant = 'ai' | 'human' | 'default' | 'ghost' | 'text';

// Button sizes
type ButtonSize = 'small' | 'medium' | 'large';

interface StyledButtonProps extends Omit<ButtonProps, 'size' | 'type'> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    animated?: boolean;
    gradient?: boolean;
    children?: React.ReactNode;
}

// Size styles mapping
const sizeStyles = {
    small: css`
    padding: ${({ theme }) => theme.sizes.small.padding};
    font-size: ${({ theme }) => theme.sizes.small.fontSize}px;
    height: ${({ theme }) => theme.sizes.small.height}px;
    border-radius: ${({ theme }) => theme.sizes.small.borderRadius}px;
    min-width: 80px;
  `,
    medium: css`
    padding: ${({ theme }) => theme.sizes.medium.padding};
    font-size: ${({ theme }) => theme.sizes.medium.fontSize}px;
    height: ${({ theme }) => theme.sizes.medium.height}px;
    border-radius: ${({ theme }) => theme.sizes.medium.borderRadius}px;
    min-width: 100px;
  `,
    large: css`
    padding: ${({ theme }) => theme.sizes.large.padding};
    font-size: ${({ theme }) => theme.sizes.large.fontSize}px;
    height: ${({ theme }) => theme.sizes.large.height}px;
    border-radius: ${({ theme }) => theme.sizes.large.borderRadius}px;
    min-width: 120px;
  `
};

// Variant styles mapping
const variantStyles = {
    ai: css`
    background: ${({ theme }) => theme.semantic.button.ai.background};
    border: none;
    color: ${({ theme }) => theme.colors.text.white};
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    box-shadow: ${({ theme }) => theme.semantic.button.ai.shadow};
    
    &:hover, &:focus {
      background: ${({ theme }) => theme.semantic.button.ai.backgroundHover} !important;
      box-shadow: ${({ theme }) => theme.semantic.button.ai.shadowHover} !important;
      color: ${({ theme }) => theme.colors.text.white} !important;
      border-color: transparent !important;
    }
    
    &:active {
      background: ${({ theme }) => theme.colors.ai.tertiary} !important;
    }
    
    &.ant-btn[disabled] {
      background: ${({ theme }) => theme.colors.text.muted} !important;
      box-shadow: none !important;
      opacity: 0.6;
    }
  `,

    human: css`
    background: ${({ theme }) => theme.semantic.button.human.background};
    border: none;
    color: ${({ theme }) => theme.colors.text.white};
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    box-shadow: ${({ theme }) => theme.semantic.button.human.shadow};
    
    &:hover, &:focus {
      background: ${({ theme }) => theme.semantic.button.human.backgroundHover} !important;
      box-shadow: ${({ theme }) => theme.semantic.button.human.shadowHover} !important;
      color: ${({ theme }) => theme.colors.text.white} !important;
      border-color: transparent !important;
    }
    
    &:active {
      background: #135200 !important;
    }
    
    &.ant-btn[disabled] {
      background: ${({ theme }) => theme.colors.text.muted} !important;
      box-shadow: none !important;
      opacity: 0.6;
    }
  `,

    default: css`
    background: ${({ theme }) => theme.semantic.card.background};
    border: 1px solid ${({ theme }) => theme.colors.border.primary};
    color: ${({ theme }) => theme.colors.text.primary};
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    
    &:hover, &:focus {
      background: ${({ theme }) => theme.semantic.card.backgroundHover} !important;
      border-color: ${({ theme }) => theme.colors.border.secondary} !important;
      color: ${({ theme }) => theme.colors.text.primary} !important;
    }
    
    &:active {
      background: ${({ theme }) => theme.colors.background.primary} !important;
    }
    
    &.ant-btn[disabled] {
      background: ${({ theme }) => theme.colors.background.tertiary} !important;
      color: ${({ theme }) => theme.colors.text.muted} !important;
      opacity: 0.6;
    }
  `,

    ghost: css`
    background: transparent;
    border: 1px solid ${({ theme }) => theme.colors.ai.primary};
    color: ${({ theme }) => theme.colors.ai.primary};
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    
    &:hover, &:focus {
      background: ${({ theme }) => theme.colors.ai.primary}10 !important;
      border-color: ${({ theme }) => theme.colors.ai.secondary} !important;
      color: ${({ theme }) => theme.colors.ai.secondary} !important;
    }
    
    &:active {
      background: ${({ theme }) => theme.colors.ai.primary}20 !important;
    }
    
    &.ant-btn[disabled] {
      border-color: ${({ theme }) => theme.colors.text.muted} !important;
      color: ${({ theme }) => theme.colors.text.muted} !important;
      opacity: 0.6;
    }
  `,

    text: css`
    background: transparent;
    border: none;
    color: ${({ theme }) => theme.colors.text.secondary};
    font-weight: ${({ theme }) => theme.typography.fontWeight.normal};
    
    &:hover, &:focus {
      background: ${({ theme }) => theme.colors.background.tertiary} !important;
      color: ${({ theme }) => theme.colors.text.primary} !important;
    }
    
    &:active {
      background: ${({ theme }) => theme.colors.background.secondary} !important;
    }
    
    &.ant-btn[disabled] {
      color: ${({ theme }) => theme.colors.text.muted} !important;
      opacity: 0.6;
    }
  `
};

// Gradient animation for AI and Human variants
const gradientStyles = css<{ variant: ButtonVariant; animated: boolean }>`
  ${({ variant, animated }) =>
        animated && (variant === 'ai' || variant === 'human') && css`
      background-size: 200% 200%;
      background-position: 0% 50%;
      
      &:hover {
        animation: gradientShift 2s ease infinite;
      }
      
      @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
    `
    }
`;

const StyledButtonContainer = styled(motion.div) <{
    variant: ButtonVariant;
    size: ButtonSize;
    animated: boolean;
    gradient: boolean;
}>`
  display: inline-block;
  
  .ant-btn {
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
    transition: all ${({ theme }) => theme.transitions.medium};
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.xs}px;
    
    ${({ size }) => sizeStyles[size]}
    ${({ variant }) => variantStyles[variant]}
    ${({ variant, animated }) => gradientStyles}
    
    &:focus {
      box-shadow: none !important;
    }
    
    // Remove Ant Design's default focus styles
    &:focus-visible {
      outline: none;
    }
    
    // Icon styling
    .anticon {
      display: flex;
      align-items: center;
    }
  }
`;

export const StyledButton: React.FC<StyledButtonProps> = ({
    variant = 'default',
    size = 'medium',
    animated = true,
    gradient = false,
    children,
    disabled = false,
    ...props
}) => {
    // Choose motion variants based on button variant
    const getMotionVariants = () => {
        if (disabled) return {};

        switch (variant) {
            case 'ai':
                return aiButtonVariants;
            case 'human':
                return humanButtonVariants;
            default:
                return buttonPressVariants;
        }
    };

    const motionProps = animated && !disabled
        ? {
            variants: getMotionVariants(),
            initial: 'initial',
            whileHover: 'hover',
            whileTap: 'tap'
        }
        : {};

    return (
        <StyledButtonContainer
            variant={variant}
            size={size}
            animated={animated}
            gradient={gradient}
            {...motionProps}
        >
            <Button
                {...props}
                disabled={disabled}
            >
                {children}
            </Button>
        </StyledButtonContainer>
    );
};

export default StyledButton; 