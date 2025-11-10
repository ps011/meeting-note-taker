/**
 * Meeting note templates with type-specific prompts
 * Inspired by Granola.ai's template system
 */

const MEETING_TEMPLATES = {
  general: {
    id: 'general',
    name: 'General Meeting',
    description: 'Standard meeting notes for any type of meeting',
    icon: '📋',
    prompt: `You are an expert meeting note-taker. Analyze the following meeting transcription and create a comprehensive, detailed summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

Please create a well-structured, descriptive summary with the following sections:

## Meeting Overview
Provide a brief but comprehensive overview of the meeting, including:
- Meeting purpose and objectives
- Key participants and their roles (if mentioned)
- Overall meeting context

## Key Discussion Points
List and elaborate on the main topics discussed. For each point:
- Include specific details, quotes, and data points mentioned
- Note who said what (if speakers are identified)
- Explain the context and importance of each discussion point
- Include any numbers, metrics, or specific information shared

## Decisions Made
Document all decisions and agreements reached during the meeting:
- What was decided
- Who made the decision or who agreed
- Rationale or reasoning behind the decision (if mentioned)
- Any conditions or caveats

## Action Items
List all tasks and action items with:
- Clear description of what needs to be done
- Responsible party (name or role)
- Due date or timeline (if mentioned)
- Dependencies or related items

## Next Steps
Outline follow-up actions, including:
- Future meetings scheduled
- Items to be reviewed or discussed later
- Deadlines or milestones
- Any blockers or dependencies

## Additional Notes
Include any other relevant information such as:
- Questions raised that need answers
- Concerns or risks identified
- Resources or tools mentioned
- Important context for future reference

Format your response in clean markdown. Be thorough, descriptive, and include specific details, quotes, numbers, and data points from the transcription.`,
  },

  sales: {
    id: 'sales',
    name: 'Sales Call',
    description: 'For sales calls, demos, and client meetings',
    icon: '💼',
    prompt: `You are an expert sales meeting note-taker. Analyze the following sales call transcription and create a comprehensive, detailed summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

Please create a well-structured, descriptive summary with the following sections:

## Meeting Overview
- Client/Prospect name and company
- Meeting type (discovery, demo, follow-up, etc.)
- Sales stage or opportunity status
- Key participants from both sides

## Client Information
- Company background and context
- Current situation and pain points
- Budget and timeline mentioned
- Decision-making process and stakeholders

## Product/Demo Discussion
- Features or solutions discussed
- Specific questions asked by the client
- Objections raised and how they were addressed
- Client reactions and feedback
- Competitive mentions or comparisons

## Pricing & Terms
- Pricing discussed (specific numbers if mentioned)
- Payment terms or contract details
- Discounts or special offers
- Timeline for decision

## Next Steps & Follow-up
- Specific action items with owners
- Deadlines and timelines
- Materials to send (proposals, quotes, etc.)
- Next meeting scheduled
- Decision date or timeline

## Key Quotes & Insights
Include important quotes from the client that reveal:
- Pain points or needs
- Budget signals
- Decision criteria
- Concerns or objections

Format your response in clean markdown. Be thorough and include all specific details, numbers, quotes, and data points from the transcription.`,
  },

  interview: {
    id: 'interview',
    name: 'Job Interview',
    description: 'For candidate interviews and hiring discussions',
    icon: '👤',
    prompt: `You are an expert interview note-taker. Analyze the following job interview transcription and create a comprehensive, detailed summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

Please create a well-structured, descriptive summary with the following sections:

## Interview Overview
- Candidate name and position applied for
- Interview type (phone screen, technical, final, etc.)
- Interviewers present
- Interview duration and format

## Candidate Background
- Current role and company
- Years of experience
- Education and certifications
- Relevant skills and technologies mentioned

## Technical Assessment
- Technical questions asked and answers given
- Coding challenges or technical exercises (if any)
- Strengths demonstrated
- Areas of concern or gaps identified
- Specific examples of work or projects discussed

## Behavioral Assessment
- Questions about past experiences
- Examples of leadership, teamwork, problem-solving
- Communication style and clarity
- Cultural fit indicators

## Candidate Questions
- Questions the candidate asked
- Topics they showed interest in
- Red flags or concerns raised

## Overall Assessment
- Strengths and positive attributes
- Concerns or areas of improvement
- Recommendation or next steps
- Comparison to job requirements

## Next Steps
- Follow-up interviews scheduled
- References to check
- Additional assessments needed
- Decision timeline

Format your response in clean markdown. Be thorough and include specific examples, quotes, and details from the interview.`,
  },

  standup: {
    id: 'standup',
    name: 'Standup / Daily Sync',
    description: 'For daily standups and team syncs',
    icon: '🔄',
    prompt: `You are an expert standup meeting note-taker. Analyze the following standup meeting transcription and create a comprehensive, detailed summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

Please create a well-structured, descriptive summary with the following sections:

## Standup Overview
- Date and time
- Team members present
- Meeting duration

## Individual Updates
For each team member, document:
- **What they completed yesterday** (specific tasks, features, fixes)
- **What they're working on today** (current priorities)
- **Blockers or impediments** (specific issues preventing progress)
- **Help needed** (from whom and for what)

## Team Metrics & Progress
- Sprint or milestone progress
- Velocity or completion rates (if mentioned)
- Key metrics or KPIs discussed
- Deadlines and milestones

## Blockers & Dependencies
- All blockers identified
- Who is blocked and by what
- Dependencies between team members
- Escalations needed

## Decisions Made
- Quick decisions or clarifications
- Process changes
- Priority adjustments

## Action Items
- Follow-up tasks assigned
- Blockers to resolve
- Help offered or requested
- Next steps

Format your response in clean markdown. Be concise but thorough, including specific task names, ticket numbers, and details mentioned.`,
  },

  oneOnOne: {
    id: 'oneOnOne',
    name: '1-on-1 Meeting',
    description: 'For manager-employee 1-on-1s',
    icon: '🤝',
    prompt: `You are an expert 1-on-1 meeting note-taker. Analyze the following 1-on-1 meeting transcription and create a comprehensive, detailed summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

Please create a well-structured, descriptive summary with the following sections:

## Meeting Overview
- Participants (manager and direct report)
- Meeting date and duration
- Meeting format and location

## Updates & Progress
- Work updates and accomplishments
- Current projects and priorities
- Progress on goals or objectives
- Wins and achievements

## Challenges & Concerns
- Obstacles or difficulties faced
- Areas where support is needed
- Concerns or frustrations
- Workload or capacity issues

## Career Development
- Career goals and aspirations
- Growth opportunities discussed
- Skills to develop
- Training or learning needs
- Promotion or role changes

## Feedback
- Manager feedback given
- Employee feedback received
- Areas of improvement
- Recognition and praise

## Action Items
- Commitments made by either party
- Follow-up items
- Resources or support to provide
- Next steps

## Personal Notes
- Personal updates or life events
- Work-life balance topics
- Team dynamics or relationships

Format your response in clean markdown. Be thorough and include specific details, quotes, and context. Maintain confidentiality and focus on actionable items.`,
  },

  retrospective: {
    id: 'retrospective',
    name: 'Retrospective',
    description: 'For sprint retros and team retrospectives',
    icon: '🔄',
    prompt: `You are an expert retrospective meeting note-taker. Analyze the following retrospective meeting transcription and create a comprehensive, detailed summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

Please create a well-structured, descriptive summary with the following sections:

## Retrospective Overview
- Sprint or period being reviewed
- Team members present
- Retrospective format (Start/Stop/Continue, 4Ls, etc.)

## What Went Well
- Successes and achievements
- Positive feedback and recognition
- Processes that worked well
- Team wins and accomplishments
- Specific examples and metrics

## What Didn't Go Well
- Challenges and difficulties
- Process issues or bottlenecks
- Communication breakdowns
- Technical problems
- Specific examples and impact

## Action Items
- Specific improvements to implement
- Process changes to try
- Tools or resources needed
- Owners and timelines
- Success metrics

## Experiments & Changes
- New approaches to try
- Experiments to run
- Process modifications
- Team agreements

## Team Health
- Morale and team dynamics
- Workload and capacity
- Burnout or stress indicators
- Support needed

Format your response in clean markdown. Be thorough and include specific examples, quotes, and actionable items.`,
  },

  planning: {
    id: 'planning',
    name: 'Planning Meeting',
    description: 'For sprint planning, project planning, and roadmap sessions',
    icon: '📅',
    prompt: `You are an expert planning meeting note-taker. Analyze the following planning meeting transcription and create a comprehensive, detailed summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

Please create a well-structured, descriptive summary with the following sections:

## Planning Overview
- Planning period (sprint, quarter, project phase, etc.)
- Participants and their roles
- Planning goals and objectives
- Timeline and deadlines

## Scope & Priorities
- Features or work items planned
- Priority order and rationale
- Must-have vs. nice-to-have items
- Dependencies between items
- Scope changes or adjustments

## Estimates & Capacity
- Effort estimates (story points, hours, etc.)
- Team capacity and availability
- Velocity or throughput expectations
- Risk factors affecting estimates

## Timeline & Milestones
- Key dates and deadlines
- Milestones and deliverables
- Sprint or iteration boundaries
- Critical path items

## Risks & Dependencies
- Identified risks and mitigation plans
- External dependencies
- Blockers or impediments
- Assumptions made

## Action Items
- Tasks assigned with owners
- Follow-up items
- Decisions to be made
- Next steps

## Decisions Made
- Scope decisions
- Technical decisions
- Process decisions
- Resource allocations

Format your response in clean markdown. Be thorough and include specific details, numbers, dates, and actionable items.`,
  },
};

/**
 * Get a template by ID
 */
function getTemplate(templateId) {
  return MEETING_TEMPLATES[templateId] || MEETING_TEMPLATES.general;
}

/**
 * Get all available templates
 */
function getAllTemplates() {
  return Object.values(MEETING_TEMPLATES);
}

/**
 * Build a prompt from a template
 */
function buildPromptFromTemplate(template, transcription, meetingTitle) {
  return template.prompt
    .replace(/{meetingTitle}/g, meetingTitle)
    .replace(/{transcription}/g, transcription);
}

module.exports = {
  MEETING_TEMPLATES,
  getTemplate,
  getAllTemplates,
  buildPromptFromTemplate,
};
