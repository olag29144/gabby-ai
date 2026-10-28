import { Sun, Moon, Monitor, Trash2, Info } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { useTheme } from '@/hooks/useTheme';
import { useApp } from '@/store/appStore';
import { clearAllConversations } from '@/lib/db';
import { AVAILABLE_MODELS } from '@/types';
import { savePreferences } from '@/lib/db';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { Theme } from '@/types';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { theme, setTheme } = useTheme();
  const { state, dispatch } = useApp();
  const [clearConfirm, setClearConfirm] = useState(false);
  const [tab, setTab] = useState<'general' | 'shortcuts'>('general');

  const handleClearHistory = async () => {
    await clearAllConversations();
    dispatch({ type: 'SET_CONVERSATIONS', payload: [] });
    dispatch({ type: 'SET_ACTIVE', payload: null });
    setClearConfirm(false);
    onClose();
  };

  const handleModelChange = async (model: string) => {
    const updated = { ...state.preferences, defaultModel: model };
    dispatch({ type: 'SET_DEFAULT_MODEL', payload: model });
    await savePreferences(updated);
  };

  return (
    <Dialog open={open} onClose={onClose} title="Settings" className="max-w-lg">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 -mt-2 border-b border-[var(--border)] pb-3">
        {(['general', 'shortcuts'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize',
              tab === t
                ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="space-y-6">
          {/* Theme */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">Appearance</label>
            <div className="flex gap-2">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm font-medium transition-all',
                    theme === value
                      ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-hover)]'
                  )}
                  aria-pressed={theme === value}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Default model */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">Default model</label>
            <div className="space-y-1.5">
              {AVAILABLE_MODELS.map(model => (
                <button
                  key={model.id}
                  onClick={() => handleModelChange(model.id)}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all',
                    state.preferences.defaultModel === model.id
                      ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                      : 'border-[var(--border)] hover:bg-[var(--surface-hover)]'
                  )}
                  aria-pressed={state.preferences.defaultModel === model.id}
                >
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium', state.preferences.defaultModel === model.id ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]')}>
                      {model.name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{model.description}</p>
                  </div>
                  {state.preferences.defaultModel === model.id && (
                    <div className="w-4 h-4 rounded-full bg-[var(--accent)] flex items-center justify-center mt-0.5 shrink-0">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="white"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Data */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-3">Data & Privacy</label>
            {!clearConfirm ? (
              <button
                onClick={() => setClearConfirm(true)}
                className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-2 rounded-xl transition-colors w-full"
              >
                <Trash2 size={14} />
                Clear conversation history
              </button>
            ) : (
              <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5">
                <p className="text-sm text-[var(--text-secondary)] mb-3">Delete all conversations? This cannot be undone.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setClearConfirm(false)}
                    className="flex-1 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearHistory}
                    className="flex-1 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-sm text-white font-medium transition-colors"
                  >
                    Delete all
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* About */}
          <div className="pt-2 border-t border-[var(--border)]">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Info size={12} />
              <span>Nova AI v1.0 · Powered by Google Gemini</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'shortcuts' && (
        <div className="space-y-2">
          {[
            ['Send message', 'Enter'],
            ['New line', 'Shift + Enter'],
            ['New chat', 'Ctrl + Shift + O'],
            ['Search conversations', 'Ctrl + K'],
            ['Toggle sidebar', 'Ctrl + B'],
            ['Copy last response', 'Ctrl + Shift + C'],
          ].map(([action, shortcut]) => (
            <div key={action} className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)] last:border-0">
              <span className="text-sm text-[var(--text-secondary)]">{action}</span>
              <kbd className="px-2 py-0.5 text-xs bg-[var(--surface-overlay)] border border-[var(--border)] rounded-md text-[var(--text-primary)] font-mono">
                {shortcut}
              </kbd>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
