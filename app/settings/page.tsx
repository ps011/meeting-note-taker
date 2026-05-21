'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { getAllTemplates } from '@/lib/templates'
import { pickVaultFolder, getVaultHandle } from '@/lib/vault'
import {
  requestNotificationPermission,
  getNotificationPermission,
  isNotificationsSupported,
} from '@/lib/notifications'

const KEYS = {
  ollamaUrl: 'aura:ollamaUrl',
  ollamaModel: 'aura:ollamaModel',
  defaultTemplate: 'aura:defaultTemplate',
}

export default function SettingsPage() {
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('llama3.2')
  const [defaultTemplate, setDefaultTemplate] = useState('general')
  const [vaultName, setVaultName] = useState<string | null>(null)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default')
  const [saved, setSaved] = useState(false)
  const templates = getAllTemplates()

  useEffect(() => {
    setOllamaUrl(localStorage.getItem(KEYS.ollamaUrl) ?? 'http://localhost:11434')
    setOllamaModel(localStorage.getItem(KEYS.ollamaModel) ?? 'llama3.2')
    setDefaultTemplate(localStorage.getItem(KEYS.defaultTemplate) ?? 'general')
    setNotifPermission(getNotificationPermission())
    getVaultHandle().then(h => { if (h) setVaultName(h.name) })
  }, [])

  const handleSave = () => {
    localStorage.setItem(KEYS.ollamaUrl, ollamaUrl)
    localStorage.setItem(KEYS.ollamaModel, ollamaModel)
    localStorage.setItem(KEYS.defaultTemplate, defaultTemplate)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handlePickVault = async () => {
    try {
      const name = await pickVaultFolder()
      setVaultName(name)
    } catch {
      // user cancelled picker
    }
  }

  const handleRequestNotifications = async () => {
    const perm = await requestNotificationPermission()
    setNotifPermission(perm)
  }

  const inputClass = 'w-full rounded-base border-3 border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card>
        <CardHeader><CardTitle>Ollama</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-semibold">API URL</label>
            <input type="text" value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Model</label>
            <input type="text" value={ollamaModel} onChange={e => setOllamaModel(e.target.value)} className={inputClass} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Obsidian Vault</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {vaultName ? (
            <p className="text-sm font-semibold">
              Selected: <span className="text-main">{vaultName}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No vault folder selected.</p>
          )}
          <Button variant="neutral" onClick={handlePickVault}>
            {vaultName ? 'Change Vault Folder' : 'Select Vault Folder'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Defaults</CardTitle></CardHeader>
        <CardContent>
          <label className="mb-1 block text-sm font-semibold">Default Template</label>
          <select
            value={defaultTemplate}
            onChange={e => setDefaultTemplate(e.target.value)}
            className={inputClass}
          >
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
        <CardContent>
          {!isNotificationsSupported() ? (
            <p className="text-sm text-muted-foreground">Not supported in this browser.</p>
          ) : notifPermission === 'granted' ? (
            <p className="text-sm font-semibold text-green-700">Notifications enabled ✓</p>
          ) : notifPermission === 'denied' ? (
            <p className="text-sm text-red-600">Blocked — enable in browser settings.</p>
          ) : (
            <Button variant="neutral" onClick={handleRequestNotifications}>
              Enable Notifications
            </Button>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave}>{saved ? 'Saved ✓' : 'Save Settings'}</Button>
    </div>
  )
}
