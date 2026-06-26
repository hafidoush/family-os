/**
 * FAMILY OS — Claude Service (Anthropic)
 * Appels à Claude Haiku pour l'analyse de préparation des activités.
 *
 * Pattern identique à openaiService :
 * - Clé stockée en localStorage + métadonnées Supabase
 * - Appels via fetch natif, pas de SDK
 */

import { supabase } from '../supabase/client'

const CLAUDE_KEY_STORAGE = 'family_os_claude_key'
const CLAUDE_API_URL     = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL       = 'claude-haiku-4-5-20251001'
const ANTHROPIC_VERSION  = '2023-06-01'

// ─── Clé API ──────────────────────────────────────────────────────────────────

export function getClaudeKey(): string {
  return localStorage.getItem(CLAUDE_KEY_STORAGE)?.trim() ?? ''
}

export async function setClaudeKey(key: string): Promise<void> {
  const trimmed = key.trim()
  localStorage.setItem(CLAUDE_KEY_STORAGE, trimmed)
  await supabase.auth.updateUser({ data: { claude_key: trimmed } })
}

export async function loadClaudeKeyFromCloud(): Promise<void> {
  if (getClaudeKey()) return
  const { data: { user } } = await supabase.auth.getUser()
  const cloudKey = user?.user_metadata?.claude_key as string | undefined
  if (cloudKey) localStorage.setItem(CLAUDE_KEY_STORAGE, cloudKey)
}

export function hasClaudeKey(): boolean {
  return getClaudeKey().length > 10
}

// ─── Appel générique ──────────────────────────────────────────────────────────

export interface ClaudeOptions {
  maxTokens?: number
  temperature?: number
}

export async function appelClaude(
  prompt: string,
  options: ClaudeOptions = {},
): Promise<string> {
  const key = getClaudeKey()
  if (!key) throw new Error('Clé Claude manquante')

  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       key,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,
      max_tokens: options.maxTokens  ?? 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    if (res.status === 429) throw Object.assign(new Error('quota'),       { claudeError: 'quota'       })
    if (res.status === 401) throw Object.assign(new Error('invalid_key'), { claudeError: 'invalid_key' })
    throw new Error(`Claude error ${res.status}`)
  }

  const data = await res.json()
  return (data.content?.[0]?.text as string | undefined) ?? ''
}
