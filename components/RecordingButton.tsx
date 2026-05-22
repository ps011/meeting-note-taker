'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Square, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/session-context'
import { SpeechRecorder, isSpeechSupported } from '@/lib/speech'
import { summarize } from '@/lib/llm'
import { createRecording, updateRecording } from '@/lib/history'
import { notifyComplete, notifyError } from '@/lib/notifications'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function RecordingButton() {
  const { state, dispatch } = useSession()
  const recorderRef = useRef<SpeechRecorder | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (state.status === 'recording') {
      tickRef.current = setInterval(() => dispatch({ type: 'TICK' }), 1000)
    } else {
      if (tickRef.current) clearInterval(tickRef.current)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [state.status, dispatch])

  const handleStart = useCallback(async () => {
    const record = await createRecording({
      title: state.title,
      templateId: state.templateId,
      participants: state.participants,
      transcript: '',
      summary: null,
      status: 'processing',
      error: null,
    })
    dispatch({
      type: 'START_RECORDING',
      title: state.title,
      templateId: state.templateId,
      participants: state.participants,
      recordingId: record.id,
    })
    const recorder = new SpeechRecorder({
      onFinal: text => dispatch({ type: 'APPEND_FINAL', text }),
      onInterim: text => dispatch({ type: 'SET_INTERIM', text }),
      onError: err => dispatch({ type: 'SET_ERROR', error: err }),
      onEnd: () => {},
    })
    recorderRef.current = recorder
    recorder.start()
  }, [state.title, state.templateId, state.participants, dispatch])

  const handleStop = useCallback(async () => {
    recorderRef.current?.stop()
    recorderRef.current = null
    dispatch({ type: 'START_PROCESSING' })

    const transcript = state.finalTranscript.trim()
    const recordingId = state.recordingId!

    try {
      await updateRecording(recordingId, { transcript, status: 'processing' })
      const summary = await summarize({ transcript, title: state.title, templateId: state.templateId })
      await updateRecording(recordingId, { summary, status: 'completed' })
      dispatch({ type: 'SET_COMPLETE', summary })
      notifyComplete(state.title)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      await updateRecording(recordingId, { status: 'failed', error: msg })
      dispatch({ type: 'SET_ERROR', error: msg })
      notifyError()
    }
  }, [state.finalTranscript, state.recordingId, state.title, state.templateId, dispatch])

  if (!isSpeechSupported() && state.status === 'idle') {
    return (
      <div className="rounded-base border-3 border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
        Speech recognition requires Chrome or Edge. Firefox is not supported.
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {state.status === 'idle' && (
        <button
          type="button"
          onClick={handleStart}
          aria-label="Start recording"
          title="Start recording"
          className="flex size-48 items-center justify-center rounded-full border-4 border-border bg-red-500 shadow-shadow transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-x-boxShadowX active:translate-y-boxShadowY active:shadow-none motion-reduce:transition-none"
        >
          <span className="size-24 rounded-full border-3 border-border bg-red-600" />
        </button>
      )}
      {state.status === 'recording' && (
        <>
          <Button onClick={handleStop} variant="destructive" size="lg" className="w-64 text-lg">
            <Square className="size-5 fill-current" /> Stop Recording
          </Button>
          <span className="font-mono text-2xl font-bold tabular-nums">{formatTime(state.elapsedSeconds)}</span>
        </>
      )}
      {state.status === 'processing' && (
        <Button disabled size="lg" className="w-64 text-lg">
          <Loader2 className="size-5 animate-spin" /> Processing…
        </Button>
      )}
    </div>
  )
}
