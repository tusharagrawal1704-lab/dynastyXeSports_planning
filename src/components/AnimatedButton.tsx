import { forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'accent' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface AnimatedButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: Variant;
  size?: Size;
  glow?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20',
  accent: 'bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20',
  ghost: 'glass text-foreground hover:bg-white/10',
  outline: 'border border-primary/40 text-primary hover:bg-primary/10 hover:border-primary/60',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-6 text-sm',
  lg: 'h-14 px-8 text-base',
};

export const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ variant = 'primary', size = 'md', glow, className, children, ...props }, ref) => (
    <motion.button
      ref={ref}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        glow && (variant === 'primary' ? 'glow-neon' : 'glow-orange'),
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  )
);
AnimatedButton.displayName = 'AnimatedButton';
