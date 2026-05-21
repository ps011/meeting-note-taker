'use client'

import { type RecordingStatus } from '@/lib/history'
import { Button } from '@/components/ui/button'

export type HistoryFilterValue = 'all' | RecordingStatus

const FILTERS: { value: HistoryFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'processing', label: 'Processing' },
]

type Props = {
  active: HistoryFilterValue
  onChange: (f: HistoryFilterValue) => void
}

export function HistoryFilter({ active, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map(f => (
        <Button
          key={f.value}
          size="sm"
          variant={active === f.value ? 'default' : 'neutral'}
          onClick={() => onChange(f.value)}
        >
          {f.label}
        </Button>
      ))}
    </div>
  )
}
