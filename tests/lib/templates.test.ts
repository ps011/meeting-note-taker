import { describe, it, expect } from 'vitest'
import { getTemplate, getAllTemplates, buildPrompt } from '@/lib/templates'

describe('getTemplate', () => {
  it('returns general template for unknown id', () => {
    expect(getTemplate('nonexistent').id).toBe('general')
  })

  it('returns correct template for known id', () => {
    const t = getTemplate('standup')
    expect(t.id).toBe('standup')
    expect(t.name).toBe('Standup / Daily Sync')
  })
})

describe('getAllTemplates', () => {
  it('returns 7 templates', () => {
    expect(getAllTemplates()).toHaveLength(7)
  })

  it('all templates have required fields', () => {
    for (const t of getAllTemplates()) {
      expect(t.id).toBeTruthy()
      expect(t.name).toBeTruthy()
      expect(t.prompt).toBeTruthy()
    }
  })
})

describe('buildPrompt', () => {
  it('interpolates meetingTitle and transcription', () => {
    const t = getTemplate('general')
    const prompt = buildPrompt(t, 'hello world', 'My Meeting')
    expect(prompt).toContain('My Meeting')
    expect(prompt).toContain('hello world')
    expect(prompt).not.toContain('{meetingTitle}')
    expect(prompt).not.toContain('{transcription}')
  })
})
