import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { Composer } from '@/components/composer/Composer';
import { useChat } from '@/hooks/useChat';
import { useApp } from '@/store/appStore';
import { useConversations } from '@/hooks/useConversations';
import type { Attachment } from '@/types';

interface ChatViewProps {
  conversationId: string;
  pendingMessage?: { content: string; attachments: Attachment[] } | null;
  onPendingConsumed?: () => void;
}

export function ChatView({ conversationId, pendingMessage, onPendingConsumed }: ChatViewProps) {
  const { state, dispatch } = useApp();
  const { updateConversation } = useConversations();
  const { conversation, isStreaming, error, sendMessage, stopGeneration, retryLastMessage } = useChat(conversationId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sentPendingRef = useRef(false);

  // Reset when switching conversations
  useEffect(() => {
    sentPendingRef.current = false;
  }, [conversationId]);

  useEffect(() => {
    if (pendingMessage && !sentPendingRef.current && conversation) {
      sentPendingRef.current = true;
      sendMessage(pendingMessage.content, pendingMessage.attachments, conversationId);
      onPendingConsumed?.();
    }
  }, [pendingMessage, conversation, conversationId, sendMessage, onPendingConsumed]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages.length, isStreaming]);

  const handleSend = async (content: string, attachments: Attachment[]) => {
    await sendMessage(content, attachments, conversationId);
  };

  const handleModelChange = async (model: string) => {
    if (!conversation) return;
    await updateConversation({ ...conversation, model });
    dispatch({ type: 'SET_DEFAULT_MODEL', payload: model });
  };

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentModel = conversation.model ?? state.preferences.defaultModel;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pt-16 pb-6 scroll-smooth">
        {conversation.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[var(--text-muted)] text-sm">Send a message to continue</p>
          </div>
        ) : (
          <>
            {conversation.messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isLast={idx === conversation.messages.length - 1}
                onRetry={msg.role === 'assistant' ? retryLastMessage : undefined}
              />
            ))}
            <div ref={bottomRef} className="h-4" aria-hidden="true" />
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 flex items-center justify-between gap-4">
          <span className="flex-1 min-w-0">{error}</span>
          <button onClick={retryLastMessage} className="text-xs underline hover:no-underline shrink-0">
            Retry
          </button>
        </div>
      )}

      {/* Composer */}
      <div className="px-4 pb-4 pt-1 shrink-0 max-w-3xl w-full mx-auto">
        <Composer
          onSend={handleSend}
          onStop={stopGeneration}
          isLoading={isStreaming}
          isStreaming={isStreaming}
          selectedModel={currentModel}
          onModelChange={handleModelChange}
          variant="chat"
        />
        <p className="text-center text-[10px] text-[var(--text-muted)] mt-2">
          Nova AI can make mistakes. Consider checking important information.
        </p>
      </div>
    </div>
  );
}
