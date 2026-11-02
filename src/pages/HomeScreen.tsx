import { useState } from 'react';
import { Lightbulb, Code2, FileText, Sparkles } from 'lucide-react';
import { Composer } from '@/components/composer/Composer';
import { NovaLogo } from '@/assets/NovaLogo';
import type { Attachment } from '@/types';

interface HomeScreenProps {
  onSend: (content: string, attachments: Attachment[]) => void;
  isLoading?: boolean;
  selectedModel: string;
  onModelChange: (model: string) => void;
}

const SUGGESTIONS = [
  { icon: Lightbulb, label: 'Explain a concept', prompt: 'Help me understand a complex topic in simple terms.' },
  { icon: Code2, label: 'Write code', prompt: 'Help me write, debug, or improve my code.' },
  { icon: FileText, label: 'Summarize text', prompt: 'Summarize a document or article for me.' },
  { icon: Sparkles, label: 'Brainstorm ideas', prompt: 'Help me brainstorm creative ideas for a project.' },
];

export function HomeScreen({ onSend, isLoading, selectedModel, onModelChange }: HomeScreenProps) {
  const [pendingPrompt, setPendingPrompt] = useState('');

  const handleSuggestion = (prompt: string) => {
    onSend(prompt, []);
  };

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden">
      {/* Blue radial glow background — matches screenshot */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'var(--blue-glow)' }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col items-center justify-center flex-1 px-4 pb-8 min-h-0 pt-12">
        {/* Gemini Sparkle Logo */}
        <div className="mb-4 hover:scale-105 transition-transform">
          <NovaLogo size={46} />
        </div>

        {/* Heading */}
        <h1 className="text-4xl md:text-5xl font-normal text-[var(--text-primary)] text-center mb-8 tracking-tight select-none">
          Where should we start?
        </h1>

        {/* Composer */}
        <div className="w-full max-w-2xl">
          <Composer
            onSend={onSend}
            isLoading={isLoading}
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            initialValue={pendingPrompt}
            onInitialValueConsumed={() => setPendingPrompt('')}
            placeholder="Ask Nova anything..."
            variant="home"
          />
        </div>

        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-2 mt-6 justify-center max-w-2xl">
          {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
            <button
              key={label}
              onClick={() => handleSuggestion(prompt)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-raised)] border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] hover:border-[var(--accent)] transition-all duration-150"
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
