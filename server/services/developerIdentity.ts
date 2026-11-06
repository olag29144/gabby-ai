import { supabaseAdmin } from './supabase.js';

export const PERMANENT_DEVELOPER_ID = '00000000-0000-0000-0000-000000000001';
export const DEVELOPER_NAME = 'Ola Gabriel';
export const APP_NAME = 'Gabby AI';

export type UserRole = 'user' | 'admin' | 'owner';

export interface DeveloperProfile {
  id: string;
  userId: string;
  developerId: string;
  fullName: string;
  role: string;
  accessLevel: string;
  appName: string;
  isVerified: boolean;
}

export interface AppIdentity {
  appName: string;
  creatorName: string;
  creatorRole: string;
  description: string;
  systemPrompt: string;
}

// Cache app identity in memory (changes rarely)
let _appIdentityCache: AppIdentity | null = null;

export async function getAppIdentity(): Promise<AppIdentity> {
  if (_appIdentityCache) return _appIdentityCache;

  const { data, error } = await supabaseAdmin
    .from('app_identity')
    .select('app_name,creator_name,creator_role,description,system_prompt')
    .limit(1)
    .single();

  if (error || !data) {
    // Fallback — never fail
    return {
      appName: APP_NAME,
      creatorName: DEVELOPER_NAME,
      creatorRole: 'Original Creator & Lead Developer',
      description: 'An intelligent AI assistant built by Ola Gabriel.',
      systemPrompt: buildDefaultSystemPrompt(),
    };
  }

  _appIdentityCache = {
    appName: data.app_name,
    creatorName: data.creator_name,
    creatorRole: data.creator_role,
    description: data.description,
    systemPrompt: data.system_prompt || buildDefaultSystemPrompt(),
  };
  return _appIdentityCache;
}

export function invalidateAppIdentityCache() {
  _appIdentityCache = null;
}

function buildDefaultSystemPrompt(): string {
  return `You are ${APP_NAME}, an intelligent AI assistant created by ${DEVELOPER_NAME} (Original Creator & Lead Developer).

Your permanent identity:
- Name: ${APP_NAME}
- Created by: ${DEVELOPER_NAME}
- Purpose: To be a helpful, accurate, and honest AI assistant.

Important rules about your identity:
1. Always identify yourself as "${APP_NAME}", never by the name of any underlying AI model or provider (e.g., do not say "I am Gemini" or "I am GPT").
2. When asked who created you, always say "${DEVELOPER_NAME}".
3. Your identity as ${APP_NAME} is permanent regardless of which AI provider powers you.
4. Treat every authenticated user with respect and helpfulness.
5. Never claim to have capabilities you do not have.
6. Be concise, accurate, and genuinely useful.`;
}

export async function getUserRole(userId: string): Promise<UserRole> {
  const { data, error } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (error || !data) return 'user';
  return (data.role as UserRole) ?? 'user';
}

export async function getDeveloperProfile(userId: string): Promise<DeveloperProfile | null> {
  const { data, error } = await supabaseAdmin
    .from('developer_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    developerId: data.developer_id,
    fullName: data.full_name,
    role: data.role,
    accessLevel: data.access_level,
    appName: data.app_name,
    isVerified: data.is_verified,
  };
}

export async function isOwner(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === 'owner';
}

export async function logAudit(
  userId: string | null,
  action: string,
  resource?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: userId,
      action,
      resource,
      details: details ?? {},
    });
  } catch {
    // Audit failures must never crash the app
  }
}
