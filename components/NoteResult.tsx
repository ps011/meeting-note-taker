'use client'

import { useState } from 'react'
import { Download, FolderOpen, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/session-context'
import { formatNote } from '@/lib/noteFormatter'
import { saveToVault, downloadNote, pickVaultFolder } from '@/lib/vault'
import { renderMarkdown } from '@/lib/utils'

export function NoteResult() {
  const { state, dispatch } = useSession()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (state.status === 'error') {
    return (
      <div className="rounded-base border-3 border-red-500 bg-red-50 p-4 shadow-shadow space-y-3">
        <p className="font-bold text-red-700">Something went wrong</p>
        <p className="text-sm text-red-600">{state.error}</p>
        <Button variant="neutral" size="sm" onClick={() => dispatch({ type: 'RESET' })}>
          <RefreshCw className="size-4" /> Try Again
        </Button>
      </div>
    )
  }

  if (state.status !== 'completed') return null

  const noteDate = new Date()
  const noteContent = formatNote({
    summary: state.summary!,
    transcription: state.finalTranscript,
    title: state.title,
    templateId: state.templateId,
    participants: state.participants,
    createdAt: noteDate,
  })

  const handleSaveToVault = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const filename = await saveToVault(noteContent, state.title, noteDate)
      dispatch({ type: 'SET_SAVED_FILENAME', filename })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      if (msg.includes('No vault folder')) {
        try {
          await pickVaultFolder()
          const filename = await saveToVault(noteContent, state.title, noteDate)
          dispatch({ type: 'SET_SAVED_FILENAME', filename })
        } catch (e: unknown) {
          setSaveError(e instanceof Error ? e.message : 'Save failed')
        }
      } else {
        setSaveError(msg)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-base border-3 border-border bg-secondary-background p-6 shadow-shadow">
        <div
          className="markdown-body"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(state.summary!) }}
        />
      </div>

      <details className="rounded-base border-3 border-border bg-secondary-background shadow-shadow">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold">
          Full Transcript
        </summary>
        <pre className="px-4 pb-4 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {state.finalTranscript}
        </pre>
      </details>

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleSaveToVault} disabled={saving}>
          <FolderOpen className="size-4" />
          {saving ? 'Saving…' : state.savedFilename ? 'Saved to Vault ✓' : 'Save to Vault'}
        </Button>
        <Button onClick={() => downloadNote(noteContent, state.title, noteDate)} variant="neutral">
          <Download className="size-4" /> Download .md
        </Button>
        <Button onClick={() => dispatch({ type: 'RESET' })} variant="neutral">
          New Meeting
        </Button>
      </div>

      {saveError && <p className="text-sm font-semibold text-red-600">{saveError}</p>}
      {state.savedFilename && (
        <p className="text-sm font-semibold text-green-700">Saved: {state.savedFilename}</p>
      )}
    </div>
  )
}
