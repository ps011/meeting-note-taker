'use client'

import { Trash2, RefreshCw, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { type RecordingRecord, deleteRecording } from '@/lib/history'
import { getTemplate } from '@/lib/templates'

type Props = {
  record: RecordingRecord
  onDelete: (id: string) => void
  onRetry: (record: RecordingRecord) => void
  onView: (record: RecordingRecord) => void
}

const statusVariant = {
  completed: 'success',
  failed: 'destructive',
  processing: 'warning',
} as const

export function HistoryCard({ record, onDelete, onRetry, onView }: Props) {
  const template = getTemplate(record.templateId)
  const date = new Date(record.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const handleDelete = async () => {
    await deleteRecording(record.id)
    onDelete(record.id)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{record.title}</CardTitle>
          <Badge variant={statusVariant[record.status] ?? 'neutral'} className="shrink-0 capitalize">
            {record.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{date}</p>
      </CardHeader>
      <CardContent>
        <Badge variant="neutral">{template.icon} {template.name}</Badge>
        {record.participants.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">{record.participants.join(', ')}</p>
        )}
        {record.error && (
          <p className="mt-2 text-xs text-red-600 font-medium">{record.error}</p>
        )}
      </CardContent>
      <CardFooter>
        {record.status === 'completed' && (
          <Button size="sm" variant="neutral" onClick={() => onView(record)}>
            <FileText className="size-4" /> View
          </Button>
        )}
        {record.status === 'failed' && (
          <Button size="sm" onClick={() => onRetry(record)}>
            <RefreshCw className="size-4" /> Retry
          </Button>
        )}
        <Button size="sm" variant="destructive" onClick={handleDelete}>
          <Trash2 className="size-4" /> Delete
        </Button>
      </CardFooter>
    </Card>
  )
}
