'use client'

import { useSession } from '@/lib/session-context'

const STEPS = ['Transcribing', 'Summarising', 'Saving']

export function ProcessingProgress() {
  const { state } = useSession()
  if (state.status !== 'processing') return null

  return (
    <div className="rounded-base border-3 border-border bg-secondary-background p-6 shadow-shadow">
      <div className="flex items-center justify-between">
        {STEPS.map((step, i) => (
          <div key={step} className="flex flex-1 flex-col items-center gap-2">
            <div
              className={`flex size-9 items-center justify-center rounded-full border-3 border-border text-sm font-bold transition-all ${
                i === 1 ? 'animate-pulse bg-main text-main-foreground' : 'bg-background text-muted-foreground'
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-xs font-semibold ${i === 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
