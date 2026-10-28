import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Square, Paperclip, ChevronDown, X, FileText, Image } from 'lucide-react';
import { cn, formatFileSize, generateId } from '@/lib/utils';
import { AVAILABLE_MODELS } from '@/types';
import type { Attachment, Model } from '@/types';
import { DropdownMenu, DropdownItem } from '@/components/ui/DropdownMenu';
import { Tooltip } from '@/components/ui/Tooltip';

interface ComposerProps {
  onSend: (content: string, attachments: Attachment[]) => void;
  onStop?: () => void;
  isLoading?: boolean;
  isStreaming?: boolean;
  selectedModel: string;
  onModelChange: (model: string) => void;
  placeholder?: string;
  variant?: 'home' | 'chat';
  initialValue?: string;
  onInitialValueConsumed?: () => void;
}

const ACCEPTED_TYPES = 'image/*,.pdf,.txt,.md,.csv,.json,.js,.ts,.py,.html,.css,.xml';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export function Composer({
  onSend,
  onStop,
  isLoading,
  isStreaming,
  selectedModel,
  onModelChange,
  placeholder = 'Ask Nova anything...',
  variant = 'chat',
  initialValue = '',
  onInitialValueConsumed,
}: ComposerProps) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [fileError, setFileError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialValue) {
      setValue(initialValue);
      onInitialValueConsumed?.();
      textareaRef.current?.focus();
    }
  }, [initialValue, onInitialValueConsumed]);

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, []);

  useEffect(() => { adjustHeight(); }, [value, adjustHeight]);

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !isLoading;

  const handleSend = () => {
    if (!canSend) return;
    onSend(value.trim(), attachments);
    setValue('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    setFileError('');
    const newAttachments: Attachment[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`${file.name} exceeds the 20 MB limit.`);
        continue;
      }
      const att: Attachment = {
        id: generateId(),
        name: file.name,
        type: file.type,
        size: file.size,
        mimeType: file.type,
        dataUrl: await readAsDataUrl(file),
      };
      newAttachments.push(att);
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    setAttachMenuOpen(false);
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const selectedModelObj = AVAILABLE_MODELS.find(m => m.id === selectedModel);

  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--border)] bg-[var(--composer-bg)]',
        'transition-shadow duration-150',
        variant === 'home' ? 'shadow-lg' : 'shadow-md'
      )}
    >
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {attachments.map(att => (
            <AttachmentChip key={att.id} attachment={att} onRemove={() => removeAttachment(att.id)} />
          ))}
        </div>
      )}

      {fileError && (
        <p className="px-4 pt-2 text-xs text-red-400">{fileError}</p>
      )}

      {/* Text input */}
      <div className="flex items-end gap-2 px-4 py-3">
        <Tooltip content="Add attachment" side="top">
          <DropdownMenu
            open={attachMenuOpen}
            onClose={() => setAttachMenuOpen(false)}
            align="left"
            trigger={
              <button
                onClick={() => setAttachMenuOpen(o => !o)}
                className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors shrink-0 mb-0.5"
                aria-label="Add attachment"
              >
                <Paperclip size={18} />
              </button>
            }
          >
            <DropdownItem
              icon={<Image size={14} />}
              onClick={() => { fileInputRef.current?.click(); fileInputRef.current!.accept = 'image/*'; }}
            >
              Upload image
            </DropdownItem>
            <DropdownItem
              icon={<FileText size={14} />}
              onClick={() => { fileInputRef.current?.click(); fileInputRef.current!.accept = ACCEPTED_TYPES; }}
            >
              Upload file
            </DropdownItem>
          </DropdownMenu>
        </Tooltip>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={isLoading && !isStreaming}
          className={cn(
            'flex-1 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)]',
            'text-sm leading-relaxed outline-none resize-none py-0.5',
            'min-h-[24px] max-h-[200px] overflow-y-auto',
            'disabled:opacity-60'
          )}
          aria-label="Message input"
        />

        <div className="flex items-center gap-1 shrink-0 mb-0.5">
          {/* Model selector */}
          <DropdownMenu
            open={modelMenuOpen}
            onClose={() => setModelMenuOpen(false)}
            align="right"
            trigger={
              <button
                onClick={() => setModelMenuOpen(o => !o)}
                className="flex items-center gap-1 px-2.5 h-7 rounded-full border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                aria-label="Select model"
                aria-haspopup="listbox"
                aria-expanded={modelMenuOpen}
              >
                <span className="font-medium max-w-[80px] truncate">{selectedModelObj?.name ?? 'Select model'}</span>
                <ChevronDown size={12} />
              </button>
            }
          >
            <div className="max-h-80 overflow-y-auto">
              <ModelDropdownList
                models={AVAILABLE_MODELS}
                selected={selectedModel}
                onSelect={(id) => { onModelChange(id); setModelMenuOpen(false); }}
              />
            </div>
          </DropdownMenu>

          {/* Send / Stop */}
          {isStreaming ? (
            <Tooltip content="Stop generating" side="top">
              <button
                onClick={onStop}
                className="p-1.5 rounded-full bg-[var(--text-primary)] text-[var(--surface)] hover:opacity-80 transition-opacity"
                aria-label="Stop generating"
              >
                <Square size={14} fill="currentColor" />
              </button>
            </Tooltip>
          ) : (
            <Tooltip content="Send message" side="top">
              <button
                onClick={handleSend}
                disabled={!canSend}
                className={cn(
                  'p-1.5 rounded-full transition-all',
                  canSend
                    ? 'bg-[var(--text-primary)] text-[var(--surface)] hover:opacity-80'
                    : 'bg-[var(--surface-overlay)] text-[var(--text-muted)] cursor-not-allowed'
                )}
                aria-label="Send message"
              >
                <Send size={14} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={e => {
          handleFileSelect(e.target.files);
          // Reset so the same file can be selected again
          e.target.value = '';
        }}
        aria-hidden="true"
      />
    </div>
  );
}

function AttachmentChip({ attachment, onRemove }: { attachment: Attachment; onRemove: () => void }) {
  const isImage = attachment.type.startsWith('image/');
  return (
    <div className="flex items-center gap-2 bg-[var(--surface-overlay)] border border-[var(--border)] rounded-xl px-2.5 py-1.5 max-w-[200px] group">
      {isImage && attachment.dataUrl ? (
        <img src={attachment.dataUrl} alt={attachment.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center shrink-0">
          <FileText size={14} className="text-[var(--accent)]" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--text-primary)] truncate">{attachment.name}</p>
        <p className="text-[10px] text-[var(--text-muted)]">{formatFileSize(attachment.size)}</p>
      </div>
      <button
        onClick={onRemove}
        className="ml-auto p-0.5 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
        aria-label={`Remove ${attachment.name}`}
      >
        <X size={12} />
      </button>
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const PROVIDER_LABELS: Record<string, { label: string; color: string }> = {
  openrouter: { label: 'OpenRouter', color: 'text-blue-400' },
  groq:       { label: 'Groq',       color: 'text-orange-400' },
  'gemini-direct': { label: 'Gemini', color: 'text-teal-400' },
};

function ModelDropdownList({
  models,
  selected,
  onSelect,
}: {
  models: Model[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const groups = models.reduce<Record<string, Model[]>>((acc, m) => {
    const key = m.provider;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(groups).map(([provider, items]) => {
        const meta = PROVIDER_LABELS[provider] ?? { label: provider, color: 'text-[var(--text-muted)]' };
        return (
          <div key={provider}>
            <div className={cn('px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest', meta.color)}>
              {meta.label}
            </div>
            {items.map(model => (
              <DropdownItem
                key={model.id}
                onClick={() => onSelect(model.id)}
                className={cn(model.id === selected && 'bg-[var(--accent-subtle)]')}
              >
                <div className="flex items-center justify-between gap-3 w-full min-w-0">
                  <div className="min-w-0">
                    <div className={cn(
                      'font-medium text-xs',
                      model.id === selected ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                    )}>
                      {model.name}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
                      {model.description}
                    </div>
                  </div>
                  {model.id === selected && (
                    <svg className="shrink-0 text-[var(--accent)]" width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </DropdownItem>
            ))}
          </div>
        );
      })}
    </>
  );
}
