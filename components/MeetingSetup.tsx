'use client'

import { getAllTemplates } from '@/lib/templates'
import { useSession } from '@/lib/session-context'

export function MeetingSetup() {
  const { state, dispatch } = useSession()
  const templates = getAllTemplates()

  if (state.status !== 'idle') return null

  return (
    <div className="rounded-base border-3 border-border bg-secondary-background p-4 shadow-shadow space-y-3">
      <div>
        <label className="block text-sm font-semibold mb-1">Meeting Title</label>
        <input
          type="text"
          value={state.title}
          onChange={e => dispatch({ type: 'UPDATE_TITLE', title: e.target.value })}
          placeholder="e.g. Q3 Planning"
          className="w-full rounded-base border-3 border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Template</label>
        <select
          value={state.templateId}
          onChange={e => dispatch({ type: 'UPDATE_TEMPLATE', templateId: e.target.value })}
          className="w-full rounded-base border-3 border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {templates.map(t => (
            <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Participants <span className="font-normal text-muted-foreground">(comma separated)</span></label>
        <input
          type="text"
          placeholder="e.g. Alice, Bob, Carol"
          onChange={e =>
            dispatch({
              type: 'UPDATE_PARTICIPANTS',
              participants: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
            })
          }
          className="w-full rounded-base border-3 border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>
  )
}
