export type Task = 'rewrite' | 'summarize';
export type Tone = 'clear' | 'friendly' | 'concise' | 'formal' | 'grammar';

export interface TransformRequestBody {
  task: Task;
  tone: Tone;
  input: string;
  redact: boolean;
}

export interface TransformResponseBody {
  output: string;
  model: string;
  latency_ms: number;
}

export interface AiActionMessage {
  type: 'AI_ACTION';
  task: Task;
  tone?: Tone; // for summarize, tone may be ignored
}

export interface ToastMessage {
  type: 'AI_TOAST';
  text: string;
  level?: 'info' | 'error';
}

export interface Settings {
  serverUrl: string;
  defaultTone: Tone;
  redact: boolean;
  secret?: string; // dev-only; stored locally
  installId: string;
}
