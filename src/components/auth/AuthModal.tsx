import { useState } from 'react';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GabbyLogo } from '@/assets/GabbyLogo';
import { signIn, signUp } from '@/lib/authApi';
import { useAuth } from '@/store/authStore';
import { getMe } from '@/lib/authApi';

interface AuthModalProps {
  onClose?: () => void;
}

type Mode = 'signin' | 'signup';

export function AuthModal({ onClose }: AuthModalProps) {
  const { dispatch } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password, displayName);
      } else {
        await signIn(email, password);
      }
      const user = await getMe();
      dispatch({ type: 'SET_USER', payload: user });
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl shadow-2xl animate-slide-in">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-muted)] transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        )}

        <div className="px-8 pt-8 pb-6">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <GabbyLogo size={40} />
            <h1 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">Gabby AI</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {mode === 'signin' ? 'Sign in to your account' : 'Create an account'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Display name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className={inputClass}
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className={inputClass}
                autoComplete="email"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                  required
                  minLength={8}
                  className={cn(inputClass, 'pr-10')}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className={cn(
                'w-full h-10 rounded-full text-sm font-medium transition-all',
                'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2'
              )}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
              {' '}
              <button
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
                className="text-[var(--accent)] hover:underline font-medium"
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          <p className="mt-4 text-center text-[10px] text-[var(--text-muted)]">
            Continue as guest to use without an account
          </p>
          {onClose && (
            <button
              onClick={onClose}
              className="mt-1 w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors py-1"
            >
              Continue as guest →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const inputClass = [
  'w-full h-10 px-3 rounded-xl text-sm',
  'bg-[var(--surface-overlay)] border border-[var(--border)]',
  'text-[var(--text-primary)] placeholder-[var(--text-muted)]',
  'focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]',
  'transition-colors',
].join(' ');
