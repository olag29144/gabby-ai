import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Square, Paperclip, ChevronDown, X, FileText, Image, Mic, MicOff,
  Play, Pause, Volume2, Search, Check
} from 'lucide-react';
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

const ACCEPTED_TYPES = 'image/*,.pdf,.txt,.md,.csv,.json,.js,.ts,.py,.html,.css,.xml,audio/*';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// Web Speech API interface helper
interface SpeechRecognitionEventLike extends Event {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal?: boolean;
    };
    length: number;
  };
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    SpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

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
  const [modelSearch, setModelSearch] = useState('');
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [fileError, setFileError] = useState('');

  // Voice note & talk-to-AI recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recordingTimerRef = useRef<number | null>(null);

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
        type: file.type || 'application/octet-stream',
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

  // ── Voice Recording & Talk to AI ───────────────────────────────────────────

  const startVoiceRecording = async () => {
    try {
      setFileError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);
      setLiveTranscript('');

      // Timer
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);

      // Start Speech Recognition if supported
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          recognitionRef.current = rec;
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = 'en-US';

          rec.onresult = (event: SpeechRecognitionEventLike) => {
            let current = '';
            for (let i = 0; i < event.results.length; i++) {
              current += event.results[i][0].transcript;
            }
            setLiveTranscript(current);
            // Append or sync to input value
            setValue(prev => {
              const base = prev.trim();
              return base ? `${base} ${current}` : current;
            });
          };

          rec.onerror = () => {
            // Speech recognition might fail silently on some networks, audio recording continues
          };

          rec.start();
        } catch {
          // Fall back gracefully to audio recording only
        }
      }
    } catch {
      setFileError('Microphone access was denied or is not supported. Please allow microphone permissions.');
      setIsRecording(false);
    }
  };

  const stopVoiceRecording = useCallback(async (shouldAttach = true) => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = async () => {
        recorder.stream.getTracks().forEach(t => t.stop());
        if (shouldAttach && audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(audioBlob);
          });

          const voiceAttachment: Attachment = {
            id: generateId(),
            name: `Voice note (${recordingSeconds}s).webm`,
            type: 'audio/webm',
            size: audioBlob.size,
            mimeType: 'audio/webm',
            dataUrl: audioDataUrl,
            duration: recordingSeconds,
          };

          setAttachments(prev => [...prev, voiceAttachment]);
        }
      };
      recorder.stop();
    }

    setIsRecording(false);
  }, [recordingSeconds]);

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setLiveTranscript('');
  };

  const handleToggleVoice = () => {
    if (isRecording) {
      stopVoiceRecording(true);
    } else {
      startVoiceRecording();
    }
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

      {/* Voice Recording Live Bar */}
      {isRecording && (
        <div className="flex items-center justify-between mx-3 mt-3 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-sm animate-fade-in">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="font-mono text-xs font-semibold text-red-400">
                {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}
              </span>
            </div>

            {/* Sound waveform animation bars */}
            <div className="hidden sm:flex items-center gap-0.5 h-4">
              <span className="w-1 bg-red-500 rounded-full animate-pulse h-3" />
              <span className="w-1 bg-red-400 rounded-full animate-pulse h-4 delay-75" />
              <span className="w-1 bg-red-500 rounded-full animate-pulse h-2 delay-150" />
              <span className="w-1 bg-red-400 rounded-full animate-pulse h-4 delay-200" />
              <span className="w-1 bg-red-500 rounded-full animate-pulse h-3 delay-300" />
            </div>

            <span className="text-xs text-[var(--text-secondary)] truncate">
              {liveTranscript ? `"${liveTranscript}"` : 'Listening... Speak now to talk to Nova'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              onClick={cancelVoiceRecording}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded-md hover:bg-[var(--surface-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => stopVoiceRecording(true)}
              className="text-xs bg-red-500 hover:bg-red-600 text-white font-medium px-3 py-1 rounded-full transition-colors shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {fileError && (
        <p className="px-4 pt-2 text-xs text-red-400">{fileError}</p>
      )}

      {/* Text input and tools */}
      <div className="flex items-end gap-2 px-4 py-3">
        <Tooltip content="Add attachment" side="top">
          <DropdownMenu
            open={attachMenuOpen}
            onClose={() => setAttachMenuOpen(false)}
            align="left"
            placement="top"
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
              icon={<Volume2 size={14} />}
              onClick={() => { fileInputRef.current?.click(); fileInputRef.current!.accept = 'audio/*'; }}
            >
              Upload audio note
            </DropdownItem>
            <DropdownItem
              icon={<FileText size={14} />}
              onClick={() => { fileInputRef.current?.click(); fileInputRef.current!.accept = ACCEPTED_TYPES; }}
            >
              Upload document or code
            </DropdownItem>
          </DropdownMenu>
        </Tooltip>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? 'Listening to your voice...' : placeholder}
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

        <div className="flex items-center gap-1.5 shrink-0 mb-0.5">
          {/* Scrollable Model selector with placement="top" */}
          <DropdownMenu
            open={modelMenuOpen}
            onClose={() => { setModelMenuOpen(false); setModelSearch(''); }}
            align="right"
            placement="top"
            className="w-72 max-w-[90vw]"
            trigger={
              <button
                onClick={() => setModelMenuOpen(o => !o)}
                className="flex items-center gap-1 px-2.5 h-7 rounded-full border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                aria-label="Select model"
                aria-haspopup="listbox"
                aria-expanded={modelMenuOpen}
              >
                <span className="font-medium max-w-[90px] truncate">{selectedModelObj?.name ?? 'Select model'}</span>
                <ChevronDown size={12} />
              </button>
            }
          >
            {/* Search input for models */}
            <div className="px-2 pt-1.5 pb-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-1.5 bg-[var(--surface-overlay)] rounded-lg px-2 h-7">
                <Search size={12} className="text-[var(--text-muted)] shrink-0" />
                <input
                  type="text"
                  placeholder="Search models..."
                  value={modelSearch}
                  onChange={e => setModelSearch(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none min-w-0"
                  autoFocus
                />
                {modelSearch && (
                  <button onClick={() => setModelSearch('')} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Model List */}
            <div className="max-h-72 overflow-y-auto overscroll-contain pr-1 scrollbar-thin">
              <ModelDropdownList
                models={AVAILABLE_MODELS.filter(m =>
                  !modelSearch ||
                  m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
                  m.description.toLowerCase().includes(modelSearch.toLowerCase()) ||
                  m.id.toLowerCase().includes(modelSearch.toLowerCase())
                )}
                selected={selectedModel}
                onSelect={(id) => {
                  onModelChange(id);
                  setModelMenuOpen(false);
                  setModelSearch('');
                }}
              />
            </div>
          </DropdownMenu>

          {/* Talk to AI / Voice Note Microphone Button */}
          <Tooltip content={isRecording ? 'Stop recording voice note' : 'Talk to AI / Voice note'} side="top">
            <button
              type="button"
              onClick={handleToggleVoice}
              className={cn(
                'p-1.5 rounded-full transition-all shrink-0',
                isRecording
                  ? 'bg-red-500 text-white animate-pulse shadow-md ring-2 ring-red-400/40'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              )}
              aria-label={isRecording ? 'Stop recording' : 'Talk to AI'}
            >
              {isRecording ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
          </Tooltip>

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
          e.target.value = '';
        }}
        aria-hidden="true"
      />
    </div>
  );
}

function AttachmentChip({ attachment, onRemove }: { attachment: Attachment; onRemove: () => void }) {
  const isImage = attachment.type.startsWith('image/');
  const isAudio = attachment.type.startsWith('audio/') || attachment.mimeType?.startsWith('audio/');
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current && attachment.dataUrl) {
      audioRef.current = new Audio(attachment.dataUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  return (
    <div className="flex items-center gap-2 bg-[var(--surface-overlay)] border border-[var(--border)] rounded-xl px-2.5 py-1.5 max-w-[240px] group">
      {isImage && attachment.dataUrl ? (
        <img src={attachment.dataUrl} alt={attachment.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
      ) : isAudio ? (
        <button
          onClick={toggleAudio}
          className="w-8 h-8 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 flex items-center justify-center shrink-0 transition-colors"
          title={isPlaying ? 'Pause' : 'Play voice note'}
        >
          {isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
        </button>
      ) : (
        <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center shrink-0">
          <FileText size={14} className="text-[var(--accent)]" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--text-primary)] truncate">{attachment.name}</p>
        <p className="text-[10px] text-[var(--text-muted)]">
          {isAudio && attachment.duration ? `${attachment.duration}s · ` : ''}{formatFileSize(attachment.size)}
        </p>
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
  'gemini-direct': { label: 'Google Gemini (Official)', color: 'text-teal-400' },
  groq:            { label: 'Groq (Ultra Fast)', color: 'text-orange-400' },
  openrouter:      { label: 'OpenRouter Multi-Model', color: 'text-blue-400' },
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
  if (models.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-[var(--text-muted)]">
        No matching models found
      </div>
    );
  }

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
          <div key={provider} className="pb-1">
            <div className={cn('px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider', meta.color)}>
              {meta.label}
            </div>
            {items.map(model => (
              <DropdownItem
                key={model.id}
                onClick={() => onSelect(model.id)}
                className={cn('py-2 px-3', model.id === selected && 'bg-[var(--accent-subtle)]')}
              >
                <div className="flex items-center justify-between gap-2.5 w-full min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className={cn(
                      'font-medium text-xs truncate',
                      model.id === selected ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-primary)]'
                    )}>
                      {model.name}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
                      {model.description}
                    </div>
                  </div>
                  {model.id === selected && (
                    <Check size={13} className="shrink-0 text-[var(--accent)]" />
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
