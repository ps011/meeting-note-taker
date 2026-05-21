'use client'

import { useEffect, useRef } from 'react'
import { useSession } from '@/lib/session-context'

export function LiveTranscript() {
  const { state } = useSession()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.finalTranscript, state.interimTranscript])

  if (state.status === 'idle' && !state.finalTranscript) return null

  return (
    <div className="rounded-base border-3 border-border bg-secondary-background p-4 shadow-shadow">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Live Transcript
      </p>
      <div className="h-40 overflow-y-auto">
        <p className="text-sm leading-relaxed">
          <span>{state.finalTranscript}</span>
          {state.interimTranscript && (
            <span className="italic text-muted-foreground"> {state.interimTranscript}</span>
          )}
        </p>
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
