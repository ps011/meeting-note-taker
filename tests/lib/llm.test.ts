import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getLlmSettings, summarize } from '@/lib/llm'

function mockFetchJson(body: unknown, ok = true, statusText = 'OK') {
  const response = {
    ok,
    statusText,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response

  return vi.fn().mockResolvedValue(response)
}

describe('getLlmSettings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to Ollama settings', () => {
    expect(getLlmSettings()).toEqual({
      provider: 'ollama',
      ollamaUrl: 'http://localhost:11434',
      ollamaModel: 'llama3.2',
      openaiBaseUrl: 'https://api.openai.com/v1',
      openaiModel: 'gpt-4o-mini',
      openaiApiKey: '',
    })
  })

  it('reads OpenAI-compatible settings from localStorage', () => {
    localStorage.setItem('aura:llmProvider', 'openai-compatible')
    localStorage.setItem('aura:openaiBaseUrl', 'https://openrouter.ai/api/v1/')
    localStorage.setItem('aura:openaiModel', 'openai/gpt-4o-mini')
    localStorage.setItem('aura:openaiApiKey', 'sk-test')

    expect(getLlmSettings()).toMatchObject({
      provider: 'openai-compatible',
      openaiBaseUrl: 'https://openrouter.ai/api/v1/',
      openaiModel: 'openai/gpt-4o-mini',
      openaiApiKey: 'sk-test',
    })
  })

  it('falls back to Ollama for an unknown provider value', () => {
    localStorage.setItem('aura:llmProvider', 'native-provider')

    expect(getLlmSettings().provider).toBe('ollama')
  })
})

describe('summarize', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', mockFetchJson({ response: '## Summary\n- Done' }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the existing Ollama generate request by default', async () => {
    const summary = await summarize({
      transcript: 'We decided to ship the release.',
      title: 'Release Sync',
      templateId: 'general',
    })

    expect(summary).toBe('## Summary\n- Done')
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('http://localhost:11434/api/generate')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init?.body as string)).toMatchObject({
      model: 'llama3.2',
      stream: false,
      options: { temperature: 0.7, top_p: 0.9 },
    })
    expect(JSON.parse(init?.body as string).prompt).toContain('Release Sync')
    expect(JSON.parse(init?.body as string).prompt).toContain('We decided to ship the release.')
  })

  it('reports empty Ollama responses clearly', async () => {
    vi.stubGlobal('fetch', mockFetchJson({}))

    await expect(summarize({
      transcript: 'Transcript',
      title: 'Meeting',
      templateId: 'general',
    })).rejects.toThrow('Ollama returned an empty response')
  })

  it('sends OpenAI-compatible chat completions with bearer auth', async () => {
    localStorage.setItem('aura:llmProvider', 'openai-compatible')
    localStorage.setItem('aura:openaiBaseUrl', 'https://openrouter.ai/api/v1/')
    localStorage.setItem('aura:openaiModel', 'openai/gpt-4o-mini')
    localStorage.setItem('aura:openaiApiKey', 'sk-test')
    vi.stubGlobal('fetch', mockFetchJson({ choices: [{ message: { content: '  ## Cloud Summary  ' } }] }))

    const summary = await summarize({
      transcript: 'Customer asked for pricing.',
      title: 'Sales Call',
      templateId: 'client',
    })

    expect(summary).toBe('## Cloud Summary')
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer sk-test',
    })
    expect(JSON.parse(init?.body as string)).toMatchObject({
      model: 'openai/gpt-4o-mini',
      temperature: 0.7,
      top_p: 0.9,
    })
    expect(JSON.parse(init?.body as string).messages).toEqual([
      expect.objectContaining({
        role: 'user',
        content: expect.stringContaining('Customer asked for pricing.'),
      }),
    ])
  })

  it('requires an API key before calling an OpenAI-compatible provider', async () => {
    localStorage.setItem('aura:llmProvider', 'openai-compatible')

    await expect(summarize({
      transcript: 'Transcript',
      title: 'Meeting',
      templateId: 'general',
    })).rejects.toThrow('OpenAI-compatible API key is required. Add it in Settings.')

    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports empty OpenAI-compatible responses clearly', async () => {
    localStorage.setItem('aura:llmProvider', 'openai-compatible')
    localStorage.setItem('aura:openaiApiKey', 'sk-test')
    vi.stubGlobal('fetch', mockFetchJson({ choices: [{ message: {} }] }))

    await expect(summarize({
      transcript: 'Transcript',
      title: 'Meeting',
      templateId: 'general',
    })).rejects.toThrow('OpenAI-compatible API returned an empty response')
  })

  it('includes provider response text for OpenAI-compatible API failures', async () => {
    localStorage.setItem('aura:llmProvider', 'openai-compatible')
    localStorage.setItem('aura:openaiApiKey', 'sk-test')
    vi.stubGlobal('fetch', mockFetchJson({ error: { message: 'bad key' } }, false, 'Unauthorized'))

    await expect(summarize({
      transcript: 'Transcript',
      title: 'Meeting',
      templateId: 'general',
    })).rejects.toThrow('OpenAI-compatible API error: {"error":{"message":"bad key"}}')
  })
})
