/**
 * FAMILY OS — OpenAI Service
 * Génération des menus via GPT-4o-mini.
 *
 * Stockage de la clé : localStorage 'family_os_openai_key'
 * Ne jamais écrire la clé en dur dans le code.
 */

const OPENAI_KEY_STORAGE = 'family_os_openai_key'

// ─── Clé API ──────────────────────────────────────────────────────────────────

export function getOpenAIKey(): string {
  return localStorage.getItem(OPENAI_KEY_STORAGE)?.trim() ?? ''
}

export function setOpenAIKey(key: string): void {
  localStorage.setItem(OPENAI_KEY_STORAGE, key.trim())
}

export function hasOpenAIKey(): boolean {
  return getOpenAIKey().length > 10
}

// ─── Appel générique ──────────────────────────────────────────────────────────

export type OpenAIError = 'quota' | 'invalid_key' | 'network'

export interface OpenAIOptions {
  model?: 'gpt-4o-mini' | 'gpt-4o'
  temperature?: number
  maxTokens?: number
  jsonMode?: boolean
}

export async function appelOpenAI(prompt: string, temperature?: number): Promise<string>
export async function appelOpenAI(prompt: string, options?: OpenAIOptions): Promise<string>
export async function appelOpenAI(
  prompt: string,
  optionsOrTemperature?: OpenAIOptions | number,
): Promise<string> {
  const key = getOpenAIKey()
  if (!key) throw new Error('Clé OpenAI manquante')

  const opts: OpenAIOptions = typeof optionsOrTemperature === 'number'
    ? { temperature: optionsOrTemperature }
    : (optionsOrTemperature ?? {})

  const body: Record<string, unknown> = {
    model:       opts.model ?? 'gpt-4o-mini',
    temperature: opts.temperature ?? 0.7,
    max_tokens:  opts.maxTokens ?? 1024,
    messages: [{ role: 'user', content: prompt }],
  }
  if (opts.jsonMode) body.response_format = { type: 'json_object' }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    if (res.status === 429) throw Object.assign(new Error('quota'),       { openaiError: 'quota'       as OpenAIError })
    if (res.status === 401) throw Object.assign(new Error('invalid_key'), { openaiError: 'invalid_key' as OpenAIError })
    throw new Error(`OpenAI error ${res.status}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// ─── Appel vision (image + texte) ────────────────────────────────────────────

export async function appelOpenAIVision(
  imageBase64: string,
  prompt: string,
  opts: Pick<OpenAIOptions, 'maxTokens' | 'temperature' | 'jsonMode'> = {},
): Promise<string> {
  const key = getOpenAIKey()
  if (!key) throw new Error('Clé OpenAI manquante')

  // Normalise : accepte "data:image/jpeg;base64,..." ou le raw base64
  const dataUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`

  const body: Record<string, unknown> = {
    model:       'gpt-4o',
    temperature: opts.temperature ?? 0.3,
    max_tokens:  opts.maxTokens ?? 2048,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  }
  if (opts.jsonMode) body.response_format = { type: 'json_object' }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    if (res.status === 429) throw Object.assign(new Error('quota'),       { openaiError: 'quota'       as OpenAIError })
    if (res.status === 401) throw Object.assign(new Error('invalid_key'), { openaiError: 'invalid_key' as OpenAIError })
    throw new Error(`OpenAI vision error ${res.status}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}
