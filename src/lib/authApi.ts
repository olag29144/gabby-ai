// Client-side auth API wrapper — all requests go through our backend

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  role?: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const SESSION_KEY = 'gabby_session';

export function getStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    // Check if expired (with 60s buffer)
    if (s.expiresAt && Date.now() / 1000 > s.expiresAt - 60) return null;
    return s;
  } catch {
    return null;
  }
}

export function storeSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const session = getStoredSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (session) headers['Authorization'] = `Bearer ${session.accessToken}`;

  return fetch(`/api${path}`, { ...options, headers });
}

export async function signUp(email: string, password: string, displayName?: string) {
  const res = await apiFetch('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  });
  const data = await res.json() as { user?: AuthUser; session?: Session; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Sign up failed.');
  if (data.session) storeSession(data.session);
  return data;
}

export async function signIn(email: string, password: string) {
  const res = await apiFetch('/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json() as { user?: AuthUser; session?: Session; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Sign in failed.');
  if (data.session) storeSession(data.session);
  return data;
}

export async function signOut() {
  try {
    await apiFetch('/auth/signout', { method: 'POST' });
  } finally {
    clearSession();
  }
}

export async function refreshSession(refreshToken: string): Promise<Session | null> {
  const res = await apiFetch('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) { clearSession(); return null; }
  const data = await res.json() as { session?: Session };
  if (data.session) { storeSession(data.session); return data.session; }
  return null;
}

export async function getMe(): Promise<AuthUser | null> {
  const res = await apiFetch('/auth/me');
  if (!res.ok) return null;
  const data = await res.json() as { user?: AuthUser };
  return data.user ?? null;
}

// ── Cloud conversation API ────────────────────────────────────────────────────

export async function cloudGetConversations() {
  const res = await apiFetch('/conversations');
  if (!res.ok) return null;
  return res.json();
}

export async function cloudCreateConversation(conv: {
  id: string; title: string; model: string; pinned: boolean;
}) {
  const res = await apiFetch('/conversations', {
    method: 'POST',
    body: JSON.stringify(conv),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function cloudUpdateConversation(id: string, updates: {
  title?: string; model?: string; pinned?: boolean;
}) {
  const res = await apiFetch(`/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return res.ok;
}

export async function cloudDeleteConversation(id: string) {
  const res = await apiFetch(`/conversations/${id}`, { method: 'DELETE' });
  return res.ok;
}

export async function cloudAddMessage(conversationId: string, msg: {
  id: string; role: string; content: string;
  status: string; error?: string; attachments?: unknown[];
}) {
  const res = await apiFetch(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(msg),
  });
  return res.ok;
}

export async function cloudUpdateMessage(conversationId: string, messageId: string, updates: {
  content?: string; status?: string; error?: string;
}) {
  const res = await apiFetch(`/conversations/${conversationId}/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return res.ok;
}

export async function cloudGetPreferences() {
  const res = await apiFetch('/conversations/prefs/me');
  if (!res.ok) return null;
  return res.json();
}

export async function cloudSavePreferences(prefs: {
  theme: string; defaultModel: string; sidebarOpen: boolean;
}) {
  const res = await apiFetch('/conversations/prefs/me', {
    method: 'PUT',
    body: JSON.stringify(prefs),
  });
  return res.ok;
}

// ── Memory API ────────────────────────────────────────────────────────────────

export interface Memory {
  id: string;
  userId: string;
  content: string;
  category: string;
  importance: number;
  isSystem: boolean;
  createdAt: number;
  updatedAt: number;
}

export async function getMemories(): Promise<Memory[]> {
  const res = await apiFetch('/memory');
  if (!res.ok) return [];
  return res.json();
}

export async function createMemory(content: string, category = 'general', importance = 1) {
  const res = await apiFetch('/memory', {
    method: 'POST',
    body: JSON.stringify({ content, category, importance }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function updateMemory(id: string, updates: { content?: string; category?: string; importance?: number }) {
  const res = await apiFetch(`/memory/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return res.ok;
}

export async function deleteMemory(id: string) {
  const res = await apiFetch(`/memory/${id}`, { method: 'DELETE' });
  return res.ok;
}

// ── Developer API ─────────────────────────────────────────────────────────────

export async function getDeveloperProfile() {
  const res = await apiFetch('/developer/profile');
  if (!res.ok) return null;
  return res.json();
}

export async function getDeveloperDashboard() {
  const res = await apiFetch('/developer/dashboard');
  if (!res.ok) return null;
  return res.json();
}
