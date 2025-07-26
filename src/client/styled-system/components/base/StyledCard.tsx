import React from 'react';
import styled, { css } from 'styled-components';
import { motion } from 'framer-motion';
import { Card, CardProps } from 'antd';
import { hoverLiftVariants } from '../../motion/variants';

// Card variants for different contexts
type CardVariant = 'default' | 'elevated' | 'glass' | 'ai' | 'human' | 'flat';

// Card sizes
type CardSize = 'small' | 'medium' | 'large';

interface StyledCardProps extends CardProps {
    variant?: CardVariant;
    size?: CardSize;
    interactive?: boolean;
    selected?: boolean;
    disabled?: boolean;
    loading?: boolean;
    animateOnHover?: boolean;
    children?: React.ReactNode;
}

// Size styles mapping
const sizeStyles = {
    small: css`
    .ant-card-body {
      padding: ${({ theme }) => theme.spacing.sm}px;
    }
    
    .ant-card-meta-title {
      font-size: ${({ theme }) => theme.typography.fontSize.sm}px;
    }
  `,
    medium: css`
    .ant-card-body {
      padding: ${({ theme }) => theme.spacing.md}px;
    }
    
    .ant-card-meta-title {
      font-size: ${({ theme }) => theme.typography.fontSize.base}px;
    }
  `,
    large: css`
    .ant-card-body {
      padding: ${({ theme }) => theme.spacing.lg}px;
    }
    
    .ant-card-meta-title {
      font-size: ${({ theme }) => theme.typography.fontSize.lg}px;
    }
  `
};

// Variant styles mapping
const variantStyles = {
    default: css`
    background: ${({ theme }) => theme.semantic.card.background};
    border: 1px solid ${({ theme }) => theme.semantic.card.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg}px;
    box-shadow: ${({ theme }) => theme.shadows.md};
    
    &:hover {
      border-color: ${({ theme }) => theme.semantic.card.borderHover};
      background: ${({ theme }) => theme.semantic.card.backgroundHover};
      box-shadow: ${({ theme }) => theme.shadows.lg};
    }
  `,

    elevated: css`
    background: ${({ theme }) => theme.semantic.card.background};
    border: 1px solid ${({ theme }) => theme.semantic.card.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg}px;
    box-shadow: ${({ theme }) => theme.shadows.lg};
    
    &:hover {
      box-shadow: ${({ theme }) => theme.shadows.xl};
      transform: translateY(-2px);
    }
  `,

    glass: css`
    background: ${({ theme }) => theme.semantic.glass.background};
    backdrop-filter: ${({ theme }) => theme.semantic.glass.backdropFilter};
    border: 1px solid ${({ theme }) => theme.semantic.glass.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg}px;
    box-shadow: ${({ theme }) => theme.shadows.md};
    
    &:hover {
      background: ${({ theme }) => theme.semantic.glass.backgroundStrong};
      border-color: ${({ theme }) => theme.semantic.glass.borderStrong};
      box-shadow: ${({ theme }) => theme.shadows.lg};
    }
  `,

    ai: css`
    background: ${({ theme }) => theme.semantic.card.background};
    border: 2px solid ${({ theme }) => theme.colors.ai.primary};
    border-radius: ${({ theme }) => theme.borderRadius.lg}px;
    box-shadow: ${({ theme }) => theme.shadows.glow.ai};
    position: relative;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: ${({ theme }) => theme.colors.ai.gradient};
      border-radius: ${({ theme }) => theme.borderRadius.lg}px ${({ theme }) => theme.borderRadius.lg}px 0 0;
    }
    
    &:hover {
      box-shadow: ${({ theme }) => theme.shadows.glow.ai}, ${({ theme }) => theme.shadows.lg};
      border-color: ${({ theme }) => theme.colors.ai.secondary};
    }
  `,

    human: css`
    background: ${({ theme }) => theme.semantic.card.background};
    border: 2px solid ${({ theme }) => theme.colors.human.primary};
    border-radius: ${({ theme }) => theme.borderRadius.lg}px;
    box-shadow: ${({ theme }) => theme.shadows.glow.human};
    position: relative;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(135deg, ${({ theme }) => theme.colors.human.primary} 0%, ${({ theme }) => theme.colors.status.success} 100%);
      border-radius: ${({ theme }) => theme.borderRadius.lg}px ${({ theme }) => theme.borderRadius.lg}px 0 0;
    }
    
    &:hover {
      box-shadow: ${({ theme }) => theme.shadows.glow.human}, ${({ theme }) => theme.shadows.lg};
      border-color: ${({ theme }) => theme.colors.status.success};
    }
  `,

    flat: css`
    background: ${({ theme }) => theme.semantic.card.background};
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.lg}px;
    box-shadow: none;
    
    &:hover {
      background: ${({ theme }) => theme.semantic.card.backgroundHover};
      box-shadow: ${({ theme }) => theme.shadows.sm};
    }
  `
};

// Interactive state styles
const interactiveStyles = css`
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.medium};
  
  &:active {
    transform: scale(0.98);
  }
`;

// Selected state styles
const selectedStyles = css`
  border-color: ${({ theme }) => theme.colors.ai.primary};
  box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.ai.primary}20;
  
  &::after {
    content: '✓';
    position: absolute;
    top: 8px;
    right: 8px;
    width: 20px;
    height: 20px;
    background: ${({ theme }) => theme.colors.ai.primary};
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
  }
`;

// Disabled state styles
const disabledStyles = css`
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
  
  &:hover {
    transform: none;
    box-shadow: ${({ theme }) => theme.shadows.sm};
  }
`;

// Loading state styles
const loadingStyles = css`
  position: relative;
  pointer-events: none;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    border-radius: ${({ theme }) => theme.borderRadius.lg}px;
    z-index: 1;
  }
  
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 24px;
    height: 24px;
    border: 2px solid ${({ theme }) => theme.colors.text.muted};
    border-top: 2px solid ${({ theme }) => theme.colors.ai.primary};
    border-radius: 50%;
    animation: spin 1s linear infinite;
    transform: translate(-50%, -50%);
    z-index: 2;
  }
  
  @keyframes spin {
    0% { transform: translate(-50%, -50%) rotate(0deg); }
    100% { transform: translate(-50%, -50%) rotate(360deg); }
  }
`;

const StyledCardContainer = styled(motion.div) <{
    variant: CardVariant;
    size: CardSize;
    interactive: boolean;
    selected: boolean;
    disabled: boolean;
    loading: boolean;
}>`
  position: relative;
  width: 100%;
  
  .ant-card {
    width: 100%;
    border: none !important;
    box-shadow: none !important;
    background: transparent !important;
    
    ${({ size }) => sizeStyles[size]}
    ${({ variant }) => variantStyles[variant]}
    ${({ interactive }) => interactive && interactiveStyles}
    ${({ selected }) => selected && selectedStyles}
    ${({ disabled }) => disabled && disabledStyles}
    ${({ loading }) => loading && loadingStyles}
    
    .ant-card-body {
      color: ${({ theme }) => theme.colors.text.primary};
    }
    
    .ant-card-meta-title {
      color: ${({ theme }) => theme.colors.text.primary};
      font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
    }
    
    .ant-card-meta-description {
      color: ${({ theme }) => theme.colors.text.secondary};
    }
  }
`;

export const StyledCard: React.FC<StyledCardProps> = ({
    variant = 'default',
    size = 'medium',
    interactive = false,
    selected = false,
    disabled = false,
    loading = false,
    animateOnHover = true,
    children,
    ...props
}) => {
    const motionProps = animateOnHover && interactive && !disabled && !loading
        ? {
            variants: hoverLiftVariants,
            initial: 'initial',
            whileHover: 'hover',
            whileTap: 'tap'
        }
        : {};

    return (
        <StyledCardContainer
            variant={variant}
            size={size}
            interactive={interactive}
            selected={selected}
            disabled={disabled}
            loading={loading}
            {...motionProps}
        >
            <Card {...props}>
                {children}
            </Card>
        </StyledCardContainer>
    );
};

export default StyledCard; 