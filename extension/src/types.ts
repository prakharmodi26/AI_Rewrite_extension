export type Task = 'rewrite' | 'grammar' | 'summarize' | 'shorten' | 'expand';
export type Tone = 'formal' | 'friendly' | 'confident' | 'persuasive' | 'casual';
export type SummaryLevel = 'light' | 'medium' | 'heavy';
export type PercentLevel = 10 | 20 | 30 | 40 | 50 | 60;

export interface TransformRequestBody {
  task: Task;
  input: string;
  redact?: boolean;
  // One of the following fields may be required depending on task
  tone?: Tone; // for rewrite
  percent?: PercentLevel; // for shorten/expand
  summary_level?: SummaryLevel; // for summarize
}

export interface TransformResponseBody {
  output: string;
  model: string;
  latency_ms: number;
}

export interface AiActionMessage {
  type: 'AI_ACTION';
  task: Task;
  tone?: Tone; // for rewrite
  percent?: PercentLevel; // for shorten/expand
  summary_level?: SummaryLevel; // for summarize
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
  dismissOnOutsideClick?: boolean;
}

export interface HistoryItem {
  id: string;
  task: Task;
  output: string;
  ts: number;
  inputPreview?: string;
  tone?: Tone;
  percent?: PercentLevel;
  summary_level?: SummaryLevel;
}
