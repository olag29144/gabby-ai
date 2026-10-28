import { useState } from 'react';
import { Copy, Check, RefreshCw, ThumbsUp, ThumbsDown, AlertCircle, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';
import type { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
  isLast: boolean;
  onRetry?: () => void;
}

export function MessageBubble({ message, isLast, onRetry }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const isError = message.status === 'error';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        'group flex gap-4 px-4 py-4 w-full max-w-3xl mx-auto',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-1">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
            U
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-teal-400 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
              <path d="M16 3 L19.5 13 L30 13 L21.5 19 L24.5 29 L16 23 L7.5 29 L10.5 19 L2 13 L12.5 13 Z" fill="white" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={cn('flex flex-col gap-2 min-w-0 flex-1', isUser && 'items-end')}>
        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className={cn('flex flex-wrap gap-2', isUser && 'justify-end')}>
            {message.attachments.map(att => (
              <div key={att.id} className="rounded-xl overflow-hidden border border-[var(--border)] max-w-xs">
                {att.type.startsWith('image/') && att.dataUrl ? (
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    className="max-h-48 max-w-xs object-contain bg-[var(--surface-overlay)]"
                  />
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-overlay)]">
                    <FileText size={14} className="text-[var(--accent)] shrink-0" />
                    <span className="text-xs text-[var(--text-secondary)] truncate max-w-[160px]">{att.name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Message bubble */}
        {message.content || isStreaming ? (
          <div
            className={cn(
              isUser
                ? 'bg-[var(--surface-overlay)] text-[var(--text-primary)] rounded-2xl rounded-tr-sm px-4 py-3 text-sm max-w-[85%]'
                : 'text-[var(--text-primary)] w-full'
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
            ) : (
              <div className="prose-nova">
                {message.content ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeSanitize]}
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className ?? '');
                        const lang = match?.[1] ?? '';
                        const isBlock = className?.includes('language-');
                        if (isBlock) {
                          return (
                            <CodeBlock lang={lang} code={String(children).replace(/\n$/, '')} />
                          );
                        }
                        return (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                ) : isStreaming ? (
                  <div className="flex items-center gap-2 py-1">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {/* Error state */}
        {isError && (
          <div className="flex items-start gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm max-w-[85%]">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Something went wrong</p>
              {message.error && <p className="text-xs mt-0.5 text-red-300/80">{message.error}</p>}
            </div>
          </div>
        )}

        {/* Action buttons — assistant only */}
        {!isUser && !isStreaming && (message.content || isError) && (
          <div
            className={cn(
              'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
              isLast && 'opacity-100'
            )}
          >
            <Tooltip content={copied ? 'Copied!' : 'Copy'} side="bottom">
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                aria-label="Copy response"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </Tooltip>
            {(isLast || isError) && onRetry && (
              <Tooltip content="Regenerate" side="bottom">
                <button
                  onClick={onRetry}
                  className="p-1.5 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                  aria-label="Regenerate response"
                >
                  <RefreshCw size={14} />
                </button>
              </Tooltip>
            )}
            <Tooltip content="Good response" side="bottom">
              <button
                onClick={() => setFeedback('up')}
                className={cn(
                  'p-1.5 rounded-full hover:bg-[var(--surface-hover)] transition-colors',
                  feedback === 'up' ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                )}
                aria-label="Thumbs up"
                aria-pressed={feedback === 'up'}
              >
                <ThumbsUp size={14} />
              </button>
            </Tooltip>
            <Tooltip content="Poor response" side="bottom">
              <button
                onClick={() => setFeedback('down')}
                className={cn(
                  'p-1.5 rounded-full hover:bg-[var(--surface-hover)] transition-colors',
                  feedback === 'down' ? 'text-red-400' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                )}
                aria-label="Thumbs down"
                aria-pressed={feedback === 'down'}
              >
                <ThumbsDown size={14} />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-xl overflow-hidden border border-[var(--border)] my-3 group/code">
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--surface-overlay)] border-b border-[var(--border)]">
        <span className="text-xs font-mono text-[var(--text-muted)]">{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          aria-label="Copy code"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={lang || 'text'}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'var(--surface-raised)',
            fontSize: '13px',
            lineHeight: '1.6',
          }}
          PreTag="div"
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
