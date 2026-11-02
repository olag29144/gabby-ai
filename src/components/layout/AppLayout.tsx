import { useState, useEffect, useReducer, useRef } from 'react';
import { NovaLogo } from '@/assets/NovaLogo';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { HomeScreen } from '@/pages/HomeScreen';
import { ChatView } from '@/components/chat/ChatView';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { TopHeader } from '@/components/layout/TopHeader';
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
      dispatch({ type: 'SET_SIDEBAR', payload: false });
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
      if (e.key === 'Escape' && state.sidebarOpen) {
        dispatch({ type: 'SET_SIDEBAR', payload: false });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [dispatch, state.sidebarOpen]);

  const handleNewChat = () => {
    dispatch({ type: 'SET_ACTIVE', payload: null });
    dispatch({ type: 'SET_SIDEBAR', payload: false });
    setMobileOpen(false);
  };

  const handleHomeSend = async (content: string, attachments: Attachment[]) => {
    const conv = await createConversation(content);
    pendingChatRef.current = { content, attachments };
    dispatch({ type: 'SET_ACTIVE', payload: conv.id });
  };

  const handleModelChange = (model: string) => {
    dispatch({ type: 'SET_DEFAULT_MODEL', payload: model });
  };

  const handleSelectPrompt = (promptText: string) => {
    dispatch({ type: 'SET_ACTIVE', payload: null });
    handleHomeSend(promptText, []);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-[var(--surface)]">
      {/* Desktop borderless floating icon column (always visible on left, no background bar, only icons) */}
      <div className="hidden md:flex h-full shrink-0 z-20">
        <Sidebar
          onNewChat={handleNewChat}
          onOpenSettings={() => setSettingsOpen(true)}
          onSelectPrompt={handleSelectPrompt}
          forceCollapsed
        />
      </div>

      {/* Desktop Expanded Drawer Overlay (Opens when clicking logo or search) */}
      {state.sidebarOpen && (
        <div className="hidden md:flex fixed inset-0 z-40 pointer-events-none">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px] pointer-events-auto transition-opacity"
            onClick={() => dispatch({ type: 'SET_SIDEBAR', payload: false })}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full pointer-events-auto shadow-2xl animate-in slide-in-from-left duration-200">
            <Sidebar
              onNewChat={handleNewChat}
              onOpenSettings={() => { setSettingsOpen(true); dispatch({ type: 'SET_SIDEBAR', payload: false }); }}
              onSelectPrompt={(p) => { handleSelectPrompt(p); dispatch({ type: 'SET_SIDEBAR', payload: false }); }}
              onClose={() => dispatch({ type: 'SET_SIDEBAR', payload: false })}
              forceExpanded
            />
          </div>
        </div>
      )}

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" style={{ '--sidebar-width': '280px' } as React.CSSProperties}>
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full shadow-2xl">
            <Sidebar
              onNewChat={handleNewChat}
              onOpenSettings={() => { setSettingsOpen(true); setMobileOpen(false); }}
              onSelectPrompt={(p) => { handleSelectPrompt(p); setMobileOpen(false); }}
              onClose={() => setMobileOpen(false)}
              forceExpanded
            />
          </div>
        </div>
      )}


      {/* Main Content Area */}
      <div className="relative flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Mobile floating logo button (clicking opens the sidebar) */}
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden absolute top-3 left-3 z-50 w-10 h-10 rounded-full bg-[var(--surface-raised)] hover:bg-[var(--surface-hover)] border border-[var(--border)] shadow-md backdrop-blur-md active:scale-95 transition-all flex items-center justify-center group cursor-pointer"
          aria-label="Open sidebar"
        >
          <NovaLogo size={24} />
        </button>

        {/* Floating 4 top-right buttons (no navbar bar, only the buttons) */}
        <TopHeader />

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
