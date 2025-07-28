import React from 'react';
import { Card, Button, Typography, Flex } from 'antd';
import { ButtonProps } from 'antd/es/button';
import { CardProps } from 'antd/es/card';
import { FlexProps } from 'antd/es/flex';
import { AppColors } from '@/common/theme/colors';
import { DesignTokens, StyleUtils } from '@/common/theme/designSystem';

const { Title, Text } = Typography;

// Enhanced Card Components
interface StyledCardProps extends CardProps {
    variant?: 'default' | 'elevated' | 'flat' | 'gradient';
    glow?: boolean;
}

export const StyledCard: React.FC<StyledCardProps> = ({
    variant = 'default',
    glow = false,
    style,
    children,
    ...props
}) => {
    const baseStyle = StyleUtils.card(variant);

    const variantStyles = {
        gradient: {
            background: `linear-gradient(135deg, ${AppColors.background.card} 0%, ${AppColors.background.secondary} 100%)`,
            border: `1px solid ${AppColors.border.secondary}`,
        },
    };

    const glowStyle = glow ? {
        boxShadow: `${DesignTokens.shadows.lg}, ${DesignTokens.shadows.glow.ai}`,
        animation: 'glow 2s ease-in-out infinite',
    } : {};

    return (
        <Card
            {...props}
            style={{
                ...baseStyle,
                ...(variant === 'gradient' && variantStyles.gradient),
                ...glowStyle,
                ...style,
            }}
        >
            {children}
        </Card>
    );
};

// Enhanced Button Components
interface StyledButtonProps extends ButtonProps {
    variant?: 'ai' | 'human' | 'ghost' | 'gradient';
    glow?: boolean;
    animated?: boolean;
}

export const StyledButton: React.FC<StyledButtonProps> = ({
    variant = 'ai',
    glow = false,
    animated = true,
    style,
    children,
    ...props
}) => {
    const baseStyle = {
        borderRadius: DesignTokens.borderRadius.md,
        fontWeight: DesignTokens.typography.fontWeight.medium,
        transition: DesignTokens.transitions.medium,
        border: 'none',
        height: '40px',
        position: 'relative' as const,
        overflow: 'hidden' as const,
    };

    const variantStyles = {
        ai: {
            background: animated
                ? AppColors.ai.gradientAnimated
                : AppColors.ai.gradient,
            backgroundSize: animated ? '200% 200%' : '100% 100%',
            backgroundPosition: '0% 50%',
            color: AppColors.text.white,
            boxShadow: glow ? DesignTokens.shadows.glow.ai : DesignTokens.shadows.sm,
        },
        human: {
            background: animated
                ? `linear-gradient(135deg, ${AppColors.human.primary}, #389e0d, #52c41a, ${AppColors.human.primary})`
                : `linear-gradient(135deg, ${AppColors.human.primary} 0%, #389e0d 50%, #52c41a 100%)`,
            backgroundSize: animated ? '200% 200%' : '100% 100%',
            backgroundPosition: '0% 50%',
            color: AppColors.text.white,
            boxShadow: glow ? DesignTokens.shadows.glow.human : DesignTokens.shadows.sm,
        },
        ghost: {
            background: 'transparent',
            border: `1px solid ${AppColors.border.primary}`,
            color: AppColors.text.primary,
            boxShadow: 'none',
        },
        gradient: {
            background: `linear-gradient(135deg, ${AppColors.ai.primary} 0%, ${AppColors.status.success} 100%)`,
            color: AppColors.text.white,
            boxShadow: glow ? DesignTokens.shadows.glow.success : DesignTokens.shadows.sm,
        },
    };

    return (
        <Button
            {...props}
            style={{
                ...baseStyle,
                ...variantStyles[variant],
                ...style,
            }}
            onMouseEnter={(e) => {
                if (animated && (variant === 'ai' || variant === 'human')) {
                    const target = e.currentTarget as HTMLElement;
                    target.style.backgroundPosition = '100% 50%';
                    target.style.transform = 'translateY(-2px)';
                    target.style.boxShadow = DesignTokens.shadows.xl;
                }
                props.onMouseEnter?.(e);
            }}
            onMouseLeave={(e) => {
                if (animated && (variant === 'ai' || variant === 'human')) {
                    const target = e.currentTarget as HTMLElement;
                    target.style.backgroundPosition = '0% 50%';
                    target.style.transform = 'translateY(0)';
                    target.style.boxShadow = glow
                        ? (variant === 'ai' ? DesignTokens.shadows.glow.ai : DesignTokens.shadows.glow.human)
                        : DesignTokens.shadows.sm;
                }
                props.onMouseLeave?.(e);
            }}
        >
            {children}
        </Button>
    );
};

// Layout Components
interface StackProps extends Omit<FlexProps, 'gap'> {
    gap?: keyof typeof DesignTokens.spacing;
    children: React.ReactNode;
}

export const Stack: React.FC<StackProps> = ({
    gap = 'md',
    children,
    style,
    ...props
}) => (
    <Flex
        {...props}
        vertical
        style={{
            gap: DesignTokens.spacing[gap],
            ...style,
        }}
    >
        {children}
    </Flex>
);

export const Inline: React.FC<StackProps> = ({
    gap = 'md',
    children,
    style,
    ...props
}) => (
    <Flex
        {...props}
        style={{
            gap: DesignTokens.spacing[gap],
            alignItems: 'center',
            ...style,
        }}
    >
        {children}
    </Flex>
);

// Container Component
interface ContainerProps {
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    style?: React.CSSProperties;
    className?: string;
}

export const Container: React.FC<ContainerProps> = ({
    children,
    size = 'lg',
    style,
    className
}) => {
    const maxWidths = {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        full: '100%',
    };

    return (
        <div
            className={className}
            style={{
                width: '100%',
                maxWidth: maxWidths[size],
                margin: '0 auto',
                padding: `0 ${DesignTokens.spacing.lg}px`,
                ...style,
            }}
        >
            {children}
        </div>
    );
};

// Section Component
interface SectionProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    spacing?: keyof typeof DesignTokens.spacing;
    style?: React.CSSProperties;
    className?: string;
}

export const Section: React.FC<SectionProps> = ({
    children,
    title,
    subtitle,
    spacing = 'xl',
    style,
    className
}) => (
    <section
        className={className}
        style={{
            marginBottom: DesignTokens.spacing[spacing],
            ...style,
        }}
    >
        {title && (
            <Title
                level={2}
                style={{
                    ...StyleUtils.text.heading(2),
                    marginBottom: subtitle ? DesignTokens.spacing.sm : DesignTokens.spacing.lg,
                }}
            >
                {title}
            </Title>
        )}
        {subtitle && (
            <Text
                style={{
                    ...StyleUtils.text.body('secondary'),
                    display: 'block',
                    marginBottom: DesignTokens.spacing.lg,
                }}
            >
                {subtitle}
            </Text>
        )}
        {children}
    </section>
);

// Page Header Component
interface PageHeaderProps {
    title: string;
    subtitle?: string;
    extra?: React.ReactNode;
    breadcrumbs?: React.ReactNode;
    style?: React.CSSProperties;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    subtitle,
    extra,
    breadcrumbs,
    style
}) => (
    <div style={{
        padding: `${DesignTokens.spacing.lg}px 0`,
        borderBottom: `1px solid ${AppColors.border.primary}`,
        marginBottom: DesignTokens.spacing.xl,
        ...style,
    }}>
        {breadcrumbs && (
            <div style={{ marginBottom: DesignTokens.spacing.sm }}>
                {breadcrumbs}
            </div>
        )}
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: DesignTokens.spacing.lg,
        }}>
            <div>
                <Title
                    level={1}
                    style={{
                        ...StyleUtils.text.heading(1),
                        marginBottom: subtitle ? DesignTokens.spacing.sm : 0,
                    }}
                >
                    {title}
                </Title>
                {subtitle && (
                    <Text style={StyleUtils.text.body('secondary')}>
                        {subtitle}
                    </Text>
                )}
            </div>
            {extra && (
                <div style={{ flexShrink: 0 }}>
                    {extra}
                </div>
            )}
        </div>
    </div>
);

// Loading Card Component
interface LoadingCardProps {
    variant?: 'pulse' | 'glow';
    height?: number;
    children?: React.ReactNode;
}

export const LoadingCard: React.FC<LoadingCardProps> = ({
    variant = 'pulse',
    height,
    children
}) => {
    const animationStyles = {
        pulse: {
            animation: 'pulse-background 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        },
        glow: {
            animation: 'glow 2s ease-in-out infinite',
            boxShadow: DesignTokens.shadows.glow.ai,
        },
    };

    return (
        <StyledCard
            style={{
                ...animationStyles[variant],
                ...(height && { height }),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {children}
        </StyledCard>
    );
};

// Status Badge Component
interface StatusBadgeProps {
    status: 'ai' | 'human' | 'success' | 'warning' | 'error' | 'processing';
    text: string;
    icon?: React.ReactNode;
    style?: React.CSSProperties;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    text,
    icon,
    style
}) => {
    const statusColors = {
        ai: AppColors.ai.primary,
        human: AppColors.human.primary,
        success: AppColors.status.success,
        warning: AppColors.status.warning,
        error: AppColors.status.error,
        processing: AppColors.status.processing,
    };

    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: DesignTokens.spacing.xs,
            padding: `${DesignTokens.spacing.xs}px ${DesignTokens.spacing.sm}px`,
            backgroundColor: `${statusColors[status]}20`,
            color: statusColors[status],
            borderRadius: DesignTokens.borderRadius.sm,
            fontSize: DesignTokens.typography.fontSize.sm,
            fontWeight: DesignTokens.typography.fontWeight.medium,
            border: `1px solid ${statusColors[status]}40`,
            ...style,
        }}>
            {icon}
            <span>{text}</span>
        </div>
    );
};

// Modern Input Wrapper
interface InputWrapperProps {
    label?: string;
    error?: string;
    required?: boolean;
    children: React.ReactNode;
    style?: React.CSSProperties;
}

export const InputWrapper: React.FC<InputWrapperProps> = ({
    label,
    error,
    required,
    children,
    style
}) => (
    <div style={{
        marginBottom: DesignTokens.spacing.lg,
        ...style,
    }}>
        {label && (
            <Text style={{
                display: 'block',
                marginBottom: DesignTokens.spacing.sm,
                fontWeight: DesignTokens.typography.fontWeight.medium,
                color: AppColors.text.primary,
            }}>
                {label}
                {required && <span style={{ color: AppColors.status.error, marginLeft: '4px' }}>*</span>}
            </Text>
        )}
        {children}
        {error && (
            <Text style={{
                display: 'block',
                marginTop: DesignTokens.spacing.xs,
                color: AppColors.status.error,
                fontSize: DesignTokens.typography.fontSize.sm,
            }}>
                {error}
            </Text>
        )}
    </div>
);

// Glassmorphism Card (Modern effect)
interface GlassCardProps extends CardProps {
    blur?: number;
    opacity?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({
    blur = 10,
    opacity = 0.1,
    style,
    children,
    ...props
}) => (
    <Card
        {...props}
        style={{
            background: `rgba(38, 38, 38, ${opacity})`,
            backdropFilter: `blur(${blur}px)`,
            border: `1px solid rgba(255, 255, 255, 0.1)`,
            borderRadius: DesignTokens.borderRadius.lg,
            boxShadow: DesignTokens.shadows.xl,
            ...style,
        }}
    >
        {children}
    </Card>
); 