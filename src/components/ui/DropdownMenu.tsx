import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DropdownMenuProps {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  placement?: 'top' | 'bottom';
  className?: string;
}

export function DropdownMenu({ open, onClose, trigger, children, align = 'left', placement = 'bottom', className }: DropdownMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Use capture to catch clicks before other handlers
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative inline-flex">
      {trigger}
      {open && (
        <div
          className={cn(
            'absolute z-50 min-w-[200px]',
            placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-1',
            'bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl shadow-2xl',
            'py-1 animate-fade-in',
            align === 'right' ? 'right-0' : 'left-0',
            className
          )}
          role="menu"
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface DropdownItemProps {
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

export function DropdownItem({ onClick, children, className, icon, danger, disabled }: DropdownItemProps) {
  return (
    <button
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors',
        'hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)] outline-none',
        danger ? 'text-red-400 hover:text-red-300' : 'text-[var(--text-primary)]',
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        className
      )}
      onClick={onClick}
      role="menuitem"
      disabled={disabled}
      tabIndex={0}
    >
      {icon && <span className="text-[var(--text-secondary)] shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-[var(--border)]" role="separator" />;
}
