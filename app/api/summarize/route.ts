import { NextRequest, NextResponse } from 'next/server'
import { getTemplate, buildPrompt } from '@/lib/templates'

export async function POST(req: NextRequest) {
  let body: { transcript?: string; title?: string; templateId?: string; ollamaUrl?: string; ollamaModel?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { transcript, title = 'Meeting', templateId = 'general', ollamaUrl: reqUrl, ollamaModel: reqModel } = body
  const ollamaUrl = reqUrl ?? process.env.OLLAMA_URL ?? 'http://localhost:11434'
  const ollamaModel = reqModel ?? process.env.OLLAMA_MODEL ?? 'llama3.2'

  if (!transcript || transcript.trim().length < 10) {
    return NextResponse.json({ error: 'Transcript is too short or missing' }, { status: 400 })
  }

  const template = getTemplate(templateId)
  const prompt = buildPrompt(template, transcript, title)

  try {
    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: ollamaModel, prompt, stream: false, options: { temperature: 0.7, top_p: 0.9 } }),
      signal: AbortSignal.timeout(300_000),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Ollama error: ${text}` }, { status: 502 })
    }

    const data = await res.json() as { response?: string; text?: string }
    const summary = data.response ?? data.text

    if (!summary) {
      return NextResponse.json({ error: 'Ollama returned an empty response' }, { status: 502 })
    }

    return NextResponse.json({ summary })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      return NextResponse.json(
        { error: `Could not reach Ollama at ${ollamaUrl} — is it running?` },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'Unexpected error contacting Ollama' }, { status: 500 })
  }
}
