const axios = require('axios');

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
   */
  async summarize(transcription, meetingTitle = 'Meeting') {
    try {
      console.log('🤖 Generating summary with Llama...');
      console.log(`   Model: ${this.model}`);
      console.log(`   API: ${this.apiUrl}`);

      const prompt = this.buildPrompt(transcription, meetingTitle);

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
          }
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

      console.log('✅ Summary generated');
      console.log(`   Length: ${summary.length} characters`);
      
      return summary.trim();
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.error('❌ Cannot connect to Llama API. Make sure Ollama is running.');
        console.error('   Start Ollama with: ollama serve');
      } else {
        console.error('❌ Summarization failed:', error.message);
      }
      throw error;
    }
  }

  /**
   * Build the prompt for Llama
   */
  buildPrompt(transcription, meetingTitle) {
    return `You are an expert meeting note-taker. Analyze the following meeting transcription and create a comprehensive summary in markdown format.

Meeting Title: ${meetingTitle}

Transcription:
${transcription}

Please create a well-structured summary with the following sections:
1. **Meeting Overview** - Brief description of the meeting
2. **Key Discussion Points** - Main topics discussed
3. **Decisions Made** - Any decisions or agreements reached
4. **Action Items** - Tasks assigned with responsible parties (if mentioned)
5. **Next Steps** - Follow-up actions or future meetings

Format your response in clean markdown. Be concise but thorough.`;
  }
}

module.exports = { LlamaSummarizer };

