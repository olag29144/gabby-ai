import { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { signIn, signUp } from '@/lib/authApi';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kdzxcdrmltgrmnknxsml.supabase.co';
const supabaseAnonKey = 'sb_publishable_LxbXpckAPL1xIek-ogPSHw_q19p-Feh';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Mode = 'landing' | 'signin' | 'signup' | 'success';

interface AuthPageProps {
  onAuthenticated: () => void;
}

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<Mode>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Small delay for entrance animation
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password, displayName);
      } else {
        await signIn(email, password);
      }
      setMode('success');
      setTimeout(() => onAuthenticated(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setOauthLoading(provider);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: provider === 'github' ? 'user:email' : undefined,
        },
      });
      if (error) throw new Error(error.message);
      // Browser will redirect — loading stays true
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes('provider is not enabled')
          ? `${provider === 'google' ? 'Google' : 'GitHub'} sign-in is not yet configured. Use email/password for now.`
          : err instanceof Error ? err.message : 'OAuth failed.'
      );
      setOauthLoading(null);
    }
  };

  if (mode === 'success') {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <CheckCircle2 size={52} className="text-green-400" />
          <p className="text-[#e3e3e3] text-lg font-medium">Welcome to Gabby AI</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#0f1117] flex flex-col"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'none' : 'translateY(8px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}
    >
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(79,142,247,0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative flex flex-col items-center justify-center flex-1 px-4 py-12">
        {/* Back button when in form mode */}
        {(mode === 'signin' || mode === 'signup') && (
          <button
            onClick={() => { setMode('landing'); setError(''); }}
            className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-[#9aa0a6] hover:text-[#e3e3e3] transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        )}

        {/* Logo + wordmark */}
        <div className="flex flex-col items-center mb-8">
          <div style={{ filter: 'drop-shadow(0 0 20px rgba(79,142,247,0.4))' }}>
            <LogoMark size={52} />
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-[#e3e3e3] tracking-tight">
            Gabby AI
          </h1>
          <p className="mt-1.5 text-sm text-[#9aa0a6]">
            {mode === 'landing' && 'Your intelligent AI assistant'}
            {mode === 'signin' && 'Welcome back'}
            {mode === 'signup' && 'Create your account'}
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm">
          {mode === 'landing' ? (
            <LandingButtons
              onSignIn={() => setMode('signin')}
              onSignUp={() => setMode('signup')}
              onOAuth={handleOAuth}
              oauthLoading={oauthLoading}
              error={error}
            />
          ) : (
            <AuthForm
              mode={mode}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              displayName={displayName}
              setDisplayName={setDisplayName}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              loading={loading}
              error={error}
              onSubmit={handleEmailSubmit}
              onOAuth={handleOAuth}
              oauthLoading={oauthLoading}
              onToggleMode={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError('');
              }}
            />
          )}
        </div>

        {/* Guest mode */}
        <button
          onClick={onAuthenticated}
          className="mt-6 text-xs text-[#5f6368] hover:text-[#9aa0a6] transition-colors"
        >
          Continue without an account →
        </button>

        <p className="mt-8 text-[10px] text-[#5f6368] text-center max-w-xs">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

// ── Landing buttons ─────────────────────────────────────────────────────────

function LandingButtons({
  onSignIn,
  onSignUp,
  onOAuth,
  oauthLoading,
  error,
}: {
  onSignIn: () => void;
  onSignUp: () => void;
  onOAuth: (p: 'google' | 'github') => void;
  oauthLoading: 'google' | 'github' | null;
  error: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* OAuth buttons */}
      <OAuthButton
        provider="google"
        loading={oauthLoading === 'google'}
        disabled={!!oauthLoading}
        onClick={() => onOAuth('google')}
      />
      <OAuthButton
        provider="github"
        loading={oauthLoading === 'github'}
        disabled={!!oauthLoading}
        onClick={() => onOAuth('github')}
      />

      {/* Divider */}
      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-white/8" />
        <span className="text-xs text-[#5f6368]">or</span>
        <div className="flex-1 h-px bg-white/8" />
      </div>

      {/* Email buttons */}
      <button
        onClick={onSignIn}
        className="w-full h-11 rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 text-[#e3e3e3] text-sm font-medium transition-all active:scale-[0.98]"
      >
        Sign in with email
      </button>
      <button
        onClick={onSignUp}
        className="w-full h-11 rounded-xl bg-[#4f8ef7] hover:bg-[#6ba3ff] text-white text-sm font-medium transition-all active:scale-[0.98]"
      >
        Create free account
      </button>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-center mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

// ── Auth form ───────────────────────────────────────────────────────────────

function AuthForm({
  mode,
  email, setEmail,
  password, setPassword,
  displayName, setDisplayName,
  showPassword, setShowPassword,
  loading, error,
  onSubmit, onOAuth, oauthLoading, onToggleMode,
}: {
  mode: 'signin' | 'signup';
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  displayName: string; setDisplayName: (v: string) => void;
  showPassword: boolean; setShowPassword: (v: boolean) => void;
  loading: boolean; error: string;
  onSubmit: (e: React.FormEvent) => void;
  onOAuth: (p: 'google' | 'github') => void;
  oauthLoading: 'google' | 'github' | null;
  onToggleMode: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* OAuth */}
      <OAuthButton provider="google" loading={oauthLoading === 'google'} disabled={!!oauthLoading} onClick={() => onOAuth('google')} />
      <OAuthButton provider="github" loading={oauthLoading === 'github'} disabled={!!oauthLoading} onClick={() => onOAuth('github')} />

      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-white/8" />
        <span className="text-xs text-[#5f6368]">or with email</span>
        <div className="flex-1 h-px bg-white/8" />
      </div>

      {/* Email form */}
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {mode === 'signup' && (
          <div>
            <label className="block text-xs font-medium text-[#9aa0a6] mb-1.5">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              className={inputCls}
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-[#9aa0a6] mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            autoFocus
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#9aa0a6] mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
              required
              minLength={8}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className={cn(inputCls, 'pr-10')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f6368] hover:text-[#9aa0a6] transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !email || !password}
          className={cn(
            'w-full h-11 rounded-xl text-sm font-medium transition-all active:scale-[0.98] mt-1',
            'bg-[#4f8ef7] hover:bg-[#6ba3ff] text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center justify-center gap-2'
          )}
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-xs text-[#9aa0a6] mt-1">
        {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
        {' '}
        <button
          onClick={onToggleMode}
          className="text-[#4f8ef7] hover:underline font-medium"
        >
          {mode === 'signin' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </div>
  );
}

// ── OAuth button ────────────────────────────────────────────────────────────

function OAuthButton({
  provider,
  loading,
  disabled,
  onClick,
}: {
  provider: 'google' | 'github';
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full h-11 rounded-xl border border-white/10 bg-white/5',
        'hover:bg-white/10 active:scale-[0.98]',
        'flex items-center justify-center gap-3',
        'text-sm font-medium text-[#e3e3e3]',
        'transition-all disabled:opacity-50 disabled:cursor-not-allowed'
      )}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : provider === 'google' ? (
        <GoogleIcon />
      ) : (
        <GithubIcon />
      )}
      {loading
        ? `Connecting to ${provider === 'google' ? 'Google' : 'GitHub'}...`
        : `Continue with ${provider === 'google' ? 'Google' : 'GitHub'}`}
    </button>
  );
}

// ── SVG Icons ───────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#e3e3e3" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function LogoMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="auth-g" x1="3" y1="3" x2="29" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="35%" stopColor="#f43f5e" />
          <stop offset="70%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <path
        d="M16 2C16 9.732 22.268 16 30 16C22.268 16 16 22.268 16 30C16 22.268 9.732 16 2 16C9.732 16 16 9.732 16 2Z"
        fill="url(#auth-g)"
      />
    </svg>
  );
}

const inputCls = [
  'w-full h-10 px-3 rounded-xl text-sm',
  'bg-white/5 border border-white/10',
  'text-[#e3e3e3] placeholder-[#5f6368]',
  'focus:outline-none focus:border-[#4f8ef7] focus:ring-1 focus:ring-[#4f8ef7]/40',
  'transition-colors',
].join(' ');
