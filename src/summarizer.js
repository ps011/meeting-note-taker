const axios = require('axios');
const { getTemplate, buildPromptFromTemplate } = require('./templates.js');

/**
 * Summarizer service using local Llama LLM
 */
class LlamaSummarizer {
  constructor(apiUrl, model) {
    this.apiUrl = apiUrl;
    this.model = model;
  }

  /**
   * Summarize transcription using Llama
   * @param {string} transcription - The meeting transcription
   * @param {string} meetingTitle - Title of the meeting
   * @param {string} templateId - Template ID to use for the prompt
   */
  async summarize(
    transcription,
    meetingTitle = 'Meeting',
    templateId = 'general'
  ) {
    try {
      const template = getTemplate(templateId);
      const prompt = buildPromptFromTemplate(
        template,
        transcription,
        meetingTitle
      );

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 300000,
        }
      );

      let summary = '';

      if (response.data.response) {
        summary = response.data.response;
      } else if (response.data.text) {
        summary = response.data.text;
      } else {
        throw new Error('Unexpected response format from Llama API');
      }

      return summary.trim();
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
      } else {
      }
      throw error;
    }
  }
}

module.exports = { LlamaSummarizer };
