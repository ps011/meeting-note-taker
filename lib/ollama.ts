import { getTemplate, buildPrompt } from './templates'

export type SummarizeRequest = {
  transcript: string
  title: string
  templateId: string
}

export async function summarize(req: SummarizeRequest): Promise<string> {
  const ollamaUrl = localStorage.getItem('aura:ollamaUrl') ?? 'http://localhost:11434'
  const ollamaModel = localStorage.getItem('aura:ollamaModel') ?? 'llama3.2'

  const template = getTemplate(req.templateId)
  const prompt = buildPrompt(template, req.transcript, req.title)

  let res: Response
  try {
    res = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: ollamaModel, prompt, stream: false, options: { temperature: 0.7, top_p: 0.9 } }),
      signal: AbortSignal.timeout(300_000),
    })
  } catch {
    throw new Error(`Could not reach Ollama at ${ollamaUrl} — is it running? (Tip: start it with OLLAMA_ORIGINS=https://ps011.github.io ollama serve)`)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ollama error: ${text || res.statusText}`)
  }

  const data = await res.json() as { response?: string; text?: string }
  const summary = data.response ?? data.text
  if (!summary) throw new Error('Ollama returned an empty response')
  return summary
}
