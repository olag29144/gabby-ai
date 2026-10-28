import { useCallback, useRef } from 'react';
import { useApp } from '@/store/appStore';
import {
  saveConversation,
  deleteConversation as dbDelete,
  getAllConversations,
  getConversation,
} from '@/lib/db';
import type { Conversation, Message } from '@/types';
import { generateId, generateTitle } from '@/lib/utils';
import { DEFAULT_MODEL } from '@/types';

export function useConversations() {
  const { state, dispatch } = useApp();

  // Keep a ref to the latest conversations to avoid stale closures
  const conversationsRef = useRef(state.conversations);
  conversationsRef.current = state.conversations;

  const activeConversation = state.conversations.find(
    c => c.id === state.activeConversationId
  ) ?? null;

  const createConversation = useCallback(async (firstMessage?: string): Promise<Conversation> => {
    const conv: Conversation = {
      id: generateId(),
      title: firstMessage ? generateTitle(firstMessage) : 'New conversation',
      messages: [],
      model: state.preferences.defaultModel || DEFAULT_MODEL,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveConversation(conv);
    dispatch({ type: 'ADD_CONVERSATION', payload: conv });
    return conv;
  }, [state.preferences.defaultModel, dispatch]);

  const updateConversation = useCallback(async (conv: Conversation) => {
    const updated = { ...conv, updatedAt: Date.now() };
    await saveConversation(updated);
    dispatch({ type: 'UPDATE_CONVERSATION', payload: updated });
  }, [dispatch]);

  const addMessage = useCallback(async (convId: string, message: Message) => {
    // Always read from DB to avoid stale state during streaming
    const conv = await getConversation(convId);
    if (!conv) return;
    const updated: Conversation = {
      ...conv,
      messages: [...conv.messages, message],
      updatedAt: Date.now(),
    };
    if (conv.messages.length === 0 && message.role === 'user') {
      updated.title = generateTitle(message.content);
    }
    await saveConversation(updated);
    dispatch({ type: 'UPDATE_CONVERSATION', payload: updated });
  }, [dispatch]);

  // updateMessage reads from DB to avoid stale-closure issues during streaming
  const updateMessage = useCallback(async (
    convId: string,
    messageId: string,
    updates: Partial<Message>,
  ) => {
    const conv = await getConversation(convId);
    if (!conv) return;
    const updated: Conversation = {
      ...conv,
      messages: conv.messages.map(m =>
        m.id === messageId ? { ...m, ...updates } : m
      ),
      updatedAt: Date.now(),
    };
    await saveConversation(updated);
    dispatch({ type: 'UPDATE_CONVERSATION', payload: updated });
  }, [dispatch]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    const conv = await getConversation(id);
    if (!conv) return;
    const updated = { ...conv, title, updatedAt: Date.now() };
    await saveConversation(updated);
    dispatch({ type: 'UPDATE_CONVERSATION', payload: updated });
  }, [dispatch]);

  const deleteConversation = useCallback(async (id: string) => {
    await dbDelete(id);
    dispatch({ type: 'DELETE_CONVERSATION', payload: id });
  }, [dispatch]);

  const togglePin = useCallback(async (id: string) => {
    const conv = await getConversation(id);
    if (!conv) return;
    const updated = { ...conv, pinned: !conv.pinned, updatedAt: Date.now() };
    await saveConversation(updated);
    dispatch({ type: 'UPDATE_CONVERSATION', payload: updated });
  }, [dispatch]);

  const refreshConversations = useCallback(async () => {
    const convs = await getAllConversations();
    dispatch({ type: 'SET_CONVERSATIONS', payload: convs });
  }, [dispatch]);

  const setActiveConversation = useCallback((id: string | null) => {
    dispatch({ type: 'SET_ACTIVE', payload: id });
  }, [dispatch]);

  return {
    conversations: state.conversations,
    activeConversation,
    activeConversationId: state.activeConversationId,
    createConversation,
    updateConversation,
    addMessage,
    updateMessage,
    renameConversation,
    deleteConversation,
    togglePin,
    refreshConversations,
    setActiveConversation,
  };
}
