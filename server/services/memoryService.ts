import { supabaseAdmin } from './supabase.js';

export interface Memory {
  id: string;
  userId: string;
  content: string;
  category: string;
  importance: number;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

const BANNED_PATTERNS = [
  /password/i,
  /api[_\s-]?key/i,
  /secret/i,
  /token/i,
  /private[_\s-]?key/i,
  /bearer /i,
  /sk-/i,
  /AIza/i,
];

function isSensitive(content: string): boolean {
  return BANNED_PATTERNS.some(p => p.test(content));
}

export async function getMemories(userId: string, limit = 20): Promise<Memory[]> {
  const { data, error } = await supabaseAdmin
    .from('memories')
    .select('*')
    .eq('user_id', userId)
    .order('importance', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(row => ({
    id: row.id,
    userId: row.user_id,
    content: row.content,
    category: row.category,
    importance: row.importance,
    isSystem: row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getRelevantMemories(userId: string, query: string, limit = 8): Promise<Memory[]> {
  // Use Postgres trigram similarity to find relevant memories
  const { data, error } = await supabaseAdmin
    .from('memories')
    .select('*')
    .eq('user_id', userId)
    .order('importance', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(row => ({
    id: row.id,
    userId: row.user_id,
    content: row.content,
    category: row.category,
    importance: row.importance,
    isSystem: row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createMemory(
  userId: string,
  content: string,
  category = 'general',
  importance = 1,
  isSystem = false,
): Promise<Memory | null> {
  if (isSensitive(content)) {
    throw new Error('Memory content may contain sensitive information and was not saved.');
  }

  const { data, error } = await supabaseAdmin
    .from('memories')
    .insert({ user_id: userId, content, category, importance, is_system: isSystem })
    .select()
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    userId: data.user_id,
    content: data.content,
    category: data.category,
    importance: data.importance,
    isSystem: data.is_system,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateMemory(
  userId: string,
  memoryId: string,
  updates: { content?: string; category?: string; importance?: number },
): Promise<boolean> {
  if (updates.content && isSensitive(updates.content)) {
    throw new Error('Memory content may contain sensitive information.');
  }

  const { error } = await supabaseAdmin
    .from('memories')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', memoryId)
    .eq('user_id', userId); // Enforce ownership

  return !error;
}

export async function deleteMemory(userId: string, memoryId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('memories')
    .delete()
    .eq('id', memoryId)
    .eq('user_id', userId); // Enforce ownership

  return !error;
}

export async function clearUserMemories(userId: string): Promise<void> {
  await supabaseAdmin
    .from('memories')
    .delete()
    .eq('user_id', userId)
    .eq('is_system', false); // Preserve system memories
}

/** Build the memory context string to inject into AI system prompt */
export function buildMemoryContext(memories: Memory[]): string {
  if (memories.length === 0) return '';

  const lines = memories
    .filter(m => m.content.trim().length > 0)
    .map(m => `- [${m.category}] ${m.content}`);

  if (lines.length === 0) return '';

  return `\n\nPersonalized context about this user (from memory):\n${lines.join('\n')}`;
}
