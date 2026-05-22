import { getTemplate, buildPrompt } from './templates'

export type LlmProvider = 'ollama' | 'openai-compatible'

export type LlmSettings = {
  provider: LlmProvider
  ollamaUrl: string
  ollamaModel: string
  openaiBaseUrl: string
  openaiModel: string
  openaiApiKey: string
}

export type SummarizeRequest = {
  transcript: string
  title: string
  templateId: string
}

const KEYS = {
  provider: 'aura:llmProvider',
  ollamaUrl: 'aura:ollamaUrl',
  ollamaModel: 'aura:ollamaModel',
  openaiBaseUrl: 'aura:openaiBaseUrl',
  openaiModel: 'aura:openaiModel',
  openaiApiKey: 'aura:openaiApiKey',
} as const

export const DEFAULT_LLM_SETTINGS: LlmSettings = {
  provider: 'ollama',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.2',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiModel: 'gpt-4o-mini',
  openaiApiKey: '',
}

function storedValue(key: string, fallback: string): string {
  const value = localStorage.getItem(key)
  return value === null ? fallback : value
}

function normalizeProvider(value: string | null): LlmProvider {
  return value === 'openai-compatible' ? 'openai-compatible' : 'ollama'
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '')
}

function requireValue(value: string, message: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(message)
  return trimmed
}

export function getLlmSettings(): LlmSettings {
  return {
    provider: normalizeProvider(localStorage.getItem(KEYS.provider)),
    ollamaUrl: storedValue(KEYS.ollamaUrl, DEFAULT_LLM_SETTINGS.ollamaUrl),
    ollamaModel: storedValue(KEYS.ollamaModel, DEFAULT_LLM_SETTINGS.ollamaModel),
    openaiBaseUrl: storedValue(KEYS.openaiBaseUrl, DEFAULT_LLM_SETTINGS.openaiBaseUrl),
    openaiModel: storedValue(KEYS.openaiModel, DEFAULT_LLM_SETTINGS.openaiModel),
    openaiApiKey: storedValue(KEYS.openaiApiKey, DEFAULT_LLM_SETTINGS.openaiApiKey),
  }
}

export async function summarize(req: SummarizeRequest): Promise<string> {
  const template = getTemplate(req.templateId)
  const prompt = buildPrompt(template, req.transcript, req.title)
  const settings = getLlmSettings()

  if (settings.provider === 'openai-compatible') {
    return summarizeWithOpenAiCompatible(prompt, settings)
  }

  return summarizeWithOllama(prompt, settings)
}

async function summarizeWithOllama(prompt: string, settings: LlmSettings): Promise<string> {
  const ollamaUrl = trimTrailingSlashes(requireValue(
    settings.ollamaUrl,
    'Ollama API URL is required. Add it in Settings.'
  ))
  const ollamaModel = requireValue(
    settings.ollamaModel,
    'Ollama model is required. Add it in Settings.'
  )

  let res: Response
  try {
    res = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        prompt,
        stream: false,
        options: { temperature: 0.7, top_p: 0.9 },
      }),
      signal: AbortSignal.timeout(300_000),
    })
  } catch (err) {
    throw new Error(`Could not reach Ollama at ${ollamaUrl} - is it running?`, { cause: err })
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ollama error: ${text || res.statusText}`)
  }

  const data = await res.json() as { response?: string; text?: string }
  const summary = data.response ?? data.text
  if (!summary?.trim()) throw new Error('Ollama returned an empty response')
  return summary.trim()
}

async function summarizeWithOpenAiCompatible(prompt: string, settings: LlmSettings): Promise<string> {
  const baseUrl = trimTrailingSlashes(requireValue(
    settings.openaiBaseUrl,
    'OpenAI-compatible base URL is required. Add it in Settings.'
  ))
  const model = requireValue(
    settings.openaiModel,
    'OpenAI-compatible model is required. Add it in Settings.'
  )
  const apiKey = requireValue(
    settings.openaiApiKey,
    'OpenAI-compatible API key is required. Add it in Settings.'
  )

  let res: Response
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        top_p: 0.9,
      }),
      signal: AbortSignal.timeout(300_000),
    })
  } catch (err) {
    throw new Error(`Could not reach OpenAI-compatible API at ${baseUrl}`, { cause: err })
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenAI-compatible API error: ${text || res.statusText}`)
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string | null } }>
  }
  const summary = data.choices?.[0]?.message?.content
  if (!summary?.trim()) throw new Error('OpenAI-compatible API returned an empty response')
  return summary.trim()
}
