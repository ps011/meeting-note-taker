'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Download, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getRecording, type RecordingRecord } from '@/lib/history'
import { formatNote } from '@/lib/noteFormatter'
import { downloadNote } from '@/lib/vault'
import { renderMarkdown } from '@/lib/utils'

function NoteView() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = searchParams.get('id')
  const [record, setRecord] = useState<RecordingRecord | null>(null)

  useEffect(() => {
    if (id) getRecording(id).then(r => setRecord(r ?? null))
  }, [id])

  if (!record) {
    return <p className="text-muted-foreground">Loading…</p>
  }

  const createdAt = new Date(record.createdAt)
  const noteContent = formatNote({
    summary: record.summary ?? '',
    transcription: record.transcript,
    title: record.title,
    templateId: record.templateId,
    participants: record.participants,
    createdAt,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{record.title}</h1>
        <div className="flex gap-2">
          <Button variant="neutral" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          <Button variant="neutral" size="sm" onClick={() => downloadNote(noteContent, record.title, createdAt)}>
            <Download className="size-4" /> Download
          </Button>
        </div>
      </div>

      <div className="rounded-base border-3 border-border bg-secondary-background p-6 shadow-shadow">
        <div
          className="markdown-body"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(record.summary ?? '') }}
        />
      </div>

      <details className="rounded-base border-3 border-border bg-secondary-background shadow-shadow">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold">
          Full Transcript
        </summary>
        <pre className="px-4 pb-4 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {record.transcript}
        </pre>
      </details>
    </div>
  )
}

export default function NoteViewPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
      <NoteView />
    </Suspense>
  )
}
