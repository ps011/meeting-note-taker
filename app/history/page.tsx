'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HistoryCard } from '@/components/HistoryCard'
import { HistoryFilter, type HistoryFilterValue } from '@/components/HistoryFilter'
import { getAllRecordings, updateRecording, type RecordingRecord } from '@/lib/history'
import { summarize } from '@/lib/ollama'

export default function HistoryPage() {
  const [records, setRecords] = useState<RecordingRecord[]>([])
  const [filter, setFilter] = useState<HistoryFilterValue>('all')
  const [retrying, setRetrying] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    getAllRecordings().then(setRecords)
  }, [])

  const filtered = filter === 'all' ? records : records.filter(r => r.status === filter)

  const handleDelete = (id: string) => setRecords(prev => prev.filter(r => r.id !== id))

  const handleRetry = async (record: RecordingRecord) => {
    setRetrying(record.id)
    setRecords(prev => prev.map(r => r.id === record.id ? { ...r, status: 'processing', error: null } : r))
    try {
      await updateRecording(record.id, { status: 'processing', error: null })
      const summary = await summarize({
        transcript: record.transcript,
        title: record.title,
        templateId: record.templateId,
      })
      await updateRecording(record.id, { summary, status: 'completed' })
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, summary, status: 'completed' } : r))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      await updateRecording(record.id, { status: 'failed', error: msg })
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, status: 'failed', error: msg } : r))
    } finally {
      setRetrying(null)
    }
  }

  const handleView = (record: RecordingRecord) => {
    router.push(`/history/${record.id}`)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">History</h1>
      <HistoryFilter active={filter} onChange={setFilter} />
      {filtered.length === 0 ? (
        <p className="text-muted-foreground">No recordings found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(record => (
            <HistoryCard
              key={record.id}
              record={retrying === record.id ? { ...record, status: 'processing' } : record}
              onDelete={handleDelete}
              onRetry={handleRetry}
              onView={handleView}
            />
          ))}
        </div>
      )}
    </div>
  )
}
