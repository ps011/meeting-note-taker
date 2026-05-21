import { MeetingSetup } from '@/components/MeetingSetup'
import { RecordingButton } from '@/components/RecordingButton'
import { LiveTranscript } from '@/components/LiveTranscript'
import { ProcessingProgress } from '@/components/ProcessingProgress'
import { NoteResult } from '@/components/NoteResult'

export default function RecordingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Record Meeting</h1>
      <MeetingSetup />
      <div className="flex justify-center py-2">
        <RecordingButton />
      </div>
      <LiveTranscript />
      <ProcessingProgress />
      <NoteResult />
    </div>
  )
}
