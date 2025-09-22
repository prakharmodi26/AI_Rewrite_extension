import { Settings, Tone, HistoryItem } from './types.js';

const DEFAULTS = {
  serverUrl: 'http://localhost:8080',
  defaultTone: 'friendly' as Tone,
  redact: false,
  dismissOnOutsideClick: true,
};

async function ensureInstallId(): Promise<string> {
  const { installId } = await chrome.storage.local.get('installId');
  if (installId && typeof installId === 'string') return installId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ installId: id });
  return id;
}

export async function getSettings(): Promise<Settings> {
  const sync = await chrome.storage.sync.get(['serverUrl', 'defaultTone', 'redact', 'dismissOnOutsideClick']);
  const local = await chrome.storage.local.get(['secret', 'installId']);
  const installId = local.installId || (await ensureInstallId());
  const allowedTones: Tone[] = ['friendly', 'formal', 'confident', 'persuasive', 'casual'];
  const rawTone = (sync.defaultTone as string) || '';
  const safeTone: Tone = allowedTones.includes(rawTone as Tone) ? (rawTone as Tone) : DEFAULTS.defaultTone;
  return {
    serverUrl: sync.serverUrl || DEFAULTS.serverUrl,
    defaultTone: safeTone,
    redact: typeof sync.redact === 'boolean' ? sync.redact : DEFAULTS.redact,
    dismissOnOutsideClick: typeof sync.dismissOnOutsideClick === 'boolean' ? sync.dismissOnOutsideClick : DEFAULTS.dismissOnOutsideClick,
    secret: typeof local.secret === 'string' ? local.secret : undefined,
    installId,
  };
}

export async function setSyncSettings(partial: Partial<Pick<Settings, 'serverUrl' | 'defaultTone' | 'redact' | 'dismissOnOutsideClick'>>): Promise<void> {
  await chrome.storage.sync.set(partial);
}

export async function setLocalSettings(partial: Partial<Pick<Settings, 'secret' | 'installId'>>): Promise<void> {
  await chrome.storage.local.set(partial);
}

export async function regenerateInstallId(): Promise<string> {
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ installId: id });
  return id;
}

export async function getHistory(): Promise<HistoryItem[]> {
  const { history } = await chrome.storage.local.get('history');
  if (Array.isArray(history)) return history as HistoryItem[];
  return [];
}

export async function addHistoryItem(item: Omit<HistoryItem, 'id' | 'ts'> & Partial<Pick<HistoryItem, 'id' | 'ts'>>): Promise<void> {
  const current = await getHistory();
  const full: HistoryItem = {
    id: item.id || crypto.randomUUID(),
    ts: item.ts || Date.now(),
    task: item.task,
    output: item.output,
    inputPreview: item.inputPreview,
    tone: item.tone,
    percent: item.percent,
    summary_level: item.summary_level,
  };
  const updated = [full, ...current].slice(0, 10);
  await chrome.storage.local.set({ history: updated });
}
