import type { ThemeConfig } from 'antd';
import { theme } from 'antd';
import { AppColors } from './colors';

// Design tokens for consistent spacing, typography, and effects
export const DesignTokens = {
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
        xxxl: 64,
    },

    borderRadius: {
        sm: 4,
        md: 8,
        lg: 12,
        xl: 16,
        full: 9999,
    },

    shadows: {
        sm: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
        md: '0 4px 6px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.12)',
        lg: '0 8px 16px rgba(0, 0, 0, 0.2), 0 4px 8px rgba(0, 0, 0, 0.15)',
        xl: '0 12px 24px rgba(0, 0, 0, 0.25), 0 6px 12px rgba(0, 0, 0, 0.2)',
        glow: {
            ai: '0 0 20px rgba(109, 40, 217, 0.3)',
            human: '0 0 20px rgba(35, 120, 4, 0.3)',
            success: '0 0 20px rgba(82, 196, 26, 0.3)',
            warning: '0 0 20px rgba(250, 140, 22, 0.3)',
            error: '0 0 20px rgba(245, 34, 45, 0.3)',
        }
    },

    transitions: {
        fast: '0.15s ease',
        medium: '0.3s ease',
        slow: '0.6s ease',
        spring: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    },

    typography: {
        fontFamily: {
            primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            mono: '"SF Mono", "Monaco", "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
        },
        fontSize: {
            xs: 12,
            sm: 14,
            base: 16,
            lg: 18,
            xl: 20,
            '2xl': 24,
            '3xl': 30,
            '4xl': 36,
        },
        fontWeight: {
            normal: 400,
            medium: 500,
            semibold: 600,
            bold: 700,
        },
        lineHeight: {
            tight: 1.25,
            normal: 1.5,
            relaxed: 1.75,
        },
    },

    zIndex: {
        dropdown: 1000,
        sticky: 1010,
        fixed: 1020,
        modalBackdrop: 1030,
        modal: 1040,
        popover: 1050,
        tooltip: 1060,
        toast: 1070,
    },
};

// Modern Ant Design theme configuration
export const antdTheme: ThemeConfig = {
    algorithm: theme.darkAlgorithm,
    token: {
        // Brand colors
        colorPrimary: '#1890ff',
        colorSuccess: AppColors.status.success,
        colorWarning: AppColors.status.warning,
        colorError: AppColors.status.error,
        colorInfo: '#1890ff',

        // Background colors
        colorBgBase: AppColors.background.primary,
        colorBgContainer: AppColors.background.card,
        colorBgElevated: AppColors.background.secondary,
        colorBgLayout: AppColors.background.primary,
        colorBgSpotlight: AppColors.background.tertiary,

        // Text colors
        colorText: AppColors.text.primary,
        colorTextSecondary: AppColors.text.secondary,
        colorTextTertiary: AppColors.text.tertiary,
        colorTextQuaternary: AppColors.text.muted,

        // Border colors
        colorBorder: AppColors.border.primary,
        colorBorderSecondary: AppColors.border.secondary,

        // Typography
        fontFamily: DesignTokens.typography.fontFamily.primary,
        fontSize: DesignTokens.typography.fontSize.base,
        fontSizeHeading1: DesignTokens.typography.fontSize['4xl'],
        fontSizeHeading2: DesignTokens.typography.fontSize['3xl'],
        fontSizeHeading3: DesignTokens.typography.fontSize['2xl'],
        fontSizeHeading4: DesignTokens.typography.fontSize.xl,
        fontSizeHeading5: DesignTokens.typography.fontSize.lg,

        // Spacing and layout
        borderRadius: DesignTokens.borderRadius.md,
        borderRadiusLG: DesignTokens.borderRadius.lg,
        borderRadiusSM: DesignTokens.borderRadius.sm,
        borderRadiusXS: DesignTokens.borderRadius.sm,

        // Shadows
        boxShadow: DesignTokens.shadows.sm,
        boxShadowSecondary: DesignTokens.shadows.md,
        boxShadowTertiary: DesignTokens.shadows.lg,

        // Animation
        motionDurationFast: '0.15s',
        motionDurationMid: '0.3s',
        motionDurationSlow: '0.6s',
        motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
        motionEaseOut: 'cubic-bezier(0, 0, 0.2, 1)',

        // Layout
        padding: DesignTokens.spacing.md,
        paddingLG: DesignTokens.spacing.lg,
        paddingSM: DesignTokens.spacing.sm,
        paddingXS: DesignTokens.spacing.xs,
        margin: DesignTokens.spacing.md,
        marginLG: DesignTokens.spacing.lg,
        marginSM: DesignTokens.spacing.sm,
        marginXS: DesignTokens.spacing.xs,

        // Control heights
        controlHeight: 40,
        controlHeightLG: 48,
        controlHeightSM: 32,
        controlHeightXS: 24,

        // Line heights
        lineHeight: DesignTokens.typography.lineHeight.normal,
        lineHeightHeading1: DesignTokens.typography.lineHeight.tight,
        lineHeightHeading2: DesignTokens.typography.lineHeight.tight,
        lineHeightHeading3: DesignTokens.typography.lineHeight.tight,
        lineHeightHeading4: DesignTokens.typography.lineHeight.tight,
        lineHeightHeading5: DesignTokens.typography.lineHeight.tight,
    },

    components: {
        // Layout components
        Layout: {
            headerBg: AppColors.background.secondary,
            headerColor: AppColors.text.primary,
            bodyBg: AppColors.background.primary,
            siderBg: AppColors.background.secondary,
        },

        // Navigation
        Menu: {
            darkItemBg: 'transparent',
            darkItemColor: AppColors.text.secondary,
            darkItemHoverBg: AppColors.background.tertiary,
            darkItemHoverColor: AppColors.text.primary,
            darkItemSelectedBg: AppColors.ai.primary,
            darkItemSelectedColor: AppColors.text.white,
            darkSubMenuItemBg: AppColors.background.secondary,
        },

        // Cards and containers
        Card: {
            colorBgContainer: AppColors.background.card,
            colorBorderSecondary: AppColors.border.primary,
            paddingLG: DesignTokens.spacing.lg,
            borderRadiusLG: DesignTokens.borderRadius.lg,
            boxShadowCard: DesignTokens.shadows.md,
        },

        // Buttons
        Button: {
            borderRadius: DesignTokens.borderRadius.md,
            controlHeight: 40,
            controlHeightLG: 48,
            controlHeightSM: 32,
            fontWeight: DesignTokens.typography.fontWeight.medium,
            boxShadow: DesignTokens.shadows.sm,
            // Primary button with AI gradient
            colorPrimary: AppColors.ai.primary,
            colorPrimaryHover: AppColors.ai.secondary,
            colorPrimaryActive: AppColors.ai.tertiary,
        },

        // Form components
        Input: {
            colorBgContainer: AppColors.background.tertiary,
            colorBorder: AppColors.border.primary,
            colorText: AppColors.text.primary,
            borderRadius: DesignTokens.borderRadius.md,
            controlHeight: 40,
            paddingInline: DesignTokens.spacing.md,
        },

        Select: {
            colorBgContainer: AppColors.background.tertiary,
            colorBorder: AppColors.border.primary,
            colorText: AppColors.text.primary,
            borderRadius: DesignTokens.borderRadius.md,
            controlHeight: 40,
        },

        // Typography
        Typography: {
            colorText: AppColors.text.primary,
            colorTextSecondary: AppColors.text.secondary,
            colorTextDescription: AppColors.text.tertiary,
            fontFamily: DesignTokens.typography.fontFamily.primary,
        },

        // Modal and Drawer
        Modal: {
            colorBgElevated: AppColors.background.secondary,
            borderRadiusLG: DesignTokens.borderRadius.xl,
            boxShadow: DesignTokens.shadows.xl,
        },

        Drawer: {
            colorBgElevated: AppColors.background.secondary,
            boxShadow: DesignTokens.shadows.xl,
        },

        // Tabs
        Tabs: {
            colorBgContainer: AppColors.background.card,
            colorBorderSecondary: AppColors.border.primary,
            borderRadius: DesignTokens.borderRadius.md,
            cardBg: AppColors.background.card,
        },

        // Table
        Table: {
            colorBgContainer: AppColors.background.card,
            colorBorderSecondary: AppColors.border.primary,
            borderRadius: DesignTokens.borderRadius.md,
        },

        // Tree
        Tree: {
            colorBgContainer: AppColors.background.card,
            borderRadius: DesignTokens.borderRadius.md,
        },

        // Notification and Message
        Notification: {
            colorBgElevated: AppColors.background.secondary,
            borderRadiusLG: DesignTokens.borderRadius.lg,
            boxShadow: DesignTokens.shadows.lg,
        },

        Message: {
            colorBgElevated: AppColors.background.secondary,
            borderRadiusLG: DesignTokens.borderRadius.lg,
            boxShadow: DesignTokens.shadows.lg,
        },
    },
};

// Utility functions for consistent styling
export const StyleUtils = {
    // Create consistent card styles
    card: (variant: 'default' | 'elevated' | 'flat' = 'default') => ({
        backgroundColor: AppColors.background.card,
        border: `1px solid ${AppColors.border.primary}`,
        borderRadius: DesignTokens.borderRadius.lg,
        ...(variant === 'elevated' && {
            boxShadow: DesignTokens.shadows.lg,
        }),
        ...(variant === 'flat' && {
            boxShadow: 'none',
            border: 'none',
        }),
    }),

    // Create consistent button styles
    button: (variant: 'ai' | 'human' | 'default' = 'default') => ({
        borderRadius: DesignTokens.borderRadius.md,
        fontWeight: DesignTokens.typography.fontWeight.medium,
        transition: DesignTokens.transitions.medium,
        border: 'none',
        cursor: 'pointer',
        ...(variant === 'ai' && {
            background: AppColors.ai.gradient,
            color: AppColors.text.white,
            boxShadow: DesignTokens.shadows.glow.ai,
            '&:hover': {
                background: AppColors.ai.gradientDark,
                transform: 'translateY(-2px)',
                boxShadow: DesignTokens.shadows.xl,
            },
        }),
        ...(variant === 'human' && {
            background: `linear-gradient(135deg, ${AppColors.human.primary} 0%, #389e0d 50%, #52c41a 100%)`,
            color: AppColors.text.white,
            boxShadow: DesignTokens.shadows.glow.human,
            '&:hover': {
                background: `linear-gradient(135deg, #135200 0%, ${AppColors.human.primary} 50%, #389e0d 100%)`,
                transform: 'translateY(-2px)',
                boxShadow: DesignTokens.shadows.xl,
            },
        }),
    }),

    // Create consistent input styles
    input: () => ({
        backgroundColor: AppColors.background.tertiary,
        border: `1px solid ${AppColors.border.primary}`,
        borderRadius: DesignTokens.borderRadius.md,
        color: AppColors.text.primary,
        padding: `${DesignTokens.spacing.sm}px ${DesignTokens.spacing.md}px`,
        fontSize: DesignTokens.typography.fontSize.base,
        transition: DesignTokens.transitions.fast,
        '&:focus': {
            borderColor: AppColors.ai.primary,
            boxShadow: `0 0 0 2px ${AppColors.ai.primary}20`,
            outline: 'none',
        },
        '&::placeholder': {
            color: AppColors.text.muted,
        },
    }),

    // Create consistent layout spacing
    layout: {
        container: {
            maxWidth: '1200px',
            margin: '0 auto',
            padding: `0 ${DesignTokens.spacing.lg}px`,
        },
        section: {
            marginBottom: DesignTokens.spacing.xl,
        },
        stack: (gap: keyof typeof DesignTokens.spacing = 'md') => ({
            display: 'flex',
            flexDirection: 'column' as const,
            gap: DesignTokens.spacing[gap],
        }),
        inline: (gap: keyof typeof DesignTokens.spacing = 'md') => ({
            display: 'flex',
            alignItems: 'center',
            gap: DesignTokens.spacing[gap],
        }),
    },

    // Create consistent text styles
    text: {
        heading: (level: 1 | 2 | 3 | 4 | 5 = 1) => ({
            color: AppColors.text.primary,
            fontWeight: DesignTokens.typography.fontWeight.bold,
            lineHeight: DesignTokens.typography.lineHeight.tight,
            margin: 0,
            fontSize: {
                1: DesignTokens.typography.fontSize['4xl'],
                2: DesignTokens.typography.fontSize['3xl'],
                3: DesignTokens.typography.fontSize['2xl'],
                4: DesignTokens.typography.fontSize.xl,
                5: DesignTokens.typography.fontSize.lg,
            }[level],
        }),
        body: (variant: 'primary' | 'secondary' | 'muted' = 'primary') => ({
            color: {
                primary: AppColors.text.primary,
                secondary: AppColors.text.secondary,
                muted: AppColors.text.muted,
            }[variant],
            fontSize: DesignTokens.typography.fontSize.base,
            lineHeight: DesignTokens.typography.lineHeight.normal,
            margin: 0,
        }),
        code: () => ({
            fontFamily: DesignTokens.typography.fontFamily.mono,
            fontSize: DesignTokens.typography.fontSize.sm,
            backgroundColor: AppColors.background.tertiary,
            color: AppColors.text.primary,
            padding: `${DesignTokens.spacing.xs}px ${DesignTokens.spacing.sm}px`,
            borderRadius: DesignTokens.borderRadius.sm,
            border: `1px solid ${AppColors.border.primary}`,
        }),
    },

    // Animation utilities
    animations: {
        fadeIn: {
            animation: 'fadeIn 0.3s ease-out',
        },
        slideUp: {
            animation: 'slideUp 0.3s ease-out',
        },
        pulse: {
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        },
        glow: (color: string) => ({
            boxShadow: `0 0 20px ${color}`,
            animation: 'glow 2s ease-in-out infinite',
        }),
    },

    // Responsive utilities
    responsive: {
        mobile: '@media (max-width: 768px)',
        tablet: '@media (max-width: 1024px)',
        desktop: '@media (min-width: 1025px)',
    },
};

// CSS-in-JS helper for creating styled components
export const createStyledComponent = (baseStyles: any, variants?: Record<string, any>) => {
    return (variant?: string) => ({
        ...baseStyles,
        ...(variant && variants?.[variant]),
    });
}; 