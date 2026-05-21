export type SpeechCallbacks = {
  onInterim: (text: string) => void
  onFinal: (text: string) => void
  onError: (error: string) => void
  onEnd: () => void
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
}

type SR = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onresult: ((event: any) => void) | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
}

export class SpeechRecorder {
  private recognition: SR | null = null
  private callbacks: SpeechCallbacks
  private running = false

  constructor(callbacks: SpeechCallbacks) {
    this.callbacks = callbacks
  }

  start() {
    if (!isSpeechSupported()) {
      this.callbacks.onError('Speech recognition is not supported. Use Chrome or Edge.')
      return
    }

    const w = window as typeof window & {
      SpeechRecognition?: new () => SR
      webkitSpeechRecognition?: new () => SR
    }
    const SRConstructor = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SRConstructor) {
      this.callbacks.onError('Speech recognition is not supported. Use Chrome or Edge.')
      return
    }
    this.recognition = new SRConstructor()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = 'en-US'

    this.recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          this.callbacks.onFinal(transcript)
        } else {
          interim += transcript
        }
      }
      this.callbacks.onInterim(interim)
    }

    this.recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        this.callbacks.onError(`Speech recognition error: ${event.error}`)
      }
    }

    this.recognition.onend = () => {
      if (this.running) {
        this.recognition?.start()
      } else {
        this.callbacks.onEnd()
      }
    }

    this.running = true
    this.recognition.start()
  }

  stop() {
    this.running = false
    if (this.recognition) {
      this.recognition.onresult = null
      this.recognition.onerror = null
      this.recognition.onend = null
      this.recognition.stop()
      this.recognition = null
    }
  }
}
