import Dexie, { type Table } from 'dexie';
import type { Conversation, UserPreferences } from '@/types';
import { DEFAULT_MODEL } from '@/types';

class NovaDB extends Dexie {
  conversations!: Table<Conversation>;
  preferences!: Table<UserPreferences & { id: string }>;

  constructor() {
    super('gabby-ai-db');
    this.version(1).stores({
      conversations: 'id, title, createdAt, updatedAt, pinned',
      preferences: 'id',
    });
  }
}

export const db = new NovaDB();

export async function getPreferences(): Promise<UserPreferences> {
  const prefs = await db.preferences.get('user');
  return prefs ?? { theme: 'dark', defaultModel: DEFAULT_MODEL, sidebarOpen: true };
}

export async function savePreferences(prefs: UserPreferences): Promise<void> {
  await db.preferences.put({ ...prefs, id: 'user' });
}

export async function getAllConversations(): Promise<Conversation[]> {
  return db.conversations.orderBy('updatedAt').reverse().toArray();
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  return db.conversations.get(id);
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  await db.conversations.put(conversation);
}

export async function deleteConversation(id: string): Promise<void> {
  await db.conversations.delete(id);
}

export async function clearAllConversations(): Promise<void> {
  await db.conversations.clear();
}

export async function searchConversations(query: string): Promise<Conversation[]> {
  const q = query.toLowerCase();
  return db.conversations
    .filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.messages.some(m => m.content.toLowerCase().includes(q))
    )
    .toArray();
}
