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
  // ── Gemini Direct (Google AI) ──────────────────────────
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'High speed, multimodal, reasoning · Google',
    available: true,
    provider: 'gemini-direct',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'Fast & versatile · Google',
    available: true,
    provider: 'gemini-direct',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    description: 'Complex reasoning & analysis · Google',
    available: true,
    provider: 'gemini-direct',
  },
  // ── Groq (confirmed working — ultra-fast) ─────────────
  {
    id: 'groq/qwen/qwen3.8-27b',
    name: 'Qwen3 27B',
    description: 'Smart & fast · Groq',
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
  {
    id: 'groq/llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    description: 'Llama 3.3 Versatile · Groq',
    available: true,
    provider: 'groq',
  },
  // ── OpenRouter (requires credits for most models) ─────
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash',
    description: 'Google · OpenRouter',
    available: true,
    provider: 'openrouter',
  },
  {
    id: 'google/gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
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
  {
    id: 'meta-llama/llama-3.1-8b-instruct:free',
    name: 'Llama 3.1 8B',
    description: 'Free · Meta · OpenRouter',
    available: true,
    provider: 'openrouter',
  },
];

export const DEFAULT_MODEL = 'gemini-2.0-flash';
