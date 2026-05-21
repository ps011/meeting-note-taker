import { saveVaultHandle, getVaultHandle } from './history'
import { generateFilename } from './noteFormatter'

export { getVaultHandle }

export async function pickVaultFolder(): Promise<string> {
  const handle = await (
    window as typeof window & { showDirectoryPicker: (opts?: { mode?: string }) => Promise<FileSystemDirectoryHandle> }
  ).showDirectoryPicker({ mode: 'readwrite' })
  await saveVaultHandle(handle)
  return handle.name
}

export async function saveToVault(content: string, title: string, date: Date): Promise<string> {
  const handle = await getVaultHandle()
  if (!handle) {
    throw new Error('No vault folder selected. Please pick a folder in Settings.')
  }

  // queryPermission/requestPermission are part of the File System Access API
  // but not yet in the TypeScript DOM lib
  const h = handle as FileSystemDirectoryHandle & {
    queryPermission: (opts: { mode: string }) => Promise<string>
    requestPermission: (opts: { mode: string }) => Promise<string>
  }
  const permission = await h.queryPermission({ mode: 'readwrite' })
  if (permission !== 'granted') {
    const request = await h.requestPermission({ mode: 'readwrite' })
    if (request !== 'granted') throw new Error('Vault folder permission denied.')
  }

  const filename = generateFilename(title, date)
  const fileHandle = await handle.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
  return filename
}

export function downloadNote(content: string, title: string, date: Date): void {
  const filename = generateFilename(title, date)
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
