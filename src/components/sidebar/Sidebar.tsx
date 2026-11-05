import { useState, useRef, useEffect } from 'react';
import {
  Plus, Search, Pin, MoreHorizontal, Pencil, Trash2,
  PinOff, X, Settings, LayoutGrid, Image as ImageIcon,
  Clock, Hexagon, Video, BookOpen, Filter, Sparkles, Check, Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/store/appStore';
import { useConversations } from '@/hooks/useConversations';
import { useAuth } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { DropdownMenu, DropdownItem, DropdownSeparator } from '@/components/ui/DropdownMenu';
import { Dialog } from '@/components/ui/Dialog';
import { Tooltip } from '@/components/ui/Tooltip';
import { NovaLogo } from '@/assets/NovaLogo';

interface SidebarProps {
  onNewChat: () => void;
  onOpenSettings: () => void;
  onSelectPrompt?: (prompt: string) => void;
  onClose?: () => void;
  forceCollapsed?: boolean;
  forceExpanded?: boolean;
}

/**
 * Custom circle-pen icon matching Gemini design in image_bf623ff2.png
 */
function GeminiNewChatIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M10 13.5l4-4a1 1 0 0 1 1.5 1.5l-4 4-2 .5.5-2z" />
    </svg>
  );
}

/**
 * Sidebar collapse icon matching top right of sidebar in image_bf623ff2.png
 */
function GeminiSidebarToggleIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
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
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M15 3v18" />
    </svg>
  );
}

export function Sidebar({ onNewChat, onOpenSettings, onSelectPrompt, onClose, forceCollapsed, forceExpanded }: SidebarProps) {
  const { state, dispatch } = useApp();
  const { state: authState } = useAuth();
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    renameConversation,
    deleteConversation,
    togglePin,
    createNotebook,
  } = useConversations();

  const handleCollapse = () => {
    dispatch({ type: 'SET_SIDEBAR', payload: false });
    onClose?.();
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pinned' | 'notebooks'>('all');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  // Dialog states for menu items
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [imagesOpen, setImagesOpen] = useState(false);
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const [videosOpen, setVideosOpen] = useState(false);

  const renameInputRef = useRef<HTMLInputElement>(null);
  const isOpen = forceExpanded ? true : forceCollapsed ? false : state.sidebarOpen;

  useEffect(() => {
    if (renameId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameId]);

  // Filtering conversations
  const filtered = conversations.filter(c => {
    const matchesSearch = !searchQuery ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (activeFilter === 'pinned') return c.pinned;
    if (activeFilter === 'notebooks') return c.isNotebook;
    return true;
  });

  const notebooks = filtered.filter(c => c.isNotebook);
  const regularChats = filtered.filter(c => !c.isNotebook);

  const handleRenameSubmit = async (id: string) => {
    if (renameValue.trim()) await renameConversation(id, renameValue.trim());
    setRenameId(null);
  };

  const handleDeleteConfirm = async () => {
    if (deleteId) await deleteConversation(deleteId);
    setDeleteId(null);
  };

  const handleCreateNotebook = async () => {
    const nb = await createNotebook(`Notebook ${notebooks.length + 1}`);
    setActiveConversation(nb.id);
    onClose?.();
  };

  // ── COLLAPSED ICON RAIL (Matching image_2a84cd25.png — no bar, borderless, clean icons only) ─────
  if (!isOpen) {
    return (
      <>
        <aside
          className="flex flex-col items-center justify-between h-full w-14 bg-transparent border-none shrink-0 py-3.5 select-none"
          aria-label="Icon Sidebar"
        >
          {/* Top section: Logo and vertical icons matching image_2a84cd25.png */}
          <div className="flex flex-col items-center gap-3 w-full">
            {/* Sparkle Logo at the top - clicking it opens the full sidebar */}
            <Tooltip content="Open sidebar" side="right">
              <button
                onClick={() => dispatch({ type: 'SET_SIDEBAR', payload: true })}
                className="p-1 rounded-xl hover:bg-white/10 dark:hover:bg-white/10 transition-all hover:scale-110 active:scale-95 group focus-visible:outline-none cursor-pointer"
                aria-label="Open sidebar"
              >
                <NovaLogo size={28} />
              </button>
            </Tooltip>

            {/* New chat (pencil icon) */}
            <Tooltip content="New chat" side="right">
              <button
                onClick={onNewChat}
                className="w-9 h-9 rounded-full bg-[var(--surface-overlay)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                aria-label="New chat"
              >
                <GeminiNewChatIcon size={17} />
              </button>
            </Tooltip>

            {/* Search */}
            <Tooltip content="Search" side="right">
              <button
                onClick={() => {
                  dispatch({ type: 'SET_SIDEBAR', payload: true });
                  setShowSearch(true);
                }}
                className="w-9 h-9 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Search"
              >
                <Search size={18} />
              </button>
            </Tooltip>

            {/* Library (4 rounded squares) */}
            <Tooltip content="Library" side="right">
              <button
                onClick={() => setLibraryOpen(true)}
                className="w-9 h-9 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Library"
              >
                <LayoutGrid size={18} />
              </button>
            </Tooltip>

            {/* Images */}
            <Tooltip content="Images" side="right">
              <button
                onClick={() => setImagesOpen(true)}
                className="w-9 h-9 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Images"
              >
                <ImageIcon size={18} />
              </button>
            </Tooltip>

            {/* Scheduled */}
            <Tooltip content="Scheduled" side="right">
              <button
                onClick={() => setScheduledOpen(true)}
                className="w-9 h-9 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Scheduled"
              >
                <Clock size={18} />
              </button>
            </Tooltip>

            {/* Customise */}
            <Tooltip content="Customise" side="right">
              <button
                onClick={() => setCustomiseOpen(true)}
                className="w-9 h-9 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Customise"
              >
                <Hexagon size={18} />
              </button>
            </Tooltip>
          </div>

          {/* Bottom section: Settings & User Profile Avatar V */}
          <div className="flex flex-col items-center gap-3 w-full">
            <Tooltip content="Settings" side="right">
              <button
                onClick={onOpenSettings}
                className="w-9 h-9 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Settings"
              >
                <Settings size={18} />
              </button>
            </Tooltip>

            <Tooltip content={authState.user ? (authState.user.displayName ?? authState.user.email) : 'Profile (Guest)'} side="right">
              <button
                onClick={onOpenSettings}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center text-xs font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                aria-label="Profile"
              >
                {authState.user
                  ? (authState.user.displayName ?? authState.user.email).charAt(0).toUpperCase()
                  : 'G'}
              </button>
            </Tooltip>
          </div>
        </aside>

        {/* Dialogs for menu items */}
        <LibraryDialog open={libraryOpen} onClose={() => setLibraryOpen(false)} onSelectPrompt={onSelectPrompt} />
        <ImagesDialog open={imagesOpen} onClose={() => setImagesOpen(false)} onNewChat={onNewChat} />
        <ScheduledDialog open={scheduledOpen} onClose={() => setScheduledOpen(false)} />
        <CustomiseDialog open={customiseOpen} onClose={() => setCustomiseOpen(false)} />
        <VideosDialog open={videosOpen} onClose={() => setVideosOpen(false)} />
      </>
    );
  }

  // ── EXPANDED FULL SIDEBAR (Matching image_bf623ff2.png exactly) ───────────
  return (
    <>
      <aside
        className="flex flex-col h-full bg-[var(--sidebar-bg)] border-r border-[var(--border-subtle)] transition-all duration-200 ease-in-out overflow-hidden shrink-0 w-[270px] select-none"
        aria-label="Expanded Sidebar"
      >
        <div className="flex flex-col h-full w-[270px]">
          {/* Header matching image_bf623ff2.png */}
          <div className="flex items-center justify-between px-4 h-14 shrink-0">
            {/* Logo + "Gemini" text */}
            <div className="flex items-center gap-2.5">
              <NovaLogo size={24} />
              <span className="text-[17px] font-semibold text-[var(--text-primary)] tracking-tight">
                Gemini
              </span>
            </div>

            {/* Right icons: Search + Collapse toggle */}
            <div className="flex items-center gap-1">
              <Tooltip content="Search" side="bottom">
                <button
                  onClick={() => setShowSearch(s => !s)}
                  className="p-1.5 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  aria-label="Search"
                >
                  <Search size={18} />
                </button>
              </Tooltip>

              <Tooltip content="Collapse sidebar" side="bottom">
                <button
                  onClick={handleCollapse}
                  className="p-1.5 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  aria-label="Collapse sidebar"
                >
                  <GeminiSidebarToggleIcon size={18} />
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Search bar when toggled */}
          {showSearch && (
            <div className="px-3 pb-2 shrink-0">
              <div className="flex items-center gap-2 bg-[var(--surface-overlay)] rounded-full px-3 h-8.5">
                <Search size={13} className="text-[var(--text-muted)] shrink-0" />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
                  autoFocus
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} aria-label="Clear search">
                    <X size={13} className="text-[var(--text-muted)]" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Top navigation items list matching image_bf623ff2.png */}
          <div className="px-2 pt-1 pb-2 space-y-0.5 shrink-0">
            {/* New chat */}
            <button
              onClick={() => {
                onNewChat();
                onClose?.();
              }}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <GeminiNewChatIcon size={18} className="text-[var(--text-primary)] shrink-0" />
              <span>New chat</span>
            </button>

            {/* Library */}
            <button
              onClick={() => setLibraryOpen(true)}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <LayoutGrid size={18} className="shrink-0" />
              <span>Library</span>
            </button>

            {/* Images */}
            <button
              onClick={() => setImagesOpen(true)}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <ImageIcon size={18} className="shrink-0" />
              <span>Images</span>
            </button>

            {/* Scheduled */}
            <button
              onClick={() => setScheduledOpen(true)}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Clock size={18} className="shrink-0" />
              <span>Scheduled</span>
            </button>

            {/* Customise */}
            <button
              onClick={() => setCustomiseOpen(true)}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Hexagon size={18} className="shrink-0" />
              <span>Customise</span>
            </button>

            {/* Videos */}
            <button
              onClick={() => setVideosOpen(true)}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Video size={18} className="shrink-0" />
              <span>Videos</span>
            </button>
          </div>

          {/* Section: Notebooks matching image_bf623ff2.png */}
          <div className="px-3 pt-3 pb-1 border-t border-[var(--border-subtle)] shrink-0">
            <span className="text-xs font-semibold text-[var(--text-muted)] tracking-wider">
              Notebooks
            </span>
            <button
              onClick={handleCreateNotebook}
              className="flex items-center gap-2.5 w-full mt-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Plus size={14} className="shrink-0" />
              <span>New notebook</span>
            </button>

            {/* List any created notebooks */}
            {notebooks.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {notebooks.map(nb => (
                  <button
                    key={nb.id}
                    onClick={() => {
                      setActiveConversation(nb.id);
                      onClose?.();
                    }}
                    className={cn(
                      'flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs truncate transition-colors text-left',
                      activeConversationId === nb.id
                        ? 'bg-[var(--surface-overlay)] text-[var(--text-primary)] font-medium'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    <BookOpen size={13} className="shrink-0 text-blue-400" />
                    <span className="truncate">{nb.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Section: All matching image_bf623ff2.png */}
          <div className="flex-1 flex flex-col min-h-0 pt-2 px-2">
            <div className="flex items-center justify-between px-2 pb-1.5 shrink-0">
              <span className="text-xs font-semibold text-[var(--text-muted)] tracking-wider">
                All
              </span>

              {/* Filter menu */}
              <DropdownMenu
                open={filterMenuOpen}
                onClose={() => setFilterMenuOpen(false)}
                align="right"
                trigger={
                  <button
                    onClick={() => setFilterMenuOpen(o => !o)}
                    className={cn(
                      'p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors',
                      activeFilter !== 'all' && 'text-[var(--accent)] font-semibold'
                    )}
                    aria-label="Filter chats"
                  >
                    <Filter size={13} />
                  </button>
                }
              >
                <DropdownItem onClick={() => { setActiveFilter('all'); setFilterMenuOpen(false); }}>
                  <div className="flex items-center justify-between w-full">
                    <span>All conversations</span>
                    {activeFilter === 'all' && <Check size={13} className="text-[var(--accent)]" />}
                  </div>
                </DropdownItem>
                <DropdownItem onClick={() => { setActiveFilter('pinned'); setFilterMenuOpen(false); }}>
                  <div className="flex items-center justify-between w-full">
                    <span>Pinned only</span>
                    {activeFilter === 'pinned' && <Check size={13} className="text-[var(--accent)]" />}
                  </div>
                </DropdownItem>
                <DropdownItem onClick={() => { setActiveFilter('notebooks'); setFilterMenuOpen(false); }}>
                  <div className="flex items-center justify-between w-full">
                    <span>Notebooks only</span>
                    {activeFilter === 'notebooks' && <Check size={13} className="text-[var(--accent)]" />}
                  </div>
                </DropdownItem>
              </DropdownMenu>
            </div>

            {/* Conversation items list */}
            <div className="flex-1 overflow-y-auto pr-1 pb-2 space-y-0.5 scrollbar-thin">
              {regularChats.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-muted)]">
                  {searchQuery ? 'No matching chats' : 'No chats yet'}
                </div>
              ) : (
                regularChats.map(conv => (
                  <div
                    key={conv.id}
                    onClick={() => {
                      if (!renameId) {
                        setActiveConversation(conv.id);
                        onClose?.();
                      }
                    }}
                    className={cn(
                      'group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors',
                      activeConversationId === conv.id
                        ? 'bg-[var(--surface-overlay)] text-[var(--text-primary)] font-medium'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                    )}
                  >
                    {renameId === conv.id ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameSubmit(conv.id);
                          if (e.key === 'Escape') setRenameId(null);
                        }}
                        onBlur={() => handleRenameSubmit(conv.id)}
                        className="flex-1 bg-transparent outline-none text-xs text-[var(--text-primary)] min-w-0"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span className="truncate flex-1 pr-1">{conv.title}</span>
                    )}

                    {/* Quick options menu */}
                    {renameId !== conv.id && (
                      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu
                          open={contextMenuId === conv.id}
                          onClose={() => setContextMenuId(null)}
                          align="right"
                          trigger={
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setContextMenuId(contextMenuId === conv.id ? null : conv.id);
                              }}
                              className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                              <MoreHorizontal size={13} />
                            </button>
                          }
                        >
                          <DropdownItem
                            icon={<Pencil size={13} />}
                            onClick={() => {
                              setContextMenuId(null);
                              setRenameId(conv.id);
                              setRenameValue(conv.title);
                            }}
                          >
                            Rename
                          </DropdownItem>
                          <DropdownItem
                            icon={conv.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                            onClick={() => {
                              setContextMenuId(null);
                              togglePin(conv.id);
                            }}
                          >
                            {conv.pinned ? 'Unpin' : 'Pin'}
                          </DropdownItem>
                          <DropdownSeparator />
                          <DropdownItem
                            icon={<Trash2 size={13} />}
                            danger
                            onClick={() => {
                              setContextMenuId(null);
                              setDeleteId(conv.id);
                            }}
                          >
                            Delete
                          </DropdownItem>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer Settings & Guest Profile */}
          <div className="border-t border-[var(--border-subtle)] px-3 py-2 shrink-0">
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-3 w-full px-2 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Settings size={15} />
              <span>Settings</span>
            </button>
            <div className="flex items-center gap-2.5 px-2 py-1.5 mt-0.5">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm',
                authState.user ? 'bg-gradient-to-br from-blue-500 to-purple-500' : 'bg-[#c0392b]'
              )}>
                {authState.user
                  ? (authState.user.displayName ?? authState.user.email).charAt(0).toUpperCase()
                  : 'G'}
              </div>
              <span className="text-xs text-[var(--text-secondary)] truncate">
                {authState.user ? (authState.user.displayName ?? authState.user.email) : 'Guest User'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete conversation?">
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          This conversation will be permanently removed.
        </p>
        <div className="flex justify-end gap-2.5">
          <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button className="bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs" size="sm" onClick={handleDeleteConfirm}>
            Delete
          </Button>
        </div>
      </Dialog>

      {/* Dialogs for menu items */}
      <LibraryDialog open={libraryOpen} onClose={() => setLibraryOpen(false)} onSelectPrompt={onSelectPrompt} />
      <ImagesDialog open={imagesOpen} onClose={() => setImagesOpen(false)} onNewChat={onNewChat} />
      <ScheduledDialog open={scheduledOpen} onClose={() => setScheduledOpen(false)} />
      <CustomiseDialog open={customiseOpen} onClose={() => setCustomiseOpen(false)} />
      <VideosDialog open={videosOpen} onClose={() => setVideosOpen(false)} />
    </>
  );
}

// ── Item Dialogs ─────────────────────────────────────────────────────────────

function LibraryDialog({ open, onClose, onSelectPrompt }: { open: boolean; onClose: () => void; onSelectPrompt?: (p: string) => void }) {
  const templates = [
    { title: 'Code Architect & Debugger', prompt: 'Review and improve the architecture and logic of this code:\n', desc: 'Identify bugs, clean structure, optimize runtime' },
    { title: 'Explain Like I\'m 5', prompt: 'Explain this concept in simple, friendly terms with clear examples:\n', desc: 'Break down complex topics into intuitive ideas' },
    { title: 'Executive Summary', prompt: 'Condense the following material into key executive bullet points and decisions:\n', desc: 'Action items, high-level takeaways, conclusions' },
    { title: 'Brainstorm Solutions', prompt: 'Brainstorm 5 innovative, practical approaches to solve:\n', desc: 'Out-of-the-box thinking and structured ideas' },
  ];

  return (
    <Dialog open={open} onClose={onClose} title="Library & Prompt Templates">
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        <p className="text-xs text-[var(--text-muted)] mb-2">
          Select any prompt template below to launch into your chat:
        </p>
        {templates.map(t => (
          <button
            key={t.title}
            onClick={() => {
              onSelectPrompt?.(t.prompt);
              onClose();
            }}
            className="w-full text-left p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-overlay)] hover:bg-[var(--surface-hover)] transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-[var(--text-primary)] group-hover:text-[var(--accent)]">
                {t.title}
              </span>
              <Sparkles size={13} className="text-[var(--text-muted)] group-hover:text-[var(--accent)]" />
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1">{t.desc}</p>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

function ImagesDialog({ open, onClose, onNewChat }: { open: boolean; onClose: () => void; onNewChat: () => void }) {
  const imagePrompts = [
    'A cinematic futuristic cityscape at twilight with glowing neon blue and warm amber lights',
    'A hyper-realistic studio portrait of an astronaut with earth reflecting in the visor',
    'Minimalist isometric 3D render of a cozy modern living room with lush plants',
  ];

  return (
    <Dialog open={open} onClose={onClose} title="Images Studio">
      <div className="space-y-3 text-xs text-[var(--text-secondary)]">
        <p>
          Create stunning photorealistic images and digital illustrations with Gemini's vision capabilities.
        </p>
        <div className="space-y-2">
          {imagePrompts.map((p, i) => (
            <div key={i} className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] flex items-center justify-between gap-2">
              <span className="italic truncate flex-1">"{p}"</span>
              <Button
                size="sm"
                variant="outline"
                className="text-[11px] shrink-0"
                onClick={() => {
                  onNewChat();
                  onClose();
                }}
              >
                Try Prompt
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

function ScheduledDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Scheduled Tasks & Automations">
      <div className="space-y-3 text-xs text-[var(--text-secondary)]">
        <p>
          Set up automated prompts and periodic reviews that run automatically.
        </p>
        <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-overlay)] space-y-2">
          <div className="flex items-center gap-2 text-[var(--text-primary)] font-medium">
            <Calendar size={14} className="text-blue-400" />
            <span>Daily Morning Briefing</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            Runs every morning at 8:00 AM · Top tech news and agenda summary
          </p>
          <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-green-500/15 text-green-400 font-medium">
            Active
          </span>
        </div>
      </div>
    </Dialog>
  );
}

function CustomiseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [instructions, setInstructions] = useState('Be concise, precise, and practical in technical explanations.');

  return (
    <Dialog open={open} onClose={onClose} title="Customise Gemini">
      <div className="space-y-3 text-xs text-[var(--text-secondary)]">
        <p>
          Set custom instructions that apply to all conversations with the AI.
        </p>
        <div>
          <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">
            System Instructions
          </label>
          <textarea
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            rows={3}
            className="w-full bg-[var(--surface-overlay)] border border-[var(--border)] rounded-lg p-2.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => { alert('Preferences saved!'); onClose(); }}>
            Save Changes
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function VideosDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Videos & Multimodal Studio">
      <div className="space-y-3 text-xs text-[var(--text-secondary)]">
        <p>
          Analyze video files, extract timestamps, summarize speeches, and detect visual changes.
        </p>
        <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-overlay)] text-center space-y-2">
          <Video size={24} className="mx-auto text-blue-400" />
          <p className="font-medium text-[var(--text-primary)]">Upload a video or paste a URL</p>
          <p className="text-[11px] text-[var(--text-muted)]">Supports MP4, WebM, MOV up to 20MB</p>
        </div>
      </div>
    </Dialog>
  );
}
