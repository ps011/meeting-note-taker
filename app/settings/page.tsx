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
import { DEFAULT_LLM_SETTINGS, type LlmProvider } from '@/lib/llm'

const KEYS = {
  provider: 'aura:llmProvider',
  ollamaUrl: 'aura:ollamaUrl',
  ollamaModel: 'aura:ollamaModel',
  openaiBaseUrl: 'aura:openaiBaseUrl',
  openaiModel: 'aura:openaiModel',
  openaiApiKey: 'aura:openaiApiKey',
  defaultTemplate: 'aura:defaultTemplate',
}

function normalizeProvider(value: string | null): LlmProvider {
  return value === 'openai-compatible' ? 'openai-compatible' : 'ollama'
}

export default function SettingsPage() {
  const [provider, setProvider] = useState<LlmProvider>(DEFAULT_LLM_SETTINGS.provider)
  const [ollamaUrl, setOllamaUrl] = useState(DEFAULT_LLM_SETTINGS.ollamaUrl)
  const [ollamaModel, setOllamaModel] = useState(DEFAULT_LLM_SETTINGS.ollamaModel)
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState(DEFAULT_LLM_SETTINGS.openaiBaseUrl)
  const [openaiModel, setOpenaiModel] = useState(DEFAULT_LLM_SETTINGS.openaiModel)
  const [openaiApiKey, setOpenaiApiKey] = useState(DEFAULT_LLM_SETTINGS.openaiApiKey)
  const [defaultTemplate, setDefaultTemplate] = useState('general')
  const [vaultName, setVaultName] = useState<string | null>(null)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default')
  const [saved, setSaved] = useState(false)
  const templates = getAllTemplates()

  useEffect(() => {
    setProvider(normalizeProvider(localStorage.getItem(KEYS.provider)))
    setOllamaUrl(localStorage.getItem(KEYS.ollamaUrl) ?? DEFAULT_LLM_SETTINGS.ollamaUrl)
    setOllamaModel(localStorage.getItem(KEYS.ollamaModel) ?? DEFAULT_LLM_SETTINGS.ollamaModel)
    setOpenaiBaseUrl(localStorage.getItem(KEYS.openaiBaseUrl) ?? DEFAULT_LLM_SETTINGS.openaiBaseUrl)
    setOpenaiModel(localStorage.getItem(KEYS.openaiModel) ?? DEFAULT_LLM_SETTINGS.openaiModel)
    setOpenaiApiKey(localStorage.getItem(KEYS.openaiApiKey) ?? DEFAULT_LLM_SETTINGS.openaiApiKey)
    setDefaultTemplate(localStorage.getItem(KEYS.defaultTemplate) ?? 'general')
    setNotifPermission(getNotificationPermission())
    getVaultHandle().then(h => { if (h) setVaultName(h.name) })
  }, [])

  const handleSave = () => {
    localStorage.setItem(KEYS.provider, provider)
    localStorage.setItem(KEYS.ollamaUrl, ollamaUrl)
    localStorage.setItem(KEYS.ollamaModel, ollamaModel)
    localStorage.setItem(KEYS.openaiBaseUrl, openaiBaseUrl)
    localStorage.setItem(KEYS.openaiModel, openaiModel)
    localStorage.setItem(KEYS.openaiApiKey, openaiApiKey)
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
        <CardHeader><CardTitle>LLM Provider</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="llm-provider" className="mb-1 block text-sm font-semibold">Provider</label>
            <select
              id="llm-provider"
              value={provider}
              onChange={e => setProvider(e.target.value as LlmProvider)}
              className={inputClass}
            >
              <option value="ollama">Ollama</option>
              <option value="openai-compatible">OpenAI-compatible</option>
            </select>
          </div>

          {provider === 'ollama' ? (
            <>
              <div>
                <label htmlFor="ollama-api-url" className="mb-1 block text-sm font-semibold">Ollama API URL</label>
                <input id="ollama-api-url" type="text" value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="ollama-model" className="mb-1 block text-sm font-semibold">Ollama Model</label>
                <input id="ollama-model" type="text" value={ollamaModel} onChange={e => setOllamaModel(e.target.value)} className={inputClass} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="openai-compatible-base-url" className="mb-1 block text-sm font-semibold">Base URL</label>
                <input id="openai-compatible-base-url" type="url" value={openaiBaseUrl} onChange={e => setOpenaiBaseUrl(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="openai-compatible-model" className="mb-1 block text-sm font-semibold">Model</label>
                <input id="openai-compatible-model" type="text" value={openaiModel} onChange={e => setOpenaiModel(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="openai-compatible-api-key" className="mb-1 block text-sm font-semibold">API Key</label>
                <input id="openai-compatible-api-key" type="password" value={openaiApiKey} onChange={e => setOpenaiApiKey(e.target.value)} className={inputClass} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Stored in this browser profile and sent directly to the configured provider.
                </p>
              </div>
            </>
          )}
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
            <p className="text-sm text-red-600">Blocked - enable in browser settings.</p>
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
