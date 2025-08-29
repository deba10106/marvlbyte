import axios from 'axios';
import type { AppConfig } from './config';

export type AIMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export class AiService {
  private provider: AppConfig['ai']['provider'];
  // Ollama
  private host: string | null = null;
  private model: string | null = null;
  // OpenAI
  private openai?: { apiKey: string; host: string; model: string };
  // Gemini
  private gemini?: { apiKey: string; host: string; model: string };

  constructor(cfg: AppConfig) {
    this.provider = cfg.ai.provider;
    if (this.provider === 'ollama') {
      this.host = cfg.ai.ollama.host.replace(/\/$/, '');
      this.model = cfg.ai.ollama.model;
    } else if (this.provider === 'openai') {
      const c = cfg.ai.openai!;
      this.openai = { apiKey: c.apiKey, host: (c.host || 'https://api.openai.com/v1').replace(/\/$/, ''), model: c.model };
    } else if (this.provider === 'gemini') {
      const c = cfg.ai.gemini!;
      this.gemini = { apiKey: c.apiKey, host: (c.host || 'https://generativelanguage.googleapis.com').replace(/\/$/, ''), model: c.model };
    }
  }

  async chat(messages: AIMessage[]): Promise<string> {
    if (this.provider === 'ollama') return this.chatOllama(messages);
    if (this.provider === 'openai') return this.chatOpenAI(messages);
    if (this.provider === 'gemini') return this.chatGemini(messages);
    throw new Error('Unsupported AI provider');
  }

  private async chatOllama(messages: AIMessage[]): Promise<string> {
    const url = `${this.host}/api/chat`;
    const model = this.model!;
    // Stream response and assemble
    const controller = new AbortController();
    const res = await axios.post(
      url,
      { model, messages, stream: true, options: { num_predict: 256 } },
      { responseType: 'stream', timeout: 0, signal: controller.signal }
    );
    return await new Promise<string>((resolve, reject) => {
      let buffer = '';
      let idleTimer: NodeJS.Timeout | null = null;
      const resetIdle = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          try { controller.abort(); } catch {}
          reject(new Error('AI stream idle timeout'));
        }, 120_000);
      };
      resetIdle();
      res.data.on('data', (chunk: Buffer) => {
        resetIdle();
        const lines = chunk.toString('utf8').split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            if (obj?.message?.content) buffer += obj.message.content;
            if (obj?.done) {
              if (idleTimer) clearTimeout(idleTimer);
              resolve(buffer);
            }
          } catch {
            // ignore partial JSON lines
          }
        }
      });
      res.data.on('end', () => {
        if (idleTimer) clearTimeout(idleTimer);
        resolve(buffer);
      });
      res.data.on('error', (err: Error) => {
        if (idleTimer) clearTimeout(idleTimer);
        reject(err);
      });
    });
  }

  private async chatOpenAI(messages: AIMessage[]): Promise<string> {
    const cfg = this.openai!;
    const url = `${cfg.host}/chat/completions`;
    const payload = {
      model: cfg.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: 0.2,
      stream: false,
    } as const;
    const res = await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      timeout: 120_000,
    });
    const txt: string = res.data?.choices?.[0]?.message?.content || '';
    return txt;
  }

  private async chatGemini(messages: AIMessage[]): Promise<string> {
    const cfg = this.gemini!;
    // Preflight validation for clearer errors
    if (!cfg.apiKey || cfg.apiKey.trim() === '') {
      throw new Error(
        'Gemini API key is missing. Set GEMINI_API_KEY in your environment or set ai.gemini.apiKey in your Comet config (e.g., ~/.config/comet/config.yaml).'
      );
    }
    const model = cfg.model;
    const url = `${cfg.host}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
    // Map system to user role; map assistant to model role
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const payload = { contents } as const;
    try {
      const res = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 120_000 });
      const parts = res.data?.candidates?.[0]?.content?.parts || [];
      const txt = parts.map((p: any) => p?.text || '').join('');
      return txt;
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const apiMsg = (err.response?.data as any)?.error?.message;
        const hint =
          status === 401 || status === 403 || url.endsWith('key=')
            ? 'Check GEMINI_API_KEY or ai.gemini.apiKey and ensure it has access.'
            : '';
        throw new Error(`Gemini request failed (${status ?? 'network'}): ${apiMsg || err.message}. ${hint}`.trim());
      }
      throw err;
    }
  }
}
