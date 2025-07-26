import { Variants, Transition } from 'framer-motion';

// Page and section entrance animations
export const pageVariants: Variants = {
    initial: {
        opacity: 0,
        y: 20,
        scale: 0.98
    },
    animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            duration: 0.4,
            ease: 'easeOut'
        }
    },
    exit: {
        opacity: 0,
        y: -20,
        scale: 0.98,
        transition: {
            duration: 0.3,
            ease: 'easeIn'
        }
    }
};

// Fade animations
export const fadeVariants: Variants = {
    initial: { opacity: 0 },
    animate: {
        opacity: 1,
        transition: {
            duration: 0.3,
            ease: 'easeOut'
        }
    },
    exit: {
        opacity: 0,
        transition: {
            duration: 0.2,
            ease: 'easeIn'
        }
    }
};

// Slide animations
export const slideUpVariants: Variants = {
    initial: {
        opacity: 0,
        y: 30
    },
    animate: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.35,
            ease: [0.4, 0, 0.2, 1] // Custom cubic bezier
        }
    },
    exit: {
        opacity: 0,
        y: -30,
        transition: {
            duration: 0.25,
            ease: 'easeIn'
        }
    }
};

export const slideInRightVariants: Variants = {
    initial: {
        opacity: 0,
        x: 20
    },
    animate: {
        opacity: 1,
        x: 0,
        transition: {
            duration: 0.3,
            ease: 'easeOut'
        }
    },
    exit: {
        opacity: 0,
        x: 20,
        transition: {
            duration: 0.2,
            ease: 'easeIn'
        }
    }
};

// Card and button interactions
export const hoverLiftVariants: Variants = {
    initial: { y: 0 },
    hover: {
        y: -4,
        transition: {
            duration: 0.2,
            ease: 'easeOut'
        }
    },
    tap: {
        y: 0,
        scale: 0.98,
        transition: {
            duration: 0.1
        }
    }
};

export const buttonPressVariants: Variants = {
    initial: { scale: 1 },
    hover: {
        scale: 1.02,
        transition: {
            duration: 0.15,
            ease: 'easeOut'
        }
    },
    tap: {
        scale: 0.98,
        transition: {
            duration: 0.1
        }
    }
};

// Enhanced button variants with glow effects
export const aiButtonVariants: Variants = {
    initial: {
        scale: 1,
        boxShadow: '0 4px 12px rgba(109, 40, 217, 0.3)'
    },
    hover: {
        scale: 1.02,
        y: -2,
        boxShadow: '0 8px 24px rgba(109, 40, 217, 0.5)',
        transition: {
            duration: 0.2,
            ease: 'easeOut'
        }
    },
    tap: {
        scale: 0.98,
        y: 0,
        transition: {
            duration: 0.1
        }
    }
};

export const humanButtonVariants: Variants = {
    initial: {
        scale: 1,
        boxShadow: '0 4px 12px rgba(35, 120, 4, 0.4)'
    },
    hover: {
        scale: 1.02,
        y: -2,
        boxShadow: '0 8px 24px rgba(35, 120, 4, 0.6)',
        transition: {
            duration: 0.2,
            ease: 'easeOut'
        }
    },
    tap: {
        scale: 0.98,
        y: 0,
        transition: {
            duration: 0.1
        }
    }
};

// List and stagger animations
export const staggerContainerVariants: Variants = {
    initial: {},
    animate: {
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1
        }
    },
    exit: {
        transition: {
            staggerChildren: 0.05,
            staggerDirection: -1
        }
    }
};

export const staggerItemVariants: Variants = {
    initial: {
        opacity: 0,
        y: 20,
        scale: 0.95
    },
    animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            duration: 0.3,
            ease: 'easeOut'
        }
    },
    exit: {
        opacity: 0,
        y: -10,
        scale: 0.95,
        transition: {
            duration: 0.2,
            ease: 'easeIn'
        }
    }
};

// Modal and drawer animations
export const modalVariants: Variants = {
    initial: {
        opacity: 0,
        scale: 0.9,
        y: -20
    },
    animate: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: {
            duration: 0.35,
            ease: [0.4, 0, 0.2, 1]
        }
    },
    exit: {
        opacity: 0,
        scale: 0.9,
        y: -20,
        transition: {
            duration: 0.25,
            ease: 'easeIn'
        }
    }
};

export const drawerVariants: Variants = {
    initial: {
        opacity: 0,
        x: '100%'
    },
    animate: {
        opacity: 1,
        x: 0,
        transition: {
            duration: 0.4,
            ease: [0.4, 0, 0.2, 1]
        }
    },
    exit: {
        opacity: 0,
        x: '100%',
        transition: {
            duration: 0.3,
            ease: 'easeIn'
        }
    }
};

// Form field animations
export const fieldVariants: Variants = {
    initial: {
        borderColor: '#404040',
        boxShadow: 'none'
    },
    focus: {
        borderColor: '#1890ff',
        boxShadow: '0 0 0 2px rgba(24, 144, 255, 0.2)',
        transition: {
            duration: 0.2,
            ease: 'easeOut'
        }
    },
    error: {
        borderColor: '#ff4d4f',
        boxShadow: '0 0 0 2px rgba(255, 77, 79, 0.2)',
        transition: {
            duration: 0.2,
            ease: 'easeOut'
        }
    }
};

// Loading and progress animations
export const pulseVariants: Variants = {
    initial: { opacity: 0.6 },
    animate: {
        opacity: 1,
        transition: {
            duration: 1.2,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut'
        }
    }
};

export const spinVariants: Variants = {
    animate: {
        rotate: 360,
        transition: {
            duration: 1,
            repeat: Infinity,
            ease: 'linear'
        }
    }
};

// Notification animations
export const toastVariants: Variants = {
    initial: {
        opacity: 0,
        y: -50,
        scale: 0.9
    },
    animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            type: 'spring',
            stiffness: 400,
            damping: 30
        }
    },
    exit: {
        opacity: 0,
        y: -50,
        scale: 0.9,
        transition: {
            duration: 0.2,
            ease: 'easeIn'
        }
    }
};

// Common transition presets
export const transitions = {
    fast: { duration: 0.15, ease: 'easeOut' } as Transition,
    medium: { duration: 0.3, ease: 'easeInOut' } as Transition,
    slow: { duration: 0.6, ease: 'easeInOut' } as Transition,
    spring: { type: 'spring', stiffness: 400, damping: 30 } as Transition,
    springGentle: { type: 'spring', stiffness: 260, damping: 20 } as Transition,
    springBouncy: { type: 'spring', stiffness: 600, damping: 15 } as Transition
}; 