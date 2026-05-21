import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { v4 as uuidv4 } from 'uuid'

export type RecordingStatus = 'processing' | 'completed' | 'failed'

export type RecordingRecord = {
  id: string
  title: string
  templateId: string
  participants: string[]
  transcript: string
  summary: string | null
  status: RecordingStatus
  error: string | null
  createdAt: number
}

interface AuraDB extends DBSchema {
  recordings: {
    key: string
    value: RecordingRecord
    indexes: { by_createdAt: number }
  }
  vault: {
    key: 'handle'
    value: FileSystemDirectoryHandle
  }
}

let dbPromise: Promise<IDBPDatabase<AuraDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<AuraDB>('aura', 1, {
      upgrade(db) {
        const store = db.createObjectStore('recordings', { keyPath: 'id' })
        store.createIndex('by_createdAt', 'createdAt')
        db.createObjectStore('vault')
      },
    })
  }
  return dbPromise
}

export async function createRecording(
  data: Omit<RecordingRecord, 'id' | 'createdAt'>
): Promise<RecordingRecord> {
  const db = await getDB()
  const record: RecordingRecord = { ...data, id: uuidv4(), createdAt: Date.now() }
  await db.put('recordings', record)
  return record
}

export async function updateRecording(id: string, updates: Partial<RecordingRecord>): Promise<void> {
  const db = await getDB()
  const existing = await db.get('recordings', id)
  if (!existing) throw new Error(`Recording ${id} not found`)
  await db.put('recordings', { ...existing, ...updates })
}

export async function getAllRecordings(): Promise<RecordingRecord[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('recordings', 'by_createdAt')
  return all.reverse()
}

export async function getRecording(id: string): Promise<RecordingRecord | undefined> {
  const db = await getDB()
  return db.get('recordings', id)
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('recordings', id)
}

export async function saveVaultHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await getDB()
  await db.put('vault', handle, 'handle')
}

export async function getVaultHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  const db = await getDB()
  return db.get('vault', 'handle')
}
