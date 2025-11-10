const fs = require('fs');
const path = require('path');
const { getTemplate } = require('./templates.js');

/**
 * Note writer service for saving meeting notes
 */
class NoteWriter {
  constructor(notesPath) {
    this.notesPath = notesPath;
    this.notesFolderPath = notesPath;
  }

  /**
   * Save meeting notes
   * @param {string} summary - The AI-generated summary
   * @param {string} transcription - The full transcription
   * @param {string} meetingTitle - Title of the meeting
   * @param {string} templateId - Template ID used for the meeting
   * @param {Array} participants - Optional list of participants
   */
  saveNote(summary, transcription, meetingTitle = 'Meeting', templateId = 'general', participants = []) {
    try {
      console.log('📝 Saving meeting notes...');

      if (!fs.existsSync(this.notesPath)) {
        throw new Error(`Notes folder not found at: ${this.notesPath}`);
      }

      if (!fs.existsSync(this.notesFolderPath)) {
        fs.mkdirSync(this.notesFolderPath, { recursive: true });
        console.log(`   Created folder: ${this.notesFolderPath}`);
      }

      const timestamp = this.formatDate(new Date(), 'yyyy-MM-dd-HHmmss');
      const sanitizedTitle = meetingTitle.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');
      const filename = `${timestamp}-${sanitizedTitle}.md`;
      const filePath = path.join(this.notesFolderPath, filename);

      const noteContent = this.formatNote(summary, transcription, meetingTitle, templateId, participants);

      fs.writeFileSync(filePath, noteContent, 'utf-8');

      console.log('✅ Meeting notes saved');
      console.log(`   File: ${filename}`);
      console.log(`   Path: ${filePath}`);

      return filePath;
    } catch (error) {
      console.error('❌ Failed to save notes:', error.message);
      throw error;
    }
  }

  /**
   * Format the meeting note in markdown (Granola.ai style)
   */
  formatNote(summary, transcription, meetingTitle, templateId = 'general', participants = []) {
    const now = new Date();
    const date = this.formatDate(now, 'MMMM dd, yyyy');
    const time = this.formatDate(now, 'HH:mm');
    const dateTime = this.formatDate(now, 'yyyy-MM-dd HH:mm:ss');
    const duration = this.calculateDuration(transcription);
    
    const template = getTemplate(templateId);
    const templateName = template ? template.name : 'General Meeting';
    
    // Build participants section
    let participantsSection = '';
    if (participants && participants.length > 0) {
      participantsSection = `**Participants:** ${participants.join(', ')}\n\n`;
    }

    return `---
title: ${meetingTitle}
date: ${date}
time: ${time}
datetime: ${dateTime}
template: ${templateName}
template_id: ${templateId}
duration: ${duration}
participants: [${participants.map(p => `"${p}"`).join(', ')}]
tags: [meeting, notes, auto-generated, ${templateId}]
---

# ${meetingTitle}

<div class="meeting-metadata" style="margin-bottom: 2rem; padding: 1rem; background: #f5f5f5; border-radius: 8px;">

**📅 Date:** ${date}  
**🕐 Time:** ${time}  
**⏱️ Duration:** ${duration}  
**📋 Template:** ${templateName}${participants.length > 0 ? `\n${participantsSection}` : ''}

</div>

---

## Summary

${summary}

---

## Full Transcription

<details>
<summary>📝 Click to expand full transcription</summary>

${'```'}
${transcription}
${'```'}

</details>

---

<div style="margin-top: 2rem; padding: 1rem; background: #f9f9f9; border-left: 4px solid #4CAF50; border-radius: 4px;">

**ℹ️ Note:** This meeting summary was automatically generated using AI transcription and summarization.  
**🤖 Generated on:** ${dateTime}  
**📋 Template used:** ${templateName}

</div>
`;
  }

  /**
   * Calculate estimated meeting duration from transcription
   * Rough estimate: ~150 words per minute
   */
  calculateDuration(transcription) {
    if (!transcription) return 'Unknown';
    
    const wordCount = transcription.split(/\s+/).length;
    const minutes = Math.round(wordCount / 150);
    
    if (minutes < 1) {
      return '< 1 minute';
    } else if (minutes === 1) {
      return '~1 minute';
    } else {
      return `~${minutes} minutes`;
    }
  }

  /**
   * Simple date formatting
   */
  formatDate(date, format) {
    const pad = (n) => String(n).padStart(2, '0');
    
    const map = {
      yyyy: date.getFullYear(),
      MM: pad(date.getMonth() + 1),
      dd: pad(date.getDate()),
      HH: pad(date.getHours()),
      mm: pad(date.getMinutes()),
      ss: pad(date.getSeconds()),
      MMMM: ['January', 'February', 'March', 'April', 'May', 'June', 
             'July', 'August', 'September', 'October', 'November', 'December'][date.getMonth()]
    };

    return format.replace(/yyyy|MMMM|MM|dd|HH|mm|ss/g, (match) => map[match]);
  }

  /**
   * Parse an existing note file and extract its content
   * @param {string} notePath - Path to the note file
   * @returns {Object} Parsed note data
   */
  parseNote(notePath) {
    try {
      if (!fs.existsSync(notePath)) {
        throw new Error('Note file not found');
      }

      const content = fs.readFileSync(notePath, 'utf-8');
      
      // Extract frontmatter
      const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
      let frontmatter = {};
      if (frontmatterMatch) {
        const frontmatterText = frontmatterMatch[1];
        frontmatterText.split('\n').forEach(line => {
          const match = line.match(/^(\w+):\s*(.+)$/);
          if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            
            // Parse array values
            if (value.startsWith('[') && value.endsWith(']')) {
              value = value.slice(1, -1).split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
            }
            
            frontmatter[key] = value;
          }
        });
      }

      // Extract title from frontmatter or first heading
      let title = frontmatter.title || 'Meeting';
      const titleMatch = content.match(/^#\s+(.+)$/m);
      if (titleMatch && !frontmatter.title) {
        title = titleMatch[1].trim();
      }

      // Extract transcription from code block in details section
      let transcription = '';
      const transcriptionMatch = content.match(/<details>[\s\S]*?```[\s\S]*?```[\s\S]*?<\/details>/);
      if (transcriptionMatch) {
        const codeBlockMatch = transcriptionMatch[0].match(/```[\s\S]*?\n([\s\S]*?)\n```/);
        if (codeBlockMatch) {
          transcription = codeBlockMatch[1].trim();
        }
      }

      // Extract summary (content between "## Summary" and "---" or "## Full Transcription")
      const summaryMatch = content.match(/## Summary\s*\n([\s\S]*?)(?=\n---|\n## Full Transcription)/);
      let summary = '';
      if (summaryMatch) {
        summary = summaryMatch[1].trim();
      }

      // Extract participants from frontmatter
      let participants = [];
      if (frontmatter.participants) {
        participants = Array.isArray(frontmatter.participants) 
          ? frontmatter.participants 
          : [frontmatter.participants];
      }

      // Extract template ID
      const templateId = frontmatter.template_id || frontmatter.templateId || 'general';

      return {
        title,
        transcription,
        summary,
        templateId,
        participants,
        frontmatter,
        originalPath: notePath
      };
    } catch (error) {
      console.error('Failed to parse note:', error.message);
      throw error;
    }
  }

  /**
   * Update an existing note with a new summary (converted to different template)
   * @param {string} notePath - Path to the existing note file
   * @param {string} newSummary - New summary generated with different template
   * @param {string} newTemplateId - New template ID used
   */
  updateNote(notePath, newSummary, newTemplateId) {
    try {
      const parsed = this.parseNote(notePath);
      
      // Update the note with new summary and template
      const updatedNote = this.formatNote(
        newSummary,
        parsed.transcription,
        parsed.title,
        newTemplateId,
        parsed.participants
      );

      // Preserve original file modification time
      const stats = fs.statSync(notePath);
      
      fs.writeFileSync(notePath, updatedNote, 'utf-8');
      
      // Restore original modification time
      fs.utimesSync(notePath, stats.atime, stats.mtime);

      console.log('✅ Note updated successfully');
      return notePath;
    } catch (error) {
      console.error('❌ Failed to update note:', error.message);
      throw error;
    }
  }

  /**
   * List all meeting notes
   */
  listNotes() {
    try {
      if (!fs.existsSync(this.notesFolderPath)) {
        return [];
      }

      const files = fs.readdirSync(this.notesFolderPath)
        .filter(file => file.endsWith('.md'))
        .map(file => ({
          name: file,
          path: path.join(this.notesFolderPath, file),
          created: fs.statSync(path.join(this.notesFolderPath, file)).birthtime,
        }))
        .sort((a, b) => b.created - a.created);

      return files;
    } catch (error) {
      console.error('Failed to list notes:', error.message);
      return [];
    }
  }
}

module.exports = { NoteWriter };

