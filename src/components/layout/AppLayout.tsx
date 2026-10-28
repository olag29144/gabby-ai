import { useState, useEffect, useReducer, useRef } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { HomeScreen } from '@/pages/HomeScreen';
import { ChatView } from '@/components/chat/ChatView';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { NovaLogo } from '@/assets/NovaLogo';
import { AppContext, appReducer, initialState, useApp } from '@/store/appStore';
import { getAllConversations, getPreferences } from '@/lib/db';
import type { Attachment } from '@/types';
import { useConversations } from '@/hooks/useConversations';
import { useTheme } from '@/hooks/useTheme';

export function AppLayout() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    async function init() {
      const [convs, prefs] = await Promise.all([getAllConversations(), getPreferences()]);
      dispatch({ type: 'SET_CONVERSATIONS', payload: convs });
      dispatch({ type: 'SET_PREFERENCES', payload: prefs });
      dispatch({ type: 'SET_SIDEBAR', payload: prefs.sidebarOpen });
      dispatch({ type: 'SET_LOADING', payload: false });

      const root = document.documentElement;
      root.className = '';
      if (prefs.theme === 'system') {
        root.classList.add(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      } else {
        root.classList.add(prefs.theme === 'dark' ? 'dark' : 'light');
      }
    }
    init();
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <Shell />
    </AppContext.Provider>
  );
}

function Shell() {
  const { state, dispatch } = useApp();
  useTheme(); // Apply theme changes reactively
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { createConversation } = useConversations();
  const pendingChatRef = useRef<{ content: string; attachments: Attachment[] } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_SIDEBAR' });
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        dispatch({ type: 'SET_ACTIVE', payload: null });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [dispatch]);

  const handleNewChat = () => {
    dispatch({ type: 'SET_ACTIVE', payload: null });
    setMobileOpen(false);
  };

  const handleHomeSend = async (content: string, attachments: Attachment[]) => {
    const conv = await createConversation(content);
    pendingChatRef.current = { content, attachments };
    dispatch({ type: 'SET_ACTIVE', payload: conv.id }); // createConversation no longer sets active
  };

  const handleModelChange = (model: string) => {
    dispatch({ type: 'SET_DEFAULT_MODEL', payload: model });
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-[var(--surface)]">
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full shrink-0">
        <Sidebar onNewChat={handleNewChat} onOpenSettings={() => setSettingsOpen(true)} />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex" style={{ '--sidebar-width': '280px' } as React.CSSProperties}>
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full">
            <Sidebar
              onNewChat={handleNewChat}
              onOpenSettings={() => { setSettingsOpen(true); setMobileOpen(false); }}
            />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-[var(--border)] shrink-0 bg-[var(--surface)]">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors"
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <NovaLogo size={22} />
            <span className="font-semibold text-sm text-[var(--text-primary)]">Nova AI</span>
          </div>
          <div className="w-9" aria-hidden="true" />
        </header>

        {/* Desktop collapsed sidebar bar */}
        {!state.sidebarOpen && (
          <div className="hidden md:flex items-center gap-2 px-4 h-14 shrink-0 border-b border-[var(--border-subtle)]">
            <button
              onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
              className="p-1.5 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Open sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
              </svg>
            </button>
            <NovaLogo size={20} />
            <span className="font-semibold text-sm text-[var(--text-primary)]">Nova AI</span>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 min-h-0 overflow-hidden">
          {state.activeConversationId ? (
            <ChatView
              conversationId={state.activeConversationId}
              pendingMessage={pendingChatRef.current}
              onPendingConsumed={() => { pendingChatRef.current = null; }}
            />
          ) : (
            <HomeScreen
              onSend={handleHomeSend}
              isLoading={false}
              selectedModel={state.preferences.defaultModel}
              onModelChange={handleModelChange}
            />
          )}
        </main>
      </div>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
