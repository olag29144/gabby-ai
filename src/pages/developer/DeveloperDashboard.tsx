import { useState, useEffect } from 'react';
import {
  Shield, Cpu, Database, Key, Activity,
  RefreshCw, Check, X, Trash2, Plus,
  Lock, LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getDeveloperDashboard,
  getMemories, createMemory, deleteMemory,
  signOut,
} from '@/lib/authApi';
import type { Memory } from '@/lib/authApi';
import { useAuth } from '@/store/authStore';

interface DashboardData {
  developer: {
    developerId: string;
    permanentDeveloperId: string;
    fullName: string;
    email: string;
    role: string;
    accessLevel: string;
    isVerified: boolean;
    isOwner: boolean;
  };
  app: {
    name: string;
    creatorName: string;
    creatorRole: string;
    description: string;
  };
  stats: { totalUsers: number; totalConversations: number; totalMemories: number };
  providers: Array<{ provider: string; key: string; healthy: boolean; totalRequests: number; totalFailures: number }>;
  recentActivity: Array<{ action: string; resource: string; created_at: string }>;
}

type Tab = 'profile' | 'app' | 'providers' | 'memory' | 'activity';

interface DeveloperDashboardProps {
  onClose: () => void;
}

export function DeveloperDashboard({ onClose }: DeveloperDashboardProps) {
  const { dispatch } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');
  const [data, setData] = useState<DashboardData | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newMemory, setNewMemory] = useState('');
  const [addingMemory, setAddingMemory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [dash, mems] = await Promise.all([getDeveloperDashboard(), getMemories()]);
      if (!dash) { setError('Access denied. Owner account required.'); return; }
      setData(dash as DashboardData);
      setMemories(mems);
    } catch {
      setError('Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleAddMemory = async () => {
    if (!newMemory.trim()) return;
    setAddingMemory(true);
    const m = await createMemory(newMemory.trim(), 'developer', 5);
    if (m) { setMemories(prev => [m, ...prev]); setNewMemory(''); }
    setAddingMemory(false);
  };

  const handleDeleteMemory = async (id: string) => {
    await deleteMemory(id);
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  const handleSignOut = async () => {
    await signOut();
    dispatch({ type: 'SIGN_OUT' });
    onClose();
  };

  const TABS: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: 'profile',   label: 'Developer',  icon: Shield },
    { id: 'app',       label: 'App Identity', icon: Cpu },
    { id: 'providers', label: 'Providers',   icon: Key },
    { id: 'memory',    label: 'Memory',      icon: Database },
    { id: 'activity',  label: 'Activity',    icon: Activity },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden animate-slide-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
              <Lock size={14} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Developer Dashboard</h2>
              <p className="text-[10px] text-[var(--text-muted)]">Owner access only · Gabby AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="p-1.5 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-muted)] transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={12} />
              Sign out
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-muted)] transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 px-6 pt-3 shrink-0 border-b border-[var(--border)] overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap',
                tab === id
                  ? 'bg-[var(--surface-overlay)] text-[var(--text-primary)] border-b-2 border-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Lock size={32} className="text-red-400 opacity-60" />
              <p className="text-sm text-red-400">{error}</p>
              <p className="text-xs text-[var(--text-muted)]">
                Sign in with the owner account and run{' '}
                <code className="text-[var(--accent)] bg-[var(--surface-overlay)] px-1 py-0.5 rounded">npm run setup-owner</code>
              </p>
            </div>
          ) : data ? (
            <>
              {tab === 'profile'   && <ProfileTab data={data} />}
              {tab === 'app'       && <AppTab data={data} />}
              {tab === 'providers' && <ProvidersTab data={data} />}
              {tab === 'memory'    && (
                <MemoryTab
                  memories={memories}
                  newMemory={newMemory}
                  setNewMemory={setNewMemory}
                  onAdd={handleAddMemory}
                  onDelete={handleDeleteMemory}
                  adding={addingMemory}
                />
              )}
              {tab === 'activity'  && <ActivityTab data={data} />}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab({ data }: { data: DashboardData }) {
  const d = data.developer;
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4 p-4 rounded-xl bg-[var(--surface-overlay)] border border-[var(--border)]">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white text-xl font-bold shrink-0">
          {d.fullName.charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{d.fullName}</h3>
            {d.isVerified && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-[10px] font-medium">
                <Check size={10} /> Verified Owner
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{d.email}</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">{d.accessLevel.replace('_', ' ').toUpperCase()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoCard label="Developer ID" value={d.developerId} mono />
        <InfoCard label="Permanent ID" value={d.permanentDeveloperId} mono highlight={d.isOwner} />
        <InfoCard label="Role" value={d.role} />
        <InfoCard label="Access Level" value={d.accessLevel} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Users" value={data.stats.totalUsers} />
        <StatCard label="Conversations" value={data.stats.totalConversations} />
        <StatCard label="Memories" value={data.stats.totalMemories} />
      </div>
    </div>
  );
}

// ── App Tab ─────────────────────────────────────────────────────────────────

function AppTab({ data }: { data: DashboardData }) {
  const a = data.app;
  return (
    <div className="space-y-3">
      <div className="p-4 rounded-xl bg-[var(--surface-overlay)] border border-[var(--border)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Permanent Application Identity</h3>
        <div className="space-y-2">
          <Row label="Application Name" value={a.name} />
          <Row label="Original Creator" value={a.creatorName} />
          <Row label="Creator Role" value={a.creatorRole} />
          <Row label="Description" value={a.description} />
        </div>
      </div>
      <div className="p-3 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent)]/20">
        <p className="text-xs text-[var(--accent)] font-medium mb-1">Identity is permanent</p>
        <p className="text-[11px] text-[var(--text-muted)]">
          Gabby AI's identity as an application built by Ola Gabriel is stored in the database and
          injected into every AI request regardless of which provider or API key is active.
        </p>
      </div>
    </div>
  );
}

// ── Providers Tab ───────────────────────────────────────────────────────────

function ProvidersTab({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-3">
      {data.providers.map((p, i) => (
        <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-overlay)] border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className={cn('w-2 h-2 rounded-full', p.healthy ? 'bg-green-400' : 'bg-red-400')} />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)] capitalize">{p.provider}</p>
              <p className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">{p.key}</p>
            </div>
          </div>
          <div className="text-right">
            <p className={cn('text-xs font-medium', p.healthy ? 'text-green-400' : 'text-red-400')}>
              {p.healthy ? 'Healthy' : 'Unhealthy'}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
              {p.totalRequests} req · {p.totalFailures} fail
            </p>
          </div>
        </div>
      ))}
      {data.providers.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-8">No API keys configured.</p>
      )}
    </div>
  );
}

// ── Memory Tab ──────────────────────────────────────────────────────────────

function MemoryTab({
  memories, newMemory, setNewMemory, onAdd, onDelete, adding
}: {
  memories: Memory[];
  newMemory: string;
  setNewMemory: (v: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  adding: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={newMemory}
          onChange={e => setNewMemory(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onAdd(); }}
          placeholder="Add a developer memory..."
          className="flex-1 h-9 px-3 rounded-xl text-sm bg-[var(--surface-overlay)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
        <button
          onClick={onAdd}
          disabled={adding || !newMemory.trim()}
          className="h-9 px-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <Plus size={13} />
          Add
        </button>
      </div>

      <div className="space-y-2">
        {memories.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] text-center py-6">No memories saved yet.</p>
        )}
        {memories.map(m => (
          <div key={m.id} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--surface-overlay)] border border-[var(--border)] group">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--text-primary)] break-words">{m.content}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-[var(--text-muted)] capitalize">{m.category}</span>
                <span className="text-[10px] text-[var(--text-muted)]">·</span>
                <span className="text-[10px] text-[var(--text-muted)]">importance {m.importance}</span>
                {m.isSystem && (
                  <span className="text-[10px] text-[var(--accent)] bg-[var(--accent-subtle)] px-1.5 py-0.5 rounded">system</span>
                )}
              </div>
            </div>
            {!m.isSystem && (
              <button
                onClick={() => onDelete(m.id)}
                className="p-1 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                aria-label="Delete memory"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Activity Tab ────────────────────────────────────────────────────────────

function ActivityTab({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-2">
      {data.recentActivity.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-8">No activity yet.</p>
      )}
      {data.recentActivity.map((log, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-overlay)] border border-[var(--border)]">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--text-primary)] font-medium">{log.action.replace(/_/g, ' ')}</p>
            {log.resource && <p className="text-[11px] text-[var(--text-muted)]">{log.resource}</p>}
          </div>
          <p className="text-[10px] text-[var(--text-muted)] shrink-0">
            {new Date(log.created_at).toLocaleTimeString()}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Shared UI ───────────────────────────────────────────────────────────────

function InfoCard({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className={cn(
      'p-3 rounded-xl border',
      highlight ? 'bg-[var(--accent-subtle)] border-[var(--accent)]/30' : 'bg-[var(--surface-overlay)] border-[var(--border)]'
    )}>
      <p className="text-[10px] text-[var(--text-muted)] mb-0.5">{label}</p>
      <p className={cn(
        'text-xs text-[var(--text-primary)] break-all',
        mono && 'font-mono',
        highlight && 'text-[var(--accent)]'
      )}>
        {value}
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded-xl bg-[var(--surface-overlay)] border border-[var(--border)] text-center">
      <p className="text-lg font-semibold text-[var(--text-primary)]">{value.toLocaleString()}</p>
      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-xs text-[var(--text-muted)] shrink-0">{label}</span>
      <span className="text-xs text-[var(--text-primary)] text-right">{value}</span>
    </div>
  );
}
