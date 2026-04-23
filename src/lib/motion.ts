import type { Variants, Transition } from 'framer-motion';

export const TRANSITIONS: Record<string, Transition> = {
  fast: { duration: 0.16, ease: 'easeOut' },
  medium: { duration: 0.22, ease: 'easeOut' },
  slow: { duration: 0.32, ease: 'easeOut' },
};

export const VARIANTS: Record<string, Variants> = {
  slideInUp: {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: TRANSITIONS.medium },
  },
  slideInRight: {
    hidden: { opacity: 0, x: 12 },
    visible: { opacity: 1, x: 0, transition: TRANSITIONS.medium },
  },
  cardHover: {
    rest: { scale: 1, y: 0 },
    hover: { scale: 1.01, y: -1, transition: TRANSITIONS.fast },
    tap: { scale: 0.99, transition: TRANSITIONS.fast },
  },
};
