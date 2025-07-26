import { AppColors } from '@/common/theme/colors';
import { DesignTokens } from '@/common/theme/designSystem';

// Extended theme for styled-components with motion support
export const styledTheme = {
    // Inherit existing design tokens
    colors: AppColors,
    spacing: DesignTokens.spacing,
    borderRadius: DesignTokens.borderRadius,
    shadows: DesignTokens.shadows,
    typography: DesignTokens.typography,
    zIndex: DesignTokens.zIndex,
    transitions: DesignTokens.transitions,

    // Motion-specific theme properties
    motion: {
        transitions: {
            fast: { duration: 0.15, ease: 'easeOut' },
            medium: { duration: 0.3, ease: 'easeInOut' },
            slow: { duration: 0.6, ease: 'easeInOut' },
            spring: { type: 'spring', stiffness: 400, damping: 30 },
            springGentle: { type: 'spring', stiffness: 260, damping: 20 },
            springBouncy: { type: 'spring', stiffness: 600, damping: 15 }
        },

        // Common animation variants
        variants: {
            fadeInUp: {
                initial: { opacity: 0, y: 20 },
                animate: { opacity: 1, y: 0 },
                exit: { opacity: 0, y: -20 }
            },
            fadeIn: {
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                exit: { opacity: 0 }
            },
            slideInFromRight: {
                initial: { opacity: 0, x: 20 },
                animate: { opacity: 1, x: 0 },
                exit: { opacity: 0, x: 20 }
            },
            hoverLift: {
                hover: {
                    y: -2,
                    transition: { duration: 0.2, ease: 'easeOut' }
                },
                tap: {
                    y: 0,
                    transition: { duration: 0.1 }
                }
            },
            buttonPress: {
                hover: { scale: 1.02 },
                tap: { scale: 0.98 },
                transition: { duration: 0.15 }
            },
            staggerChildren: {
                animate: {
                    transition: {
                        staggerChildren: 0.1,
                        delayChildren: 0.1
                    }
                }
            }
        }
    },

    // Enhanced semantic colors for components
    semantic: {
        field: {
            background: '#1f1f1f',
            backgroundHover: '#2a2a2a',
            backgroundFocus: '#1a1a1a',
            border: '#404040',
            borderHover: '#606060',
            borderFocus: '#1890ff',
            text: '#ffffff',
            textSecondary: '#d9d9d9',
            placeholder: '#8c8c8c',
            error: '#ff4d4f',
            success: '#52c41a'
        },

        card: {
            background: '#262626',
            backgroundHover: '#2d2d2d',
            border: '#333333',
            borderHover: '#404040',
            shadow: 'rgba(0, 0, 0, 0.15)',
            shadowHover: 'rgba(0, 0, 0, 0.25)'
        },

        button: {
            ai: {
                background: AppColors.ai.gradient,
                backgroundHover: AppColors.ai.gradientDark,
                shadow: AppColors.ai.shadow,
                shadowHover: AppColors.ai.shadowHover
            },
            human: {
                background: 'linear-gradient(135deg, #237804 0%, #389e0d 50%, #52c41a 100%)',
                backgroundHover: 'linear-gradient(135deg, #135200 0%, #237804 50%, #389e0d 100%)',
                shadow: 'rgba(35, 120, 4, 0.4)',
                shadowHover: 'rgba(35, 120, 4, 0.6)'
            }
        },

        glass: {
            background: 'rgba(38, 38, 38, 0.6)',
            backgroundStrong: 'rgba(38, 38, 38, 0.8)',
            border: 'rgba(255, 255, 255, 0.1)',
            borderStrong: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(25px) saturate(200%) contrast(130%) brightness(110%)'
        }
    },

    // Component size variants
    sizes: {
        small: {
            padding: `${DesignTokens.spacing.xs}px ${DesignTokens.spacing.sm}px`,
            fontSize: DesignTokens.typography.fontSize.sm,
            height: 32,
            borderRadius: DesignTokens.borderRadius.sm
        },
        medium: {
            padding: `${DesignTokens.spacing.sm}px ${DesignTokens.spacing.md}px`,
            fontSize: DesignTokens.typography.fontSize.base,
            height: 40,
            borderRadius: DesignTokens.borderRadius.md
        },
        large: {
            padding: `${DesignTokens.spacing.md}px ${DesignTokens.spacing.lg}px`,
            fontSize: DesignTokens.typography.fontSize.lg,
            height: 48,
            borderRadius: DesignTokens.borderRadius.lg
        }
    },

    // Responsive breakpoints
    breakpoints: {
        mobile: '768px',
        tablet: '1024px',
        desktop: '1200px'
    },

    // Media query helpers
    media: {
        mobile: `@media (max-width: 768px)`,
        tablet: `@media (max-width: 1024px)`,
        desktop: `@media (min-width: 1025px)`
    }
};

// TypeScript types for the theme
export type StyledTheme = typeof styledTheme;

// Theme type declaration for styled-components
declare module 'styled-components' {
    export interface DefaultTheme extends StyledTheme { }
} 