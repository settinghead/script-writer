import React from 'react';
import styled, { css } from 'styled-components';
import { motion } from 'framer-motion';
import { Input } from 'antd';
import { TextAreaProps } from 'antd/es/input';
import { fieldVariants } from '../../motion/variants';

const { TextArea } = Input;

// Size variants for textareas
type TextAreaSize = 'small' | 'medium' | 'large';

// Theme variants for different contexts
type TextAreaVariant = 'default' | 'dark' | 'glass';

interface StyledTextAreaProps extends TextAreaProps {
    variant?: TextAreaVariant;
    size?: TextAreaSize;
    hasError?: boolean;
    isLoading?: boolean;
    minRows?: number;
    maxRows?: number;
}

// Size styles mapping
const sizeStyles = {
    small: css`
    padding: ${({ theme }) => theme.sizes.small.padding};
    font-size: ${({ theme }) => theme.sizes.small.fontSize}px;
    border-radius: ${({ theme }) => theme.sizes.small.borderRadius}px;
    min-height: 80px;
  `,
    medium: css`
    padding: ${({ theme }) => theme.sizes.medium.padding};
    font-size: ${({ theme }) => theme.sizes.medium.fontSize}px;
    border-radius: ${({ theme }) => theme.sizes.medium.borderRadius}px;
    min-height: 100px;
  `,
    large: css`
    padding: ${({ theme }) => theme.sizes.large.padding};
    font-size: ${({ theme }) => theme.sizes.large.fontSize}px;
    border-radius: ${({ theme }) => theme.sizes.large.borderRadius}px;
    min-height: 120px;
  `
};

// Variant styles mapping
const variantStyles = {
    default: css`
    background-color: ${({ theme }) => theme.colors.background.tertiary};
    border: 1px solid ${({ theme }) => theme.colors.border.primary};
    color: ${({ theme }) => theme.colors.text.primary};
    
    &::placeholder {
      color: ${({ theme }) => theme.colors.text.muted};
    }
    
    &:hover {
      border-color: ${({ theme }) => theme.colors.border.secondary};
      background-color: ${({ theme }) => theme.colors.background.secondary};
    }
    
    &:focus, &:focus-within {
      border-color: ${({ theme }) => theme.colors.ai.primary};
      box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.ai.primary}20;
      background-color: ${({ theme }) => theme.colors.background.primary};
      outline: none;
    }
  `,

    dark: css`
    background-color: ${({ theme }) => theme.semantic.field.background};
    border: 1px solid ${({ theme }) => theme.semantic.field.border};
    color: ${({ theme }) => theme.semantic.field.text};
    
    &::placeholder {
      color: ${({ theme }) => theme.semantic.field.placeholder};
    }
    
    &:hover {
      border-color: ${({ theme }) => theme.semantic.field.borderHover};
      background-color: ${({ theme }) => theme.semantic.field.backgroundHover};
    }
    
    &:focus, &:focus-within {
      border-color: ${({ theme }) => theme.semantic.field.borderFocus};
      box-shadow: 0 0 0 2px ${({ theme }) => theme.semantic.field.borderFocus}20;
      background-color: ${({ theme }) => theme.semantic.field.backgroundFocus};
      outline: none;
    }
  `,

    glass: css`
    background: ${({ theme }) => theme.semantic.glass.background};
    backdrop-filter: ${({ theme }) => theme.semantic.glass.backdropFilter};
    border: 1px solid ${({ theme }) => theme.semantic.glass.border};
    color: ${({ theme }) => theme.colors.text.white};
    
    &::placeholder {
      color: ${({ theme }) => theme.colors.text.tertiary};
    }
    
    &:hover {
      background: ${({ theme }) => theme.semantic.glass.backgroundStrong};
      border-color: ${({ theme }) => theme.semantic.glass.borderStrong};
    }
    
    &:focus, &:focus-within {
      border-color: ${({ theme }) => theme.colors.ai.primary};
      box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.ai.primary}20;
      background: ${({ theme }) => theme.semantic.glass.backgroundStrong};
      outline: none;
    }
  `
};

// Error state styles
const errorStyles = css`
  border-color: ${({ theme }) => theme.semantic.field.error} !important;
  box-shadow: 0 0 0 2px ${({ theme }) => theme.semantic.field.error}20 !important;
  
  &:hover, &:focus, &:focus-within {
    border-color: ${({ theme }) => theme.semantic.field.error} !important;
    box-shadow: 0 0 0 2px ${({ theme }) => theme.semantic.field.error}20 !important;
  }
`;

// Loading state styles
const loadingStyles = css`
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    top: 12px;
    right: 12px;
    width: 16px;
    height: 16px;
    border: 2px solid ${({ theme }) => theme.colors.text.muted};
    border-top: 2px solid ${({ theme }) => theme.colors.ai.primary};
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const StyledTextAreaContainer = styled(motion.div) <{
    variant: TextAreaVariant;
    size: TextAreaSize;
    hasError: boolean;
    isLoading: boolean;
}>`
  position: relative;
  width: 100%;
  
  .ant-input {
    width: 100%;
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
    transition: all ${({ theme }) => theme.transitions.fast};
    font-family: ${({ theme }) => theme.typography.fontFamily.primary};
    line-height: 1.5;
    resize: vertical;
    
    ${({ size }) => sizeStyles[size]}
    ${({ variant }) => variantStyles[variant]}
    ${({ hasError }) => hasError && errorStyles}
    ${({ isLoading }) => isLoading && loadingStyles}
    
    &:hover {
      box-shadow: none !important;
    }
    
    &:focus, &:focus-within {
      box-shadow: none !important;
    }
    
    &.ant-input-disabled {
      opacity: 0.6;
      cursor: not-allowed;
      background-color: ${({ theme }) => theme.colors.background.tertiary};
      color: ${({ theme }) => theme.colors.text.muted};
      resize: none;
    }
    
    /* Custom scrollbar for dark theme */
    &::-webkit-scrollbar {
      width: 8px;
    }
    
    &::-webkit-scrollbar-track {
      background: ${({ theme }) => theme.colors.background.primary};
      border-radius: 4px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: ${({ theme }) => theme.colors.border.secondary};
      border-radius: 4px;
      
      &:hover {
        background: ${({ theme }) => theme.colors.border.primary};
      }
    }
  }
`;

export const StyledTextArea: React.FC<StyledTextAreaProps> = ({
    variant = 'dark',
    size = 'medium',
    hasError = false,
    isLoading = false,
    minRows = 3,
    maxRows = 8,
    ...props
}) => {
    return (
        <StyledTextAreaContainer
            variant={variant}
            size={size}
            hasError={hasError}
            isLoading={isLoading}
            variants={fieldVariants}
            initial="initial"
            animate={hasError ? 'error' : 'initial'}
            whileFocus="focus"
        >
            <TextArea
                {...props}
                disabled={props.disabled || isLoading}
                autoSize={{ minRows, maxRows }}
            />
        </StyledTextAreaContainer>
    );
};

export default StyledTextArea; 