export type Role = 'user' | 'assistant';

export type MessageStatus = 'sending' | 'streaming' | 'done' | 'error';

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  mimeType: string;
  duration?: number;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  status: MessageStatus;
  attachments?: Attachment[];
  createdAt: number;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  pinned: boolean;
  isNotebook?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type Theme = 'dark' | 'light' | 'system';

export interface UserPreferences {
  theme: Theme;
  defaultModel: string;
  sidebarOpen: boolean;
}

export interface Model {
  id: string;
  name: string;
  description: string;
  available: boolean;
  provider: 'openrouter' | 'gemini-direct' | 'groq';
}

export const AVAILABLE_MODELS: Model[] = [
  // ── Groq (confirmed working — ultra-fast) ────────────
  {
    id: 'groq/qwen/qwen3.8-27b',
    name: 'Qwen3 27B',
    description: 'Fast & smart · Groq',
    available: true,
    provider: 'groq',
  },
  {
    id: 'groq/openai/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    description: 'Fast · OpenAI OSS · Groq',
    available: true,
    provider: 'groq',
  },
  {
    id: 'groq/openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    description: 'Powerful · OpenAI OSS · Groq',
    available: true,
    provider: 'groq',
  },
  // ── OpenRouter free (confirmed available) ────────────
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'Nemotron Lightning',
    description: 'Free · NVIDIA · OpenRouter',
    available: true,
    provider: 'openrouter',
  },
  {
    id: 'google/gemma-4-31b-it:free',
    name: 'Gemma 4 31B',
    description: 'Free · Google · OpenRouter',
    available: true,
    provider: 'openrouter',
  },
  // ── OpenRouter paid ────────────────────────────────────
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Google · OpenRouter',
    available: true,
    provider: 'openrouter',
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    name: 'Claude 3.5 Haiku',
    description: 'Anthropic · OpenRouter',
    available: true,
    provider: 'openrouter',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'OpenAI · OpenRouter',
    available: true,
    provider: 'openrouter',
  },
];

export const DEFAULT_MODEL = 'groq/qwen/qwen3.8-27b';
