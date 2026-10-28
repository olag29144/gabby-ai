import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'solid' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'ghost', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-colors duration-150 select-none',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          {
            'hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]':
              variant === 'ghost',
            'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white':
              variant === 'solid',
            'border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)]':
              variant === 'outline',
            'hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-400':
              variant === 'danger',
          },
          {
            'h-7 px-3 text-xs gap-1.5': size === 'sm',
            'h-9 px-4 text-sm': size === 'md',
            'h-11 px-6 text-base': size === 'lg',
            'h-8 w-8 p-0': size === 'icon',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
