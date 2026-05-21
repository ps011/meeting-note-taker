import { MeetingSetup } from '@/components/MeetingSetup'
import { RecordingButton } from '@/components/RecordingButton'
import { LiveTranscript } from '@/components/LiveTranscript'
import { ProcessingProgress } from '@/components/ProcessingProgress'
import { NoteResult } from '@/components/NoteResult'

export default function RecordingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Record Meeting</h1>
      <section className="rounded-base border-3 border-border bg-secondary-background p-4 shadow-shadow">
        <div className="space-y-6">
          <MeetingSetup />
          <div className="flex justify-center border-t-3 border-border pt-6">
            <RecordingButton />
          </div>
        </div>
      </section>
      <LiveTranscript />
      <ProcessingProgress />
      <NoteResult />
    </div>
  )
}
