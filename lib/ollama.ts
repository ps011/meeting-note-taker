export type SummarizeRequest = {
  transcript: string
  title: string
  templateId: string
}

export async function summarize(req: SummarizeRequest): Promise<string> {
  const ollamaUrl = typeof window !== 'undefined'
    ? (localStorage.getItem('aura:ollamaUrl') ?? 'http://localhost:11434')
    : 'http://localhost:11434'
  const ollamaModel = typeof window !== 'undefined'
    ? (localStorage.getItem('aura:ollamaModel') ?? 'llama3.2')
    : 'llama3.2'

  const res = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...req, ollamaUrl, ollamaModel }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? `Summarize failed with status ${res.status}`)
  }

  const data = await res.json() as { summary: string }
  return data.summary
}
