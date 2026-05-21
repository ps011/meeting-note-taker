import { describe, it, expect } from 'vitest'
import { formatNote, generateFilename } from '@/lib/noteFormatter'

const baseData = {
  summary: '## Key Points\n- Point one\n- Point two',
  transcription: 'Hello, this is the meeting.',
  title: 'Q3 Planning',
  templateId: 'planning' as const,
  participants: ['Alice', 'Bob'],
  createdAt: new Date('2026-05-21T10:30:00'),
}

describe('formatNote', () => {
  it('includes YAML frontmatter', () => {
    const note = formatNote(baseData)
    expect(note).toMatch(/^---/)
    expect(note).toContain('title: Q3 Planning')
    expect(note).toContain('meeting_type: planning')
  })

  it('includes summary section', () => {
    const note = formatNote(baseData)
    expect(note).toContain('## Summary')
    expect(note).toContain('## Key Points')
  })

  it('includes transcription in details block', () => {
    const note = formatNote(baseData)
    expect(note).toContain('<details>')
    expect(note).toContain('Hello, this is the meeting.')
  })

  it('includes participants when provided', () => {
    const note = formatNote(baseData)
    expect(note).toContain('Alice')
    expect(note).toContain('Bob')
  })

  it('omits participants line when empty', () => {
    const note = formatNote({ ...baseData, participants: [] })
    expect(note).not.toContain('**Participants:**')
  })
})

describe('generateFilename', () => {
  it('produces .md filename with title and date', () => {
    const name = generateFilename('Q3 Planning', new Date('2026-05-21T10:30:00'))
    expect(name).toMatch(/^Q3 Planning - /)
    expect(name).toMatch(/\.md$/)
  })

  it('strips invalid filename characters', () => {
    const name = generateFilename('Meeting: Q3/2026', new Date('2026-05-21T10:30:00'))
    expect(name).not.toContain(':')
    expect(name).not.toContain('/')
  })
})
