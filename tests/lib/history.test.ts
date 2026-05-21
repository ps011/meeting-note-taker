import { describe, it, expect, beforeAll } from 'vitest'
import 'fake-indexeddb/auto'
import { createRecording, updateRecording, getAllRecordings, deleteRecording } from '@/lib/history'

beforeAll(() => {
  // fake-indexeddb/auto sets up IDBFactory globally
})

describe('createRecording', () => {
  it('creates a record with generated id and timestamp', async () => {
    const record = await createRecording({
      title: 'Test Meeting',
      templateId: 'general',
      participants: [],
      transcript: 'Hello world',
      summary: null,
      status: 'processing',
      error: null,
    })
    expect(record.id).toBeTruthy()
    expect(record.createdAt).toBeGreaterThan(0)
    expect(record.title).toBe('Test Meeting')
  })
})

describe('updateRecording', () => {
  it('updates status and summary', async () => {
    const record = await createRecording({
      title: 'Update Test',
      templateId: 'general',
      participants: [],
      transcript: 'Hello',
      summary: null,
      status: 'processing',
      error: null,
    })
    await updateRecording(record.id, { status: 'completed', summary: 'Great meeting' })
    const all = await getAllRecordings()
    const updated = all.find(r => r.id === record.id)
    expect(updated?.status).toBe('completed')
    expect(updated?.summary).toBe('Great meeting')
  })
})

describe('deleteRecording', () => {
  it('removes the record', async () => {
    const record = await createRecording({
      title: 'Delete Test',
      templateId: 'general',
      participants: [],
      transcript: 'Hello',
      summary: null,
      status: 'completed',
      error: null,
    })
    await deleteRecording(record.id)
    const all = await getAllRecordings()
    expect(all.find(r => r.id === record.id)).toBeUndefined()
  })
})
