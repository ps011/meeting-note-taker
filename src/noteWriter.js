const fs = require('fs');
const path = require('path');

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
   */
  saveNote(summary, transcription, meetingTitle = 'Meeting') {
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

      const noteContent = this.formatNote(summary, transcription, meetingTitle);

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
   * Format the meeting note in markdown
   */
  formatNote(summary, transcription, meetingTitle) {
    const now = new Date();
    const date = this.formatDate(now, 'MMMM dd, yyyy');
    const time = this.formatDate(now, 'HH:mm');

    return `---
title: ${meetingTitle}
date: ${date}
time: ${time}
tags: [meeting, notes, auto-generated]
---

# ${meetingTitle}

**Date:** ${date}  
**Time:** ${time}

---

${summary}

---

## Full Transcription

<details>
<summary>Click to expand full transcription</summary>

${transcription}

</details>

---

*Note: This meeting summary was automatically generated using AI transcription and summarization.*
`;
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

