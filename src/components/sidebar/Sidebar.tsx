import { useState, useRef, useEffect } from 'react';
import {
  Plus, Search, Pin, MoreHorizontal, Pencil, Trash2,
  PinOff, X, Settings, MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/store/appStore';
import { useConversations } from '@/hooks/useConversations';
import { Button } from '@/components/ui/Button';
import { DropdownMenu, DropdownItem, DropdownSeparator } from '@/components/ui/DropdownMenu';
import { Dialog } from '@/components/ui/Dialog';
import type { Conversation } from '@/types';

interface SidebarProps {
  onNewChat: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({ onNewChat, onOpenSettings }: SidebarProps) {
  const { state, dispatch } = useApp();
  const { conversations, activeConversationId, setActiveConversation, renameConversation, deleteConversation, togglePin } = useConversations();
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const isOpen = state.sidebarOpen;

  useEffect(() => {
    if (renameId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameId]);

  const filtered = searchQuery
    ? conversations.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : conversations;

  const pinned = filtered.filter(c => c.pinned);
  const recent = filtered.filter(c => !c.pinned);

  const grouped = groupByDate(recent);

  const handleRenameSubmit = async (id: string) => {
    if (renameValue.trim()) await renameConversation(id, renameValue.trim());
    setRenameId(null);
  };

  const handleDeleteConfirm = async () => {
    if (deleteId) await deleteConversation(deleteId);
    setDeleteId(null);
  };

  return (
    <>
      <aside
        className={cn(
          'flex flex-col h-full bg-[var(--sidebar-bg)] border-r border-[var(--border)]',
          'transition-all duration-200 ease-in-out overflow-hidden shrink-0',
          isOpen ? 'w-[var(--sidebar-width)]' : 'w-0 border-r-0'
        )}
        aria-label="Sidebar"
      >
        <div className="flex flex-col h-full w-[var(--sidebar-width)]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-14 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
                className="p-1.5 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="Close sidebar"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18" />
                </svg>
              </button>
              <button
                onClick={onNewChat}
                className="p-1.5 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="New chat"
              >
                <Pencil size={16} />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSearch(s => !s)}
                className="p-1.5 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="Search conversations"
              >
                <Search size={16} />
              </button>
            </div>
          </div>

          {/* Search */}
          {showSearch && (
            <div className="px-3 pb-2 shrink-0">
              <div className="flex items-center gap-2 bg-[var(--surface-overlay)] rounded-full px-3 h-9">
                <Search size={14} className="text-[var(--text-muted)] shrink-0" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
                  autoFocus
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} aria-label="Clear search">
                    <X size={14} className="text-[var(--text-muted)]" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* New Chat Button */}
          <div className="px-3 pb-2 shrink-0">
            <button
              onClick={onNewChat}
              className="flex items-center gap-3 w-full px-3 h-10 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm font-medium"
            >
              <Plus size={16} />
              New chat
            </button>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2">
            {conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <MessageSquare size={28} className="text-[var(--text-muted)] mb-3" />
                <p className="text-sm text-[var(--text-muted)]">No conversations yet</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Start a new chat to begin</p>
              </div>
            )}

            {filtered.length === 0 && searchQuery && (
              <div className="py-8 text-center px-4">
                <p className="text-sm text-[var(--text-muted)]">No results for "{searchQuery}"</p>
              </div>
            )}

            {pinned.length > 0 && (
              <ConversationSection
                label="Pinned"
                conversations={pinned}
                activeId={activeConversationId}
                contextMenuId={contextMenuId}
                renameId={renameId}
                renameValue={renameValue}
                renameInputRef={renameInputRef}
                onSelect={setActiveConversation}
                onContextMenu={setContextMenuId}
                onRenameStart={(c) => { setRenameId(c.id); setRenameValue(c.title); }}
                onRenameChange={setRenameValue}
                onRenameSubmit={handleRenameSubmit}
                onRenameCancel={() => setRenameId(null)}
                onDelete={setDeleteId}
                onPin={togglePin}
              />
            )}

            {Object.entries(grouped).map(([label, convs]) => (
              <ConversationSection
                key={label}
                label={label}
                conversations={convs}
                activeId={activeConversationId}
                contextMenuId={contextMenuId}
                renameId={renameId}
                renameValue={renameValue}
                renameInputRef={renameInputRef}
                onSelect={setActiveConversation}
                onContextMenu={setContextMenuId}
                onRenameStart={(c) => { setRenameId(c.id); setRenameValue(c.title); }}
                onRenameChange={setRenameValue}
                onRenameSubmit={handleRenameSubmit}
                onRenameCancel={() => setRenameId(null)}
                onDelete={setDeleteId}
                onPin={togglePin}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--border)] px-2 py-2 shrink-0">
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-3 w-full px-3 h-10 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm"
            >
              <Settings size={16} />
              Settings
            </button>
            <div className="flex items-center gap-3 px-3 h-10 rounded-full mt-0.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                U
              </div>
              <span className="text-sm text-[var(--text-secondary)] truncate">Guest</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete conversation?"
      >
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          This conversation will be permanently deleted. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button
            className="bg-red-500 hover:bg-red-600 text-white rounded-full h-9 px-4 text-sm"
            onClick={handleDeleteConfirm}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </>
  );
}

interface SectionProps {
  label: string;
  conversations: Conversation[];
  activeId: string | null;
  contextMenuId: string | null;
  renameId: string | null;
  renameValue: string;
  renameInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onSelect: (id: string) => void;
  onContextMenu: (id: string | null) => void;
  onRenameStart: (c: Conversation) => void;
  onRenameChange: (v: string) => void;
  onRenameSubmit: (id: string) => void;
  onRenameCancel: () => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
}

function ConversationSection({
  label, conversations, activeId, contextMenuId, renameId, renameValue,
  renameInputRef, onSelect, onContextMenu, onRenameStart, onRenameChange,
  onRenameSubmit, onRenameCancel, onDelete, onPin,
}: SectionProps) {
  if (conversations.length === 0) return null;
  return (
    <div className="mb-1">
      <p className="px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
        {label}
      </p>
      {conversations.map(conv => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          isActive={activeId === conv.id}
          menuOpen={contextMenuId === conv.id}
          isRenaming={renameId === conv.id}
          renameValue={renameValue}
          renameInputRef={renameInputRef}
          onSelect={() => onSelect(conv.id)}
          onMenuToggle={() => onContextMenu(contextMenuId === conv.id ? null : conv.id)}
          onMenuClose={() => onContextMenu(null)}
          onRenameStart={() => onRenameStart(conv)}
          onRenameChange={onRenameChange}
          onRenameSubmit={() => onRenameSubmit(conv.id)}
          onRenameCancel={onRenameCancel}
          onDelete={() => onDelete(conv.id)}
          onPin={() => onPin(conv.id)}
        />
      ))}
    </div>
  );
}

interface ItemProps {
  conversation: Conversation;
  isActive: boolean;
  menuOpen: boolean;
  isRenaming: boolean;
  renameValue: string;
  renameInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onSelect: () => void;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onRenameStart: () => void;
  onRenameChange: (v: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onDelete: () => void;
  onPin: () => void;
}

function ConversationItem({
  conversation, isActive, menuOpen, isRenaming, renameValue,
  renameInputRef, onSelect, onMenuToggle, onMenuClose,
  onRenameStart, onRenameChange, onRenameSubmit, onRenameCancel,
  onDelete, onPin,
}: ItemProps) {
  return (
    <div
      className={cn(
        'group relative flex items-center rounded-xl px-3 py-2 cursor-pointer transition-colors',
        isActive
          ? 'bg-[var(--surface-overlay)] text-[var(--text-primary)]'
          : 'hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      )}
      onClick={!isRenaming ? onSelect : undefined}
    >
      {isRenaming ? (
        <input
          ref={renameInputRef}
          type="text"
          value={renameValue}
          onChange={e => onRenameChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') onRenameSubmit();
            if (e.key === 'Escape') onRenameCancel();
          }}
          onBlur={onRenameSubmit}
          className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none min-w-0"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 text-sm truncate min-w-0 pr-1">{conversation.title}</span>
      )}

      {!isRenaming && (
        <div className={cn('shrink-0 opacity-0 group-hover:opacity-100 transition-opacity', menuOpen && 'opacity-100')}>
          <DropdownMenu
            open={menuOpen}
            onClose={onMenuClose}
            align="right"
            trigger={
              <button
                onClick={e => { e.stopPropagation(); onMenuToggle(); }}
                className="p-1 rounded-md hover:bg-[var(--surface-overlay)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="Conversation options"
              >
                <MoreHorizontal size={14} />
              </button>
            }
          >
            <DropdownItem icon={<Pencil size={14} />} onClick={() => { onMenuClose(); onRenameStart(); }}>
              Rename
            </DropdownItem>
            <DropdownItem
              icon={conversation.pinned ? <PinOff size={14} /> : <Pin size={14} />}
              onClick={() => { onMenuClose(); onPin(); }}
            >
              {conversation.pinned ? 'Unpin' : 'Pin'}
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem icon={<Trash2 size={14} />} danger onClick={() => { onMenuClose(); onDelete(); }}>
              Delete
            </DropdownItem>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

function groupByDate(conversations: Conversation[]): Record<string, Conversation[]> {
  const groups: Record<string, Conversation[]> = {};
  const now = Date.now();
  const day = 86400000;

  for (const conv of conversations) {
    const diff = now - conv.updatedAt;
    let label: string;
    if (diff < day) label = 'Today';
    else if (diff < 2 * day) label = 'Yesterday';
    else if (diff < 7 * day) label = 'Previous 7 days';
    else if (diff < 30 * day) label = 'Previous 30 days';
    else label = 'Older';

    if (!groups[label]) groups[label] = [];
    groups[label].push(conv);
  }
  return groups;
}
