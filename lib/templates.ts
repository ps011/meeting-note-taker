export type TemplateId = 'general' | 'sales' | 'interview' | 'standup' | 'oneOnOne' | 'retrospective' | 'planning'

export type Template = {
  id: TemplateId
  name: string
  description: string
  icon: string
  prompt: string
}

const TEMPLATES: Record<TemplateId, Template> = {
  general: {
    id: 'general',
    name: 'General Meeting',
    description: 'Standard meeting notes for any type of meeting',
    icon: '📋',
    prompt: `You are an expert meeting note-taker. Analyze the following meeting transcription and create a comprehensive summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

Please create a well-structured summary with the following sections:

## Meeting Overview
Provide a brief overview including meeting purpose, key participants, and context.

## Key Discussion Points
List and elaborate on the main topics discussed with specific details and data points.

## Decisions Made
Document all decisions and agreements reached with rationale.

## Action Items
List all tasks with responsible party, due date, and dependencies.

## Next Steps
Outline follow-up actions, future meetings, and milestones.

## Additional Notes
Include questions raised, concerns, risks, and resources mentioned.

Format your response in clean markdown. Be thorough and include specific details from the transcription.`,
  },
  sales: {
    id: 'sales',
    name: 'Sales Call',
    description: 'For sales calls, demos, and client meetings',
    icon: '💼',
    prompt: `You are an expert sales meeting note-taker. Analyze the following sales call transcription and create a comprehensive summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

## Meeting Overview
Client/Prospect name, meeting type, sales stage, key participants.

## Client Information
Company background, pain points, budget, timeline, decision-making process.

## Product/Demo Discussion
Features discussed, client questions, objections and responses, competitive mentions.

## Pricing & Terms
Pricing discussed, payment terms, discounts, decision timeline.

## Next Steps & Follow-up
Action items with owners, materials to send, next meeting, decision date.

## Key Quotes & Insights
Important client quotes revealing pain points, budget signals, decision criteria.

Format in clean markdown with specific details, numbers, and quotes from the transcription.`,
  },
  interview: {
    id: 'interview',
    name: 'Job Interview',
    description: 'For candidate interviews and hiring discussions',
    icon: '👤',
    prompt: `You are an expert interview note-taker. Analyze the following job interview transcription and create a comprehensive summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

## Interview Overview
Candidate name, position, interview type, interviewers, duration.

## Candidate Background
Current role, years of experience, education, relevant skills.

## Technical Assessment
Technical questions and answers, strengths, gaps, specific examples.

## Behavioral Assessment
Past experience examples, leadership, teamwork, cultural fit.

## Candidate Questions
Questions asked, topics of interest, concerns raised.

## Overall Assessment
Strengths, concerns, recommendation, comparison to requirements, next steps.

Format in clean markdown with specific examples and quotes.`,
  },
  standup: {
    id: 'standup',
    name: 'Standup / Daily Sync',
    description: 'For daily standups and team syncs',
    icon: '🔄',
    prompt: `You are an expert standup meeting note-taker. Analyze the following standup transcription and create a summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

## Standup Overview
Date, team members present, duration.

## Individual Updates
For each team member: what they completed, what they're working on today, blockers, help needed.

## Team Metrics & Progress
Sprint progress, velocity, key metrics, deadlines.

## Blockers & Dependencies
All blockers, who is blocked, dependencies, escalations.

## Action Items
Follow-up tasks, blockers to resolve, next steps.

Format in clean markdown. Be concise but include specific task names and ticket numbers.`,
  },
  oneOnOne: {
    id: 'oneOnOne',
    name: '1-on-1 Meeting',
    description: 'For manager-employee 1-on-1s',
    icon: '🤝',
    prompt: `You are an expert 1-on-1 meeting note-taker. Analyze the following 1-on-1 transcription and create a summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

## Meeting Overview
Participants, date, duration, format.

## Updates & Progress
Work updates, current projects, goal progress, wins.

## Challenges & Concerns
Obstacles, support needed, concerns, workload issues.

## Career Development
Career goals, growth opportunities, skills to develop, training needs.

## Feedback
Manager feedback, employee feedback, areas of improvement, recognition.

## Action Items
Commitments, follow-up items, resources to provide, next steps.

Format in clean markdown. Be thorough and maintain confidentiality.`,
  },
  retrospective: {
    id: 'retrospective',
    name: 'Retrospective',
    description: 'For sprint retros and team retrospectives',
    icon: '🔁',
    prompt: `You are an expert retrospective note-taker. Analyze the following retrospective transcription and create a summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

## Retrospective Overview
Sprint/period reviewed, team members, retrospective format.

## What Went Well
Successes, positive feedback, processes that worked, specific examples.

## What Didn't Go Well
Challenges, process issues, communication breakdowns, specific examples.

## Action Items
Improvements to implement, process changes, owners, timelines, success metrics.

## Experiments & Changes
New approaches, experiments to run, team agreements.

## Team Health
Morale, workload, burnout indicators, support needed.

Format in clean markdown with specific examples and actionable items.`,
  },
  planning: {
    id: 'planning',
    name: 'Planning Meeting',
    description: 'For sprint planning, project planning, and roadmap sessions',
    icon: '📅',
    prompt: `You are an expert planning meeting note-taker. Analyze the following planning meeting transcription and create a summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

## Planning Overview
Planning period, participants, goals, timeline.

## Scope & Priorities
Features planned, priority order, must-have vs nice-to-have, dependencies.

## Estimates & Capacity
Effort estimates, team capacity, velocity expectations, risk factors.

## Timeline & Milestones
Key dates, milestones, sprint boundaries, critical path.

## Risks & Dependencies
Identified risks, external dependencies, blockers, assumptions.

## Action Items & Decisions
Tasks assigned, decisions made, technical decisions, resource allocations.

Format in clean markdown with specific details, numbers, dates, and actionable items.`,
  },
}

export function getTemplate(id: TemplateId | string): Template {
  return TEMPLATES[id as TemplateId] ?? TEMPLATES.general
}

export function getAllTemplates(): Template[] {
  return Object.values(TEMPLATES)
}

export function buildPrompt(template: Template, transcription: string, meetingTitle: string): string {
  return template.prompt
    .replace(/{meetingTitle}/g, meetingTitle)
    .replace(/{transcription}/g, transcription)
}
