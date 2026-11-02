import { useState, useCallback, useRef } from 'react';
import { generateId } from '@/lib/utils';
import { useConversations } from './useConversations';
import { getConversation } from '@/lib/db';
import type { Message, Attachment } from '@/types';

export function useChat(conversationId: string | null) {
  const {
    addMessage,
    updateMessage,
    conversations,
    createConversation,
  } = useConversations();

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const conversation = conversations.find(c => c.id === conversationId) ?? null;

  const sendMessage = useCallback(async (
    content: string,
    attachments: Attachment[],
    overrideConvId?: string,
  ) => {
    setError(null);

    // Resolve the target conversation
    let activeConvId = overrideConvId ?? conversationId;
    let activeConv = conversations.find(c => c.id === activeConvId) ?? null;

    if (!activeConvId || !activeConv) {
      activeConv = await createConversation(content);
      activeConvId = activeConv.id;
    }

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      status: 'done',
      attachments,
      createdAt: Date.now(),
    };

    // Add user message (writes to DB + dispatches state update)
    await addMessage(activeConvId, userMessage);

    const assistantMessageId = generateId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      createdAt: Date.now(),
    };

    // Add empty assistant placeholder
    await addMessage(activeConvId, assistantMessage);
    setIsStreaming(true);
    abortRef.current = new AbortController();

    // Read fresh conversation from DB for accurate history, fallback to in-memory conversations for temporary chat
    const freshConv = (await getConversation(activeConvId)) ?? conversations.find(c => c.id === activeConvId);
    const historyForApi = (freshConv?.messages ?? []).filter(
      m => m.status === 'done' && m.role !== undefined
    );

    let accumulated = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: historyForApi.map(m => ({
            role: m.role,
            content: m.content,
            attachments: m.attachments?.map(a => ({
              name: a.name,
              mimeType: a.mimeType,
              dataUrl: a.dataUrl,
            })),
          })),
          model: freshConv?.model ?? activeConv?.model,
          conversationId: activeConvId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errData.error ?? `Server error ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response stream available');

      // Stream chunks and update state progressively
      let done = false;
      while (!done) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        const chunk = decoder.decode(value, { stream: true });

        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') { done = true; break; }
          try {
            const parsed = JSON.parse(data) as { text?: string; error?: string };
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              accumulated += parsed.text;
              // Dispatch a state update to show streaming progress
              await updateMessage(activeConvId!, assistantMessageId, {
                content: accumulated,
                status: 'streaming',
              });
            }
          } catch (parseErr: unknown) {
            if (parseErr instanceof Error && parseErr.name !== 'SyntaxError') {
              throw parseErr;
            }
          }
        }
      }

      // Final state update with full content
      await updateMessage(activeConvId!, assistantMessageId, {
        content: accumulated || 'No response received.',
        status: 'done',
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User stopped generation — commit what we have
        await updateMessage(activeConvId!, assistantMessageId, {
          content: accumulated || '(Generation stopped)',
          status: 'done',
        });
      } else {
        const errMsg = err instanceof Error ? err.message : 'Failed to get response';
        setError(errMsg);
        await updateMessage(activeConvId!, assistantMessageId, {
          content: accumulated,
          status: 'error',
          error: errMsg,
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [conversationId, conversations, addMessage, updateMessage, createConversation]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retryLastMessage = useCallback(async () => {
    if (!conversation) return;
    const messages = conversation.messages;
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;

    // Clear the failed assistant message first
    const lastAsstMsg = messages[messages.length - 1];
    if (lastAsstMsg?.role === 'assistant') {
      await updateMessage(conversation.id, lastAsstMsg.id, {
        content: '',
        status: 'streaming',
        error: undefined,
      });
    }

    setError(null);
    await sendMessage(lastUserMsg.content, lastUserMsg.attachments ?? [], conversation.id);
  }, [conversation, sendMessage, updateMessage]);

  return {
    conversation,
    isStreaming,
    error,
    sendMessage,
    stopGeneration,
    retryLastMessage,
    clearError: () => setError(null),
  };
}
