import { useState } from 'react';
import { Download, Sparkles, Sun, Moon, LogIn, LogOut, User } from 'lucide-react';
import { useApp } from '@/store/appStore';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/store/authStore';
import { signOut } from '@/lib/authApi';
import { Tooltip } from '@/components/ui/Tooltip';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { AuthModal } from '@/components/auth/AuthModal';
import { DropdownMenu, DropdownItem, DropdownSeparator } from '@/components/ui/DropdownMenu';

/**
 * Temporary Chat icon matching Image 2:
 * A dashed circle with a diagonal pen/pencil inside.
 */
function TemporaryChatIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
      <path d="m14.5 7.5-6 6v2h2l6-6-2-2z" />
    </svg>
  );
}

export function TopHeader() {
  const { state, dispatch } = useApp();
  const { theme, toggleTheme } = useTheme();
  const { state: authState, dispatch: authDispatch } = useAuth();
  const [getAppOpen, setGetAppOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isTemporary = state.isTemporaryChat;
  const user = authState.user;

  const handleSignOut = async () => {
    await signOut();
    authDispatch({ type: 'SIGN_OUT' });
    setUserMenuOpen(false);
  };

  return (
    <>
      {/* Floating top right action buttons (No background bar, no borders - only the buttons) */}
      <div className="absolute top-3 right-3 md:top-4 md:right-5 z-30 flex items-center gap-1.5 md:gap-2 select-none pointer-events-auto">
        {/* Temporary chat status pill if active */}
        {isTemporary && (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-medium backdrop-blur-md shadow-sm">
            <TemporaryChatIcon size={13} />
            <span>Temporary chat is on</span>
          </div>
        )}

        {/* 1. Get app button */}
        <button
          onClick={() => setGetAppOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-raised)]/90 hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] transition-all active:scale-95 shadow-sm backdrop-blur-md"
          aria-label="Get app"
        >
          <Download size={13} className="shrink-0" />
          <span className="hidden sm:inline">Get app</span>
        </button>

        {/* 2. Upgrade button (vibrant blue pill matching design) */}
        <button
          onClick={() => setUpgradeOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1d4ed8] hover:bg-[#2563eb] text-white text-xs font-medium transition-all active:scale-95 shadow-md"
          aria-label="Upgrade plan"
        >
          <Sparkles size={13} className="fill-white shrink-0" />
          <span>Upgrade</span>
        </button>

        {/* 3. Turn on temporary chat button */}
        <Tooltip content={isTemporary ? 'Turn off temporary chat' : 'Turn on temporary chat'} side="bottom">
          <button
            onClick={() => dispatch({ type: 'TOGGLE_TEMPORARY_CHAT' })}
            className={`p-2 rounded-full transition-all active:scale-95 backdrop-blur-md ${
              isTemporary
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                : 'bg-[var(--surface-raised)]/70 hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
            }`}
            aria-label={isTemporary ? 'Turn off temporary chat' : 'Turn on temporary chat'}
          >
            <TemporaryChatIcon size={17} />
          </button>
        </Tooltip>

        {/* 4. Light and dark mode button */}
        <Tooltip content={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} side="bottom">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-[var(--surface-raised)]/70 hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-95 backdrop-blur-md"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </Tooltip>

        {/* 5. User account button */}
        {user ? (
          <DropdownMenu
            open={userMenuOpen}
            onClose={() => setUserMenuOpen(false)}
            align="right"
            trigger={
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold shadow-sm transition-all active:scale-95 hover:opacity-90"
                aria-label="Account menu"
              >
                {(user.displayName ?? user.email).charAt(0).toUpperCase()}
              </button>
            }
          >
            <div className="px-4 py-2.5 border-b border-[var(--border)]">
              <p className="text-xs font-medium text-[var(--text-primary)] truncate">{user.displayName ?? 'Account'}</p>
              <p className="text-[10px] text-[var(--text-muted)] truncate">{user.email}</p>
            </div>
            <DropdownItem icon={<User size={13} />} onClick={() => setUserMenuOpen(false)}>
              Profile
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem icon={<LogOut size={13} />} danger onClick={handleSignOut}>
              Sign out
            </DropdownItem>
          </DropdownMenu>
        ) : (
          <Tooltip content="Sign in" side="bottom">
            <button
              onClick={() => setAuthOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-raised)]/70 hover:bg-[var(--surface-hover)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-95 backdrop-blur-md"
              aria-label="Sign in"
            >
              <LogIn size={13} />
              <span className="hidden sm:inline">Sign in</span>
            </button>
          </Tooltip>
        )}
      </div>

      {/* Temporary chat mobile alert badge */}
      {isTemporary && (
        <div className="md:hidden absolute top-14 right-3 z-30 flex items-center justify-between px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <TemporaryChatIcon size={12} />
            <span>Temporary chat is on</span>
          </div>
          <button
            onClick={() => dispatch({ type: 'SET_TEMPORARY_CHAT', payload: false })}
            className="underline hover:no-underline font-medium ml-2 text-[11px]"
          >
            Turn off
          </button>
        </div>
      )}

      {/* Get App Modal */}
      <Dialog
        open={getAppOpen}
        onClose={() => setGetAppOpen(false)}
        title="Get Nova AI App"
      >
        <div className="space-y-4 text-sm text-[var(--text-secondary)]">
          <p>
            Experience faster access, native keyboard shortcuts, and distraction-free AI on any device.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-overlay)]">
              <div className="font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-2">
                <span>💻 Desktop App (PWA)</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mb-3">
                Install directly in Chrome, Edge, or Brave as a standalone desktop window.
              </p>
              <Button
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  alert('To install Nova AI: Click the Install icon in your browser URL bar, or choose "Install Nova AI" in your browser menu.');
                  setGetAppOpen(false);
                }}
              >
                Install Web App
              </Button>
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-overlay)]">
              <div className="font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-2">
                <span>📱 Mobile Quick Access</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mb-3">
                Tap Share → "Add to Home Screen" on iOS Safari or Android Chrome.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => setGetAppOpen(false)}
              >
                Got it
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Upgrade Modal */}
      <Dialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        title="Upgrade to Nova AI Pro"
      >
        <div className="space-y-4 text-sm text-[var(--text-secondary)]">
          <p>
            Supercharge your workflow with next-generation intelligence, unlimited reasoning, and instant voice notes.
          </p>

          <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-2.5">
            <div className="flex items-baseline justify-between">
              <span className="font-bold text-base text-[var(--text-primary)]">Nova Pro Plan</span>
              <span className="text-sm font-semibold text-blue-400">$20 / month</span>
            </div>
            <ul className="text-xs space-y-1.5 text-[var(--text-primary)] pt-1">
              <li className="flex items-center gap-2">✓ Access to Gemini 2.0 Flash & Gemini 1.5 Pro</li>
              <li className="flex items-center gap-2">✓ Unlimited voice note talking and speech recognition</li>
              <li className="flex items-center gap-2">✓ Multimodal document and photo analysis with 1M+ context window</li>
              <li className="flex items-center gap-2">✓ Lightning fast Groq inference & OpenRouter multi-model support</li>
              <li className="flex items-center gap-2">✓ Priority server availability during peak hours</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setUpgradeOpen(false)}>
              Maybe Later
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-500 text-white"
              onClick={() => {
                alert('Thank you for choosing Nova AI Pro! Pro capabilities are active for your account.');
                setUpgradeOpen(false);
              }}
            >
              Upgrade Now
            </Button>
          </div>
        </div>
      </Dialog>
      {/* Auth Modal */}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </>
  );
}
