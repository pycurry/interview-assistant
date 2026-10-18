import { AIProvider, AppSettings, PromptMode, SpeakerTurn } from '../../shared/types';

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

export class LLMService {
  /**
   * Builds the system prompt based on mode and optional candidate context.
   */
  private static getSystemPrompt(mode: PromptMode, settings: AppSettings): string {
    let modeGuidance = '';

    switch (mode) {
      case 'coding':
        modeGuidance = `
You are an expert technical interview co-pilot assisting a candidate with live coding / DSA questions.
Structure your response concisely:
1. **Core Pattern**: 1-2 sentence identification (e.g. "Two pointers with sliding window", "Monotonic stack").
2. **Algorithm Steps**: 3-4 bullet points describing the optimal approach.
3. **Clean Code**: Provide the clean, idiomatic code snippet in the interviewer's requested language (or Python/TypeScript if unspecified).
4. **Complexity & Edge Cases**: Time O(...), Space O(...), and critical edge cases to mention to the interviewer.
Keep explanations brief so the candidate can read at a glance while speaking.`;
        break;

      case 'system-design':
        modeGuidance = `
You are an elite principal engineer co-pilot for a live System Design interview.
Format your output in high-impact talking points:
1. **Scope & Estimates**: Functional requirements, traffic/storage back-of-the-envelope calculations.
2. **High-Level Architecture**: Core services, API signatures, load balancers, database choices (SQL vs NoSQL).
3. **Deep Dive & Tradeoffs**: Caching (Redis), messaging (Kafka), consistency vs availability (CAP), data partitioning.
4. **Failure Modes**: Single points of failure, rate limiting, disaster recovery.`;
        break;

      case 'behavioral':
        modeGuidance = `
You are a senior executive interview coach guiding the candidate through a behavioral interview question.
Use the **STAR** method (Situation, Task, Action, Result):
- **Situation & Task**: Brief setup (1-2 sentences).
- **Actions Taken**: 3 concrete, high-ownership steps taken ("I led...", "I resolved...").
- **Measurable Result**: Quantifiable impact and key reflection/learnings.
Keep tone humble yet decisive.`;
        break;

      case 'rapid-bullet':
      default:
        modeGuidance = `
You are an ultra-fast live interview teleprompter assistant.
Provide 3-5 punchy, bulleted talking points that the candidate can immediately speak out loud. No long introductions or disclaimers. Direct answers only.`;
        break;
    }

    let grounding = '';
    if (settings.resumeText) {
      grounding += `\n\nCANDIDATE'S BACKGROUND & RESUME SUMMARY:\n${settings.resumeText.slice(0, 2000)}`;
    }
    if (settings.jobDescriptionText) {
      grounding += `\n\nTARGET JOB DESCRIPTION & REQUIREMENTS:\n${settings.jobDescriptionText.slice(0, 2000)}`;
    }

    return `You are a real-time invisible interview co-pilot. Your guidance must be immediately actionable, technically impeccable, and easy to read during a live conversation.${modeGuidance}${grounding}`;
  }

  /**
   * Formats the recent conversation history into messages.
   */
  private static formatConversation(turns: SpeakerTurn[]): { role: 'user' | 'assistant'; content: string }[] {
    const recentTurns = turns.slice(-10);
    return recentTurns.map((turn) => ({
      role: turn.speaker === 'interviewer' ? 'user' : 'assistant',
      content: `[${turn.speaker.toUpperCase()}]: ${turn.text}`,
    }));
  }

  /**
   * Streams a completion from the selected AI provider.
   */
  public static async streamResponse(
    turns: SpeakerTurn[],
    settings: AppSettings,
    callbacks: StreamCallbacks,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const provider = settings.activeProvider;
    const systemPrompt = this.getSystemPrompt(settings.promptMode, settings);
    const messages = this.formatConversation(turns);

    if (messages.length === 0) {
      callbacks.onError(new Error('No conversation turns to analyze.'));
      return;
    }

    try {
      switch (provider) {
        case 'gemini':
          await this.streamGemini(systemPrompt, messages, settings, callbacks, abortSignal);
          break;
        case 'openai':
          await this.streamOpenAI(systemPrompt, messages, settings, callbacks, abortSignal);
          break;
        case 'anthropic':
          await this.streamAnthropic(systemPrompt, messages, settings, callbacks, abortSignal);
          break;
        case 'deepseek':
          await this.streamDeepSeek(systemPrompt, messages, settings, callbacks, abortSignal);
          break;
        case 'groq':
          await this.streamGroq(systemPrompt, messages, settings, callbacks, abortSignal);
          break;
        case 'ollama':
        case 'custom':
          await this.streamOpenAICompatible(systemPrompt, messages, settings, callbacks, abortSignal);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      callbacks.onError(err);
    }
  }

  // 1. Google Gemini (SSE streamGenerateContent)
  private static async streamGemini(
    systemPrompt: string,
    messages: { role: string; content: string }[],
    settings: AppSettings,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ) {
    const apiKey = settings.geminiApiKey;
    if (!apiKey) throw new Error('Missing Gemini API Key. Please add it in Settings.');

    let model = settings.activeModel || 'gemini-3.8-flash';
    // Auto-migrate deprecated models to modern Gemini 3.8 equivalents
    if (model === 'gemini-2.5-flash' || model === 'gemini-1.5-flash') {
      model = 'gemini-3.8-flash';
    } else if (model === 'gemini-2.5-pro' || model === 'gemini-1.5-pro') {
      model = 'gemini-3.8-pro';
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Understood. I will provide concise, live interview guidance.' }] },
      ...messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
    ];

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({ contents }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errText}`);
    }

    await this.processSSE(response, (data) => {
      try {
        const json = JSON.parse(data);
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) callbacks.onToken(text);
      } catch (e) {
        // SSE framing line
      }
    }, callbacks);
  }

  // 2. OpenAI
  private static async streamOpenAI(
    systemPrompt: string,
    messages: { role: string; content: string }[],
    settings: AppSettings,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ) {
    const apiKey = settings.openaiApiKey;
    if (!apiKey) throw new Error('Missing OpenAI API Key. Please configure it in Settings.');

    const model = settings.activeModel || 'gpt-4o';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errText}`);
    }

    await this.processSSE(response, (data) => {
      if (data.trim() === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const token = json.choices?.[0]?.delta?.content;
        if (token) callbacks.onToken(token);
      } catch (e) {}
    }, callbacks);
  }

  // 3. Anthropic Claude
  private static async streamAnthropic(
    systemPrompt: string,
    messages: { role: string; content: string }[],
    settings: AppSettings,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ) {
    const apiKey = settings.anthropicApiKey;
    if (!apiKey) throw new Error('Missing Anthropic API Key. Please configure it in Settings.');

    const model = settings.activeModel || 'claude-3-5-sonnet-20241022';
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages,
        max_tokens: 1024,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errText}`);
    }

    await this.processSSE(response, (data) => {
      try {
        const json = JSON.parse(data);
        if (json.type === 'content_block_delta' && json.delta?.text) {
          callbacks.onToken(json.delta.text);
        }
      } catch (e) {}
    }, callbacks);
  }

  // 4. DeepSeek
  private static async streamDeepSeek(
    systemPrompt: string,
    messages: { role: string; content: string }[],
    settings: AppSettings,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ) {
    const apiKey = settings.deepseekApiKey;
    if (!apiKey) throw new Error('Missing DeepSeek API Key. Please add it in Settings.');

    const model = settings.activeModel || 'deepseek-chat';
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API error (${response.status}): ${errText}`);
    }

    await this.processSSE(response, (data) => {
      if (data.trim() === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const token = json.choices?.[0]?.delta?.content;
        if (token) callbacks.onToken(token);
      } catch (e) {}
    }, callbacks);
  }

  // 5. Groq
  private static async streamGroq(
    systemPrompt: string,
    messages: { role: string; content: string }[],
    settings: AppSettings,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ) {
    const apiKey = settings.groqApiKey;
    if (!apiKey) throw new Error('Missing Groq API Key. Please add it in Settings.');

    const model = settings.activeModel || 'llama-3.3-70b-versatile';
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errText}`);
    }

    await this.processSSE(response, (data) => {
      if (data.trim() === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const token = json.choices?.[0]?.delta?.content;
        if (token) callbacks.onToken(token);
      } catch (e) {}
    }, callbacks);
  }

  // 6. Generic OpenAI-Compatible / Ollama
  private static async streamOpenAICompatible(
    systemPrompt: string,
    messages: { role: string; content: string }[],
    settings: AppSettings,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ) {
    let url = settings.customApiUrl || 'http://localhost:11434/v1';
    if (!url.endsWith('/chat/completions')) {
      url = url.replace(/\/+$/, '') + '/chat/completions';
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (settings.customApiKey) {
      headers['Authorization'] = `Bearer ${settings.customApiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: settings.activeModel || 'llama3.2',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Custom endpoint error (${response.status}): ${errText}`);
    }

    await this.processSSE(response, (data) => {
      if (data.trim() === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const token = json.choices?.[0]?.delta?.content;
        if (token) callbacks.onToken(token);
      } catch (e) {}
    }, callbacks);
  }

  /**
   * Helper utility for streaming Server-Sent Events (SSE).
   */
  private static async processSSE(
    response: Response,
    onDataChunk: (data: string) => void,
    callbacks: StreamCallbacks
  ) {
    if (!response.body) throw new Error('Response body is null');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const payload = trimmed.slice(5).trim();
          onDataChunk(payload);
        }
      }
    }

    callbacks.onComplete(accumulated);
  }
}
