'use client'

import { createContext, useContext, useReducer, type ReactNode } from 'react'

export type SessionStatus = 'idle' | 'recording' | 'processing' | 'completed' | 'error'

export type SessionState = {
  status: SessionStatus
  title: string
  templateId: string
  participants: string[]
  finalTranscript: string
  interimTranscript: string
  summary: string | null
  savedFilename: string | null
  error: string | null
  elapsedSeconds: number
  recordingId: string | null
}

type Action =
  | { type: 'START_RECORDING'; title: string; templateId: string; participants: string[]; recordingId: string }
  | { type: 'APPEND_FINAL'; text: string }
  | { type: 'SET_INTERIM'; text: string }
  | { type: 'TICK' }
  | { type: 'START_PROCESSING' }
  | { type: 'SET_COMPLETE'; summary: string }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_SAVED_FILENAME'; filename: string }
  | { type: 'RESET' }
  | { type: 'UPDATE_TITLE'; title: string }
  | { type: 'UPDATE_TEMPLATE'; templateId: string }
  | { type: 'UPDATE_PARTICIPANTS'; participants: string[] }

const initial: SessionState = {
  status: 'idle',
  title: 'Meeting',
  templateId: 'general',
  participants: [],
  finalTranscript: '',
  interimTranscript: '',
  summary: null,
  savedFilename: null,
  error: null,
  elapsedSeconds: 0,
  recordingId: null,
}

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'START_RECORDING':
      return {
        ...initial,
        status: 'recording',
        title: action.title,
        templateId: action.templateId,
        participants: action.participants,
        recordingId: action.recordingId,
      }
    case 'APPEND_FINAL':
      return { ...state, finalTranscript: (state.finalTranscript + ' ' + action.text).trim(), interimTranscript: '' }
    case 'SET_INTERIM':
      return { ...state, interimTranscript: action.text }
    case 'TICK':
      return { ...state, elapsedSeconds: state.elapsedSeconds + 1 }
    case 'START_PROCESSING':
      return { ...state, status: 'processing', interimTranscript: '' }
    case 'SET_COMPLETE':
      return { ...state, status: 'completed', summary: action.summary }
    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.error }
    case 'SET_SAVED_FILENAME':
      return { ...state, savedFilename: action.filename }
    case 'RESET':
      return initial
    case 'UPDATE_TITLE':
      return { ...state, title: action.title }
    case 'UPDATE_TEMPLATE':
      return { ...state, templateId: action.templateId }
    case 'UPDATE_PARTICIPANTS':
      return { ...state, participants: action.participants }
    default:
      return state
  }
}

type SessionContextValue = {
  state: SessionState
  dispatch: React.Dispatch<Action>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial)
  return <SessionContext.Provider value={{ state, dispatch }}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
